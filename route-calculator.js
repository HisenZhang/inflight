// Route Calculator Module - Handles all navigation calculations

// ============================================
// WAYPOINT RESOLUTION
// ============================================

function resolveWaypoints(routeString) {
    const route = routeString.trim().toUpperCase().split(/\s+/).filter(w => w.length > 0);

    if (route.length < 1) {
        return { error: 'ERROR: ENTER AT LEAST ONE WAYPOINT' };
    }

    const waypoints = [];
    const notFound = [];

    for (const code of route) {
        let waypoint = null;

        // Priority: ICAO (4+ chars) → Navaid → Fix → IATA (3 chars)
        if (code.length >= 4) {
            waypoint = DataManager.getAirport(code);
        }

        if (!waypoint) {
            waypoint = DataManager.getNavaid(code);
        }

        if (!waypoint) {
            waypoint = DataManager.getFix(code);
        }

        if (!waypoint && code.length === 3) {
            waypoint = DataManager.getAirportByIATA(code);
        }

        if (waypoint) {
            waypoints.push(waypoint);
        } else {
            notFound.push(code);
        }
    }

    if (notFound.length > 0) {
        return {
            error: `ERROR: WAYPOINT(S) NOT IN DATABASE\n\n${notFound.join(', ')}\n\nVERIFY WAYPOINT IDENTIFIERS`
        };
    }

    return { waypoints };
}

// ============================================
// NAVIGATION CALCULATIONS
// ============================================

async function calculateRoute(waypoints, options = {}) {
    const { enableWinds = false, altitude = null, forecastPeriod = '06', enableTime = false, tas = null, enableFuel = false, usableFuel = null, taxiFuel = null, burnRate = null, vfrReserve = 30 } = options;

    // Calculate magnetic declination for each waypoint
    waypoints.forEach(waypoint => {
        waypoint.magVar = getMagneticDeclination(waypoint.lat, waypoint.lon);
    });

    // Fetch winds aloft if wind correction is enabled
    let windsData = null;
    if (enableWinds && altitude && typeof fetchWindsAloft === 'function') {
        try {
            windsData = await fetchWindsAloft(forecastPeriod);
            console.log(`[Winds] Loaded ${forecastPeriod}hr forecast`);
        } catch (error) {
            console.error('[Winds] Failed to fetch winds aloft:', error);
        }
    }

    // Calculate legs
    const legs = [];
    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to = waypoints[i + 1];

        const distance = calculateDistance(from.lat, from.lon, to.lat, to.lon);
        const trueCourse = calculateBearing(from.lat, from.lon, to.lat, to.lon);

        const leg = {
            from,
            to,
            distance,
            trueCourse,  // TC: true course (ground track)
            magVar: from.magVar
        };

        // Calculate wind data if enabled (independent of TAS)
        let trueHeading = trueCourse;  // TH starts as TC
        let wca = 0;

        if (enableWinds && windsData && altitude) {
            try {
                // Calculate midpoint of leg for wind interpolation
                const midLat = (from.lat + to.lat) / 2;
                const midLon = (from.lon + to.lon) / 2;

                // Calculate winds at filed altitude
                const windData = interpolateWind(midLat, midLon, altitude, windsData);
                if (windData) {
                    leg.windDir = windData.direction;
                    leg.windSpd = windData.speed;

                    // Calculate wind components (headwind/crosswind)
                    const components = calculateWindComponents(windData.direction, windData.speed, trueCourse);
                    leg.headwind = components.headwind;
                    leg.crosswind = components.crosswind;

                    // Calculate WCA only if TAS is available (from time estimation)
                    if (tas && tas > 0) {
                        // WCA = arcsin(crosswind / TAS)
                        const wcaRadians = Math.asin(Math.min(Math.abs(leg.crosswind) / tas, 1));
                        wca = (wcaRadians * 180 / Math.PI) * (leg.crosswind > 0 ? 1 : -1);
                        leg.wca = wca;

                        // Apply WCA to get true heading: TH = TC + WCA
                        trueHeading = trueCourse + wca;

                        console.log(`[Winds] Leg ${from.icao || from.ident} → ${to.icao || to.ident}: Wind ${windData.direction}°/${windData.speed}kt, HW: ${components.headwind.toFixed(1)}, XW: ${components.crosswind.toFixed(1)}, WCA: ${wca.toFixed(1)}°`);
                    } else {
                        console.log(`[Winds] Leg ${from.icao || from.ident} → ${to.icao || to.ident}: Wind ${windData.direction}°/${windData.speed}kt, HW: ${components.headwind.toFixed(1)}, XW: ${components.crosswind.toFixed(1)} (no TAS - WCA not calculated)`);
                    }
                } else {
                    console.warn('[Winds] No wind data returned for leg');
                }

                // Calculate winds at multiple altitudes for wind table
                const altitudes = [
                    altitude - 2000,
                    altitude - 1000,
                    altitude,
                    altitude + 1000,
                    altitude + 2000
                ];

                leg.windsAtAltitudes = {};
                for (const alt of altitudes) {
                    if (alt > 0) { // Only calculate for positive altitudes
                        const altWind = interpolateWind(midLat, midLon, alt, windsData);
                        if (altWind) {
                            leg.windsAtAltitudes[alt] = altWind;
                        }
                    }
                }
            } catch (error) {
                console.error('[Winds] Error calculating wind for leg:', error);
            }
        }

        // Store headings and apply magnetic variation
        // TH = TC + WCA (wind correction applied above if winds enabled)
        // MH = TH - Mag Var
        leg.trueHeading = trueHeading;
        leg.magHeading = trueToMagnetic(trueHeading, from.magVar);

        // Add time/ground speed if enabled
        if (enableTime && tas) {
            const headwind = leg.headwind || 0;
            const groundSpeed = tas - headwind;
            const legTime = (distance / groundSpeed) * 60; // minutes

            leg.groundSpeed = groundSpeed > 0 ? groundSpeed : 0;
            leg.legTime = groundSpeed > 0 ? legTime : 0;
            totalTime += leg.legTime || 0;
        }

        legs.push(leg);
        totalDistance += distance;
    }

    // Calculate fuel on board for each leg (if fuel planning enabled)
    let fuelStatus = null;
    if (enableFuel && enableTime && usableFuel && taxiFuel && burnRate) {
        let fob = usableFuel - taxiFuel; // Fuel on board after taxi
        const requiredReserve = (vfrReserve / 60) * burnRate; // Reserve in gallons

        legs.forEach(leg => {
            const legTimeHours = (leg.legTime || 0) / 60;
            const fuelBurn = legTimeHours * burnRate;

            leg.fuelBurnGal = fuelBurn;
            leg.fobGal = fob - fuelBurn; // FOB at destination
            leg.fobTime = leg.fobGal / burnRate; // FOB in hours

            fob = leg.fobGal;
        });

        // Check if final FOB is sufficient
        const finalFob = legs[legs.length - 1]?.fobGal || 0;
        const isSufficient = finalFob >= requiredReserve;

        fuelStatus = {
            usableFuel,
            taxiFuel,
            burnRate,
            vfrReserve,
            requiredReserve,
            finalFob,
            isSufficient
        };
    }

    return {
        waypoints,
        legs,
        totalDistance,
        totalTime: enableTime ? totalTime : null,
        fuelStatus
    };
}

// ============================================
// DISTANCE & BEARING
// ============================================

function calculateDistance(lat1, lon1, lat2, lon2) {
    try {
        if (typeof vincentyInverse === 'function') {
            const result = vincentyInverse(lat1, lon1, lat2, lon2);
            return result.distance / 1852; // meters to nautical miles
        }
    } catch (error) {
        console.error('Error calculating distance with Vincenty:', error);
    }

    // Fallback to spherical calculation
    console.warn('Using fallback spherical calculation for distance');
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    try {
        if (typeof vincentyInverse === 'function') {
            const result = vincentyInverse(lat1, lon1, lat2, lon2);
            return result.initialBearing;
        }
    } catch (error) {
        console.error('Error calculating bearing with Vincenty:', error);
    }

    // Fallback to spherical calculation
    console.warn('Using fallback spherical calculation for bearing');
    const dLon = toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
    const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
              Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);
    let bearing = Math.atan2(y, x);
    bearing = toDegrees(bearing);
    return (bearing + 360) % 360;
}

// ============================================
// MAGNETIC VARIATION
// ============================================

function getMagneticDeclination(lat, lon) {
    try {
        if (typeof calculateMagneticDeclination === 'function') {
            return calculateMagneticDeclination(lat, lon);
        }
    } catch (error) {
        console.error('Error calculating magnetic declination:', error);
    }
    return null;
}

function trueToMagnetic(trueHeading, declination) {
    if (declination === null || declination === undefined) {
        return null;
    }
    // Magnetic heading = True heading - Declination
    let magHeading = trueHeading - declination;
    return (magHeading + 360) % 360;
}

// ============================================
// FORMATTING UTILITIES
// ============================================

function getWaypointCode(waypoint) {
    if (waypoint.waypointType === 'airport') {
        return waypoint.icao;
    } else {
        return waypoint.ident;
    }
}

function formatCoordinate(value, type) {
    const abs = Math.abs(value);
    const degrees = Math.floor(abs);
    const minutes = ((abs - degrees) * 60).toFixed(3);
    const direction = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${degrees}°${minutes}'${direction}`;
}

function formatNavaidFrequency(freqKhz, type) {
    if (type === 'VOR' || type === 'VOR-DME' || type === 'VORTAC') {
        const freqMhz = freqKhz / 1000;
        return `${freqMhz.toFixed(2)}`;
    } else if (type === 'NDB' || type === 'NDB-DME') {
        return `${freqKhz}`;
    } else {
        return `${freqKhz}`;
    }
}

function getCardinalDirection(bearing) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

function checkLibraries() {
    const vincentyAvailable = typeof vincentyInverse === 'function';
    const magVarAvailable = typeof calculateMagneticDeclination === 'function';

    console.log('[Geodesy] Vincenty (WGS84):', vincentyAvailable ? '✓ Loaded' : '✗ Not loaded (using spherical fallback)');
    console.log('[Geodesy] Magnetic Variation:', magVarAvailable ? '✓ Loaded' : '✗ Not loaded (will show "-")');

    if (!vincentyAvailable) {
        console.warn('[Geodesy] Vincenty not available. Using spherical calculations (slightly less accurate).');
    }
    if (!magVarAvailable) {
        console.warn('[Geodesy] Magnetic variation unavailable. Magnetic headings will show "-".');
    }
}

// ============================================
// EXPORTS
// ============================================

window.RouteCalculator = {
    // Waypoint resolution
    resolveWaypoints,

    // Route calculation
    calculateRoute,

    // Utilities
    getWaypointCode,
    formatCoordinate,
    formatNavaidFrequency,
    getCardinalDirection,
    checkLibraries
};
