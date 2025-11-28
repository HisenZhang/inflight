// Trie Index - Prefix Search Index
// Architecture v3.0.0 - Query Layer Indexes

(function() {
    'use strict';

    /**
     * Trie-based index for efficient prefix search.
     * Best for: Autocomplete, type-ahead search
     *
     * @extends IndexStrategy
     */
    class TrieIndex extends window.IndexStrategy {
        constructor() {
            super();
            this._root = {};
            this._size = 0;
        }

        /**
         * Build trie from data
         * @param {Map|Object} data - Key-value pairs to index
         * @returns {TrieIndex} this for chaining
         */
        build(data) {
            this._root = {};
            this._size = 0;

            const entries = data instanceof Map
                ? data.entries()
                : Object.entries(data);

            for (const [key, value] of entries) {
                this._insert(key.toUpperCase(), key, value);
                this._size++;
            }

            return this;
        }

        /**
         * Insert a key-value pair into the trie
         * @private
         */
        _insert(upperKey, originalKey, value) {
            let node = this._root;

            for (const char of upperKey) {
                if (!node[char]) {
                    node[char] = {};
                }
                node = node[char];
            }

            // Store original key and value at terminal node
            node.$ = { key: originalKey, value };
        }

        /**
         * Query by prefix
         * @param {Object} params - Query parameters
         * @param {string} params.prefix - Prefix to search for
         * @param {number} params.limit - Maximum results to return (default 10)
         * @returns {Array} Array of {key, value} objects matching prefix
         */
        query(params) {
            const { prefix = '', limit = 10 } = params;
            const upperPrefix = prefix.toUpperCase();

            // Navigate to prefix node
            let node = this._root;
            for (const char of upperPrefix) {
                if (!node[char]) {
                    return []; // No matches
                }
                node = node[char];
            }

            // Collect all matches from this node
            return this._collect(node, limit);
        }

        /**
         * Collect all terminal nodes up to limit
         * @private
         */
        _collect(node, limit, results = []) {
            if (results.length >= limit) {
                return results;
            }

            // Add terminal node value
            if (node.$) {
                results.push(node.$);
            }

            // Traverse children in alphabetical order
            const chars = Object.keys(node).filter(c => c !== '$').sort();
            for (const char of chars) {
                this._collect(node[char], limit, results);
                if (results.length >= limit) {
                    break;
                }
            }

            return results;
        }

        /**
         * Update not supported for trie (rebuild instead)
         */
        update(key, value) {
            // For trie, we just insert (overwrites if exists)
            this._insert(key.toUpperCase(), key, value);
        }

        /**
         * Delete not fully supported (would need to clean up empty branches)
         */
        delete(key) {
            console.warn('[TrieIndex] delete() not fully supported, consider rebuild');
        }

        /**
         * Clear all entries
         */
        clear() {
            this._root = {};
            this._size = 0;
        }

        /**
         * Get entry count
         * @returns {number} Number of entries
         */
        get size() {
            return this._size;
        }
    }

    // Export to window
    window.TrieIndex = TrieIndex;

})();
