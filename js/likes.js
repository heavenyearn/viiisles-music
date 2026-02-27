/**
 * Likes Manager using CountAPI
 * No authentication required.
 * API: https://countapi.xyz/
 */

const NAMESPACE = 'viiisles-daily-song'; // Unique namespace for this app

export const LikesManager = {
    init() {
        // No initialization needed for CountAPI
    },

    /**
     * Get like count for a specific date
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<number>}
     */
    async getLikesCount(date) {
        try {
            // Check if key exists first to avoid creating keys on just viewing
            const response = await fetch(`https://api.countapi.xyz/get/${NAMESPACE}/${date}`);
            const data = await response.json();
            return data.value || 0;
        } catch (e) {
            console.warn('Error fetching likes (might be new key):', e);
            return 0;
        }
    },

    /**
     * Increment like count
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<number>} New count
     */
    async like(date) {
        try {
            // Hit endpoint increments by 1 and returns new value
            // If key doesn't exist, it creates it with value 1
            const response = await fetch(`https://api.countapi.xyz/hit/${NAMESPACE}/${date}`);
            const data = await response.json();
            return data.value;
        } catch (e) {
            console.error('Error saving like:', e);
            return 0;
        }
    }
};
