/**
 * Local storage management for user preferences and history
 */

const KEYS = {
    HISTORY: 'daily_song_history',
    PREFERENCES: 'daily_song_preferences'
};

const DEFAULT_PREFERENCES = {
    volume: 0.7,
    autoPlay: false
};

export const Storage = {
    /**
     * Save played song to history
     * @param {string} date - Date string YYYY-MM-DD
     */
    saveHistory(date) {
        try {
            const history = this.getHistory();
            if (!history.includes(date)) {
                history.push(date);
                localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
            }
        } catch (e) {
            console.error('Error saving history:', e);
        }
    },

    /**
     * Get play history
     * @returns {string[]} Array of date strings
     */
    getHistory() {
        try {
            const data = localStorage.getItem(KEYS.HISTORY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading history:', e);
            return [];
        }
    },

    /**
     * Save user preferences
     * @param {Object} prefs - Preferences object
     */
    savePreferences(prefs) {
        try {
            const current = this.getPreferences();
            const updated = { ...current, ...prefs };
            localStorage.setItem(KEYS.PREFERENCES, JSON.stringify(updated));
        } catch (e) {
            console.error('Error saving preferences:', e);
        }
    },

    /**
     * Get user preferences
     * @returns {Object} Preferences object
     */
    getPreferences() {
        try {
            const data = localStorage.getItem(KEYS.PREFERENCES);
            return data ? JSON.parse(data) : DEFAULT_PREFERENCES;
        } catch (e) {
            console.error('Error reading preferences:', e);
            return DEFAULT_PREFERENCES;
        }
    }
};
