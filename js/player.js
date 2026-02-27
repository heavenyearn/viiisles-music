/**
 * Music Player Class
 * Handles audio playback and controls
 */

export class MusicPlayer {
    constructor(callbacks) {
        this.audio = new Audio();
        this.audio.loop = true; // Enable loop by default
        this.callbacks = callbacks || {}; // onTimeUpdate, onEnded, onPlay, onPause, onError
        this.initEvents();
    }

    initEvents() {
        this.audio.addEventListener('timeupdate', () => {
            if (this.callbacks.onTimeUpdate) {
                this.callbacks.onTimeUpdate(this.audio.currentTime, this.audio.duration);
            }
        });

        this.audio.addEventListener('ended', () => {
            if (this.callbacks.onEnded) {
                this.callbacks.onEnded();
            }
        });

        this.audio.addEventListener('play', () => {
            if (this.callbacks.onPlay) this.callbacks.onPlay();
        });

        this.audio.addEventListener('pause', () => {
            if (this.callbacks.onPause) this.callbacks.onPause();
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            if (this.callbacks.onError) this.callbacks.onError(e);
        });
        
        // Handle metadata loaded to get duration immediately
        this.audio.addEventListener('loadedmetadata', () => {
             if (this.callbacks.onTimeUpdate) {
                this.callbacks.onTimeUpdate(this.audio.currentTime, this.audio.duration);
            }
        });
    }

    /**
     * Load a song source
     * @param {string} src - Audio file URL
     */
    load(src) {
        this.audio.src = src;
        this.audio.load();
    }

    play() {
        // Handle promise returned by play() to avoid uncaught errors
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Playback prevented:', error);
                if (this.callbacks.onError) this.callbacks.onError(error);
            });
        }
    }

    pause() {
        this.audio.pause();
    }

    toggle() {
        if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    /**
     * Set volume (0.0 to 1.0)
     * @param {number} value 
     */
    setVolume(value) {
        this.audio.volume = Math.max(0, Math.min(1, value));
    }

    setMute(isMuted) {
        this.audio.muted = isMuted;
    }

    /**
     * Seek to time in seconds
     * @param {number} time 
     */
    seek(time) {
        if (isFinite(time)) {
            this.audio.currentTime = time;
        }
    }
}
