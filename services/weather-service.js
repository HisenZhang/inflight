// Weather Service - Weather Data Orchestration
// Architecture v3.0.0 - Service Layer

(function() {
    'use strict';

    /**
     * Weather data service - orchestrates Data and Compute layers for weather operations.
     */
    class WeatherService {
        /**
         * Create a weather service
         * @param {Object} deps - Dependencies
         * @param {Object} deps.dataRepository - Data repository instance
         */
        constructor({ dataRepository }) {
            this._repo = dataRepository;
        }

        /**
         * Get parsed METAR for a station
         * @param {string} station - Station identifier (ICAO code)
         * @returns {Promise<Object|null>} Parsed METAR or null
         */
        async getMETAR(station) {
            if (!station) return null;

            const raw = await this._repo.get('weather_metar', station.toUpperCase());

            if (!raw) return null;

            return window.Weather.parseMETAR(raw);
        }

        /**
         * Get weather for multiple stations
         * @param {Array<string>} stations - Array of station identifiers
         * @returns {Promise<Object>} Object keyed by station
         */
        async getMETARs(stations) {
            const results = {};

            await Promise.all(
                stations.map(async (station) => {
                    results[station] = await this.getMETAR(station);
                })
            );

            return results;
        }

        /**
         * Get weather along a route
         * @param {Array} waypoints - Route waypoints with type and icao
         * @returns {Promise<Array>} Weather for each airport on route
         */
        async getRouteWeather(waypoints) {
            if (!waypoints || waypoints.length === 0) {
                return [];
            }

            // Filter to just airports
            const stations = waypoints
                .filter(w => w.type === 'airport')
                .map(w => w.icao);

            // Fetch METARs in parallel
            const metars = await Promise.all(
                stations.map(s => this.getMETAR(s))
            );

            // Build result with flight categories
            return stations.map((station, i) => {
                const metar = metars[i];
                let category = null;

                if (metar && metar.visibility != null) {
                    category = window.Weather.getFlightCategory(
                        metar.visibility,
                        metar.ceiling
                    );
                }

                return {
                    station,
                    metar,
                    category
                };
            });
        }

        /**
         * Get flight category for a station
         * @param {string} station - Station identifier
         * @returns {Promise<string|null>} VFR, MVFR, IFR, LIFR, or null
         */
        async getFlightCategory(station) {
            const metar = await this.getMETAR(station);

            if (!metar || metar.visibility == null) {
                return null;
            }

            return window.Weather.getFlightCategory(
                metar.visibility,
                metar.ceiling
            );
        }

        /**
         * Calculate density altitude for a station
         * @param {string} station - Station identifier
         * @param {number} elevation - Field elevation in feet
         * @returns {Promise<number|null>} Density altitude in feet
         */
        async getDensityAltitude(station, elevation) {
            const metar = await this.getMETAR(station);

            if (!metar || metar.temperature == null || metar.altimeter == null) {
                return null;
            }

            return window.Weather.calculateDensityAltitude(
                elevation,
                metar.temperature,
                metar.altimeter
            );
        }

        /**
         * Check if conditions are VFR
         * @param {string} station - Station identifier
         * @returns {Promise<boolean>} True if VFR
         */
        async isVFR(station) {
            const category = await this.getFlightCategory(station);
            return category === 'VFR';
        }

        /**
         * Check if conditions are IFR or worse
         * @param {string} station - Station identifier
         * @returns {Promise<boolean>} True if IFR or LIFR
         */
        async isIFR(station) {
            const category = await this.getFlightCategory(station);
            return category === 'IFR' || category === 'LIFR';
        }

        /**
         * Get weather summary for briefing
         * @param {Array<string>} stations - Stations to include
         * @returns {Promise<Object>} Weather summary
         */
        async getWeatherBriefing(stations) {
            const metars = await this.getMETARs(stations);

            const summary = {
                stations: {},
                worstCategory: 'VFR',
                allVFR: true,
                anyIFR: false,
                timestamp: new Date().toISOString()
            };

            const categoryRank = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 };
            let worstRank = 0;

            for (const [station, metar] of Object.entries(metars)) {
                let category = null;

                if (metar && metar.visibility != null) {
                    category = window.Weather.getFlightCategory(
                        metar.visibility,
                        metar.ceiling
                    );

                    const rank = categoryRank[category] || 0;
                    if (rank > worstRank) {
                        worstRank = rank;
                        summary.worstCategory = category;
                    }

                    if (category !== 'VFR') {
                        summary.allVFR = false;
                    }

                    if (category === 'IFR' || category === 'LIFR') {
                        summary.anyIFR = true;
                    }
                }

                summary.stations[station] = {
                    metar,
                    category,
                    available: metar !== null
                };
            }

            return summary;
        }
    }

    // Export to window
    window.WeatherService = WeatherService;

})();
