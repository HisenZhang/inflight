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

        // ============================================
        // HAZARD FILTERING
        // ============================================

        /**
         * Filter hazards to those relevant to a specific location
         * @param {Array} hazards - Array of hazard objects with coords
         * @param {number} lat - Location latitude
         * @param {number} lon - Location longitude
         * @param {number} radiusNm - Relevance radius in nautical miles
         * @returns {Array} Filtered hazards
         */
        filterHazardsForLocation(hazards, lat, lon, radiusNm = 150) {
            if (!hazards || !Array.isArray(hazards)) return [];
            if (lat === undefined || lon === undefined) return hazards;

            return hazards.filter(hazard =>
                window.Weather.isHazardRelevantToPoint(hazard, lat, lon, radiusNm)
            );
        }

        /**
         * Filter hazards to those relevant to a route
         * @param {Array} hazards - Array of hazard objects with coords
         * @param {Array} waypoints - Route waypoints with lat/lon
         * @param {number} corridorNm - Corridor width in nautical miles
         * @returns {Array} Filtered hazards
         */
        filterHazardsForRoute(hazards, waypoints, corridorNm = 50) {
            if (!hazards || !Array.isArray(hazards)) return [];
            if (!waypoints || waypoints.length === 0) return hazards;

            return hazards.filter(hazard =>
                window.Weather.isHazardRelevantToRoute(hazard, waypoints, corridorNm)
            );
        }

        /**
         * Get route hazard analysis
         * Analyzes SIGMETs and G-AIRMETs affecting the route
         * @param {Array} sigmets - Array of SIGMET objects
         * @param {Array} gairmets - Array of G-AIRMET objects
         * @param {Array} waypoints - Route waypoints with lat/lon
         * @param {number} corridorNm - Corridor width in nautical miles
         * @returns {Object} Hazard analysis with affected waypoints
         */
        analyzeRouteHazards(sigmets, gairmets, waypoints, corridorNm = 50) {
            const analysis = {
                sigmets: [],
                gairmets: [],
                affectedWaypoints: new Set(),
                hasIcing: false,
                hasTurbulence: false,
                hasIFR: false,
                hasConvective: false,
                timestamp: new Date().toISOString()
            };

            // Analyze SIGMETs
            const relevantSigmets = this.filterHazardsForRoute(sigmets || [], waypoints, corridorNm);
            for (const sigmet of relevantSigmets) {
                const affected = window.Weather.findAffectedWaypoints(sigmet, waypoints, corridorNm);
                affected.forEach(wp => analysis.affectedWaypoints.add(wp));

                const hazard = (sigmet.hazard || '').toUpperCase();
                if (hazard.includes('ICE')) analysis.hasIcing = true;
                if (hazard.includes('TURB')) analysis.hasTurbulence = true;
                if (hazard.includes('TS') || hazard.includes('CONVECTIVE')) analysis.hasConvective = true;

                analysis.sigmets.push({
                    ...sigmet,
                    affectedWaypoints: affected,
                    color: window.Weather.getHazardColor(hazard),
                    label: window.Weather.getHazardLabel(hazard)
                });
            }

            // Analyze G-AIRMETs
            const relevantGairmets = this.filterHazardsForRoute(gairmets || [], waypoints, corridorNm);
            for (const gairmet of relevantGairmets) {
                const affected = window.Weather.findAffectedWaypoints(gairmet, waypoints, corridorNm);
                affected.forEach(wp => analysis.affectedWaypoints.add(wp));

                const hazard = (gairmet.hazard || '').toUpperCase();
                if (hazard.includes('ICE') || hazard === 'FZLVL' || hazard === 'M_FZLVL') analysis.hasIcing = true;
                if (hazard.includes('TURB') || hazard === 'LLWS') analysis.hasTurbulence = true;
                if (hazard === 'IFR' || hazard === 'MT_OBSC') analysis.hasIFR = true;

                analysis.gairmets.push({
                    ...gairmet,
                    affectedWaypoints: affected,
                    color: window.Weather.getHazardColor(hazard),
                    label: window.Weather.getHazardLabel(hazard)
                });
            }

            // Convert Set to Array
            analysis.affectedWaypoints = Array.from(analysis.affectedWaypoints);

            return analysis;
        }

        /**
         * Comprehensive weather hazard analysis with time-based filtering
         * Checks SIGMETs, G-AIRMETs, METARs, TAFs, and PIREPs
         * @param {Array} waypoints - Route waypoints
         * @param {Array} legs - Route legs (with legTime in minutes)
         * @param {number} filedAltitude - Filed altitude in feet
         * @param {Date} departureTime - Planned departure time (defaults to now)
         * @returns {Promise<Object>} Weather hazards analysis
         */
        async analyzeWeatherHazards(waypoints, legs, filedAltitude, departureTime = null) {
            const hazards = {
                sigmets: [],      // SIGMETs affecting route
                gairmets: [],     // G-AIRMETs affecting route
                airportWx: [],    // Airport weather hazards (IFR, LIFR, etc.)
                densityAlt: null, // Density altitude concern
                icing: [],        // Icing reports/forecasts
                turbulence: [],   // Turbulence reports
                pireps: []        // Relevant PIREPs
            };

            if (!waypoints || waypoints.length < 2) {
                return hazards;
            }

            // Calculate ETA for each waypoint
            const depTime = departureTime ? new Date(departureTime) : new Date();
            const waypointETAs = window.Weather.calculateWaypointETAs(legs || [], depTime);

            try {
                // Get departure and destination ICAO codes
                const departure = waypoints[0];
                const destination = waypoints[waypoints.length - 1];
                const depIcao = departure.icao || departure.ident;
                const destIcao = destination.icao || destination.ident;

                // Fetch weather data in parallel via WeatherAPI
                const [sigmets, gairmets, allPireps, depMetar, destMetar] = await Promise.allSettled([
                    window.WeatherAPI ? window.WeatherAPI.fetchSIGMETs() : Promise.resolve([]),
                    window.WeatherAPI ? window.WeatherAPI.fetchGAIRMETs() : Promise.resolve([]),
                    window.WeatherAPI ? window.WeatherAPI.fetchAllPIREPs() : Promise.resolve([]),
                    window.WeatherAPI && depIcao ? window.WeatherAPI.fetchMETAR(depIcao) : Promise.resolve(null),
                    window.WeatherAPI && destIcao ? window.WeatherAPI.fetchMETAR(destIcao) : Promise.resolve(null)
                ]);

                // Analyze SIGMETs affecting route corridor
                const allSigmets = sigmets.status === 'fulfilled' ? (sigmets.value || []) : [];
                for (const sigmet of allSigmets) {
                    if (!window.Weather.isHazardRelevantToRoute(sigmet, waypoints, 50)) continue;

                    // Check altitude overlap if we have filed altitude
                    const overlapsAlt = !filedAltitude ||
                        ((!sigmet.altitudeLow1 || filedAltitude >= sigmet.altitudeLow1) &&
                         (!sigmet.altitudeHi1 || filedAltitude <= sigmet.altitudeHi1));

                    if (overlapsAlt) {
                        // Find affected waypoints and filter by time
                        const allAffectedWpts = window.Weather.findAffectedWaypointsWithIndex(sigmet, waypoints, 50);
                        const timeFilteredWpts = allAffectedWpts.filter(wp => {
                            const eta = waypointETAs[wp.index - 1];
                            return window.Weather.isWeatherValidAtTime(sigmet, eta, 'sigmet');
                        });

                        if (timeFilteredWpts.length > 0) {
                            const timeRange = window.Weather.calculateAffectedTimeRange(timeFilteredWpts, waypointETAs, depTime);
                            hazards.sigmets.push({
                                type: sigmet.airSigmetType || 'SIGMET',
                                hazard: sigmet.hazard || 'UNKNOWN',
                                severity: sigmet.severity,
                                affectedWaypoints: timeFilteredWpts,
                                validTimeFrom: sigmet.validTimeFrom,
                                validTimeTo: sigmet.validTimeTo,
                                timeRange: timeRange,
                                color: window.Weather.getHazardColor(sigmet.hazard),
                                label: window.Weather.getHazardLabel(sigmet.hazard)
                            });
                        }
                    }
                }

                // Analyze G-AIRMETs affecting route corridor
                const allGairmets = gairmets.status === 'fulfilled' ? (gairmets.value || []) : [];
                for (const gairmet of allGairmets) {
                    if (!window.Weather.isHazardRelevantToRoute(gairmet, waypoints, 50)) continue;

                    // Find affected waypoints and filter by time
                    const allAffectedWpts = window.Weather.findAffectedWaypointsWithIndex(gairmet, waypoints, 50);
                    const timeFilteredWpts = allAffectedWpts.filter(wp => {
                        const eta = waypointETAs[wp.index - 1];
                        return window.Weather.isWeatherValidAtTime(gairmet, eta, 'gairmet');
                    });

                    if (timeFilteredWpts.length > 0) {
                        const timeRange = window.Weather.calculateAffectedTimeRange(timeFilteredWpts, waypointETAs, depTime);
                        const hazardType = (gairmet.hazard || '').toUpperCase();

                        hazards.gairmets.push({
                            hazard: gairmet.hazard || 'UNKNOWN',
                            dueTo: gairmet.dueTo,
                            validTime: gairmet.validTime,
                            expireTime: gairmet.expireTime,
                            affectedWaypoints: timeFilteredWpts,
                            timeRange: timeRange,
                            color: window.Weather.getHazardColor(gairmet.hazard),
                            label: window.Weather.getHazardLabel(gairmet.hazard)
                        });

                        // Categorize specific hazard types
                        if (hazardType.includes('ICE') || hazardType.includes('ICING')) {
                            hazards.icing.push({
                                source: 'G-AIRMET',
                                type: gairmet.hazard,
                                affectedWaypoints: timeFilteredWpts,
                                timeRange: timeRange
                            });
                        }
                        if (hazardType.includes('TURB') || hazardType === 'LLWS') {
                            hazards.turbulence.push({
                                source: 'G-AIRMET',
                                type: gairmet.hazard,
                                affectedWaypoints: timeFilteredWpts,
                                timeRange: timeRange
                            });
                        }
                    }
                }

                // Analyze departure airport weather
                const depMetarData = depMetar.status === 'fulfilled' ? depMetar.value : null;
                if (depMetarData && depIcao) {
                    const flightCat = window.WeatherAPI.getFlightCategoryFromMETAR(depMetarData);
                    if (flightCat === 'IFR' || flightCat === 'LIFR') {
                        hazards.airportWx.push({
                            icao: depIcao,
                            type: 'DEPARTURE',
                            flightCategory: flightCat,
                            visibility: depMetarData.visib,
                            ceiling: window.Weather.getCeilingFromMETAR(depMetarData)
                        });
                    }

                    // Calculate density altitude at departure
                    if (departure.elevation !== undefined && depMetarData.temp !== undefined) {
                        const pressureAlt = departure.elevation;
                        const altimeter = depMetarData.altim || 29.92;
                        const densityAlt = window.Weather.calculateDensityAltitude(departure.elevation, depMetarData.temp, altimeter);
                        const daDiff = densityAlt - departure.elevation;

                        if (daDiff > 1000) {
                            hazards.densityAlt = {
                                airport: depIcao,
                                fieldElev: departure.elevation,
                                densityAlt: densityAlt,
                                difference: daDiff,
                                temp: depMetarData.temp
                            };
                        }
                    }
                }

                // Analyze destination airport weather
                const destMetarData = destMetar.status === 'fulfilled' ? destMetar.value : null;
                if (destMetarData && destIcao) {
                    const flightCat = window.WeatherAPI.getFlightCategoryFromMETAR(destMetarData);
                    if (flightCat === 'IFR' || flightCat === 'LIFR') {
                        hazards.airportWx.push({
                            icao: destIcao,
                            type: 'DESTINATION',
                            flightCategory: flightCat,
                            visibility: destMetarData.visib,
                            ceiling: window.Weather.getCeilingFromMETAR(destMetarData)
                        });
                    }
                }

                // Analyze PIREPs along route corridor
                const allPirepData = allPireps.status === 'fulfilled' ? (allPireps.value || []) : [];
                const corridorPireps = window.Weather.filterPirepsWithinCorridor(allPirepData, waypoints, 50);
                for (const pirep of corridorPireps) {
                    const hazardInfo = window.WeatherAPI.parsePIREPHazards(pirep);
                    if (hazardInfo.hasIcing || hazardInfo.hasTurbulence) {
                        hazards.pireps.push({
                            raw: pirep.rawOb,
                            hasIcing: hazardInfo.hasIcing,
                            hasTurbulence: hazardInfo.hasTurbulence,
                            severity: hazardInfo.severity,
                            altitude: pirep.fltLvl
                        });

                        if (hazardInfo.hasIcing) {
                            hazards.icing.push({
                                source: 'PIREP',
                                severity: hazardInfo.severity,
                                altitude: pirep.fltLvl
                            });
                        }
                        if (hazardInfo.hasTurbulence) {
                            hazards.turbulence.push({
                                source: 'PIREP',
                                severity: hazardInfo.severity,
                                altitude: pirep.fltLvl
                            });
                        }
                    }
                }

                console.log('[WeatherService] Weather hazards analyzed:', {
                    sigmets: hazards.sigmets.length,
                    gairmets: hazards.gairmets.length,
                    airportWx: hazards.airportWx.length,
                    icing: hazards.icing.length,
                    turbulence: hazards.turbulence.length,
                    pireps: hazards.pireps.length
                });

            } catch (error) {
                console.error('[WeatherService] Weather hazard analysis error:', error);
            }

            return hazards;
        }
    }

    // Export to window
    window.WeatherService = WeatherService;

})();
