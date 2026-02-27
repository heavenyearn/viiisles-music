import { DateUtils } from './date-utils.js';
import { Storage } from './storage.js';
import { MusicPlayer } from './player.js';

class App {
    constructor() {
        this.songs = [];
        this.currentSong = null;
        this.player = null;
        this.isHistoryPage = window.location.pathname.includes('history.html');
        this.init();
    }

    async init() {
        try {
            await this.loadSongs();
            if (this.isHistoryPage) {
                this.renderHistory();
            } else {
                this.initPlayer();
                this.renderHome();
            }
        } catch (e) {
            console.error('Initialization error:', e);
            alert('Failed to load application data.');
        }
    }

    async loadSongs() {
        const response = await fetch('data/songs.json');
        const data = await response.json();
        this.songs = data.songs;
    }

    getSongForDate(dateStr) {
        return this.songs.find(s => s.date === dateStr);
    }

    getCurrentDisplayDate() {
        // Check URL params for date override
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');
        if (dateParam) return dateParam;

        return DateUtils.getTodayString();
    }

    initPlayer() {
        this.player = new MusicPlayer({
            onTimeUpdate: (current, total) => this.updateProgress(current, total),
            onEnded: () => this.handleSongEnd(),
            onPlay: () => this.updatePlayButton(true),
            onPause: () => this.updatePlayButton(false),
            onError: (e) => console.error('Player error:', e)
        });

        this.bindPlayerControls();
    }

    renderHome() {
        const dateStr = this.getCurrentDisplayDate();
        const song = this.getSongForDate(dateStr);

        // UI Elements
        const dateDisplay = document.getElementById('current-date');
        const bgLayer = document.getElementById('bg-layer');
        const albumArt = document.getElementById('album-art');
        const titleEl = document.getElementById('song-title');
        const artistEl = document.getElementById('artist-name');
        const recEl = document.getElementById('recommendation-text');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        // Set Date
        dateDisplay.textContent = DateUtils.formatDate(dateStr);

        // Navigation Logic
        const today = DateUtils.getTodayString();
        // Disable next button if date is today or future (unless we have future songs)
        // For this app, let's assume we can't see future songs unless we are debugging
        if (dateStr >= today) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = 0.5;
        } else {
            nextBtn.onclick = () => {
                const nextDay = DateUtils.getNextDay(dateStr);
                window.location.search = `?date=${nextDay}`;
            };
        }

        prevBtn.onclick = () => {
            const prevDay = DateUtils.getPrevDay(dateStr);
            window.location.search = `?date=${prevDay}`;
        };

        if (song) {
            this.currentSong = song;
            
            // Update UI
            document.title = `${song.title} - Daily Song`;
            titleEl.textContent = song.title;
            artistEl.textContent = song.artist;
            recEl.textContent = song.recommendation;
            
            albumArt.src = song.coverImage;
            bgLayer.style.backgroundImage = `url('${song.backgroundImage || song.coverImage}')`;

            // Load audio
            this.player.load(song.audioFile);
            
            // Restore volume preference
            const prefs = Storage.getPreferences();
            this.player.setVolume(prefs.volume);
            document.getElementById('volume-slider').value = prefs.volume;

        } else {
            // No song for this date
            titleEl.textContent = "No song for this date";
            artistEl.textContent = "Check back later!";
            recEl.textContent = "";
            albumArt.src = "assets/images/default-cover.jpg"; // Should exist or handle error
            document.getElementById('play-pause-btn').disabled = true;
            document.getElementById('main-play-btn').style.display = 'none';
        }
    }

    bindPlayerControls() {
        const playBtn = document.getElementById('play-pause-btn');
        const mainPlayBtn = document.getElementById('main-play-btn');
        const seekSlider = document.getElementById('seek-slider');
        const volumeSlider = document.getElementById('volume-slider');
        const playOverlay = document.getElementById('play-overlay');

        const togglePlay = () => {
            if (this.currentSong) {
                this.player.toggle();
                Storage.saveHistory(this.currentSong.date);
            }
        };

        playBtn.onclick = togglePlay;
        mainPlayBtn.onclick = togglePlay;
        
        // Also toggle when clicking the overlay
        playOverlay.onclick = (e) => {
            if (e.target === playOverlay) togglePlay();
        };

        seekSlider.oninput = (e) => {
            const time = (e.target.value / 100) * this.player.audio.duration;
            this.player.seek(time);
        };

        volumeSlider.oninput = (e) => {
            const val = parseFloat(e.target.value);
            this.player.setVolume(val);
            Storage.savePreferences({ volume: val });
        };
    }

    updateProgress(current, total) {
        const seekSlider = document.getElementById('seek-slider');
        const timeDisplay = document.getElementById('current-time');
        const durationDisplay = document.getElementById('duration');

        if (!isNaN(total)) {
            const progress = (current / total) * 100;
            seekSlider.value = progress;
            durationDisplay.textContent = this.formatTime(total);
        }
        timeDisplay.textContent = this.formatTime(current);
    }

    updatePlayButton(isPlaying) {
        const btn = document.getElementById('play-pause-btn');
        const mainBtn = document.getElementById('main-play-btn');
        const overlay = document.getElementById('play-overlay');
        const art = document.getElementById('album-art');

        if (isPlaying) {
            btn.textContent = '⏸';
            mainBtn.style.display = 'none'; // Hide big play button
            overlay.style.opacity = '0'; // Hide overlay
            art.classList.add('playing');
        } else {
            btn.textContent = '▶';
            mainBtn.style.display = 'block';
            overlay.style.opacity = '1';
            art.classList.remove('playing');
        }
    }

    handleSongEnd() {
        this.updatePlayButton(false);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    renderHistory() {
        const listContainer = document.getElementById('history-list');
        listContainer.innerHTML = '';
        const today = DateUtils.getTodayString();

        // Filter songs up to today and sort by date descending
        const historySongs = this.songs
            .filter(s => s.date <= today)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (historySongs.length === 0) {
            listContainer.innerHTML = '<p>No history available.</p>';
            return;
        }

        historySongs.forEach(song => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-date">${DateUtils.formatDate(song.date)}</div>
                <img src="${song.coverImage}" alt="cover" class="history-cover">
                <div class="history-info">
                    <div class="history-title">${song.title}</div>
                    <div class="history-artist">${song.artist}</div>
                </div>
                <a href="index.html?date=${song.date}" class="play-link">▶</a>
            `;
            listContainer.appendChild(item);
        });
    }
}

// Start the app
window.addEventListener('DOMContentLoaded', () => {
    new App();
});
