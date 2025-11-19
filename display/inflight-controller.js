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

            // Hazards
            hazardsCard: document.getElementById('if-hazards-card'),
            hazardsList: document.getElementById('if-hazards-list'),

            // Airports
            airportsTable: document.getElementById('if-airports-table')
        };
    }

    function setupUpdateInterval() {
        // Update every 5 seconds
        updateInterval = setInterval(() => {
            updateDisplay();
        }, 5000);

        // Initial update
        updateDisplay();
    }

    // ============================================
    // UPDATE DISPLAY
    // ============================================

    function updateDisplay() {
        // Check if we're in flight
        const isInFlight = window.FlightTracker && window.FlightTracker.isInFlight();

        // Show/hide placeholder based on flight status
        if (isInFlight && currentPosition) {
            elements.placeholder.style.display = 'none';
            elements.display.style.display = 'block';

            updatePositionDisplay();
            updateFuelDisplay();
            updateWeatherDisplay();
            updateNearbyAirports();
        } else {
            elements.placeholder.style.display = 'block';
            elements.display.style.display = 'none';
        }
    }

    function updatePositionDisplay() {
        if (!currentPosition) return;

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

        // Heading
        if (currentHeading !== null) {
            elements.hdg.textContent = `${Math.round(currentHeading).toString().padStart(3, '0')}°`;
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

        if (fuelRemaining > 0) {
            elements.fuelCard.style.display = 'block';

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
        } else {
            elements.fuelCard.style.display = 'none';
        }
    }

    function updateWeatherDisplay() {
        if (!currentPosition || !currentAltitude) return;

        // Try to get wind data from the flight plan's cached wind data
        const flightPlan = window.FlightState ? window.FlightState.flightPlan : null;

        if (flightPlan && flightPlan.windData) {
            // Interpolate wind for current position and altitude
            interpolateWindAtPosition(flightPlan.windData, currentPosition.lat, currentPosition.lon, currentAltitude);
        } else {
            // No wind data available
            elements.windDir.textContent = '--°';
            elements.windSpd.textContent = '-- KT';
            elements.temp.textContent = '--°C';
            elements.headwind.textContent = '-- KT';
            elements.crosswind.textContent = '-- KT';
            elements.windStatus.textContent = 'NO DATA';
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

            if (wind && wind.dir !== null && wind.spd !== null) {
                elements.windDir.textContent = `${Math.round(wind.dir).toString().padStart(3, '0')}°`;
                elements.windSpd.textContent = `${Math.round(wind.spd)} KT`;

                if (wind.temp !== null) {
                    elements.temp.textContent = `${Math.round(wind.temp)}°C`;
                } else {
                    elements.temp.textContent = '--°C';
                }

                // Calculate headwind/crosswind if we have heading
                if (currentHeading !== null) {
                    const components = calculateWindComponents(wind.dir, wind.spd, currentHeading);
                    elements.headwind.textContent = `${components.headwind >= 0 ? '+' : ''}${components.headwind} KT`;
                    elements.crosswind.textContent = `${Math.abs(components.crosswind)} KT`;
                } else {
                    elements.headwind.textContent = '-- KT';
                    elements.crosswind.textContent = '-- KT';
                }

                elements.windStatus.textContent = 'FORECAST';
                elements.windStatus.style.color = 'var(--color-metric)';

                // Check for hazards
                checkWeatherHazards(wind, altitude);
            } else {
                elements.windStatus.textContent = 'ERROR';
                elements.windStatus.style.color = 'var(--color-warning)';
            }
        } catch (error) {
            console.error('[InflightController] Error interpolating wind:', error);
            elements.windStatus.textContent = 'ERROR';
        }
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

        // Icing conditions (temp 0°C to -20°C in visible moisture)
        if (wind.temp !== null && wind.temp <= 0 && wind.temp >= -20) {
            hazards.push({
                type: 'ICING POTENTIAL',
                description: `Temperature ${Math.round(wind.temp)}°C in icing range (0 to -20°C)`,
                severity: 'warning'
            });
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

        // Display hazards
        if (hazards.length > 0) {
            elements.hazardsCard.style.display = 'block';
            elements.hazardsList.innerHTML = hazards.map(h => `
                <div class="hazard-item hazard-${h.severity}">
                    <span class="hazard-type">${h.type}</span>
                    <span class="hazard-desc">${h.description}</span>
                </div>
            `).join('');
        } else {
            elements.hazardsCard.style.display = 'none';
        }
    }

    function updateNearbyAirports() {
        if (!currentPosition || !window.DataManager) return;

        // Find airports within 50 NM
        const airports = findNearbyAirports(currentPosition.lat, currentPosition.lon, 50);

        if (airports.length === 0) {
            elements.airportsTable.innerHTML = '<p class="text-secondary" style="padding: 1rem;">No towered airports within 50 NM</p>';
            return;
        }

        // Generate table HTML (similar to navlog style)
        const tableHTML = generateAirportsTable(airports);
        elements.airportsTable.innerHTML = tableHTML;
    }

    function findNearbyAirports(lat, lon, radiusNM) {
        const airports = [];
        const airportsData = window.DataManager.getAirportsData?.() || new Map();

        for (const [code, airport] of airportsData) {
            // Skip if not a towered airport
            if (!isToweredAirport(code)) continue;

            const distance = calculateDistance(lat, lon, airport.lat, airport.lon);

            if (distance <= radiusNM) {
                const bearing = calculateBearing(lat, lon, airport.lat, airport.lon);

                // Calculate ETE if we have ground speed
                let ete = null;
                if (currentSpeed && currentSpeed > 0) {
                    ete = (distance / currentSpeed) * 60; // minutes
                }

                airports.push({
                    code,
                    name: airport.name || code,
                    lat: airport.lat,
                    lon: airport.lon,
                    distance,
                    bearing,
                    ete,
                    elevation: airport.elevation || null
                });
            }
        }

        // Sort by distance
        airports.sort((a, b) => a.distance - b.distance);

        // Return top 10
        return airports.slice(0, 10);
    }

    function isToweredAirport(code) {
        if (!window.DataManager) return false;
        const freqs = window.DataManager.getFrequencies(code);
        if (!freqs || freqs.length === 0) return false;

        return freqs.some(f => {
            const type = (f.type || f.description || '').toUpperCase();
            return type.includes('TWR') || type.includes('TOWER') ||
                   type.includes('GND') || type.includes('GROUND') ||
                   type.includes('ATCT');
        });
    }

    function generateAirportsTable(airports) {
        let html = '<table class="navlog-table" style="width: 100%;"><thead><tr>';
        html += '<th>AIRPORT</th>';
        html += '<th>DIST</th>';
        html += '<th>BRG</th>';
        html += '<th>ETE</th>';
        html += '<th>ELEV</th>';
        html += '</tr></thead><tbody>';

        for (const airport of airports) {
            html += '<tr>';
            html += `<td><span class="font-bold">${airport.code}</span></td>`;
            html += `<td>${airport.distance.toFixed(1)} NM</td>`;
            html += `<td>${Math.round(airport.bearing).toString().padStart(3, '0')}°</td>`;

            if (airport.ete !== null) {
                const mins = Math.floor(airport.ete);
                html += `<td>${mins} MIN</td>`;
            } else {
                html += '<td>--</td>';
            }

            if (airport.elevation !== null) {
                html += `<td>${Math.round(airport.elevation)} FT</td>`;
            } else {
                html += '<td>--</td>';
            }

            html += '</tr>';
        }

        html += '</tbody></table>';
        return html;
    }

    // ============================================
    // CALCULATIONS
    // ============================================

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
        if (!window.FlightState || !window.FlightState.flightPlan) return 0;

        const plan = window.FlightState.flightPlan;
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
        currentPosition = position;
        currentAltitude = position.altitude || null;
        currentSpeed = position.speed || null;
        currentHeading = position.heading || null;
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
