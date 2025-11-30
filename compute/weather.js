// Weather - Pure Weather Parsing and Analysis
// Architecture v3.0.0 - Compute Layer (Pure Functions)

(function() {
    'use strict';

    /**
     * Weather parsing and analysis - all pure functions.
     *
     * NO state, NO fetching, NO caching.
     * Input → Output only.
     */
    const Weather = {
        /**
         * Parse raw METAR string
         * @param {string} raw - Raw METAR text
         * @returns {Object} Parsed METAR data
         */
        parseMETAR(raw) {
            if (!raw || typeof raw !== 'string') {
                return { raw: '', error: 'Invalid METAR' };
            }

            const parts = raw.trim().split(/\s+/);
            const result = {
                raw,
                station: null,
                time: null,
                wind: null,
                visibility: null,
                ceiling: null,
                temperature: null,
                dewpoint: null,
                altimeter: null,
                remarks: null
            };

            let idx = 0;

            // Station identifier (4 characters)
            if (parts[idx] && /^[A-Z]{4}$/.test(parts[idx])) {
                result.station = parts[idx];
                idx++;
            }

            // Time (DDHHMMz format)
            if (parts[idx] && /^\d{6}Z$/i.test(parts[idx])) {
                result.time = parts[idx];
                idx++;
            }

            // AUTO or COR
            if (parts[idx] && /^(AUTO|COR)$/i.test(parts[idx])) {
                idx++;
            }

            // Wind (DDDssKT or DDDssGggKT or VRBssKT)
            if (parts[idx] && /^(VRB|\d{3})\d{2,3}(G\d{2,3})?(KT|MPS)$/i.test(parts[idx])) {
                result.wind = this._parseWind(parts[idx]);
                idx++;

                // Variable wind direction (DDDVddd)
                if (parts[idx] && /^\d{3}V\d{3}$/.test(parts[idx])) {
                    result.wind.variable = parts[idx];
                    idx++;
                }
            }

            // Visibility
            while (idx < parts.length) {
                const vis = this._parseVisibility(parts, idx);
                if (vis.value !== null) {
                    result.visibility = vis.value;
                    idx = vis.nextIdx;
                    break;
                } else if (/^(SKC|CLR|FEW|SCT|BKN|OVC|VV)\d{3}/.test(parts[idx])) {
                    // No visibility, skip to clouds
                    result.visibility = 10; // Assume good visibility
                    break;
                } else {
                    idx++;
                }
                if (idx > 10) break; // Safety limit
            }

            // Present weather and sky conditions
            while (idx < parts.length) {
                // Cloud layers
                const cloudMatch = parts[idx]?.match(/^(SKC|CLR|FEW|SCT|BKN|OVC|VV)(\d{3})?/i);
                if (cloudMatch) {
                    const coverage = cloudMatch[1].toUpperCase();
                    const heightHundreds = cloudMatch[2] ? parseInt(cloudMatch[2], 10) : null;
                    const heightFeet = heightHundreds ? heightHundreds * 100 : null;

                    // Track ceiling (lowest BKN, OVC, or VV)
                    if ((coverage === 'BKN' || coverage === 'OVC' || coverage === 'VV') &&
                        heightFeet !== null) {
                        if (result.ceiling === null || heightFeet < result.ceiling) {
                            result.ceiling = heightFeet;
                        }
                    }
                }

                // Temperature/Dewpoint (TT/DD or M TT/M DD)
                const tempMatch = parts[idx]?.match(/^(M)?(\d{2})\/(M)?(\d{2})$/);
                if (tempMatch) {
                    result.temperature = parseInt(tempMatch[2], 10) * (tempMatch[1] ? -1 : 1);
                    result.dewpoint = parseInt(tempMatch[4], 10) * (tempMatch[3] ? -1 : 1);
                }

                // Altimeter (Annnn or Qnnnn)
                const altMatch = parts[idx]?.match(/^A(\d{4})$/i);
                if (altMatch) {
                    result.altimeter = parseInt(altMatch[1], 10) / 100;
                }

                // Remarks
                if (parts[idx] === 'RMK') {
                    result.remarks = parts.slice(idx + 1).join(' ');
                    break;
                }

                idx++;
            }

            return result;
        },

        /**
         * Parse wind component
         * @private
         */
        _parseWind(windStr) {
            const match = windStr.match(/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/i);
            if (!match) return null;

            const direction = match[1] === 'VRB' ? 'VRB' : parseInt(match[1], 10);
            let speed = parseInt(match[2], 10);
            let gust = match[4] ? parseInt(match[4], 10) : null;

            // Convert MPS to KT if needed
            if (match[5].toUpperCase() === 'MPS') {
                speed = Math.round(speed * 1.944);
                if (gust) gust = Math.round(gust * 1.944);
            }

            return {
                direction,
                speed,
                gust,
                unit: 'KT'
            };
        },

        /**
         * Parse visibility
         * @private
         */
        _parseVisibility(parts, idx) {
            let value = null;
            let nextIdx = idx;

            // Check for statute miles (10SM, 3SM, 1/2SM, 1 1/2SM, P6SM)
            const current = parts[idx];

            // P6SM or similar (greater than)
            if (/^P\d+SM$/i.test(current)) {
                value = parseInt(current.slice(1), 10);
                nextIdx = idx + 1;
            }
            // Simple number SM (10SM, 5SM)
            else if (/^\d+SM$/i.test(current)) {
                value = parseInt(current, 10);
                nextIdx = idx + 1;
            }
            // Fraction SM (1/2SM, 3/4SM)
            else if (/^\d+\/\d+SM$/i.test(current)) {
                const [num, denom] = current.replace(/SM$/i, '').split('/');
                value = parseInt(num, 10) / parseInt(denom, 10);
                nextIdx = idx + 1;
            }
            // Mixed number (1 1/2SM)
            else if (/^\d+$/.test(current) && parts[idx + 1] && /^\d+\/\d+SM$/i.test(parts[idx + 1])) {
                const whole = parseInt(current, 10);
                const [num, denom] = parts[idx + 1].replace(/SM$/i, '').split('/');
                value = whole + parseInt(num, 10) / parseInt(denom, 10);
                nextIdx = idx + 2;
            }
            // Meters (9999, 0500)
            else if (/^\d{4}$/.test(current)) {
                const meters = parseInt(current, 10);
                value = meters >= 9999 ? 10 : meters / 1609; // Convert to SM
                nextIdx = idx + 1;
            }

            return { value, nextIdx };
        },

        /**
         * Determine flight category from conditions
         * @param {number} visibility - Visibility in statute miles
         * @param {number|null} ceiling - Ceiling in feet AGL (null if clear)
         * @returns {string} VFR | MVFR | IFR | LIFR
         */
        getFlightCategory(visibility, ceiling) {
            // LIFR: < 1sm OR < 500ft
            if (visibility < 1 || (ceiling !== null && ceiling < 500)) {
                return 'LIFR';
            }

            // IFR: 1-3sm OR 500-1000ft
            if (visibility < 3 || (ceiling !== null && ceiling < 1000)) {
                return 'IFR';
            }

            // MVFR: 3-5sm OR 1000-3000ft
            if (visibility <= 5 || (ceiling !== null && ceiling <= 3000)) {
                return 'MVFR';
            }

            // VFR: > 5sm AND > 3000ft (or clear)
            return 'VFR';
        },

        /**
         * Calculate density altitude
         * @param {number} elevation - Field elevation in feet MSL
         * @param {number} tempC - Temperature in Celsius
         * @param {number} altimeter - Altimeter setting in inches Hg
         * @returns {number} Density altitude in feet
         */
        calculateDensityAltitude(elevation, tempC, altimeter) {
            // Pressure altitude = elevation + (29.92 - altimeter) * 1000
            const pressureAlt = elevation + (29.92 - altimeter) * 1000;

            // ISA temperature at this altitude
            // ISA at sea level = 15°C, lapse rate = 2°C per 1000ft
            const isaTemp = 15 - (elevation / 1000) * 2;

            // Temperature deviation from ISA
            const tempDeviation = tempC - isaTemp;

            // Density altitude = PA + (120 * temp deviation)
            return Math.round(pressureAlt + (120 * tempDeviation));
        },

        /**
         * Calculate pressure altitude
         * @param {number} elevation - Field elevation in feet MSL
         * @param {number} altimeter - Altimeter setting in inches Hg
         * @returns {number} Pressure altitude in feet
         */
        calculatePressureAltitude(elevation, altimeter) {
            return Math.round(elevation + (29.92 - altimeter) * 1000);
        },

        /**
         * Calculate wind chill
         * @param {number} tempF - Temperature in Fahrenheit
         * @param {number} windMph - Wind speed in mph
         * @returns {number} Wind chill in Fahrenheit
         */
        calculateWindChill(tempF, windMph) {
            if (tempF > 50 || windMph < 3) {
                return tempF;
            }

            return Math.round(
                35.74 + 0.6215 * tempF -
                35.75 * Math.pow(windMph, 0.16) +
                0.4275 * tempF * Math.pow(windMph, 0.16)
            );
        },

        /**
         * Convert Celsius to Fahrenheit
         * @param {number} celsius - Temperature in Celsius
         * @returns {number} Temperature in Fahrenheit
         */
        celsiusToFahrenheit(celsius) {
            return Math.round(celsius * 9 / 5 + 32);
        },

        /**
         * Convert Fahrenheit to Celsius
         * @param {number} fahrenheit - Temperature in Fahrenheit
         * @returns {number} Temperature in Celsius
         */
        fahrenheitToCelsius(fahrenheit) {
            return Math.round((fahrenheit - 32) * 5 / 9);
        },

        // ============================================
        // HAZARD GEOMETRY FUNCTIONS (Pure)
        // ============================================

        /**
         * Calculate great circle distance between two points in nautical miles
         * Uses Haversine formula
         * @param {number} lat1 - First point latitude
         * @param {number} lon1 - First point longitude
         * @param {number} lat2 - Second point latitude
         * @param {number} lon2 - Second point longitude
         * @returns {number} Distance in nautical miles
         */
        haversineDistance(lat1, lon1, lat2, lon2) {
            const R = 3440.065; // Earth radius in nautical miles
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        },

        /**
         * Check if a point is inside a polygon using ray casting algorithm
         * @param {number} lat - Point latitude
         * @param {number} lon - Point longitude
         * @param {Array} polygon - Array of {lat, lon} coordinates
         * @returns {boolean} True if point is inside polygon
         */
        pointInPolygon(lat, lon, polygon) {
            if (!polygon || polygon.length < 3) return false;

            let inside = false;
            const n = polygon.length;

            for (let i = 0, j = n - 1; i < n; j = i++) {
                const yi = polygon[i].lat;
                const xi = polygon[i].lon;
                const yj = polygon[j].lat;
                const xj = polygon[j].lon;

                if (((yi > lat) !== (yj > lat)) &&
                    (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
            }

            return inside;
        },

        /**
         * Check if a hazard polygon is relevant to a location
         * Point is inside polygon OR any polygon vertex is within radius
         * @param {Object} hazard - Hazard object with coords array
         * @param {number} lat - Location latitude
         * @param {number} lon - Location longitude
         * @param {number} radiusNm - Relevance radius in nautical miles
         * @returns {boolean} True if hazard affects location
         */
        isHazardRelevantToPoint(hazard, lat, lon, radiusNm = 150) {
            if (!hazard || !hazard.coords || hazard.coords.length < 3) {
                return false;
            }

            // Check if point is inside polygon
            if (this.pointInPolygon(lat, lon, hazard.coords)) {
                return true;
            }

            // Check if any polygon vertex is within radius
            for (const coord of hazard.coords) {
                const dist = this.haversineDistance(lat, lon, coord.lat, coord.lon);
                if (dist <= radiusNm) {
                    return true;
                }
            }

            return false;
        },

        /**
         * Check if a hazard polygon intersects with a route corridor
         * @param {Object} hazard - Hazard object with coords array
         * @param {Array} waypoints - Route waypoints with lat/lon
         * @param {number} corridorNm - Corridor width in nautical miles
         * @returns {boolean} True if hazard intersects route corridor
         */
        isHazardRelevantToRoute(hazard, waypoints, corridorNm = 50) {
            if (!hazard || !hazard.coords || hazard.coords.length < 3) {
                return false;
            }
            if (!waypoints || waypoints.length === 0) {
                return false;
            }

            // Check if any waypoint is inside the polygon
            for (const wp of waypoints) {
                if (wp.lat !== undefined && wp.lon !== undefined) {
                    if (this.pointInPolygon(wp.lat, wp.lon, hazard.coords)) {
                        return true;
                    }
                }
            }

            // Check if any polygon vertex is within corridor of any waypoint
            for (const coord of hazard.coords) {
                for (const wp of waypoints) {
                    if (wp.lat !== undefined && wp.lon !== undefined) {
                        const dist = this.haversineDistance(coord.lat, coord.lon, wp.lat, wp.lon);
                        if (dist <= corridorNm) {
                            return true;
                        }
                    }
                }
            }

            return false;
        },

        /**
         * Find waypoints affected by a hazard polygon
         * @param {Object} hazard - Hazard object with coords array
         * @param {Array} waypoints - Route waypoints with lat/lon and ident
         * @param {number} corridorNm - Corridor width in nautical miles
         * @returns {Array} Array of affected waypoint identifiers
         */
        findAffectedWaypoints(hazard, waypoints, corridorNm = 50) {
            if (!hazard || !hazard.coords || hazard.coords.length < 3) {
                return [];
            }
            if (!waypoints || waypoints.length === 0) {
                return [];
            }

            const affected = [];

            for (const wp of waypoints) {
                if (wp.lat === undefined || wp.lon === undefined) continue;

                const ident = wp.icao || wp.ident || wp.name || 'WPT';
                let isAffected = false;

                // Check if inside polygon
                if (this.pointInPolygon(wp.lat, wp.lon, hazard.coords)) {
                    isAffected = true;
                } else {
                    // Check distance to polygon vertices
                    for (const coord of hazard.coords) {
                        const dist = this.haversineDistance(wp.lat, wp.lon, coord.lat, coord.lon);
                        if (dist <= corridorNm) {
                            isAffected = true;
                            break;
                        }
                    }
                }

                if (isAffected) {
                    affected.push(ident);
                }
            }

            return affected;
        },

        /**
         * Get color for hazard type
         * @param {string} hazard - Hazard code (e.g., 'ICE', 'TURB', 'IFR')
         * @returns {string} CSS color string
         */
        getHazardColor(hazard) {
            const h = (hazard || '').toUpperCase();
            // IFR/visibility - Red
            if (h === 'IFR' || h.includes('VIS')) return '#FF4444';
            // Mountain obscuration - Red
            if (h === 'MT_OBSC' || h.includes('MTN') || h.includes('OBSC')) return '#FF6666';
            // Icing - Cyan
            if (h === 'ICE' || h.includes('ICE') || h === 'FZLVL' || h === 'M_FZLVL') return '#00DDDD';
            // Turbulence - Orange
            if (h.includes('TURB')) return '#FFA500';
            // Low-level wind shear - Yellow
            if (h === 'LLWS' || h.includes('WIND') || h === 'SFC_WND') return '#FFDD00';
            // Thunderstorm - Yellow
            if (h.includes('TS') || h.includes('CONVECTIVE')) return '#FFFF00';
            // Default - Yellow
            return '#FFFF00';
        },

        /**
         * Get human-readable hazard label
         * @param {string} hazard - Hazard code
         * @returns {string} Human-readable label
         */
        getHazardLabel(hazard) {
            // Use uppercase abbreviations for compact display
            const labels = {
                'IFR': 'IFR',
                'MT_OBSC': 'MT OBSCN',
                'ICE': 'ICE',
                'FZLVL': 'FZLVL',
                'M_FZLVL': 'M-FZLVL',
                'TURB-HI': 'TURB-HI',
                'TURB-LO': 'TURB-LO',
                'LLWS': 'LLWS',
                'SFC_WND': 'SFC WND',
                'CONVECTIVE': 'CONVECT'
            };
            return labels[hazard] || (hazard || 'UNKNOWN').toUpperCase();
        },

        /**
         * Calculate bounding box of a polygon
         * @param {Array} coords - Array of {lat, lon} coordinates
         * @returns {Object|null} {minLat, maxLat, minLon, maxLon} or null
         */
        getPolygonBounds(coords) {
            if (!coords || coords.length === 0) return null;

            let minLat = Infinity, maxLat = -Infinity;
            let minLon = Infinity, maxLon = -Infinity;

            for (const coord of coords) {
                if (coord.lat < minLat) minLat = coord.lat;
                if (coord.lat > maxLat) maxLat = coord.lat;
                if (coord.lon < minLon) minLon = coord.lon;
                if (coord.lon > maxLon) maxLon = coord.lon;
            }

            return { minLat, maxLat, minLon, maxLon };
        },

        // ============================================
        // VALIDITY-BASED CACHE EXPIRATION (Pure)
        // ============================================

        /**
         * Calculate METAR cache expiration time
         * METARs are valid until 5 minutes past the next hour after observation
         * @param {number} obsTime - Observation time (Unix timestamp in seconds)
         * @returns {number} Expiration time (Unix timestamp in milliseconds)
         */
        calculateMETARExpiration(obsTime) {
            if (!obsTime) return Date.now() + 60 * 60 * 1000; // 1 hour fallback

            const obsTimeMs = obsTime * 1000;
            const obsDate = new Date(obsTimeMs);
            const nextHour = new Date(obsDate);
            nextHour.setHours(nextHour.getHours() + 1);
            nextHour.setMinutes(5, 0, 0); // 5 minutes past next hour
            return nextHour.getTime();
        },

        /**
         * Calculate TAF cache expiration time
         * TAFs are valid until their validTimeTo
         * @param {number} validTimeTo - Valid time to (Unix timestamp in seconds)
         * @returns {number} Expiration time (Unix timestamp in milliseconds)
         */
        calculateTAFExpiration(validTimeTo) {
            if (!validTimeTo) return Date.now() + 6 * 60 * 60 * 1000; // 6 hour fallback
            return validTimeTo * 1000;
        },

        // ============================================
        // TIME-BASED WEATHER ANALYSIS (Pure)
        // ============================================

        /**
         * Calculate ETA for each waypoint based on leg times
         * @param {Array} legs - Route legs with legTime in minutes
         * @param {Date} departureTime - Departure time
         * @returns {Array} Array of ETA Date objects indexed by waypoint index
         */
        calculateWaypointETAs(legs, departureTime) {
            const etas = [];
            let cumulativeMinutes = 0;

            // First waypoint (departure) - ETA is departure time
            etas.push(new Date(departureTime));

            // Calculate ETA for each subsequent waypoint
            // Note: legs may use 'ete' (from navigation.js) or 'legTime' (from route-calculator.js)
            for (let i = 0; i < legs.length; i++) {
                const leg = legs[i];
                cumulativeMinutes += leg.ete || leg.legTime || 0;
                etas.push(new Date(departureTime.getTime() + cumulativeMinutes * 60 * 1000));
            }

            return etas;
        },

        /**
         * Check if a weather hazard is valid for a given waypoint based on ETA
         * @param {Object} weather - Weather object with time fields
         * @param {Date} waypointETA - ETA at the waypoint
         * @param {string} type - 'sigmet' or 'gairmet'
         * @returns {boolean} True if hazard will be active when aircraft reaches waypoint
         */
        isWeatherValidAtTime(weather, waypointETA, type) {
            if (!waypointETA) return true; // If no ETA, assume valid

            const etaMs = waypointETA.getTime();

            if (type === 'sigmet') {
                // SIGMET times are Unix timestamps in seconds
                const validFrom = weather.validTimeFrom ? weather.validTimeFrom * 1000 : 0;
                const validTo = weather.validTimeTo ? weather.validTimeTo * 1000 : Infinity;

                // Check if ETA falls within the SIGMET's valid window
                // Use <= for expiry since hazard may still affect you at boundary
                return etaMs >= validFrom && etaMs <= validTo;
            } else if (type === 'gairmet') {
                // G-AIRMET times are ISO strings
                const validTime = weather.validTime ? new Date(weather.validTime).getTime() : 0;
                const expireTime = weather.expireTime ? new Date(weather.expireTime).getTime() : Infinity;

                // DEBUG: Log time comparison for troubleshooting
                // console.log('[Weather] G-AIRMET time check:', {
                //     eta: new Date(etaMs).toISOString(),
                //     validTime: weather.validTime,
                //     expireTime: weather.expireTime,
                //     validTimeMs: validTime,
                //     expireTimeMs: expireTime,
                //     result: etaMs >= validTime && etaMs <= expireTime
                // });

                // Check if ETA falls within the G-AIRMET's valid window
                // Use <= for expiry since hazard may still affect you at boundary
                return etaMs >= validTime && etaMs <= expireTime;
            }

            return true; // Default to valid if unknown type
        },

        /**
         * Format relative time from departure as "T+xxH yyM"
         * @param {Date} targetTime - The time to format
         * @param {Date} departureTime - Departure time as reference
         * @returns {string} Formatted relative time like "T+1H 30M" or "T+0H 15M"
         */
        formatRelativeTime(targetTime, departureTime) {
            if (!targetTime || !departureTime) return '';
            const diffMs = targetTime.getTime() - departureTime.getTime();
            if (diffMs < 0) return 'T+0H 0M'; // Before departure
            const totalMinutes = Math.round(diffMs / (60 * 1000));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `T+${hours}H ${minutes}M`;
        },

        /**
         * Find waypoints affected by a hazard with index information
         * Returns waypoints with their index in route order for time-based filtering
         * @param {Object} hazard - Hazard object with coords array
         * @param {Array} waypoints - Route waypoints with lat/lon and ident
         * @param {number} corridorNm - Corridor width in nautical miles
         * @returns {Array} Array of {ident, index} objects in route order
         */
        findAffectedWaypointsWithIndex(hazard, waypoints, corridorNm = 50) {
            if (!hazard || !hazard.coords || hazard.coords.length < 3) {
                return [];
            }
            if (!waypoints || waypoints.length === 0) {
                return [];
            }

            const affected = [];

            for (let i = 0; i < waypoints.length; i++) {
                const wp = waypoints[i];
                if (wp.lat === undefined || wp.lon === undefined) continue;

                const ident = wp.icao || wp.ident || wp.name || 'WPT';
                let isAffected = false;

                // Check if inside polygon
                if (this.pointInPolygon(wp.lat, wp.lon, hazard.coords)) {
                    isAffected = true;
                } else {
                    // Check distance to polygon vertices
                    for (const coord of hazard.coords) {
                        const dist = this.haversineDistance(wp.lat, wp.lon, coord.lat, coord.lon);
                        if (dist <= corridorNm) {
                            isAffected = true;
                            break;
                        }
                    }
                }

                if (isAffected) {
                    affected.push({ ident, index: i + 1 }); // 1-based index
                }
            }

            return affected;
        },

        /**
         * Format affected waypoints as range notation
         * e.g., "KALB(1)-SYR(3), ROC(5)-BUF(7)" for consecutive ranges
         * @param {Array} affectedWaypoints - Array of {ident, index} objects
         * @returns {string} Formatted range string
         */
        formatAffectedWaypointsRange(affectedWaypoints) {
            if (!affectedWaypoints || affectedWaypoints.length === 0) {
                return '';
            }

            // Sort by index (should already be sorted, but ensure)
            const sorted = [...affectedWaypoints].sort((a, b) => a.index - b.index);

            // Group into consecutive ranges
            const ranges = [];
            let rangeStart = sorted[0];
            let rangeEnd = sorted[0];

            for (let i = 1; i < sorted.length; i++) {
                const current = sorted[i];
                // Check if consecutive (index differs by 1)
                if (current.index === rangeEnd.index + 1) {
                    rangeEnd = current;
                } else {
                    // End current range, start new one
                    ranges.push({ start: rangeStart, end: rangeEnd });
                    rangeStart = current;
                    rangeEnd = current;
                }
            }
            // Don't forget the last range
            ranges.push({ start: rangeStart, end: rangeEnd });

            // Format ranges
            const formatted = ranges.map(range => {
                if (range.start.index === range.end.index) {
                    return `${range.start.ident}(${range.start.index})`;
                } else {
                    return `${range.start.ident}(${range.start.index})-${range.end.ident}(${range.end.index})`;
                }
            });

            return formatted.join(', ');
        },

        /**
         * Calculate the affected time range for waypoints
         * @param {Array} affectedWaypoints - Array of {ident, index} objects
         * @param {Array} waypointETAs - Array of Date objects for each waypoint
         * @param {Date} departureTime - Departure time as reference
         * @returns {Object|null} {startTime, endTime, formattedRange} or null
         */
        calculateAffectedTimeRange(affectedWaypoints, waypointETAs, departureTime) {
            if (!affectedWaypoints || affectedWaypoints.length === 0 || !waypointETAs || !departureTime) {
                return null;
            }

            // Get ETAs for affected waypoints (index is 1-based)
            const affectedETAs = affectedWaypoints
                .map(wp => waypointETAs[wp.index - 1])
                .filter(eta => eta instanceof Date);

            if (affectedETAs.length === 0) return null;

            const startTime = new Date(Math.min(...affectedETAs.map(d => d.getTime())));
            const endTime = new Date(Math.max(...affectedETAs.map(d => d.getTime())));

            const startFormatted = this.formatRelativeTime(startTime, departureTime);
            const endFormatted = this.formatRelativeTime(endTime, departureTime);

            // If same time, just show single time
            if (startFormatted === endFormatted) {
                return {
                    startTime,
                    endTime,
                    formattedRange: startFormatted
                };
            }

            return {
                startTime,
                endTime,
                formattedRange: `${startFormatted} - ${endFormatted}`
            };
        },

        /**
         * Get ceiling from METAR cloud data
         * @param {Object} metarData - METAR data object from API
         * @returns {number|null} Ceiling in feet or null if clear
         */
        getCeilingFromMETAR(metarData) {
            if (!metarData || !metarData.clouds) return null;

            for (const cloud of metarData.clouds) {
                if (cloud.cover === 'BKN' || cloud.cover === 'OVC' || cloud.cover === 'VV') {
                    return cloud.base || null;
                }
            }

            return null;
        },

        /**
         * Calculate bearing from point 1 to point 2
         * @returns {number} Bearing in degrees (0-360)
         */
        calculateBearing(lat1, lon1, lat2, lon2) {
            const toRad = deg => deg * Math.PI / 180;
            const toDeg = rad => rad * 180 / Math.PI;

            const dLon = toRad(lon2 - lon1);
            const y = Math.sin(dLon) * Math.cos(toRad(lat2));
            const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
            let bearing = toDeg(Math.atan2(y, x));
            return (bearing + 360) % 360;
        },

        /**
         * Convert bearing to cardinal direction (N, NE, E, SE, S, SW, W, NW)
         * @param {number} bearing - Bearing in degrees
         * @returns {string} Cardinal direction
         */
        bearingToCardinal(bearing) {
            const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            const index = Math.round(bearing / 45) % 8;
            return directions[index];
        },

        /**
         * Filter PIREPs to those within a route corridor
         * @param {Array} pireps - Array of PIREP objects with lat/lon
         * @param {Array} waypoints - Route waypoints
         * @param {number} corridorNm - Corridor width in nautical miles
         * @returns {Array} Filtered PIREPs within corridor
         */
        filterPirepsWithinCorridor(pireps, waypoints, corridorNm = 50) {
            if (!pireps || pireps.length === 0 || !waypoints || waypoints.length === 0) {
                return [];
            }

            return pireps.filter(pirep => {
                if (pirep.lat === undefined || pirep.lon === undefined) return false;

                // Check if PIREP is within corridor of any waypoint
                for (const wp of waypoints) {
                    if (wp.lat !== undefined && wp.lon !== undefined) {
                        const dist = this.haversineDistance(pirep.lat, pirep.lon, wp.lat, wp.lon);
                        if (dist <= corridorNm) {
                            return true;
                        }
                    }
                }
                return false;
            });
        },

        /**
         * Parse turbulence info from PIREP raw text
         * @param {string} rawOb - Raw PIREP text
         * @returns {Object|null} {intensity, altLo, altHi} or null
         */
        parsePirepTurbulence(rawOb) {
            if (!rawOb) return null;
            // Match /TB followed by intensity and optional altitude
            // Examples: /TB MOD, /TB LGT-MOD, /TB SEV 180-220, /TB NEG
            const match = rawOb.match(/\/TB\s+(NEG|SMTH|LGT|MOD|SEV|EXTRM)(?:[-\/](LGT|MOD|SEV|EXTRM))?(?:\s+(\d{3})(?:-(\d{3}))?)?/i);
            if (!match) return null;

            const intensity1 = (match[1] || '').toUpperCase();
            const intensity2 = (match[2] || '').toUpperCase();
            // Use worst intensity
            const intensityOrder = { 'NEG': 0, 'SMTH': 0, 'LGT': 1, 'MOD': 2, 'SEV': 3, 'EXTRM': 4 };
            const intensity = (intensityOrder[intensity2] || 0) > (intensityOrder[intensity1] || 0) ? intensity2 : intensity1;

            if (intensity === 'NEG' || intensity === 'SMTH') return null; // No turbulence

            return {
                intensity,
                altLo: match[3] ? parseInt(match[3]) * 100 : null,
                altHi: match[4] ? parseInt(match[4]) * 100 : null
            };
        },

        /**
         * Parse icing info from PIREP raw text
         * @param {string} rawOb - Raw PIREP text
         * @returns {Object|null} {intensity, type, altLo, altHi} or null
         */
        parsePirepIcing(rawOb) {
            if (!rawOb) return null;
            // Match /IC followed by intensity, optional type, and optional altitude
            // Examples: /IC LGT RIME, /IC MOD CLR 080-100, /IC NEG
            const match = rawOb.match(/\/IC\s+(NEG|TRC|LGT|MOD|SEV)(?:\s+(RIME|CLR|MXD|MIX))?(?:\s+(\d{3})(?:-(\d{3}))?)?/i);
            if (!match) return null;

            const intensity = (match[1] || '').toUpperCase();
            if (intensity === 'NEG') return null; // No icing

            return {
                intensity,
                type: (match[2] || '').toUpperCase() || null,
                altLo: match[3] ? parseInt(match[3]) * 100 : null,
                altHi: match[4] ? parseInt(match[4]) * 100 : null
            };
        },

        /**
         * Filter PIREPs by route and extract hazard info
         * @param {Array} pireps - Array of PIREP objects
         * @param {Array} waypoints - Array of waypoint objects
         * @param {number} corridorNm - Corridor width in nautical miles
         * @param {number} filedAltitude - Filed altitude in feet
         * @returns {Object} {turbulence: [], icing: []} arrays of hazard PIREPs
         */
        analyzePirepsForRoute(pireps, waypoints, corridorNm = 30, filedAltitude = null) {
            const result = { turbulence: [], icing: [] };
            if (!pireps || !waypoints || waypoints.length === 0) return result;

            const now = Date.now() / 1000;
            const maxAge = 2 * 60 * 60; // 2 hours in seconds

            for (const pirep of pireps) {
                // Skip old PIREPs
                if (pirep.obsTime && (now - pirep.obsTime) > maxAge) continue;

                // Check if PIREP is near route and find nearest waypoint with details
                let nearRoute = false;
                let nearestWpIndex = null;
                let nearestWpIdent = null;
                let minDist = Infinity;
                let nearestWpLat = null;
                let nearestWpLon = null;

                for (let i = 0; i < waypoints.length; i++) {
                    const wp = waypoints[i];
                    if (wp.lat !== undefined && wp.lon !== undefined) {
                        const dist = this.haversineDistance(pirep.lat, pirep.lon, wp.lat, wp.lon);
                        if (dist <= corridorNm && dist < minDist) {
                            nearRoute = true;
                            minDist = dist;
                            nearestWpIndex = i + 1; // 1-based index
                            nearestWpIdent = wp.ident || wp.icao || wp.code || `WP${i + 1}`;
                            nearestWpLat = wp.lat;
                            nearestWpLon = wp.lon;
                        }
                    }
                }

                if (!nearRoute) continue;

                // Calculate bearing from waypoint to PIREP for direction display
                let directionFromWp = '';
                if (nearestWpLat !== null && minDist > 1) {
                    const bearing = this.calculateBearing(nearestWpLat, nearestWpLon, pirep.lat, pirep.lon);
                    directionFromWp = this.bearingToCardinal(bearing);
                }

                // Check altitude if filed altitude specified
                const altCheck = (lo, hi) => {
                    if (!filedAltitude) return true;
                    if (!lo && !hi) return true; // No altitude info, include
                    const alt = filedAltitude;
                    if (lo && hi) return alt >= lo - 2000 && alt <= hi + 2000;
                    if (lo) return alt >= lo - 2000;
                    if (hi) return alt <= hi + 2000;
                    return true;
                };

                // Parse turbulence
                const turb = this.parsePirepTurbulence(pirep.rawOb);
                if (turb && altCheck(turb.altLo, turb.altHi)) {
                    result.turbulence.push({
                        ...turb,
                        lat: pirep.lat,
                        lon: pirep.lon,
                        fltLvl: pirep.fltLvl,
                        obsTime: pirep.obsTime,
                        reportType: pirep.reportType,
                        nearestWpIndex,
                        nearestWpIdent,
                        distanceNm: Math.round(minDist),
                        direction: directionFromWp,
                        rawOb: pirep.rawOb
                    });
                }

                // Parse icing
                const ice = this.parsePirepIcing(pirep.rawOb);
                if (ice && altCheck(ice.altLo, ice.altHi)) {
                    result.icing.push({
                        ...ice,
                        lat: pirep.lat,
                        lon: pirep.lon,
                        fltLvl: pirep.fltLvl,
                        obsTime: pirep.obsTime,
                        reportType: pirep.reportType,
                        nearestWpIndex,
                        nearestWpIdent,
                        distanceNm: Math.round(minDist),
                        direction: directionFromWp,
                        rawOb: pirep.rawOb
                    });
                }
            }

            return result;
        }
    };

    // Export to window
    window.Weather = Weather;

})();
