// Index Strategy - Abstract Index Interface
// Architecture v3.0.0 - Query Layer Core

(function() {
    'use strict';

    /**
     * Abstract interface for index implementations.
     *
     * Implementations: MapIndex, TrieIndex, SpatialGridIndex
     *
     * @abstract
     */
    class IndexStrategy {
        /**
         * Build index from data
         *
         * @abstract
         * @param {Map|Array|Object} data - Data to index
         * @returns {IndexStrategy} this for chaining
         * @throws {Error} If not implemented
         */
        build(data) {
            throw new Error('IndexStrategy.build() not implemented');
        }

        /**
         * Query the index
         *
         * @abstract
         * @param {Object} params - Query parameters
         * @returns {any} Query results
         * @throws {Error} If not implemented
         */
        query(params) {
            throw new Error('IndexStrategy.query() not implemented');
        }

        /**
         * Update a single entry
         *
         * @abstract
         * @param {string} key - Entry key
         * @param {any} value - New value
         * @throws {Error} If not implemented
         */
        update(key, value) {
            throw new Error('IndexStrategy.update() not implemented');
        }

        /**
         * Delete a single entry
         *
         * @abstract
         * @param {string} key - Entry key to delete
         * @throws {Error} If not implemented
         */
        delete(key) {
            throw new Error('IndexStrategy.delete() not implemented');
        }

        /**
         * Clear all entries
         *
         * @abstract
         * @throws {Error} If not implemented
         */
        clear() {
            throw new Error('IndexStrategy.clear() not implemented');
        }

        /**
         * Get entry count
         *
         * @abstract
         * @returns {number} Number of entries
         * @throws {Error} If not implemented
         */
        get size() {
            throw new Error('IndexStrategy.size not implemented');
        }
    }

    // Export to window
    window.IndexStrategy = IndexStrategy;

})();
