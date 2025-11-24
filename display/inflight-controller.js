// IN-FLIGHT Controller - Real-time situational awareness during flight
// ============================================

const InflightController = (() => {
    let elements = {};
    let currentPosition = null;
    let currentAltitude = null;
    let currentSpeed = null;
    let currentHeading = null;
    let nearbyAirports = [];
    let weatherData = null;
    let updateInterval = null;
    let usingFallbackData = false;

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        cacheElements();
        setupUpdateInterval();
        console.log('[InflightController] Initialized');
    }

    function cacheElements() {
        elements = {
            placeholder: document.getElementById('inflightPlaceholder'),
            display: document.getElementById('inflightDisplay'),

            // Position
            lat: document.getElementById('if-lat'),
            lon: document.getElementById('if-lon'),
            alt: document.getElementById('if-alt'),
            gs: document.getElementById('if-gs'),
            hdg: document.getElementById('if-hdg'),
            time: document.getElementById('if-time'),
            posStatus: document.getElementById('if-pos-status'),

            // Fuel
            fuelCard: document.getElementById('if-fuel-card'),
            fuelRem: document.getElementById('if-fuel-rem'),
            fuelEndur: document.getElementById('if-fuel-endur'),
            fuelRange: document.getElementById('if-fuel-range'),
            fuelUsed: document.getElementById('if-fuel-used'),

            // Weather
            windDir: document.getElementById('if-wind-dir'),
            windSpd: document.getElementById('if-wind-spd'),
            temp: document.getElementById('if-temp'),
            headwind: document.getElementById('if-headwind'),
            crosswind: document.getElementById('if-crosswind'),
            windStatus: document.getElementById('if-wind-status'),

            // Weather Ahead
            weatherAheadCard: document.getElementById('if-weather-ahead-card'),
            weatherAheadTable: document.getElementById('if-weather-ahead-table'),

            // Hazards
            hazardsCard: document.getElementById('if-hazards-card'),
            hazardsList: document.getElementById('if-hazards-list'),

            // Airports
            airportsTable: document.getElementById('if-airports-table')
        };
    }

    function setupUpdateInterval() {
        // Update every 60 seconds (weather data is cached and doesn't change that frequently)
        updateInterval = setInterval(() => {
            updateDisplay();
        }, 60000);

        // Initial update
        updateDisplay();
    }

    // ============================================
    // UPDATE DISPLAY
    // ============================================

    function updateDisplay() {
        // Use GPS position if available, otherwise fall back to flight plan data
        const flightPlan = window.FlightState ? window.FlightState.getFlightPlan() : null;
        const hasGPS = currentPosition !== null;
        const hasFallbackData = flightPlan && flightPlan.departure;

        console.log('[AHEAD] updateDisplay - hasGPS:', hasGPS, 'hasFallbackData:', hasFallbackData, 'currentPos:', currentPosition, 'currentAlt:', currentAltitude);

        // If we have GPS OR flight plan data, show the display
        if (hasGPS || hasFallbackData) {
            // Use fallback values from flight plan if GPS not available
            if (!hasGPS && hasFallbackData) {
                usingFallbackData = true;
                // Use departure airport position as fallback
                const depAirport = window.DataManager?.getAirport?.(flightPlan.departure);
                if (depAirport) {
                    currentPosition = { lat: depAirport.lat, lon: depAirport.lon };
                    console.log(`[AHEAD] Using fallback position from ${flightPlan.departure}: ${depAirport.lat.toFixed(4)}, ${depAirport.lon.toFixed(4)}`);
                }
                // Use filed altitude and TAS as fallback
                currentAltitude = flightPlan.altitude || 5500;
                currentSpeed = flightPlan.tas || 110;
                currentHeading = null; // No heading without GPS
                console.log(`[AHEAD] Using fallback altitude: ${currentAltitude} FT, TAS: ${currentSpeed} KT`);
            } else {
                usingFallbackData = false;
            }

            // If we have GPS but no altitude, use filed altitude as fallback
            if (hasGPS && !currentAltitude && flightPlan) {
                currentAltitude = flightPlan.altitude || 5500;
                console.log(`[AHEAD] GPS has no altitude, using filed altitude: ${currentAltitude} FT`);
            }

            // If we have GPS but no speed, use filed TAS as fallback
            if (hasGPS && (!currentSpeed || currentSpeed === 0) && flightPlan) {
                currentSpeed = flightPlan.tas || 110;
                console.log(`[AHEAD] GPS has no speed, using filed TAS: ${currentSpeed} KT`);
            }

            elements.placeholder.style.display = 'none';
            elements.display.style.display = 'block';

            updatePositionDisplay();
            updateFuelDisplay();
            updateWeatherDisplay();
            updateWeatherAhead();
            updateNearbyPIREPs(); // Fetch and display nearby hazardous PIREPs
            updateNearbyAirports();
        } else {
            // No GPS position or flight plan data available
            elements.placeholder.style.display = 'block';
            elements.display.style.display = 'none';
        }
    }

    function updatePositionDisplay() {
        if (!currentPosition) return;

        // Update status indicator
        if (usingFallbackData) {
            elements.posStatus.textContent = '(USING FILED DATA)';
            elements.posStatus.style.color = 'var(--color-warning)';
        } else {
            elements.posStatus.textContent = '';
        }

        // Format coordinates
        const latStr = formatCoordinate(currentPosition.lat, 'lat');
        const lonStr = formatCoordinate(currentPosition.lon, 'lon');

        elements.lat.textContent = latStr;
        elements.lon.textContent = lonStr;

        // Altitude
        if (currentAltitude !== null) {
            elements.alt.textContent = `${Math.round(currentAltitude)} FT`;
        } else {
            elements.alt.textContent = '-- FT';
        }

        // Ground speed
        if (currentSpeed !== null) {
            elements.gs.textContent = `${Math.round(currentSpeed)} KT`;
        } else {
            elements.gs.textContent = '-- KT';
        }

        // Heading (convert to magnetic)
        if (currentHeading !== null && currentPosition) {
            const magHeading = trueToMagnetic(currentHeading, currentPosition.lat, currentPosition.lon);
            elements.hdg.textContent = `${Math.round(magHeading).toString().padStart(3, '0')}°`;
        } else {
            elements.hdg.textContent = '--°';
        }

        // Current time (UTC)
        const now = new Date();
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        elements.time.textContent = `${hours}:${minutes}Z`;
    }

    function updateFuelDisplay() {
        if (!window.FlightTracker) return;

        const fuelRemaining = window.FlightTracker.getFuelRemaining();
        const endurance = window.FlightTracker.getEndurance(); // minutes

        // Always show fuel card, just update values or show placeholders
        if (fuelRemaining > 0) {
            elements.fuelRem.textContent = `${fuelRemaining.toFixed(1)} GAL`;

            // Format endurance as hours:minutes
            const hours = Math.floor(endurance / 60);
            const mins = Math.floor(endurance % 60);
            elements.fuelEndur.textContent = `${hours}:${String(mins).padStart(2, '0')}`;

            // Calculate range based on current ground speed
            if (currentSpeed && currentSpeed > 0) {
                const rangeNM = (endurance / 60) * currentSpeed;
                elements.fuelRange.textContent = `${rangeNM.toFixed(0)} NM`;

                // Warning if low range
                if (rangeNM < 50) {
                    elements.fuelRange.style.color = 'var(--color-warning)';
                } else {
                    elements.fuelRange.style.color = 'var(--color-metric)';
                }
            } else {
                elements.fuelRange.textContent = '-- NM';
            }

            // Fuel used (from FlightTracker)
            const flightDuration = window.FlightTracker.getFlightDuration() || 0;
            const fuelUsed = calculateFuelUsed(flightDuration);
            elements.fuelUsed.textContent = `${fuelUsed.toFixed(1)} GAL`;

            // Warning color if low fuel
            if (fuelRemaining < 10) {
                elements.fuelRem.style.color = 'var(--color-warning)';
            } else {
                elements.fuelRem.style.color = 'var(--color-metric)';
            }

            // Check for low fuel hazards
            checkFuelHazards(fuelRemaining, endurance);
        } else {
            // No fuel data - show placeholders
            elements.fuelRem.textContent = '-- GAL';
            elements.fuelEndur.textContent = '--:--';
            elements.fuelRange.textContent = '-- NM';
            elements.fuelUsed.textContent = '-- GAL';
        }
    }

    function checkFuelHazards(fuelRemaining, enduranceMinutes) {
        // Get existing hazards from weather check
        const existingHazards = Array.from(elements.hazardsList?.children || []).map(el => ({
            type: el.querySelector('.hazard-type')?.textContent,
            description: el.querySelector('.hazard-desc')?.textContent,
            severity: el.classList.contains('hazard-warning') ? 'warning' : 'caution'
        }));

        const fuelHazards = [];

        // Critical low fuel (< 30 minutes endurance OR < 5 gallons)
        if (enduranceMinutes < 30 || fuelRemaining < 5) {
            fuelHazards.push({
                type: 'CRITICAL LOW FUEL',
                description: `${fuelRemaining.toFixed(1)} GAL remaining (${Math.floor(enduranceMinutes)} MIN endurance) - Land immediately`,
                severity: 'warning'
            });
        }
        // Low fuel warning (< 45 minutes endurance OR < 10 gallons)
        else if (enduranceMinutes < 45 || fuelRemaining < 10) {
            fuelHazards.push({
                type: 'LOW FUEL',
                description: `${fuelRemaining.toFixed(1)} GAL remaining (${Math.floor(enduranceMinutes)} MIN endurance) - Plan to land soon`,
                severity: 'caution'
            });
        }
        // Fuel reserve alert (< VFR 30-min day reserve with some buffer)
        else if (enduranceMinutes < 60) {
            fuelHazards.push({
                type: 'FUEL RESERVE ALERT',
                description: `${Math.floor(enduranceMinutes)} MIN endurance - Monitor fuel closely`,
                severity: 'caution'
            });
        }

        // Merge fuel hazards with existing hazards (fuel hazards first for visibility)
        const allHazards = [...fuelHazards, ...existingHazards.filter(h =>
            !h.type?.includes('FUEL') // Remove old fuel hazards to avoid duplicates
        )];

        // Display all hazards (always show, display "None" if empty)
        if (allHazards.length > 0) {
            elements.hazardsList.innerHTML = allHazards.map(h => `
                <div class="hazard-item hazard-${h.severity}">
                    <span class="hazard-type">${h.type}</span>
                    <span class="hazard-desc">${h.description}</span>
                </div>
            `).join('');
        } else {
            elements.hazardsList.textContent = 'None';
        }
    }

    function updateWeatherDisplay() {
        if (!currentPosition || !currentAltitude) return;

        // Get wind data from the flight plan (must calculate route first with "Fetch Winds Aloft" enabled)
        const flightPlan = window.FlightState ? window.FlightState.getFlightPlan() : null;

        if (flightPlan && flightPlan.windData) {
            console.log('[AHEAD] Weather Display - Has wind data, stations:', Object.keys(flightPlan.windData).length);
            // Interpolate wind for current position and altitude
            interpolateWindAtPosition(flightPlan.windData, currentPosition.lat, currentPosition.lon, currentAltitude);
        } else {
            // No wind data available - need to calculate route with winds aloft
            elements.windDir.textContent = '--°';
            elements.windSpd.textContent = '-- KT';
            elements.temp.textContent = '--°C';
            elements.headwind.textContent = '-- KT';
            elements.crosswind.textContent = '-- KT';
            elements.windStatus.textContent = 'NO ROUTE';
            elements.windStatus.style.color = 'var(--text-secondary)';
        }
    }

    function interpolateWindAtPosition(windData, lat, lon, altitude) {
        if (!window.WindsAloft) {
            console.warn('[InflightController] WindsAloft module not available');
            return;
        }

        try {
            // Interpolate wind for this position and altitude
            // WindsAloft.interpolateWind finds nearest stations internally
            const wind = window.WindsAloft.interpolateWind(lat, lon, altitude, windData);

            console.log('[AHEAD] Weather At Position - Wind interpolation result:', wind);
            console.log('[AHEAD] Position:', lat.toFixed(4), lon.toFixed(4), 'Altitude:', altitude);

            if (wind) {
                // WindsAloft returns {direction, speed, temperature} (not dir/spd/temp)
                const windDir = wind.direction ?? wind.dir;
                const windSpd = wind.speed ?? wind.spd;
                const windTemp = wind.temperature ?? wind.temp;

                console.log('[AHEAD] Extracted values - Dir:', windDir, 'Spd:', windSpd, 'Temp:', windTemp);

                if (windDir !== null && windDir !== undefined && windSpd !== null && windSpd !== undefined) {
                    elements.windDir.textContent = `${Math.round(windDir).toString().padStart(3, '0')}°`;
                    elements.windSpd.textContent = `${Math.round(windSpd)} KT`;

                    if (windTemp !== null && windTemp !== undefined) {
                        elements.temp.textContent = `${Math.round(windTemp)}°C`;
                    } else {
                        elements.temp.textContent = '--°C';
                    }

                    // Calculate headwind/crosswind if we have heading
                    if (currentHeading !== null) {
                        const components = calculateWindComponents(windDir, windSpd, currentHeading);
                        elements.headwind.textContent = `${components.headwind >= 0 ? '+' : ''}${components.headwind} KT`;
                        elements.crosswind.textContent = `${Math.abs(components.crosswind)} KT`;
                    } else {
                        elements.headwind.textContent = '-- KT';
                        elements.crosswind.textContent = '-- KT';
                    }

                    elements.windStatus.textContent = 'FORECAST';
                    elements.windStatus.style.color = 'var(--color-metric)';

                    // Check for hazards (pass wind object with spd property for compatibility)
                    checkWeatherHazards({dir: windDir, spd: windSpd, temp: windTemp}, altitude);
                } else {
                    elements.windStatus.textContent = 'NO DATA';
                    elements.windStatus.style.color = 'var(--color-warning)';
                }
            } else {
                elements.windStatus.textContent = 'ERROR';
                elements.windStatus.style.color = 'var(--color-warning)';
            }
        } catch (error) {
            console.error('[InflightController] Error interpolating wind:', error);
            elements.windStatus.textContent = 'ERROR';
        }
    }

    function updateWeatherAhead() {
        console.log('[AHEAD] updateWeatherAhead - Position:', currentPosition, 'Altitude:', currentAltitude, 'Heading:', currentHeading);

        // Need position and altitude, heading optional (can use route heading as fallback)
        if (!currentPosition || !currentAltitude) {
            console.log('[AHEAD] Weather Ahead: Missing position or altitude');
            elements.weatherAheadTable.innerHTML = '<p class="text-secondary">Waiting for GPS position and altitude...</p>';
            return;
        }

        // If no GPS heading, try to use route heading from first leg
        let heading = currentHeading;
        if (!heading) {
            const flightPlan = window.FlightState ? window.FlightState.getFlightPlan() : null;
            console.log('[AHEAD] No GPS heading, checking flight plan legs:', flightPlan?.legs?.length || 0);
            if (flightPlan && flightPlan.legs && flightPlan.legs.length > 0) {
                // Use true heading from first leg of route
                heading = flightPlan.legs[0].trueHeading || flightPlan.legs[0].magHeading || null;
                console.log(`[AHEAD] Using route heading from first leg: ${heading}°`);
            }
        }

        // If still no heading, can't show weather ahead
        if (!heading) {
            console.log('[AHEAD] Weather Ahead: No heading available (GPS or route)');
            elements.weatherAheadTable.innerHTML = '<p class="text-secondary">Calculate a route to show forecast along track...</p>';
            return;
        }

        // Get wind data from flight plan (must calculate route first with "Fetch Winds Aloft" enabled)
        const flightPlan = window.FlightState ? window.FlightState.getFlightPlan() : null;

        if (!flightPlan || !flightPlan.windData || !window.WindsAloft) {
            if (!flightPlan) {
                console.log('[AHEAD] Weather Ahead: No flight plan - calculate route first');
                elements.weatherAheadTable.innerHTML = '<p class="text-secondary">Calculate a route to show forecast...</p>';
            } else if (!flightPlan.windData) {
                console.log('[AHEAD] Weather Ahead: No wind data - enable "Fetch Winds Aloft" in ENTRY tab');
                elements.weatherAheadTable.innerHTML = '<p class="text-secondary">Enable "Fetch Winds Aloft" in ENTRY tab and recalculate route...</p>';
            } else if (!window.WindsAloft) {
                console.log('[AHEAD] Weather Ahead: WindsAloft module not available');
                elements.weatherAheadTable.innerHTML = '<p class="text-secondary">Wind module not loaded...</p>';
            }
            return;
        }

        console.log(`[AHEAD] Weather Ahead: Calculating weather for heading ${heading}°`);


        const windData = flightPlan.windData;

        // Calculate positions ahead along current heading at 25nm, 50nm, 100nm, 150nm
        const distances = [25, 50, 100, 150];
        const weatherPoints = [];

        for (const distNM of distances) {
            // Calculate position ahead using heading (GPS or route fallback)
            const position = calculatePositionAhead(currentPosition.lat, currentPosition.lon, heading, distNM);

            // Interpolate wind at this position
            try {
                const wind = window.WindsAloft.interpolateWind(position.lat, position.lon, currentAltitude, windData);

                if (wind) {
                    // WindsAloft returns {direction, speed, temperature}
                    const windDir = wind.direction ?? wind.dir;
                    const windSpd = wind.speed ?? wind.spd;
                    const windTemp = wind.temperature ?? wind.temp;

                    if (windDir !== null && windDir !== undefined && windSpd !== null && windSpd !== undefined) {
                        // Calculate headwind/crosswind components (using heading from GPS or route)
                        const components = calculateWindComponents(windDir, windSpd, heading);

                        // Calculate ETA based on current ground speed
                        let eta = null;
                        if (currentSpeed && currentSpeed > 0) {
                            eta = (distNM / currentSpeed) * 60; // minutes
                        }

                        weatherPoints.push({
                            distance: distNM,
                            wind: {
                                dir: windDir,
                                spd: windSpd,
                                temp: windTemp
                            },
                            headwind: components.headwind,
                            crosswind: components.crosswind,
                            eta: eta
                        });
                    }
                }
            } catch (error) {
                console.warn(`[InflightController] Error getting weather at ${distNM}nm ahead:`, error);
            }
        }

        // Display weather ahead if we have any points
        if (weatherPoints.length > 0) {
            console.log(`[InflightController] Weather Ahead: Displaying ${weatherPoints.length} forecast points`);
            const tableHTML = generateWeatherAheadTable(weatherPoints);
            elements.weatherAheadTable.innerHTML = tableHTML;
        } else {
            console.log('[InflightController] Weather Ahead: No weather points available');
            elements.weatherAheadTable.innerHTML = '<p class="text-secondary">Unable to calculate weather forecast...</p>';
        }
    }

    function calculatePositionAhead(lat, lon, heading, distanceNM) {
        // Convert to radians
        const R = 3440.065; // Earth radius in nautical miles
        const lat1 = lat * Math.PI / 180;
        const lon1 = lon * Math.PI / 180;
        const bearing = heading * Math.PI / 180;
        const d = distanceNM;

        // Calculate new position
        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(d / R) +
            Math.cos(lat1) * Math.sin(d / R) * Math.cos(bearing)
        );

        const lon2 = lon1 + Math.atan2(
            Math.sin(bearing) * Math.sin(d / R) * Math.cos(lat1),
            Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
        );

        return {
            lat: lat2 * 180 / Math.PI,
            lon: lon2 * 180 / Math.PI
        };
    }

    function generateWeatherAheadTable(weatherPoints) {
        let html = '<table class="navlog-table" style="width: 100%;"><thead><tr>';
        html += '<th>DIST</th>';
        html += '<th>ETA</th>';
        html += '<th>WIND</th>';
        html += '<th>TEMP</th>';
        html += '<th>H-WIND</th>';
        html += '<th>X-WIND</th>';
        html += '</tr></thead><tbody>';

        for (const point of weatherPoints) {
            html += '<tr>';
            html += `<td><span class="font-bold">${point.distance} NM</span></td>`;

            // ETA (Estimated Time to Arrival)
            if (point.eta !== null) {
                const hours = Math.floor(point.eta / 60);
                const mins = Math.floor(point.eta % 60);
                if (hours > 0) {
                    html += `<td>${hours}:${String(mins).padStart(2, '0')}</td>`;
                } else {
                    html += `<td>${mins} MIN</td>`;
                }
            } else {
                html += '<td>--</td>';
            }

            // Wind direction and speed
            const windDir = Math.round(point.wind.dir).toString().padStart(3, '0');
            const windSpd = Math.round(point.wind.spd);
            html += `<td>${windDir}° ${windSpd}KT</td>`;

            // Temperature
            if (point.wind.temp !== null) {
                html += `<td>${Math.round(point.wind.temp)}°C</td>`;
            } else {
                html += '<td>--</td>';
            }

            // Headwind (positive = tailwind)
            const hwSign = point.headwind >= 0 ? '+' : '';
            html += `<td>${hwSign}${point.headwind} KT</td>`;

            // Crosswind
            html += `<td>${Math.abs(point.crosswind)} KT</td>`;

            html += '</tr>';
        }

        html += '</tbody></table>';
        return html;
    }

    function checkWeatherHazards(wind, altitude) {
        const hazards = [];

        // High wind warning (>30 knots)
        if (wind.spd > 30) {
            hazards.push({
                type: 'HIGH WIND',
                description: `Wind speed ${Math.round(wind.spd)} KT exceeds 30 KT`,
                severity: 'warning'
            });
        }

        // Enhanced icing conditions detection
        if (wind.temp !== null) {
            // Structural icing range: 0°C to -20°C in visible moisture
            if (wind.temp <= 0 && wind.temp >= -20) {
                // Critical icing: -5°C to -15°C
                if (wind.temp <= -5 && wind.temp >= -15) {
                    hazards.push({
                        type: 'ICING - HIGH RISK',
                        description: `Temperature ${Math.round(wind.temp)}°C in critical icing range (-5 to -15°C)`,
                        severity: 'warning'
                    });
                } else {
                    hazards.push({
                        type: 'ICING POTENTIAL',
                        description: `Temperature ${Math.round(wind.temp)}°C in icing range (0 to -20°C)`,
                        severity: 'caution'
                    });
                }
            }

            // Fog/low visibility risk (temperature near freezing with high humidity likely)
            // In absence of dewpoint data, use temperature thresholds that commonly correlate with fog
            if (wind.temp >= -5 && wind.temp <= 15 && altitude < 3000) {
                hazards.push({
                    type: 'FOG/VISIBILITY RISK',
                    description: `Low altitude (${Math.round(altitude)} FT) with temperature ${Math.round(wind.temp)}°C favorable for fog`,
                    severity: 'caution'
                });
            }

            // Freezing fog (very dangerous)
            if (wind.temp < 0 && wind.temp >= -10 && altitude < 2000) {
                hazards.push({
                    type: 'FREEZING FOG RISK',
                    description: `Below-freezing temperature ${Math.round(wind.temp)}°C at ${Math.round(altitude)} FT`,
                    severity: 'warning'
                });
            }
        }

        // Strong crosswind
        if (currentHeading !== null) {
            const components = calculateWindComponents(wind.dir, wind.spd, currentHeading);
            if (Math.abs(components.crosswind) > 20) {
                hazards.push({
                    type: 'STRONG CROSSWIND',
                    description: `Crosswind component ${Math.abs(Math.round(components.crosswind))} KT`,
                    severity: 'caution'
                });
            }
        }

        // Display hazards (always show card, display "None" if no hazards)
        if (hazards.length > 0) {
            elements.hazardsList.innerHTML = hazards.map(h => `
                <div class="hazard-item hazard-${h.severity}">
                    <span class="hazard-type">${h.type}</span>
                    <span class="hazard-desc">${h.description}</span>
                </div>
            `).join('');
        } else {
            elements.hazardsList.textContent = 'None';
        }
    }

    /**
     * Update nearby PIREPs and weather alerts
     */
    async function updateNearbyPIREPs() {
        if (!currentPosition) return;

        const pirepCard = document.getElementById('if-pireps-card');
        const pirepList = document.getElementById('if-pireps-list');

        if (!pirepCard || !pirepList) return;

        try {
            // Find nearest airport to use as center point for PIREP search
            const nearestAirport = findNearestAirportICAO(currentPosition.lat, currentPosition.lon);

            if (!nearestAirport) {
                pirepCard.style.display = 'none';
                return;
            }

            // Fetch PIREPs within 50NM
            const pireps = await window.WeatherAPI.fetchPIREPs(nearestAirport, 50, 6);

            if (!pireps || pireps.length === 0) {
                pirepCard.style.display = 'none';
                return;
            }

            // Filter for hazardous PIREPs only
            const hazardousPireps = pireps.filter(pirep => {
                const hazards = window.WeatherAPI.parsePIREPHazards(pirep);
                return hazards.hasIcing || hazards.hasTurbulence;
            });

            if (hazardousPireps.length === 0) {
                pirepCard.style.display = 'none';
                return;
            }

            // Display hazardous PIREPs
            const pirepHTML = hazardousPireps.map(pirep => {
                const hazards = window.WeatherAPI.parsePIREPHazards(pirep);
                const obsTime = pirep.obsTime ? new Date(pirep.obsTime * 1000).toUTCString().substring(17, 22) : '--:--';

                let hazardText = [];
                if (hazards.hasIcing) hazardText.push('ICING');
                if (hazards.hasTurbulence) hazardText.push('TURBULENCE');

                const severityColor = hazards.severity === 'SEVERE' ? 'error' :
                                      hazards.severity === 'MODERATE' ? 'warning' : 'secondary';

                return `
                    <div style="padding: 8px; margin-bottom: 8px; background: var(--bg-secondary); border-left: 3px solid var(--${severityColor});">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span class="text-${severityColor}" style="font-weight: 700;">${hazardText.join(' + ')} ${hazards.severity ? `(${hazards.severity})` : ''}</span>
                            <span class="text-secondary" style="font-size: 0.75rem;">${obsTime}Z</span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${pirep.fltLvl ? `FL${pirep.fltLvl}` : '--'} • ${pirep.acType || 'UNK A/C'}
                        </div>
                        <div style="font-size: 0.7rem; margin-top: 4px; font-family: 'Roboto Mono', monospace; color: var(--text-metric);">
                            ${pirep.rawOb ? pirep.rawOb.substring(0, 100) : 'No details'}${pirep.rawOb && pirep.rawOb.length > 100 ? '...' : ''}
                        </div>
                    </div>
                `;
            }).join('');

            pirepList.innerHTML = pirepHTML;
            pirepCard.style.display = 'block';

        } catch (error) {
            console.error('[AHEAD] PIREP fetch error:', error);
            pirepCard.style.display = 'none';
        }
    }

    /**
     * Find nearest airport ICAO code for weather queries
     */
    function findNearestAirportICAO(lat, lon) {
        const airportsData = window.DataManager.getAirportsData?.() || new Map();
        let nearest = null;
        let minDistance = Infinity;

        for (const [code, airport] of airportsData) {
            // Only use airports with valid 4-letter ICAO codes (must be ALL LETTERS, no digits)
            if (!code || code.length !== 4 || /\d/.test(code)) continue;

            const distance = calculateDistance(lat, lon, airport.lat, airport.lon);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = code;
            }
        }

        return nearest;
    }

    function updateNearbyAirports() {
        if (!currentPosition || !window.DataManager) return;

        // Calculate max range based on fuel remaining using TAS (for initial estimate)
        let maxRange = 50; // Default 50 NM if no fuel data

        // Try to get fuel from FlightTracker first (set after route calculation)
        let fuelRemaining = window.FlightTracker ? window.FlightTracker.getFuelRemaining() : 0;
        let fuelBurn = window.FlightTracker ? window.FlightTracker.getFuelBurnRate() : 0;

        // If FlightTracker doesn't have fuel data (no route calculated yet), read from UI inputs
        if (fuelRemaining === 0 || fuelBurn === 0) {
            const usableFuelInput = document.getElementById('usableFuelInput');
            const taxiFuelInput = document.getElementById('taxiFuelInput');
            const burnRateInput = document.getElementById('burnRateInput');

            if (usableFuelInput && burnRateInput) {
                const usableFuel = parseFloat(usableFuelInput.value) || 0;
                const taxiFuel = parseFloat(taxiFuelInput?.value) || 0;
                fuelBurn = parseFloat(burnRateInput.value) || 0;
                // Calculate fuel remaining (usable - taxi fuel, since we haven't started yet)
                fuelRemaining = Math.max(0, usableFuel - taxiFuel);
            }
        }

        // Get TAS from flight plan (default to 110kt if not available) - ONLY for range estimation
        let tas = 110; // Default TAS
        const flightPlanForTas = window.FlightState ? window.FlightState.getFlightPlan() : null;
        if (flightPlanForTas && flightPlanForTas.tas) {
            tas = flightPlanForTas.tas;
        }

        console.log('[AHEAD] Fuel Range Calculation:');
        console.log('  Fuel Remaining:', fuelRemaining, 'gal');
        console.log('  Fuel Burn Rate:', fuelBurn, 'gal/hr');
        console.log('  TAS:', tas, 'kt');

        if (fuelRemaining > 0 && fuelBurn > 0 && tas > 0) {
            // Calculate endurance in hours
            const enduranceHours = fuelRemaining / fuelBurn;
            // Calculate range (distance = speed × time) using TAS for initial estimate
            const currentRange = tas * enduranceHours;
            // 1.5x remaining fuel range
            maxRange = currentRange * 1.5;

            console.log('  Endurance:', enduranceHours.toFixed(2), 'hours');
            console.log('  Current Range:', currentRange.toFixed(1), 'NM');
            console.log('  Max Range (1.5x):', maxRange.toFixed(1), 'NM');
        } else {
            console.log('  Using default range:', maxRange, 'NM (fuel data incomplete)');
        }

        // Find airports within max range
        const airports = findNearbyAirports(currentPosition.lat, currentPosition.lon, maxRange);

        // Generate detailed airport cards (navlog style) with separator
        const airportsHTML = generateAirportsTable(airports, maxRange / 1.5); // Pass fuel range (not 1.5x)
        elements.airportsTable.innerHTML = airportsHTML;
    }

    function findNearbyAirports(lat, lon, radiusNM) {
        const airports = [];
        const airportsData = window.DataManager.getAirportsData?.() || new Map();

        for (const [code, airport] of airportsData) {
            // Calculate distance first
            const distance = calculateDistance(lat, lon, airport.lat, airport.lon);

            if (distance <= radiusNM) {
                // Get frequencies - MUST have radio frequencies for diversion
                const frequencies = window.DataManager.getFrequencies?.(code) || [];

                // Skip airports without radio frequencies (can't communicate)
                if (!frequencies || frequencies.length === 0) {
                    continue;
                }

                const trueBearing = calculateBearing(lat, lon, airport.lat, airport.lon);
                // Convert to magnetic bearing
                const bearing = trueToMagnetic(trueBearing, lat, lon);

                // Calculate ETE if we have ground speed
                let ete = null;
                if (currentSpeed && currentSpeed > 0) {
                    ete = (distance / currentSpeed) * 60; // minutes
                }

                // Get additional airport information
                const airspaceClass = window.DataManager.getAirspaceClass?.(code) || null;
                const runways = window.DataManager.getRunways?.(code) || [];

                airports.push({
                    code,
                    name: airport.name || code,
                    lat: airport.lat,
                    lon: airport.lon,
                    distance,
                    bearing,
                    ete,
                    elevation: airport.elevation || null,
                    airspaceClass,
                    runways,
                    frequencies
                });
            }
        }

        // Sort by distance
        airports.sort((a, b) => a.distance - b.distance);

        // Return all airports (no limit)
        return airports;
    }

    function generateAirportsTable(airports, fuelRange) {
        if (airports.length === 0) {
            return '<p class="text-secondary" style="padding: 1rem;">No airports within range</p>';
        }

        let html = '<table class="navlog-table"><tbody>';
        let separatorAdded = false;

        // Only show first 20 airports (dynamically updated as we fly)
        const displayLimit = 20;
        const displayAirports = airports.slice(0, displayLimit);

        for (let i = 0; i < displayAirports.length; i++) {
            const airport = displayAirports[i];

            // Add separator between in-range and out-of-range airports
            if (!separatorAdded && fuelRange && airport.distance > fuelRange) {
                html += `
                    <tr>
                        <td colspan="2" style="padding: var(--space-md); text-align: center; border-top: 2px solid var(--color-warning); border-bottom: 2px solid var(--color-warning);">
                            <span class="text-warning" style="font-weight: 700; letter-spacing: 1px;"> BEYOND FUEL RANGE </span>
                        </td>
                    </tr>
                `;
                separatorAdded = true;
            }
            // Airspace class (replaces "AIRPORT" label)
            let airspaceText = '';
            let airspaceHoursText = '';
            if (airport.airspaceClass) {
                const airspaceClass = typeof airport.airspaceClass === 'object' ? airport.airspaceClass.class : airport.airspaceClass;
                if (airspaceClass) {
                    airspaceText = `CLASS ${airspaceClass}`;
                    // Store hours/supplement info separately
                    if (typeof airport.airspaceClass === 'object' && airport.airspaceClass.hours) {
                        airspaceHoursText = airport.airspaceClass.hours;
                    }
                }
            }

            // Distance, bearing, ETE - navigation info for details column (top)
            const distStr = `${airport.distance.toFixed(1)} NM`;
            const brgStr = `${Math.round(airport.bearing).toString().padStart(3, '0')}°`;
            const eteStr = airport.ete !== null ? `${Math.floor(airport.ete)} MIN` : '--';

            // Elevation (cyan color)
            let elevLine = '';
            if (airport.elevation !== null) {
                elevLine = `<div class="text-airport text-xs">ELEV ${Math.round(airport.elevation)} FT</div>`;
            }

            // Runways (matching navlog format exactly - using leIdent/heIdent)
            let runwayHTML = '';
            if (airport.runways && airport.runways.length > 0) {
                const runwayInfo = airport.runways.map(r => {
                    // Use leIdent/heIdent like in navlog
                    const idents = r.leIdent && r.heIdent ? `${r.leIdent}/${r.heIdent}` : (r.leIdent || r.heIdent || r.name || r.id || 'N/A');
                    const length = r.length ? `${r.length}FT` : '';
                    const surface = r.surface || '';
                    return `<strong>${idents}</strong> ${length} ${surface}`.trim();
                }).join(', ');
                runwayHTML = `<div class="text-secondary text-xs">RWY ${runwayInfo}</div>`;
            }

            // Frequencies (matching navlog format)
            let freqHTML = '';
            if (airport.frequencies && airport.frequencies.length > 0) {
                const grouped = {};
                airport.frequencies.forEach(f => {
                    const type = (f.type || f.description || '').toUpperCase();
                    const freqMHz = f.frequency || f.freq;
                    if (!freqMHz) return;

                    // Use abbreviated types for consistency
                    let abbrev = type.includes('ATIS') ? 'ATIS' :
                                type.includes('AWOS') || type.includes('ASOS') ? 'AWOS' :
                                type.includes('TWR') || type.includes('TOWER') ? 'TWR' :
                                type.includes('GND') || type.includes('GROUND') ? 'GND' :
                                type.includes('CLD') || type.includes('CLEARANCE') || type.includes('DEL') ? 'CLD' :
                                type.includes('APP') || type.includes('APPROACH') ? 'APP' :
                                type.includes('DEP') || type.includes('DEPARTURE') ? 'DEP' :
                                type.includes('A/D') || type.includes('A-D') ? 'A/D' :
                                type.includes('CTAF') || type.includes('UNICOM') ? 'CTAF' :
                                type.includes('UNIC') ? 'UNIC' :
                                type.includes('OPS') || type.includes('OPERATIONS') ? 'OPS' :
                                type.includes('RDO') || type.includes('RADIO') ? 'RDO' :
                                type.includes('MULTICOM') ? 'MCOM' : null;

                    if (abbrev) {
                        if (!grouped[abbrev]) grouped[abbrev] = [];
                        const freqStr = typeof freqMHz === 'number' ? freqMHz.toFixed(3) : freqMHz;
                        grouped[abbrev].push(freqStr);
                    }
                });

                const freqItems = Object.entries(grouped).map(([type, freqs]) =>
                    `<span class="text-metric text-xs"><strong>${type}</strong> ${freqs.join('/')}</span>`
                );
                freqHTML = freqItems.join(' ');
            }

            html += `
                <tr class="wpt-row">
                    <td class="wpt-info-cell">
                        <div class="text-airport wpt-code">${airport.code}</div>
                        <div class="text-reporting text-xs">${airspaceText || '&nbsp;'}</div>
                    </td>
                    <td>
                        <div class="wpt-code"><span class="text-navaid">${distStr}</span> • <span class="text-airport">${brgStr}</span> • <span class="text-metric">${eteStr}</span></div>
                        ${elevLine}
                        ${airspaceHoursText ? `<div class="text-reporting text-xs">${airspaceHoursText}</div>` : ''}
                        ${runwayHTML}
                        ${freqHTML ? `<div class="mt-xs">${freqHTML}</div>` : ''}
                    </td>
                </tr>
            `;
        }

        html += '</tbody></table>';
        return html;
    }

    // ============================================
    // CALCULATIONS
    // ============================================

    /**
     * Convert true heading to magnetic heading
     * @param {number} trueHeading - True heading in degrees
     * @param {number} lat - Latitude for magnetic variation lookup
     * @param {number} lon - Longitude for magnetic variation lookup
     * @returns {number} - Magnetic heading in degrees
     */
    function trueToMagnetic(trueHeading, lat, lon) {
        if (typeof window.calculateMagneticDeclination !== 'function') {
            console.warn('[InflightController] WMM2025 not available, using true heading');
            return trueHeading;
        }

        try {
            // Get magnetic declination (variation) at this position
            const declination = window.calculateMagneticDeclination(lat, lon);
            if (declination === null) {
                return trueHeading;
            }

            // Magnetic Heading = True Heading - Declination
            // (East declination is positive, West is negative)
            let magHeading = trueHeading - declination;

            // Normalize to 0-360
            while (magHeading < 0) magHeading += 360;
            while (magHeading >= 360) magHeading -= 360;

            return magHeading;
        } catch (error) {
            console.warn('[InflightController] Error converting to magnetic heading:', error);
            return trueHeading;
        }
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in nautical miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;

        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360;

        return bearing;
    }

    function calculateWindComponents(windDir, windSpd, heading) {
        const relativeAngle = (windDir - heading + 360) % 360;
        const relativeRad = relativeAngle * Math.PI / 180;

        const headwind = Math.round(windSpd * Math.cos(relativeRad));
        const crosswind = Math.round(windSpd * Math.sin(relativeRad));

        return { headwind, crosswind };
    }

    function calculateFuelUsed(flightDurationSeconds) {
        // This is a simplified calculation
        // In reality, this should come from FlightTracker
        const plan = window.FlightState ? window.FlightState.getFlightPlan() : null;
        if (!plan) return 0;
        if (!plan.burnRate) return 0;

        const hours = flightDurationSeconds / 3600;
        return hours * plan.burnRate;
    }

    function formatCoordinate(value, type) {
        const absValue = Math.abs(value);
        const degrees = Math.floor(absValue);
        const minutes = (absValue - degrees) * 60;

        const direction = type === 'lat'
            ? (value >= 0 ? 'N' : 'S')
            : (value >= 0 ? 'E' : 'W');

        return `${degrees.toString().padStart(type === 'lat' ? 2 : 3, '0')}°${minutes.toFixed(2)}'${direction}`;
    }

    // ============================================
    // PUBLIC API
    // ============================================

    function updatePosition(position) {
        // When GPS position is received, it overwrites any fallback values
        currentPosition = position;
        currentAltitude = position.altitude || null;
        currentSpeed = position.speed || null;
        currentHeading = position.heading || null;
        usingFallbackData = false; // Clear fallback flag when GPS is active
    }

    return {
        init,
        updatePosition
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', InflightController.init);
} else {
    InflightController.init();
}

// Export for use in other modules
window.InflightController = InflightController;
