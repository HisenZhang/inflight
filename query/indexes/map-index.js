// Map Index - Simple Key-Value Index
// Architecture v3.0.0 - Query Layer Indexes

(function() {
    'use strict';

    /**
     * Simple Map-based index for O(1) key lookups.
     * Best for: Direct key access (airport by ICAO, navaid by ident)
     *
     * @extends IndexStrategy
     */
    class MapIndex extends window.IndexStrategy {
        constructor() {
            super();
            this._map = new Map();
        }

        /**
         * Build index from data
         * @param {Map|Array} data - Map or Array of items
         * @returns {MapIndex} this for chaining
         */
        build(data) {
            this._map.clear();

            if (data instanceof Map) {
                for (const [key, value] of data) {
                    this._map.set(key, value);
                }
            } else if (Array.isArray(data)) {
                for (const item of data) {
                    const key = item.id || item.key || item.ident || item.icao;
                    if (key) {
                        this._map.set(key, item);
                    }
                }
            } else if (data && typeof data === 'object') {
                for (const [key, value] of Object.entries(data)) {
                    this._map.set(key, value);
                }
            }

            return this;
        }

        /**
         * Query by key
         * @param {Object} params - Query parameters with 'key' property
         * @returns {any} Value for key, or null if not found
         */
        query(params) {
            const { key } = params;
            const result = this._map.get(key);
            return result !== undefined ? result : null;
        }

        /**
         * Update an entry
         * @param {string} key - Entry key
         * @param {any} value - New value
         */
        update(key, value) {
            this._map.set(key, value);
        }

        /**
         * Delete an entry
         * @param {string} key - Entry key
         */
        delete(key) {
            this._map.delete(key);
        }

        /**
         * Clear all entries
         */
        clear() {
            this._map.clear();
        }

        /**
         * Get entry count
         * @returns {number} Number of entries
         */
        get size() {
            return this._map.size;
        }

        /**
         * Check if key exists
         * @param {string} key - Key to check
         * @returns {boolean} True if exists
         */
        has(key) {
            return this._map.has(key);
        }

        /**
         * Get all keys
         * @returns {Iterator} Iterator of keys
         */
        keys() {
            return this._map.keys();
        }

        /**
         * Get all values
         * @returns {Iterator} Iterator of values
         */
        values() {
            return this._map.values();
        }

        /**
         * Get all entries
         * @returns {Iterator} Iterator of [key, value] pairs
         */
        entries() {
            return this._map.entries();
        }
    }

    // Export to window
    window.MapIndex = MapIndex;

})();
