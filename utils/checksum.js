/**
 * Checksum Utilities - Data Integrity Verification
 *
 * Uses Web Crypto API (SHA-256) for fast, native checksum calculation
 * Critical for aviation safety - ensures data hasn't been corrupted
 *
 * Use cases:
 * - Verify cached aviation database (airports, navaids, airways)
 * - Verify compressed raw CSV files before decompression
 * - Verify user-generated data (flight plans, GPS tracks)
 */

window.ChecksumUtils = {
    /**
     * Calculate SHA-256 checksum for any data
     * @param {*} data - Any JSON-serializable data (Map, Array, Object)
     * @returns {Promise<string>} - Hex string checksum (64 characters)
     */
    async calculate(data) {
        try {
            // Convert data to stable JSON string
            const jsonString = this._serializeForChecksum(data);

            // Encode to UTF-8 bytes
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(jsonString);

            // Calculate SHA-256 hash
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

            // Convert to hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            return hashHex;
        } catch (error) {
            console.error('[ChecksumUtils] Calculation failed:', error);
            throw new Error(`Checksum calculation failed: ${error.message}`);
        }
    },

    /**
     * Verify checksum matches data
     * @param {*} data - Data to verify
     * @param {string} expectedChecksum - Expected checksum (hex string)
     * @returns {Promise<boolean>} - True if checksums match
     */
    async verify(data, expectedChecksum) {
        if (!expectedChecksum) {
            console.warn('[ChecksumUtils] No checksum provided - skipping verification');
            return true; // Backward compatibility - old data without checksums
        }

        try {
            const actualChecksum = await this.calculate(data);
            const matches = actualChecksum === expectedChecksum;

            if (!matches) {
                console.error('[ChecksumUtils] Checksum mismatch!');
                console.error('  Expected:', expectedChecksum);
                console.error('  Actual:  ', actualChecksum);
            }

            return matches;
        } catch (error) {
            console.error('[ChecksumUtils] Verification failed:', error);
            return false;
        }
    },

    /**
     * Calculate checksums for multiple data structures in parallel
     * @param {Object} dataMap - {key: data} pairs
     * @returns {Promise<Object>} - {key: checksum} pairs
     */
    async calculateMultiple(dataMap) {
        const entries = Object.entries(dataMap);
        const checksums = await Promise.all(
            entries.map(async ([key, data]) => {
                const checksum = await this.calculate(data);
                return [key, checksum];
            })
        );
        return Object.fromEntries(checksums);
    },

    /**
     * Verify multiple checksums in parallel
     * @param {Object} dataMap - {key: data} pairs
     * @param {Object} checksumMap - {key: expectedChecksum} pairs
     * @returns {Promise<Object>} - {key: boolean} verification results
     */
    async verifyMultiple(dataMap, checksumMap) {
        const entries = Object.entries(dataMap);
        const results = await Promise.all(
            entries.map(async ([key, data]) => {
                const expectedChecksum = checksumMap[key];
                const valid = await this.verify(data, expectedChecksum);
                return [key, valid];
            })
        );
        return Object.fromEntries(results);
    },

    /**
     * Serialize data to stable JSON string for checksumming
     * Handles Maps, Arrays, Objects, and primitives
     * @private
     */
    _serializeForChecksum(data) {
        // Handle Map (convert to sorted array of entries)
        if (data instanceof Map) {
            const entries = Array.from(data.entries());
            // Sort by key for deterministic output
            entries.sort((a, b) => {
                const keyA = String(a[0]);
                const keyB = String(b[0]);
                return keyA.localeCompare(keyB);
            });
            return JSON.stringify(entries);
        }

        // Handle Array
        if (Array.isArray(data)) {
            return JSON.stringify(data);
        }

        // Handle Object (sort keys for deterministic output)
        if (typeof data === 'object' && data !== null) {
            const sortedKeys = Object.keys(data).sort();
            const sortedObj = {};
            for (const key of sortedKeys) {
                sortedObj[key] = data[key];
            }
            return JSON.stringify(sortedObj);
        }

        // Handle primitives (string, number, boolean, null)
        return JSON.stringify(data);
    },

    /**
     * Check if Web Crypto API is available
     * @returns {boolean}
     */
    isSupported() {
        return typeof crypto !== 'undefined' &&
               typeof crypto.subtle !== 'undefined' &&
               typeof crypto.subtle.digest === 'function';
    },

    /**
     * Get checksum statistics for logging/debugging
     * @param {Object} checksumMap - {key: checksum} pairs
     * @returns {Object} - Stats about checksums
     */
    getStats(checksumMap) {
        const checksums = Object.values(checksumMap);
        return {
            count: checksums.length,
            totalBytes: checksums.reduce((sum, cs) => sum + (cs ? cs.length / 2 : 0), 0),
            keys: Object.keys(checksumMap)
        };
    }
};

// Export for testing in Node.js (if available)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.ChecksumUtils;
}
