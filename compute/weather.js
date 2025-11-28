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
        }
    };

    // Export to window
    window.Weather = Weather;

})();
