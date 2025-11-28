// Storage Adapter - Abstract Interface
// Architecture v3.0.0 - Data Layer Core

(function() {
    'use strict';

    /**
     * Abstract interface for storage backends.
     * All storage implementations must implement these methods.
     *
     * Implementations: IndexedDBStorage, LocalStorageAdapter, MemoryStorage
     *
     * @abstract
     */
    class StorageAdapter {
        /**
         * Get a value by key
         *
         * @abstract
         * @param {string} key - Storage key
         * @returns {Promise<any>} Stored value or null if not found
         * @throws {Error} If not implemented
         */
        async get(key) {
            throw new Error('StorageAdapter.get() not implemented');
        }

        /**
         * Set a value by key
         *
         * @abstract
         * @param {string} key - Storage key
         * @param {any} value - Value to store
         * @returns {Promise<void>}
         * @throws {Error} If not implemented
         */
        async set(key, value) {
            throw new Error('StorageAdapter.set() not implemented');
        }

        /**
         * Delete a value by key
         *
         * @abstract
         * @param {string} key - Storage key
         * @returns {Promise<void>}
         * @throws {Error} If not implemented
         */
        async delete(key) {
            throw new Error('StorageAdapter.delete() not implemented');
        }

        /**
         * Clear all stored values
         *
         * @abstract
         * @returns {Promise<void>}
         * @throws {Error} If not implemented
         */
        async clear() {
            throw new Error('StorageAdapter.clear() not implemented');
        }

        /**
         * Get all storage keys
         *
         * @abstract
         * @returns {Promise<string[]>} Array of all keys
         * @throws {Error} If not implemented
         */
        async keys() {
            throw new Error('StorageAdapter.keys() not implemented');
        }

        /**
         * Check if a key exists
         *
         * @abstract
         * @param {string} key - Storage key
         * @returns {Promise<boolean>} True if key exists
         * @throws {Error} If not implemented
         */
        async has(key) {
            throw new Error('StorageAdapter.has() not implemented');
        }
    }

    // Export to window
    window.StorageAdapter = StorageAdapter;

})();
