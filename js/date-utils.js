/**
 * Date utility functions for Daily Song website
 */

export const DateUtils = {
    /**
     * Get today's date in YYYY-MM-DD format
     * @returns {string} Date string
     */
    getTodayString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Format date string to readable format (e.g., "February 27, 2026")
     * @param {string} dateStr - Date string in YYYY-MM-DD format
     * @returns {string} Formatted date string
     */
    formatDate(dateStr) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        try {
            // Handle potential timezone issues by appending T00:00:00
            const date = new Date(dateStr + 'T00:00:00');
            return date.toLocaleDateString('en-US', options);
        } catch (e) {
            console.error('Error formatting date:', e);
            return dateStr;
        }
    },

    /**
     * Get previous day string in YYYY-MM-DD format
     * @param {string} dateStr - Current date string
     * @returns {string} Previous date string
     */
    getPrevDay(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        date.setDate(date.getDate() - 1);
        return this.getDateString(date);
    },

    /**
     * Get next day string in YYYY-MM-DD format
     * @param {string} dateStr - Current date string
     * @returns {string} Next date string
     */
    getNextDay(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        date.setDate(date.getDate() + 1);
        return this.getDateString(date);
    },

    /**
     * Helper to get YYYY-MM-DD from Date object
     * @param {Date} date 
     * @returns {string}
     */
    getDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};
