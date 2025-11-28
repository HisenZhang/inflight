// Memory Storage - In-Memory Storage Implementation
// Architecture v3.0.0 - Data Layer Storage Adapters

(function() {
    'use strict';

    /**
     * In-memory storage implementation.
     * Useful for testing and volatile caching.
     * Data is lost when page reloads.
     *
     * @extends StorageAdapter
     */
    class MemoryStorage extends window.StorageAdapter {
        constructor() {
            super();
            this._store = new Map();
        }

        /**
         * Get a value by key
         * @param {string} key - Storage key
         * @returns {Promise<any>} Stored value or null
         */
        async get(key) {
            const value = this._store.get(key);
            return value !== undefined ? value : null;
        }

        /**
         * Set a value by key
         * @param {string} key - Storage key
         * @param {any} value - Value to store
         * @returns {Promise<void>}
         */
        async set(key, value) {
            this._store.set(key, value);
        }

        /**
         * Delete a value by key
         * @param {string} key - Storage key
         * @returns {Promise<void>}
         */
        async delete(key) {
            this._store.delete(key);
        }

        /**
         * Clear all stored values
         * @returns {Promise<void>}
         */
        async clear() {
            this._store.clear();
        }

        /**
         * Get all storage keys
         * @returns {Promise<string[]>} Array of all keys
         */
        async keys() {
            return Array.from(this._store.keys());
        }

        /**
         * Check if a key exists
         * @param {string} key - Storage key
         * @returns {Promise<boolean>} True if key exists
         */
        async has(key) {
            return this._store.has(key);
        }

        /**
         * Get the number of stored items
         * @returns {number} Count of items
         */
        get size() {
            return this._store.size;
        }
    }

    // Export to window
    window.MemoryStorage = MemoryStorage;

})();
