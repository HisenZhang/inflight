// Cache Strategy - Cache Validity Patterns
// Architecture v3.0.0 - Data Layer Core

(function() {
    'use strict';

    /**
     * Abstract interface for cache validity strategies.
     *
     * Implementations: TTLStrategy, PermanentStrategy, VersionStrategy
     *
     * @abstract
     */
    class CacheStrategy {
        /**
         * Check if a cache entry is still valid
         *
         * @abstract
         * @param {Object} entry - Cache entry with timestamp and metadata
         * @returns {boolean} True if entry is still valid
         * @throws {Error} If not implemented
         */
        isValid(entry) {
            throw new Error('CacheStrategy.isValid() not implemented');
        }

        /**
         * Create a cache entry with metadata
         *
         * @param {any} data - Data to cache
         * @param {Object} metadata - Additional metadata (version, etc.)
         * @returns {Object} Cache entry with data, timestamp, and metadata
         */
        createEntry(data, metadata = {}) {
            return {
                data,
                timestamp: Date.now(),
                ...metadata
            };
        }
    }

    /**
     * Time-To-Live cache strategy.
     * Entries expire after a specified duration.
     */
    class TTLStrategy extends CacheStrategy {
        /**
         * Create a TTL strategy
         * @param {number} durationMs - Cache duration in milliseconds
         */
        constructor(durationMs) {
            super();
            this.duration = durationMs;
        }

        /**
         * Check if entry is within TTL window
         * @param {Object} entry - Cache entry with timestamp
         * @returns {boolean} True if not expired
         */
        isValid(entry) {
            if (!entry || typeof entry.timestamp !== 'number') {
                return false;
            }
            return (Date.now() - entry.timestamp) < this.duration;
        }
    }

    /**
     * Permanent cache strategy.
     * Entries never expire automatically.
     */
    class PermanentStrategy extends CacheStrategy {
        /**
         * Always returns true - entries never expire
         * @param {Object} entry - Cache entry
         * @returns {boolean} Always true
         */
        isValid(entry) {
            return true;
        }
    }

    /**
     * Version-based cache strategy.
     * Entries are valid based on a version check function.
     */
    class VersionStrategy extends CacheStrategy {
        /**
         * Create a version strategy
         * @param {Function} isVersionValid - Function that checks if version is valid
         */
        constructor(isVersionValid) {
            super();
            this.isVersionValid = isVersionValid;
        }

        /**
         * Check if entry version is still valid
         * @param {Object} entry - Cache entry with version property
         * @returns {boolean} Result of version validation
         */
        isValid(entry) {
            if (!entry) return false;
            return this.isVersionValid(entry.version);
        }

        /**
         * Create entry with version metadata
         * @param {any} data - Data to cache
         * @param {Object} metadata - Must include version
         * @returns {Object} Cache entry
         */
        createEntry(data, metadata = {}) {
            return {
                data,
                timestamp: Date.now(),
                version: metadata.version,
                ...metadata
            };
        }
    }

    // Export to window
    window.CacheStrategy = CacheStrategy;
    window.TTLStrategy = TTLStrategy;
    window.PermanentStrategy = PermanentStrategy;
    window.VersionStrategy = VersionStrategy;

})();
