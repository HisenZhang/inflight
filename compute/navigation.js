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
        },

        // ============================================
        // WIND COMPONENT ANALYSIS (Pure Functions)
        // ============================================

        /**
         * Calculate wind components for a given heading
         * @param {number} windDir - Wind direction (from) in degrees
         * @param {number} windSpeed - Wind speed in knots
         * @param {number} heading - Aircraft heading in degrees
         * @returns {Object} {headwind, crosswind} - positive headwind is into wind, positive crosswind is from right
         */
        calculateWindComponents(windDir, windSpeed, heading) {
            if (!windSpeed || windSpeed === 0) {
                return { headwind: 0, crosswind: 0 };
            }

            const relativeAngle = (windDir - heading + 360) % 360;
            const relativeRad = relativeAngle * Math.PI / 180;

            // Headwind: positive = headwind, negative = tailwind
            const headwind = Math.round(windSpeed * Math.cos(relativeRad));
            // Crosswind: positive = from right, negative = from left
            const crosswind = Math.round(windSpeed * Math.sin(relativeRad));

            return { headwind, crosswind };
        },

        /**
         * Analyze wind hazards for a route
         * Returns consolidated warnings by type with affected leg ranges
         * @param {Array} legs - Route legs with wind data (windDir, windSpd, headwind, crosswind)
         * @param {Object} thresholds - {headwind: number, crosswind: number} warning thresholds in knots
         * @returns {Object} Wind hazard analysis with consolidated warnings
         */
        analyzeWindHazards(legs, thresholds = { headwind: 25, crosswind: 15 }) {
            if (!legs || legs.length === 0) {
                return { hasHazard: false, headwindWarning: null, crosswindWarning: null, maxHeadwind: 0, maxCrosswind: 0 };
            }

            let maxHeadwind = 0;
            let maxCrosswind = 0;
            const headwindLegs = [];  // Legs with significant headwind
            const crosswindLegs = []; // Legs with significant crosswind

            for (let i = 0; i < legs.length; i++) {
                const leg = legs[i];
                const headwind = leg.headwind || 0;
                const crosswind = leg.crosswind || 0;
                const absHeadwind = Math.abs(headwind);
                const absCrosswind = Math.abs(crosswind);

                // Track max values
                if (headwind > maxHeadwind) {
                    maxHeadwind = headwind;
                }
                if (absCrosswind > Math.abs(maxCrosswind)) {
                    maxCrosswind = crosswind;
                }

                // Collect legs with significant headwind (positive headwind)
                // Leg notation: FROM[fromIndex]-TO[toIndex] e.g., "KALB[1]-PAYGE[2]" means leg from wp1 to wp2
                if (headwind > thresholds.headwind) {
                    headwindLegs.push({
                        fromIndex: i + 1,  // 1-based waypoint index of FROM
                        toIndex: i + 2,    // 1-based waypoint index of TO
                        from: leg.from?.ident || leg.from?.icao || leg.from || `WPT${i + 1}`,
                        to: leg.to?.ident || leg.to?.icao || leg.to || `WPT${i + 2}`,
                        fromType: leg.from?.waypointType || 'fix',
                        toType: leg.to?.waypointType || 'fix',
                        fromIsReporting: leg.from?.isReportingPoint || false,
                        toIsReporting: leg.to?.isReportingPoint || false,
                        value: headwind
                    });
                }

                // Collect legs with significant crosswind
                if (absCrosswind > thresholds.crosswind) {
                    crosswindLegs.push({
                        fromIndex: i + 1,
                        toIndex: i + 2,
                        from: leg.from?.ident || leg.from?.icao || leg.from || `WPT${i + 1}`,
                        to: leg.to?.ident || leg.to?.icao || leg.to || `WPT${i + 2}`,
                        fromType: leg.from?.waypointType || 'fix',
                        toType: leg.to?.waypointType || 'fix',
                        fromIsReporting: leg.from?.isReportingPoint || false,
                        toIsReporting: leg.to?.isReportingPoint || false,
                        value: absCrosswind,
                        direction: crosswind > 0 ? 'R' : 'L'
                    });
                }
            }

            // Build consolidated headwind warning
            let headwindWarning = null;
            if (headwindLegs.length > 0) {
                const affectedRange = this._formatLegRange(headwindLegs);
                headwindWarning = {
                    type: 'HEADWIND',
                    maxValue: maxHeadwind,
                    affectedLegs: headwindLegs,
                    affectedRange,
                    message: `${maxHeadwind}KT max, legs ${affectedRange}`
                };
            }

            // Build consolidated crosswind warning
            let crosswindWarning = null;
            if (crosswindLegs.length > 0) {
                const affectedRange = this._formatLegRange(crosswindLegs);
                const direction = Math.abs(maxCrosswind) === maxCrosswind ? 'R' : 'L';
                crosswindWarning = {
                    type: 'CROSSWIND',
                    maxValue: Math.abs(maxCrosswind),
                    direction,
                    affectedLegs: crosswindLegs,
                    affectedRange,
                    message: `${Math.abs(maxCrosswind)}KT max from ${direction === 'R' ? 'right' : 'left'}, legs ${affectedRange}`
                };
            }

            return {
                hasHazard: headwindWarning !== null || crosswindWarning !== null,
                headwindWarning,
                crosswindWarning,
                maxHeadwind,
                maxCrosswind
            };
        },

        /**
         * Format leg indices as range notation (e.g., "1-3, 5, 7-9")
         * @private
         */
        _formatLegRange(legs) {
            if (!legs || legs.length === 0) return '';

            const indices = legs.map(l => l.index).sort((a, b) => a - b);
            const ranges = [];
            let rangeStart = indices[0];
            let rangeEnd = indices[0];

            for (let i = 1; i < indices.length; i++) {
                if (indices[i] === rangeEnd + 1) {
                    rangeEnd = indices[i];
                } else {
                    ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
                    rangeStart = indices[i];
                    rangeEnd = indices[i];
                }
            }
            ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);

            return ranges.join(', ');
        },

        /**
         * Calculate proper bounding box for waypoints on a sphere
         * Handles anti-meridian crossings and routes > 180° longitude span
         * @param {Array} waypoints - Array of {lat, lon} objects
         * @returns {Object} {minLat, maxLat, minLon, maxLon}
         */
        calculateSphericalBounds(waypoints) {
            if (!waypoints || waypoints.length === 0) {
                return { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 };
            }

            if (waypoints.length === 1) {
                return {
                    minLat: waypoints[0].lat,
                    maxLat: waypoints[0].lat,
                    minLon: waypoints[0].lon,
                    maxLon: waypoints[0].lon
                };
            }

            // Helper: Normalize longitude to -180 to +180 range
            const normalizeLon = (lon) => {
                while (lon > 180) lon -= 360;
                while (lon < -180) lon += 360;
                return lon;
            };

            // Check if route crosses anti-meridian (±180° line)
            // by looking for large longitude jumps between consecutive waypoints
            let crossesAntiMeridian = false;
            for (let i = 1; i < waypoints.length; i++) {
                const lon1 = normalizeLon(waypoints[i - 1].lon);
                const lon2 = normalizeLon(waypoints[i].lon);
                const diff = Math.abs(lon2 - lon1);

                // If consecutive points differ by > 180°, they cross the anti-meridian
                // (shortest path goes across ±180° rather than the long way around)
                if (diff > 180) {
                    crossesAntiMeridian = true;
                    break;
                }
            }

            // Latitude is straightforward (no wrapping)
            const lats = waypoints.map(w => w.lat);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            let minLon, maxLon;

            if (crossesAntiMeridian) {
                // Convert longitudes to 0-360 range to avoid discontinuity
                const adjustedLons = waypoints.map(w => {
                    const lon = normalizeLon(w.lon);
                    return lon < 0 ? lon + 360 : lon;
                });

                // Find min/max in 0-360 range
                const minLon360 = Math.min(...adjustedLons);
                const maxLon360 = Math.max(...adjustedLons);

                // Check if the span is > 180° (going the "long way")
                const span = maxLon360 - minLon360;

                if (span > 180) {
                    // Route spans > 180° - take the OPPOSITE bounds (shorter arc)
                    // Example: waypoints at 170° and -170° (190° and 170° in 0-360)
                    // Span = 20°, but simple min/max gives 170-190 (wrong!)
                    // We want: max=170°, min=-170° (or 190° in 0-360)
                    // So swap: the "min" becomes the max, "max" becomes the min
                    minLon = normalizeLon(maxLon360);
                    maxLon = normalizeLon(minLon360);
                } else {
                    // Normal case: convert back to -180 to +180
                    minLon = normalizeLon(minLon360);
                    maxLon = normalizeLon(maxLon360);
                }
            } else {
                // No anti-meridian crossing - use simple min/max
                const lons = waypoints.map(w => normalizeLon(w.lon));
                minLon = Math.min(...lons);
                maxLon = Math.max(...lons);

                // If span > 180°, this is a legitimate long-path route
                // (e.g., trans-Pacific or trans-Atlantic routes)
                // Keep the bounds as-is - don't swap
            }

            return { minLat, maxLat, minLon, maxLon };
        },

        /**
         * Calculate return trip fuel estimate
         * Reverses the route direction and calculates new wind effects
         * @param {Array} legs - Original route legs with wind and fuel data
         * @param {number} burnRate - Fuel burn rate in gallons per hour
         * @param {number} tas - True airspeed in knots
         * @returns {Object} Return trip fuel analysis
         */
        calculateReturnFuel(legs, burnRate, tas) {
            if (!legs || legs.length === 0 || !burnRate || !tas) {
                return null;
            }

            let returnTime = 0;  // minutes
            let returnFuel = 0;  // gallons
            const returnLegs = [];

            // Process legs in reverse order
            for (let i = legs.length - 1; i >= 0; i--) {
                const originalLeg = legs[i];
                const distance = originalLeg.distance || 0;

                // For return trip, headwind becomes tailwind and vice versa
                // Outbound: GS = TAS - headwind (positive headwind = slower)
                // Return:   GS = TAS + headwind (headwind becomes tailwind = faster)
                // If outbound had 40KT headwind, return has 40KT tailwind
                const outboundHeadwind = originalLeg.headwind || 0;
                const returnHeadwind = -outboundHeadwind;  // For display: negative = tailwind

                // Calculate return ground speed (add original headwind as tailwind)
                const returnGS = Math.max(tas + outboundHeadwind, 0);

                // Calculate return leg time
                const legTime = returnGS > 0 ? (distance / returnGS) * 60 : 0;
                returnTime += legTime;

                returnLegs.push({
                    from: originalLeg.to,
                    to: originalLeg.from,
                    distance,
                    groundSpeed: Math.round(returnGS),
                    headwind: returnHeadwind,
                    legTime: Math.round(legTime)
                });
            }

            // Calculate total return fuel
            returnFuel = (returnTime / 60) * burnRate;

            // Compare with outbound
            const outboundTime = legs.reduce((sum, leg) => sum + (leg.legTime || 0), 0);
            const outboundFuel = (outboundTime / 60) * burnRate;
            const fuelDifference = returnFuel - outboundFuel;
            const timeDifference = returnTime - outboundTime;

            return {
                returnTime: Math.round(returnTime),
                returnFuel: Math.round(returnFuel * 10) / 10,
                outboundTime: Math.round(outboundTime),
                outboundFuel: Math.round(outboundFuel * 10) / 10,
                fuelDifference: Math.round(fuelDifference * 10) / 10,
                timeDifference: Math.round(timeDifference),
                returnLegs,
                // For display
                returnBetterByFuel: fuelDifference < -0.5,  // Return uses less fuel
                returnWorseByfuel: fuelDifference > 0.5     // Return uses more fuel
            };
        }
    };

    // Export to window
    window.Navigation = Navigation;

})();
