// Navigation - Pure Navigation Calculations
// Architecture v3.0.0 - Compute Layer (Pure Functions)

(function() {
    'use strict';

    /**
     * Navigation calculations - all pure functions.
     * Uses Geodesy library for precision WGS84 calculations.
     *
     * NO state, NO fetching, NO caching.
     * Input → Output only.
     */
    const Navigation = {
        /**
         * Calculate distance between two points using Vincenty formula
         * @param {number} lat1 - Start latitude in degrees
         * @param {number} lon1 - Start longitude in degrees
         * @param {number} lat2 - End latitude in degrees
         * @param {number} lon2 - End longitude in degrees
         * @returns {number} Distance in nautical miles
         */
        calculateDistance(lat1, lon1, lat2, lon2) {
            // Same point check
            if (lat1 === lat2 && lon1 === lon2) {
                return 0;
            }

            // Use Geodesy library if available
            if (window.vincentyInverse) {
                const result = window.vincentyInverse(lat1, lon1, lat2, lon2);
                // Convert meters to nautical miles (1 nm = 1852 meters)
                return result.distance / 1852;
            }

            // Fallback to Haversine
            return this._haversineDistance(lat1, lon1, lat2, lon2);
        },

        /**
         * Haversine distance fallback
         * @private
         */
        _haversineDistance(lat1, lon1, lat2, lon2) {
            const R = 3440.065; // Earth radius in nautical miles

            const φ1 = lat1 * Math.PI / 180;
            const φ2 = lat2 * Math.PI / 180;
            const Δφ = (lat2 - lat1) * Math.PI / 180;
            const Δλ = (lon2 - lon1) * Math.PI / 180;

            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            return R * c;
        },

        /**
         * Calculate initial bearing (true) between two points
         * @param {number} lat1 - Start latitude in degrees
         * @param {number} lon1 - Start longitude in degrees
         * @param {number} lat2 - End latitude in degrees
         * @param {number} lon2 - End longitude in degrees
         * @returns {number} Bearing in degrees true (0-360)
         */
        calculateBearing(lat1, lon1, lat2, lon2) {
            // Use Geodesy library if available
            if (window.vincentyInverse) {
                const result = window.vincentyInverse(lat1, lon1, lat2, lon2);
                return result.initialBearing;
            }

            // Fallback calculation
            const φ1 = lat1 * Math.PI / 180;
            const φ2 = lat2 * Math.PI / 180;
            const Δλ = (lon2 - lon1) * Math.PI / 180;

            const y = Math.sin(Δλ) * Math.cos(φ2);
            const x = Math.cos(φ1) * Math.sin(φ2) -
                      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

            const θ = Math.atan2(y, x);

            return (θ * 180 / Math.PI + 360) % 360;
        },

        /**
         * Calculate magnetic bearing
         * @param {number} lat1 - Start latitude
         * @param {number} lon1 - Start longitude
         * @param {number} lat2 - End latitude
         * @param {number} lon2 - End longitude
         * @returns {number} Bearing in degrees magnetic
         */
        calculateMagneticBearing(lat1, lon1, lat2, lon2) {
            const trueBearing = this.calculateBearing(lat1, lon1, lat2, lon2);

            // Get magnetic variation at start point
            let magVar = 0;
            if (window.calculateMagneticDeclination) {
                magVar = window.calculateMagneticDeclination(lat1, lon1) || 0;
            }

            // Magnetic = True - Variation (East positive)
            return (trueBearing - magVar + 360) % 360;
        },

        /**
         * Calculate wind correction
         * @param {number} course - Desired course in degrees true
         * @param {number} tas - True airspeed in knots
         * @param {number} windDir - Wind direction (from) in degrees true
         * @param {number} windSpeed - Wind speed in knots
         * @returns {Object} {heading, groundSpeed, windCorrectionAngle}
         */
        calculateWindCorrection(course, tas, windDir, windSpeed) {
            // Handle zero wind
            if (windSpeed === 0) {
                return {
                    heading: Math.round(course),
                    groundSpeed: Math.round(tas),
                    windCorrectionAngle: 0
                };
            }

            const courseRad = course * Math.PI / 180;
            const windRad = windDir * Math.PI / 180;

            // Calculate wind correction angle
            const sinWCA = (windSpeed / tas) * Math.sin(windRad - courseRad);

            // Check if wind exceeds TAS (can't make headway)
            if (Math.abs(sinWCA) > 1) {
                return {
                    heading: Math.round(course),
                    groundSpeed: 0,
                    windCorrectionAngle: 0
                };
            }

            const wca = Math.asin(sinWCA);
            const wcaDeg = wca * 180 / Math.PI;

            // Calculate heading
            const heading = (course + wcaDeg + 360) % 360;

            // Calculate ground speed using wind components
            // GS = TAS * cos(WCA) - headwind component
            // Headwind component = wind_speed * cos(wind_dir - course)
            // (positive = headwind, negative = tailwind)
            const gs = tas * Math.cos(wca) - windSpeed * Math.cos(windRad - courseRad);

            return {
                heading: Math.round(heading),
                groundSpeed: Math.round(gs),
                windCorrectionAngle: Math.round(wcaDeg)
            };
        },

        /**
         * Calculate leg data between two waypoints
         * @param {Object} from - Start waypoint {lat, lon, ident}
         * @param {Object} to - End waypoint {lat, lon, ident}
         * @param {Object} options - {tas, wind: {direction, speed}}
         * @returns {Object} Leg calculation results
         */
        calculateLeg(from, to, options = {}) {
            const distance = this.calculateDistance(from.lat, from.lon, to.lat, to.lon);
            const trueCourse = this.calculateBearing(from.lat, from.lon, to.lat, to.lon);
            const magCourse = this.calculateMagneticBearing(from.lat, from.lon, to.lat, to.lon);

            // Default TAS
            const tas = options.tas || 120;

            let heading = magCourse;
            let groundSpeed = tas;
            let wca = 0;

            // Apply wind correction if wind data provided
            if (options.wind && options.wind.speed > 0) {
                const correction = this.calculateWindCorrection(
                    trueCourse,
                    tas,
                    options.wind.direction,
                    options.wind.speed
                );
                heading = correction.heading;
                groundSpeed = correction.groundSpeed;
                wca = correction.windCorrectionAngle;

                // Convert heading to magnetic
                let magVar = 0;
                if (window.calculateMagneticDeclination) {
                    magVar = window.calculateMagneticDeclination(from.lat, from.lon) || 0;
                }
                heading = (heading - magVar + 360) % 360;
            }

            // Calculate ETE in minutes
            const ete = groundSpeed > 0 ? (distance / groundSpeed) * 60 : 0;

            // Extract identifier
            const fromIdent = from.ident || from.icao || from.id || 'START';
            const toIdent = to.ident || to.icao || to.id || 'END';

            return {
                distance: Math.round(distance * 10) / 10,
                trueCourse: Math.round(trueCourse),
                magCourse: Math.round(magCourse),
                heading: Math.round(heading),
                groundSpeed: Math.round(groundSpeed),
                windCorrectionAngle: wca,
                ete: Math.round(ete),
                from: fromIdent,
                to: toIdent
            };
        },

        /**
         * Calculate entire route
         * @param {Array} waypoints - Array of waypoints with lat/lon
         * @param {Object} options - Route options {tas, wind}
         * @returns {Object} {legs, totals}
         */
        calculateRoute(waypoints, options = {}) {
            // Handle edge cases
            if (!waypoints || waypoints.length < 2) {
                return {
                    legs: [],
                    totals: { distance: 0, ete: 0 }
                };
            }

            const legs = [];
            let totalDistance = 0;
            let totalEte = 0;

            for (let i = 0; i < waypoints.length - 1; i++) {
                const leg = this.calculateLeg(waypoints[i], waypoints[i + 1], options);
                legs.push(leg);
                totalDistance += leg.distance;
                totalEte += leg.ete;
            }

            return {
                legs,
                totals: {
                    distance: Math.round(totalDistance * 10) / 10,
                    ete: Math.round(totalEte)
                }
            };
        }
    };

    // Export to window
    window.Navigation = Navigation;

})();
