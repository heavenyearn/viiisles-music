import { DateUtils } from './date-utils.js';
import { Storage } from './storage.js';
import { MusicPlayer } from './player.js';
import { CoverExtractor } from './cover-extractor.js';
import { LikesManager } from './likes.js';

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
            LikesManager.init();
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
            onError: (e) => {
                console.error('Player error:', e);
                // Try to detect 404/source errors
                 // Note: HTML5 Audio errors are generic, usually code 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) if 404
                 if (e.target && e.target.error && (e.target.error.code === 4 || e.target.error.code === 3)) {
                      this.showToast('这是往期的推荐啦，可以自行网易云查找资源哦', 'info');
                 } else {
                      this.showToast('播放出错，请重试', 'error');
                 }
                this.updatePlayButton(false);
            }
        });

        this.bindPlayerControls();
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'error') icon = '⚠️';
        if (type === 'success') icon = '✅';

        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        
        container.appendChild(toast);

        // Trigger reflow
        void toast.offsetWidth;
        
        // Show
        requestAnimationFrame(() => toast.classList.add('show'));

        // Hide after 3s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    renderHome() {
        const dateStr = this.getCurrentDisplayDate();
        const song = this.getSongForDate(dateStr);
        const today = DateUtils.getTodayString();

        // UI Elements
        const dateDisplay = document.getElementById('current-date');
        const bgLayer = document.getElementById('bg-layer');
        const albumArt = document.getElementById('album-art');
        const titleEl = document.getElementById('song-title');
        const artistEl = document.getElementById('artist-name');
        const recEl = document.getElementById('recommendation-text');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const likeBtn = document.getElementById('like-btn');

        // Set Date
        dateDisplay.textContent = DateUtils.formatDate(dateStr);

        // Navigation Logic
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
            
            // Determine dynamic recommendation text
            let recommendationText = "";
            if (dateStr === today) {
                recommendationText = "今日推荐";
            } else if (dateStr < today) {
                recommendationText = "往日回顾"; // Or "Past Recommendation"
            } else {
                recommendationText = "未来预告"; // Should not happen in normal flow
            }

            // Update UI
            document.title = `${song.title} - Daily Song`;
            titleEl.textContent = song.title;
            artistEl.textContent = song.artist;
            recEl.textContent = recommendationText;
            
            const fallbackCover = song.coverImage;
            const fallbackBg = song.backgroundImage || song.coverImage;

            albumArt.src = fallbackCover;
            bgLayer.style.backgroundImage = `url('${fallbackBg}')`;

            // Load audio
            this.player.load(song.audioFile);

            CoverExtractor.getCoverObjectUrl(song.audioFile).then((objectUrl) => {
                if (!objectUrl) return;
                if (!this.currentSong || this.currentSong.date !== song.date) return;
                albumArt.src = objectUrl;
                if (!song.backgroundImage || song.backgroundImage === song.coverImage) {
                    bgLayer.style.backgroundImage = `url('${objectUrl}')`;
                }
            });
            
            // Restore volume preference
            const prefs = Storage.getPreferences();
            this.player.setVolume(prefs.volume);
            document.getElementById('volume-slider').value = prefs.volume;
            if (likeBtn) {
                likeBtn.disabled = false;
                const isLiked = Storage.isLiked(song.date);
                this.setLikeButtonState(isLiked, 0); // 0 as placeholder
                
                // Fetch actual count
                LikesManager.getLikesCount(song.date).then(count => {
                    if (this.currentSong && this.currentSong.date === song.date) {
                        const currentLiked = Storage.isLiked(song.date);
                        this.setLikeButtonState(currentLiked, count);
                    }
                });
            }

        } else {
            // No song for this date
            titleEl.textContent = "No song for this date";
            artistEl.textContent = "Check back later!";
            recEl.textContent = "";
            albumArt.src = "assets/images/default-cover.jpg"; // Should exist or handle error
            document.getElementById('play-pause-btn').disabled = true;
            document.getElementById('main-play-btn').style.display = 'none';
            if (likeBtn) {
                likeBtn.disabled = true;
                this.setLikeButtonState(false);
            }
        }
    }

    bindPlayerControls() {
        const playBtn = document.getElementById('play-pause-btn');
        const mainPlayBtn = document.getElementById('main-play-btn');
        const seekSlider = document.getElementById('seek-slider');
        const volumeSlider = document.getElementById('volume-slider');
        const volumeBtn = document.getElementById('volume-btn');
        const playOverlay = document.getElementById('play-overlay');
        const likeBtn = document.getElementById('like-btn');

        const togglePlay = () => {
            if (this.currentSong) {
                this.player.toggle();
                Storage.saveHistory(this.currentSong.date);
            }
        };

        if (playBtn) playBtn.onclick = togglePlay;
        if (mainPlayBtn) mainPlayBtn.onclick = togglePlay;
        
        // Also toggle when clicking the overlay
        if (playOverlay) {
            playOverlay.onclick = (e) => {
                if (e.target === playOverlay) togglePlay();
            };
        }

        if (seekSlider) {
            seekSlider.oninput = (e) => {
                const time = (e.target.value / 100) * this.player.audio.duration;
                this.player.seek(time);
            };
        }

        if (volumeSlider) {
            volumeSlider.oninput = (e) => {
                const val = parseFloat(e.target.value);
                this.player.setVolume(val);
                Storage.savePreferences({ volume: val });
            };
        }
        
        // Mute/Unmute toggle
        if (volumeBtn) {
            volumeBtn.onclick = () => {
                const currentMute = this.player.audio.muted;
                this.player.setMute(!currentMute);
                volumeBtn.style.opacity = !currentMute ? '0.3' : '1';
            };
        }

        if (likeBtn) {
            likeBtn.onclick = async () => {
                if (!this.currentSong) return;
                
                // Optimistic update
                const liked = Storage.toggleLike(this.currentSong.date);
                let count = parseInt(likeBtn.dataset.count || 0);
                
                if (liked) {
                    count++;
                    LikesManager.like(this.currentSong.date).then(newCount => {
                        // Update with real count from server if still on same song
                        if (this.currentSong && this.currentSong.date === this.currentSong.date) {
                             this.setLikeButtonState(liked, newCount);
                        }
                    });
                } else {
                     count = Math.max(0, count - 1);
                     LikesManager.unlike(this.currentSong.date).then(newCount => {
                        if (this.currentSong && this.currentSong.date === this.currentSong.date) {
                             this.setLikeButtonState(liked, newCount);
                        }
                     });
                }
                
                this.setLikeButtonState(liked, count);
            };
        }
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
        const mainBtn = document.getElementById('main-play-btn');
        const overlay = document.getElementById('play-overlay');
        const art = document.getElementById('album-art');
        const artWrapper = document.querySelector('.album-art-wrapper');
        
        const playIcon = document.getElementById('play-icon');
        const pauseIcon = document.getElementById('pause-icon');

        if (isPlaying) {
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
            
            if (mainBtn) mainBtn.style.display = 'none'; // Hide big play button
            if (overlay) overlay.style.opacity = '0'; // Hide overlay
            if (art) art.classList.add('playing');
            if (artWrapper) artWrapper.classList.add('is-playing');
        } else {
            if (playIcon) playIcon.style.display = 'block';
            if (pauseIcon) pauseIcon.style.display = 'none';
            
            if (mainBtn) mainBtn.style.display = 'block';
            if (overlay) overlay.style.opacity = '1';
            if (art) art.classList.remove('playing');
            if (artWrapper) artWrapper.classList.remove('is-playing');
        }
    }

    setLikeButtonState(isLiked, count = 0) {
        const likeBtn = document.getElementById('like-btn');
        if (!likeBtn) return;
        
        const heartIcon = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="icon-heart"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        
        // If count is passed as number, update it. If not passed (or 0/undefined in some flows), keep existing if possible or default
        if (typeof count === 'number' && count > 0) {
            likeBtn.dataset.count = count;
            likeBtn.innerHTML = heartIcon + `<span class="like-count">${count}</span>`;
        } else {
             // Keep existing count or just show icon if no count yet
             const currentCount = likeBtn.dataset.count || '';
             likeBtn.innerHTML = heartIcon + (currentCount ? `<span class="like-count">${currentCount}</span>` : '');
        }
        
        likeBtn.classList.toggle('is-liked', isLiked);
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
