// Terrain - Pure Terrain Analysis Calculations
// Architecture v3.0.0 - Compute Layer (Pure Functions)

(function() {
    'use strict';

    /**
     * Terrain analysis - all pure functions.
     * Receives MORA data, returns analysis results.
     *
     * NO state, NO fetching, NO caching.
     * Input → Output only.
     */
    const Terrain = {
        // FAA terrain clearance requirements
        STANDARD_CLEARANCE_FT: 1000,    // Non-mountainous terrain
        MOUNTAINOUS_CLEARANCE_FT: 2000, // Mountainous terrain
        MOUNTAINOUS_THRESHOLD_FT: 5000, // Terrain above this is mountainous

        /**
         * Analyze terrain profile along a route
         * @param {Array} waypoints - Route waypoints with lat/lon
         * @param {Map} moraData - MORA grid data (Map with "lat,lon" keys)
         * @returns {Object} Terrain analysis results
         */
        analyzeProfile(waypoints, moraData) {
            // Validate inputs
            if (!waypoints || waypoints.length < 2) {
                return { error: 'Insufficient data for analysis' };
            }

            if (!moraData || moraData.size === 0) {
                return { error: 'No MORA data available' };
            }

            // Find all MORA grid cells along route
            const routeCells = this._findRouteCells(waypoints, moraData);

            if (routeCells.length === 0) {
                return { error: 'No MORA data for route' };
            }

            // Calculate statistics
            const moraValues = routeCells.map(c => c.mora);
            const maxMORA = Math.max(...moraValues);
            const minMORA = Math.min(...moraValues);
            const avgMORA = Math.round(
                moraValues.reduce((a, b) => a + b, 0) / moraValues.length
            );

            // Estimate terrain height (MORA = terrain + obstacle + clearance)
            // Conservative estimate: MORA minus standard clearance
            const maxTerrain = Math.max(0, maxMORA - this.STANDARD_CLEARANCE_FT);

            // Determine if mountainous
            const isMountainous = maxTerrain >= this.MOUNTAINOUS_THRESHOLD_FT;

            // Required clearance based on terrain type
            const requiredClearance = isMountainous
                ? this.MOUNTAINOUS_CLEARANCE_FT
                : this.STANDARD_CLEARANCE_FT;

            return {
                maxMORA,
                minMORA,
                avgMORA,
                maxTerrain,
                isMountainous,
                requiredClearance,
                gridCellCount: routeCells.length,
                cells: routeCells
            };
        },

        /**
         * Find MORA grid cells along route
         * @private
         */
        _findRouteCells(waypoints, moraData) {
            const cells = new Map();

            // Sample points along each leg
            for (let i = 0; i < waypoints.length - 1; i++) {
                const from = waypoints[i];
                const to = waypoints[i + 1];
                const samples = this._sampleSegment(from, to, 10); // Every ~10nm

                for (const point of samples) {
                    const key = `${Math.floor(point.lat)},${Math.floor(point.lon)}`;

                    if (moraData.has(key) && !cells.has(key)) {
                        cells.set(key, moraData.get(key));
                    }
                }
            }

            return Array.from(cells.values());
        },

        /**
         * Sample points along a segment
         * @private
         */
        _sampleSegment(from, to, intervalNM) {
            const points = [from];

            // Calculate approximate distance using simple method
            const latDiff = to.lat - from.lat;
            const lonDiff = to.lon - from.lon;
            const approxDistance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 60; // Rough nm

            // More accurate if Navigation module available
            let distance = approxDistance;
            if (window.Navigation && window.Navigation.calculateDistance) {
                distance = window.Navigation.calculateDistance(from.lat, from.lon, to.lat, to.lon);
            }

            const numSamples = Math.max(1, Math.ceil(distance / intervalNM));

            for (let i = 1; i <= numSamples; i++) {
                const fraction = i / numSamples;
                points.push({
                    lat: from.lat + fraction * (to.lat - from.lat),
                    lon: from.lon + fraction * (to.lon - from.lon)
                });
            }

            return points;
        },

        /**
         * Check if altitude provides adequate clearance
         * @param {number} altitude - Cruise altitude in feet MSL
         * @param {Object} analysis - Result from analyzeProfile()
         * @returns {Object} Clearance check result
         */
        checkClearance(altitude, analysis) {
            // Handle error or missing analysis
            if (!analysis || analysis.error) {
                return {
                    status: 'UNKNOWN',
                    message: analysis?.error || 'No analysis'
                };
            }

            // Calculate actual clearance above terrain
            const clearance = altitude - analysis.maxTerrain;

            // Check against required clearance
            if (clearance >= analysis.requiredClearance) {
                return {
                    status: 'OK',
                    message: `${clearance}ft clearance (${analysis.requiredClearance}ft required)`,
                    clearance,
                    required: analysis.requiredClearance,
                    maxTerrain: analysis.maxTerrain,
                    maxMORA: analysis.maxMORA
                };
            } else {
                const deficit = analysis.requiredClearance - clearance;
                return {
                    status: 'UNSAFE',
                    message: `Only ${clearance}ft clearance, need ${analysis.requiredClearance}ft`,
                    clearance,
                    required: analysis.requiredClearance,
                    deficit,
                    recommendedAltitude: analysis.maxMORA,
                    maxTerrain: analysis.maxTerrain,
                    maxMORA: analysis.maxMORA
                };
            }
        },

        /**
         * Get minimum safe altitude for route
         * @param {Object} analysis - Result from analyzeProfile()
         * @returns {number|null} Minimum safe altitude in feet
         */
        getMinimumSafeAltitude(analysis) {
            if (!analysis || analysis.error) {
                return null;
            }
            return analysis.maxMORA;
        }
    };

    // Export to window
    window.Terrain = Terrain;

})();
