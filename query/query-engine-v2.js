// Query Engine v2 - Central Query Coordinator
// Architecture v3.0.0 - Query Layer

(function() {
    'use strict';

    /**
     * Central query coordinator that owns all indexes.
     * Provides unified interface for all data queries.
     */
    class QueryEngineV2 {
        constructor() {
            this._indexes = new Map();
            this._initialized = false;
        }

        /**
         * Register an index
         * @param {string} name - Unique index name
         * @param {IndexStrategy} strategy - Index implementation
         * @returns {QueryEngineV2} this for chaining
         */
        registerIndex(name, strategy) {
            this._indexes.set(name, strategy);
            return this;
        }

        /**
         * Initialize all indexes from data repository
         * @param {DataRepository} dataRepository - Data source
         * @returns {Promise<QueryEngineV2>} this for chaining
         */
        async initialize(dataRepository) {
            console.log('[QueryEngineV2] Initializing...');

            const data = await dataRepository.loadAll();

            // Build indexes from loaded data
            if (data.airports) {
                console.log(`[QueryEngineV2] Building airport indexes (${data.airports.size || 0} entries)`);
                this._indexes.get('airports')?.build(data.airports);
                this._indexes.get('airports_search')?.build(data.airports);
                this._indexes.get('airports_spatial')?.build(data.airports);
            }

            if (data.navaids) {
                console.log(`[QueryEngineV2] Building navaid indexes (${data.navaids.size || 0} entries)`);
                this._indexes.get('navaids')?.build(data.navaids);
                this._indexes.get('navaids_search')?.build(data.navaids);
                this._indexes.get('navaids_spatial')?.build(data.navaids);
            }

            if (data.fixes) {
                console.log(`[QueryEngineV2] Building fix indexes (${data.fixes.size || 0} entries)`);
                this._indexes.get('fixes')?.build(data.fixes);
                this._indexes.get('fixes_search')?.build(data.fixes);
                this._indexes.get('fixes_spatial')?.build(data.fixes);
            }

            if (data.airways) {
                console.log(`[QueryEngineV2] Building airway indexes (${data.airways.size || 0} entries)`);
                this._indexes.get('airways')?.build(data.airways);
            }

            // Build token type index
            this._buildTokenTypeIndex(data);

            this._initialized = true;
            console.log('[QueryEngineV2] Initialization complete');

            return this;
        }

        /**
         * Build combined token type lookup index
         * @private
         */
        _buildTokenTypeIndex(data) {
            const tokenTypes = new Map();

            if (data.airports) {
                for (const [code] of data.airports) {
                    tokenTypes.set(code, 'AIRPORT');
                }
            }

            if (data.navaids) {
                for (const [code] of data.navaids) {
                    tokenTypes.set(code, 'NAVAID');
                }
            }

            if (data.fixes) {
                for (const [code] of data.fixes) {
                    tokenTypes.set(code, 'FIX');
                }
            }

            if (data.airways) {
                for (const [code] of data.airways) {
                    tokenTypes.set(code, 'AIRWAY');
                }
            }

            console.log(`[QueryEngineV2] Token type index: ${tokenTypes.size} entries`);
            this._indexes.get('tokenTypes')?.build(tokenTypes);
        }

        // ============================================
        // QUERY METHODS
        // ============================================

        /**
         * Query by key from named index
         * @param {string} indexName - Index to query
         * @param {string} key - Key to look up
         * @returns {any} Value or null
         */
        getByKey(indexName, key) {
            const index = this._indexes.get(indexName);
            if (!index) return null;
            return index.query({ key });
        }

        /**
         * Search by prefix from named index
         * @param {string} indexName - Trie index to search
         * @param {string} prefix - Prefix to match
         * @param {number} limit - Max results
         * @returns {Array} Matching entries
         */
        search(indexName, prefix, limit = 15) {
            const index = this._indexes.get(indexName);
            if (!index) return [];
            return index.query({ prefix, limit });
        }

        /**
         * Find items in bounds from spatial index
         * @param {string} indexName - Spatial index to query
         * @param {Object} bounds - {minLat, maxLat, minLon, maxLon}
         * @returns {Array} Items in bounds
         */
        findInBounds(indexName, bounds) {
            const index = this._indexes.get(indexName);
            if (!index) return [];
            return index.query({ bounds });
        }

        /**
         * Find items near a point
         * @param {string} indexName - Spatial index to query
         * @param {number} lat - Center latitude
         * @param {number} lon - Center longitude
         * @param {number} radiusNM - Search radius in nautical miles
         * @returns {Array} Items within radius
         */
        findNearby(indexName, lat, lon, radiusNM) {
            const index = this._indexes.get(indexName);
            if (!index) return [];
            return index.query({ lat, lon, radiusNM });
        }

        /**
         * Get token type for route parsing
         * @param {string} token - Route token
         * @returns {string|null} Token type or null
         */
        getTokenType(token) {
            if (!token) return null;
            const upperToken = token.toUpperCase();
            return this.getByKey('tokenTypes', upperToken);
        }

        // ============================================
        // CONVENIENCE METHODS
        // ============================================

        /**
         * Get airport by ICAO code
         * @param {string} icao - ICAO code
         * @returns {Object|null} Airport data
         */
        getAirport(icao) {
            return this.getByKey('airports', icao?.toUpperCase());
        }

        /**
         * Get navaid by identifier
         * @param {string} ident - Navaid identifier
         * @returns {Object|null} Navaid data
         */
        getNavaid(ident) {
            return this.getByKey('navaids', ident?.toUpperCase());
        }

        /**
         * Get fix by identifier
         * @param {string} ident - Fix identifier
         * @returns {Object|null} Fix data
         */
        getFix(ident) {
            return this.getByKey('fixes', ident?.toUpperCase());
        }

        /**
         * Get airway by identifier
         * @param {string} ident - Airway identifier
         * @returns {Object|null} Airway data
         */
        getAirway(ident) {
            return this.getByKey('airways', ident?.toUpperCase());
        }

        /**
         * Search airports by prefix
         * @param {string} prefix - Search prefix
         * @param {number} limit - Max results
         * @returns {Array} Matching airports
         */
        searchAirports(prefix, limit = 15) {
            return this.search('airports_search', prefix, limit);
        }

        /**
         * Search all waypoints by prefix
         * @param {string} prefix - Search prefix
         * @param {number} limit - Max results
         * @returns {Array} Combined results from airports, navaids, fixes
         */
        searchWaypoints(prefix, limit = 15) {
            const airports = this.search('airports_search', prefix, limit);
            const navaids = this.search('navaids_search', prefix, limit);
            const fixes = this.search('fixes_search', prefix, limit);

            // Combine and limit
            return [...airports, ...navaids, ...fixes].slice(0, limit);
        }

        /**
         * Get statistics about loaded data
         * @returns {Object} Index sizes
         */
        getStats() {
            const stats = {};
            for (const [name, index] of this._indexes) {
                stats[name] = index.size;
            }
            return stats;
        }

        /**
         * Check if engine is initialized
         * @returns {boolean} True if ready
         */
        isReady() {
            return this._initialized;
        }
    }

    // Export to window
    window.QueryEngineV2 = QueryEngineV2;

})();
