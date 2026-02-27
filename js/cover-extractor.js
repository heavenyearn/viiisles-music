const textDecoderLatin1 = new TextDecoder('latin1');

function readU32BE(view, offset) {
    return (
        (view.getUint8(offset) << 24) |
        (view.getUint8(offset + 1) << 16) |
        (view.getUint8(offset + 2) << 8) |
        view.getUint8(offset + 3)
    ) >>> 0;
}

function readSynchsafeU32(view, offset) {
    return (
        ((view.getUint8(offset) & 0x7f) << 21) |
        ((view.getUint8(offset + 1) & 0x7f) << 14) |
        ((view.getUint8(offset + 2) & 0x7f) << 7) |
        (view.getUint8(offset + 3) & 0x7f)
    ) >>> 0;
}

function findNullTerminated(data, start, encodingByte) {
    if (encodingByte === 1 || encodingByte === 2) {
        for (let i = start; i + 1 < data.length; i += 2) {
            if (data[i] === 0x00 && data[i + 1] === 0x00) return i + 2;
        }
        return data.length;
    }
    for (let i = start; i < data.length; i += 1) {
        if (data[i] === 0x00) return i + 1;
    }
    return data.length;
}

function parseApicFrame(frameData) {
    if (!frameData || frameData.length < 10) return null;
    const encoding = frameData[0];
    let offset = 1;

    let mimeEnd = offset;
    while (mimeEnd < frameData.length && frameData[mimeEnd] !== 0x00) mimeEnd += 1;
    const mime = textDecoderLatin1.decode(frameData.slice(offset, mimeEnd)).trim() || 'image/jpeg';
    offset = Math.min(mimeEnd + 1, frameData.length);

    offset = Math.min(offset + 1, frameData.length);

    offset = findNullTerminated(frameData, offset, encoding);
    if (offset >= frameData.length) return null;

    const imageBytes = frameData.slice(offset);
    if (!imageBytes.length) return null;
    return { mime, imageBytes };
}

function parsePicFrameV22(frameData) {
    if (!frameData || frameData.length < 10) return null;
    const encoding = frameData[0];
    const imageFormat = textDecoderLatin1.decode(frameData.slice(1, 4)).trim().toLowerCase();
    let mime = 'image/jpeg';
    if (imageFormat === 'png') mime = 'image/png';
    if (imageFormat === 'jpg') mime = 'image/jpeg';
    let offset = 4;
    offset = Math.min(offset + 1, frameData.length);
    offset = findNullTerminated(frameData, offset, encoding);
    if (offset >= frameData.length) return null;
    const imageBytes = frameData.slice(offset);
    if (!imageBytes.length) return null;
    return { mime, imageBytes };
}

function parseId3CoverFromBuffer(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 10) return null;
    if (String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2)) !== 'ID3') return null;

    const major = view.getUint8(3);
    const flags = view.getUint8(5);
    const tagSize = readSynchsafeU32(view, 6);
    const tagEnd = Math.min(10 + tagSize, view.byteLength);
    let offset = 10;

    const hasExtendedHeader = (flags & 0x40) !== 0;
    if (hasExtendedHeader) {
        if (offset + 4 > tagEnd) return null;
        const extSize = major === 4 ? readSynchsafeU32(view, offset) : readU32BE(view, offset);
        if (!extSize || extSize < 6) return null;
        offset = Math.min(offset + extSize, tagEnd);
    }

    if (major === 2) {
        while (offset + 6 <= tagEnd) {
            const id = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2));
            if (!id.trim()) break;
            const size = ((view.getUint8(offset + 3) << 16) | (view.getUint8(offset + 4) << 8) | view.getUint8(offset + 5)) >>> 0;
            const frameStart = offset + 6;
            const frameEnd = Math.min(frameStart + size, tagEnd);
            if (frameEnd <= frameStart) break;
            if (id === 'PIC') {
                const frameBytes = new Uint8Array(buffer.slice(frameStart, frameEnd));
                return parsePicFrameV22(frameBytes);
            }
            offset = frameEnd;
        }
        return null;
    }

    while (offset + 10 <= tagEnd) {
        const id = String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2),
            view.getUint8(offset + 3)
        );
        if (!id.trim()) break;

        const size = major === 4 ? readSynchsafeU32(view, offset + 4) : readU32BE(view, offset + 4);
        const frameStart = offset + 10;
        const frameEnd = Math.min(frameStart + size, tagEnd);
        if (frameEnd <= frameStart) break;

        if (id === 'APIC') {
            const frameBytes = new Uint8Array(buffer.slice(frameStart, frameEnd));
            return parseApicFrame(frameBytes);
        }

        offset = frameEnd;
    }

    return null;
}

async function fetchBytes(url, start, byteCount) {
    const endInclusive = start + byteCount - 1;

    try {
        const res = await fetch(url, {
            headers: {
                Range: `bytes=${start}-${endInclusive}`
            }
        });
        if (res.status === 206) return await res.arrayBuffer();
        const contentLength = res.headers.get('Content-Length');
        if (res.ok && contentLength && Number(contentLength) <= byteCount) return await res.arrayBuffer();
    } catch (_) {}

    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`fetch failed: ${res.status}`);

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;

    while (received < byteCount) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
    }

    try { await reader.cancel(); } catch (_) {}

    const out = new Uint8Array(Math.min(received, byteCount));
    let offset = 0;
    for (const chunk of chunks) {
        if (offset >= out.length) break;
        const slice = chunk.subarray(0, out.length - offset);
        out.set(slice, offset);
        offset += slice.length;
    }
    return out.buffer;
}

export class CoverExtractor {
    static #cache = new Map();

    static async getCoverObjectUrl(audioSrc) {
        try {
            const url = new URL(audioSrc, window.location.href);
            if (url.origin !== window.location.origin) return null;

            if (this.#cache.has(url.href)) return this.#cache.get(url.href);

            const headerBuf = await fetchBytes(url.href, 0, 10);
            const headerView = new DataView(headerBuf);
            if (headerView.byteLength < 10) return null;
            if (String.fromCharCode(headerView.getUint8(0), headerView.getUint8(1), headerView.getUint8(2)) !== 'ID3') return null;

            const tagSize = readSynchsafeU32(headerView, 6);
            const totalSize = 10 + tagSize;
            if (totalSize <= 10 || totalSize > 2_500_000) return null;

            const tagBuf = await fetchBytes(url.href, 0, totalSize);
            const parsed = parseId3CoverFromBuffer(tagBuf);
            if (!parsed) return null;

            const blob = new Blob([parsed.imageBytes], { type: parsed.mime });
            const objectUrl = URL.createObjectURL(blob);
            this.#cache.set(url.href, objectUrl);
            return objectUrl;
        } catch (_) {
            return null;
        }
    }
}
