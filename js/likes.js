/**
 * Likes Manager using CounterAPI.dev
 * No authentication required.
 * API: https://counterapi.dev/
 */

const NAMESPACE = 'viiisles-music'; // Unique namespace for this app

export const LikesManager = {
    init() {
        // No initialization needed for CounterAPI
    },

    /**
     * Get like count for a specific date
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<number>}
     */
    async getLikesCount(date) {
        try {
            // Check if key exists first to avoid creating keys on just viewing
            const response = await fetch(`https://api.counterapi.dev/v1/${NAMESPACE}/${date}/`);
            
            // If the key is not found, CounterAPI returns 400 with "record not found"
            if (!response.ok) {
                if (response.status === 400 || response.status === 404) {
                    // Key not found is not an error, just means 0 likes
                    return 0;
                }
                throw new Error(`CounterAPI Error: ${response.status}`);
            }

            const data = await response.json();
            return data.count || 0;
        } catch (e) {
            console.warn('Error fetching likes:', e);
            // Fallback: If 'get' fails, it might be because the key was never created.
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
            // /up endpoint increments by 1. If key doesn't exist, creates it with value 1
            const response = await fetch(`https://api.counterapi.dev/v1/${NAMESPACE}/${date}/up`);
            
            if (!response.ok) {
                throw new Error(`CounterAPI Hit Error: ${response.status}`);
            }

            const data = await response.json();
            return data.count;
        } catch (e) {
            console.error('Error saving like:', e);
            return 0;
        }
    }
};
