// Route Service - Route Planning Orchestration
// Architecture v3.0.0 - Service Layer

(function() {
    'use strict';

    /**
     * Route planning service - orchestrates Data, Query, and Compute layers.
     * Entry point for all route planning operations.
     */
    class RouteService {
        /**
         * Create a route service
         * @param {Object} deps - Dependencies
         * @param {Object} deps.queryEngine - Query engine instance
         * @param {Object} deps.dataRepository - Data repository instance
         */
        constructor({ queryEngine, dataRepository }) {
            this._query = queryEngine;
            this._repo = dataRepository;
        }

        /**
         * Plan a complete route
         * @param {string} routeString - Route string like "KSFO V25 KLAX"
         * @param {Object} options - Planning options
         * @param {number} options.cruiseSpeed - TAS in knots
         * @param {number} options.altitude - Cruise altitude in feet
         * @param {Object} options.wind - Wind {direction, speed}
         * @returns {Promise<Object>} Complete route plan
         */
        async planRoute(routeString, options = {}) {
            // 1. Parse and resolve waypoints (Query layer)
            const waypoints = await this._resolveWaypoints(routeString);

            // 2. Calculate navigation (Compute layer - pure functions)
            const route = window.Navigation.calculateRoute(waypoints, {
                tas: options.cruiseSpeed || 120,
                wind: options.wind
            });

            // 3. Analyze terrain (Data + Compute)
            let terrain = null;
            let clearance = null;

            try {
                const moraData = await this._repo.get('terrain', 'mora');
                if (moraData) {
                    terrain = window.Terrain.analyzeProfile(waypoints, moraData);

                    // 4. Check clearance if altitude specified
                    if (options.altitude) {
                        clearance = window.Terrain.checkClearance(options.altitude, terrain);
                    }
                }
            } catch (error) {
                console.warn('[RouteService] Terrain analysis failed:', error);
            }

            return {
                waypoints,
                legs: route.legs,
                totals: route.totals,
                terrain,
                clearance,
                options
            };
        }

        /**
         * Resolve route string to waypoints
         * @private
         */
        async _resolveWaypoints(routeString) {
            if (!routeString || typeof routeString !== 'string') {
                return [];
            }

            const tokens = routeString.trim().toUpperCase().split(/\s+/);
            const waypoints = [];

            for (const token of tokens) {
                if (!token) continue;

                const type = this._query.getTokenType(token);
                let waypoint = null;

                switch (type) {
                    case 'AIRPORT':
                        waypoint = this._query.getAirport(token);
                        break;
                    case 'NAVAID':
                        waypoint = this._query.getNavaid(token);
                        break;
                    case 'FIX':
                        waypoint = this._query.getFix(token);
                        break;
                    case 'AIRWAY':
                        // TODO: Expand airway - needs previous/next waypoint
                        console.debug(`[RouteService] Airway expansion not yet implemented: ${token}`);
                        continue;
                    default:
                        console.debug(`[RouteService] Unknown token: ${token}`);
                        continue;
                }

                if (waypoint && waypoint.lat != null && waypoint.lon != null) {
                    waypoints.push({
                        ...waypoint,
                        token,
                        type: type.toLowerCase()
                    });
                }
            }

            return waypoints;
        }

        /**
         * Search for waypoints (autocomplete)
         * @param {string} query - Search query
         * @param {number} limit - Maximum results (default 15)
         * @returns {Array} Matching waypoints
         */
        searchWaypoints(query, limit = 15) {
            return this._query.searchWaypoints(query, limit);
        }

        /**
         * Search for airports only
         * @param {string} query - Search query
         * @param {number} limit - Maximum results
         * @returns {Array} Matching airports
         */
        searchAirports(query, limit = 15) {
            return this._query.searchAirports(query, limit);
        }

        /**
         * Get airport by ICAO code
         * @param {string} icao - ICAO code
         * @returns {Object|null} Airport data
         */
        getAirport(icao) {
            return this._query.getAirport(icao);
        }

        /**
         * Get navaid by identifier
         * @param {string} ident - Navaid identifier
         * @returns {Object|null} Navaid data
         */
        getNavaid(ident) {
            return this._query.getNavaid(ident);
        }

        /**
         * Get fix by identifier
         * @param {string} ident - Fix identifier
         * @returns {Object|null} Fix data
         */
        getFix(ident) {
            return this._query.getFix(ident);
        }

        /**
         * Find nearby airports
         * @param {number} lat - Latitude
         * @param {number} lon - Longitude
         * @param {number} radiusNM - Search radius in nautical miles
         * @returns {Array} Nearby airports
         */
        findNearbyAirports(lat, lon, radiusNM = 50) {
            return this._query.findNearby('airports_spatial', lat, lon, radiusNM);
        }

        /**
         * Validate a route string
         * @param {string} routeString - Route string to validate
         * @returns {Object} Validation result {valid, errors, warnings}
         */
        validateRoute(routeString) {
            const tokens = routeString.trim().toUpperCase().split(/\s+/);
            const errors = [];
            const warnings = [];

            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                const type = this._query.getTokenType(token);

                if (!type) {
                    // Check if it looks like a known pattern
                    if (/^K[A-Z]{3}$/.test(token)) {
                        errors.push(`Unknown airport: ${token}`);
                    } else if (/^[A-Z]{3,5}$/.test(token)) {
                        errors.push(`Unknown waypoint: ${token}`);
                    } else if (/^[JVQ]\d+$/.test(token)) {
                        errors.push(`Unknown airway: ${token}`);
                    } else {
                        errors.push(`Unrecognized token: ${token}`);
                    }
                }
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings
            };
        }
    }

    // Export to window
    window.RouteService = RouteService;

})();
