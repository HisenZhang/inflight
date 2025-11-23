// Route Calculator Module - Handles all navigation calculations

// ============================================
// WAYPOINT RESOLUTION
// ============================================

function resolveWaypoints(routeString) {
    // First, expand airways and procedures if available
    let expandedRoute = routeString;
    if (typeof RouteExpander !== 'undefined') {
        const expansion = RouteExpander.expandRoute(routeString);

        // Check for expansion errors
        if (expansion.errors && expansion.errors.length > 0) {
            console.error('[Route] Expansion errors:', expansion.errors);
            return { error: 'ERROR: ' + expansion.errors.join('; ') };
        }

        if (expansion.expanded.length > 0) {
            expandedRoute = expansion.expandedString;
            console.log(`[Route] Expanded: ${routeString} to ${expandedRoute}`);
        }
    }

    // Split route and remove consecutive duplicates
    const route = expandedRoute.trim().toUpperCase().split(/\s+/).filter(w => w.length > 0);

    // Filter out DCT keyword (it's implicit - direct routing between waypoints)
    const filteredRoute = route.filter(w => w !== 'DCT');

    const dedupedRoute = [];
    for (let i = 0; i < filteredRoute.length; i++) {
        if (i === 0 || filteredRoute[i] !== filteredRoute[i - 1]) {
            dedupedRoute.push(filteredRoute[i]);
        }
    }
    const finalRoute = dedupedRoute;

    if (finalRoute.length < 1) {
        return { error: 'ERROR: ENTER AT LEAST ONE WAYPOINT' };
    }

    const waypoints = [];
    const notFound = [];

    for (const code of finalRoute) {
        let waypoint = null;

        // Check if this is a lat/long coordinate (FAA/ICAO format: DDMM/DDDMM or DDMMSS/DDDMMSS)
        // Supports: 4814/06848, 4814N/06848W, 4814/06848NW
        const latLonMatch = code.match(/^(\d{4,6})([NS])?\/(\d{5,7})([EW])?$/);
        if (latLonMatch) {
            waypoint = parseLatLonCoordinate(code, latLonMatch);
            if (waypoint) {
                waypoints.push(waypoint);
                continue;
            }
        }

        // Priority: Airports (ICAO 4+ chars OR local 3-char alphanumeric) then Navaid then Fix then IATA (3 alphabetic chars)
        // Check for airports:
        // - ICAO codes (4+ characters)
        // - Local identifiers (3 characters with numbers, e.g., 1B1, 2B2)
        if ((code.length >= 4 || (code.length === 3 && /\d/.test(code))) && !latLonMatch) {
            waypoint = DataManager.getAirport(code);
        }

        if (!waypoint) {
            waypoint = DataManager.getNavaid(code);
        }

        if (!waypoint) {
            waypoint = DataManager.getFix(code);
        }

        // IATA codes are 3 alphabetic characters (e.g., BOS, LAX, not 1B1)
        if (!waypoint && code.length === 3 && /^[A-Z]{3}$/.test(code)) {
            waypoint = DataManager.getAirportByIATA(code);
        }

        if (waypoint) {
            waypoints.push(waypoint);
        } else {
            notFound.push(code);
        }
    }

    if (notFound.length > 0) {
        // Classify unknown waypoints
        const oceanic = [];
        const natTracks = [];
        const unknown = [];

        for (const code of notFound) {
            // NAT Track identifiers: N###X format (e.g., N257B, NATX)
            if (/^N\d{2,3}[A-Z]$/.test(code) || code === 'NATX') {
                natTracks.push(code);
            }
            // Likely oceanic waypoints: 5 uppercase letters
            else if (/^[A-Z]{5}$/.test(code)) {
                oceanic.push(code);
            }
            // Unknown format
            else {
                unknown.push(code);
            }
        }

        let errorMsg = 'ERROR: WAYPOINT(S) NOT IN DATABASE\n\n';

        if (oceanic.length > 0) {
            errorMsg += `OCEANIC/INTERNATIONAL: ${oceanic.join(', ')}\n`;
        }
        if (natTracks.length > 0) {
            errorMsg += `NAT TRACKS: ${natTracks.join(', ')}\n`;
        }
        if (unknown.length > 0) {
            errorMsg += `UNKNOWN: ${unknown.join(', ')}\n`;
        }

        errorMsg += '\nDATABASE: US (FAA NASR) + Worldwide airports (OurAirports)\n';
        errorMsg += 'NOTE: Oceanic waypoints and NAT tracks are not included';

        return { error: errorMsg };
    }

    return {
        waypoints,
        expandedRoute: expandedRoute !== routeString ? expandedRoute : null
    };
}

// Parse FAA/ICAO lat/long coordinate format
// Supports: DDMM/DDDMM (degrees+minutes) and DDMMSS/DDDMMSS (degrees+minutes+seconds)
// Examples: 3407/10615 = 34°07'N 106°15'W, 4814N/06848W = 48°14'N 68°48'W
function parseLatLonCoordinate(code, match) {
    try {
        let latStr = match[1];
        const nsHemis = match[2] || null;
        let lonStr = match[3];
        const ewHemis = match[4] || null;

        // Parse latitude (DDMM or DDMMSS format)
        let latDeg, latMin, latSec = 0;
        if (latStr.length === 4) {
            // DDMM format
            latDeg = parseInt(latStr.substring(0, 2));
            latMin = parseInt(latStr.substring(2, 4));
        } else if (latStr.length === 6) {
            // DDMMSS format
            latDeg = parseInt(latStr.substring(0, 2));
            latMin = parseInt(latStr.substring(2, 4));
            latSec = parseInt(latStr.substring(4, 6));
        } else {
            console.error(`[Coordinate] Invalid latitude format: ${latStr}`);
            return null;
        }

        // Parse longitude (DDDMM or DDDMMSS format)
        let lonDeg, lonMin, lonSec = 0;
        if (lonStr.length === 5) {
            // DDDMM format
            lonDeg = parseInt(lonStr.substring(0, 3));
            lonMin = parseInt(lonStr.substring(3, 5));
        } else if (lonStr.length === 7) {
            // DDDMMSS format
            lonDeg = parseInt(lonStr.substring(0, 3));
            lonMin = parseInt(lonStr.substring(3, 5));
            lonSec = parseInt(lonStr.substring(5, 7));
        } else {
            console.error(`[Coordinate] Invalid longitude format: ${lonStr}`);
            return null;
        }

        // Validate ranges
        if (latDeg < 0 || latDeg > 90 || latMin < 0 || latMin >= 60 || latSec < 0 || latSec >= 60) {
            console.error(`[Coordinate] Latitude out of range: ${latDeg}°${latMin}'${latSec}"`);
            return null;
        }
        if (lonDeg < 0 || lonDeg > 180 || lonMin < 0 || lonMin >= 60 || lonSec < 0 || lonSec >= 60) {
            console.error(`[Coordinate] Longitude out of range: ${lonDeg}°${lonMin}'${lonSec}"`);
            return null;
        }

        // Convert to decimal degrees
        let lat = latDeg + (latMin / 60) + (latSec / 3600);
        let lon = lonDeg + (lonMin / 60) + (lonSec / 3600);

        // Apply hemisphere (if not specified, assume N/W for US-centric routing)
        // US is Northern hemisphere (N) and Western hemisphere (W)
        if (nsHemis === 'S') {
            lat = -lat;
        }
        if (ewHemis === 'E') {
            // Eastern hemisphere stays positive
        } else {
            // Western hemisphere (W) or default
            lon = -lon;
        }

        // Format coordinate identifier for display
        const latLabel = latSec > 0 ? `${latDeg}°${latMin}'${latSec}"` : `${latDeg}°${latMin}'`;
        const lonLabel = lonSec > 0 ? `${lonDeg}°${lonMin}'${lonSec}"` : `${lonDeg}°${lonMin}'`;
        const hemisLat = lat >= 0 ? 'N' : 'S';
        const hemisLon = lon >= 0 ? 'E' : 'W';

        console.log(`[Coordinate] Parsed ${code} = ${latLabel}${hemisLat} ${lonLabel}${hemisLon} (${lat.toFixed(5)}, ${lon.toFixed(5)})`);

        return {
            id: `coord_${code}`,
            ident: code,
            name: `${latLabel}${hemisLat} ${lonLabel}${hemisLon}`,
            type: 'COORDINATE',
            lat,
            lon,
            elevation: null,
            waypointType: 'coordinate',
            source: 'user-defined',
            country: ''
        };
    } catch (error) {
        console.error(`[Coordinate] Error parsing ${code}:`, error);
        return null;
    }
}

// ============================================
// NAVIGATION CALCULATIONS
// ============================================

async function calculateRoute(waypoints, options = {}) {
    const { enableWinds = false, altitude = null, forecastPeriod = '06', enableTime = false, tas = null, enableFuel = false, usableFuel = null, taxiFuel = null, burnRate = null, vfrReserve = 30 } = options;

    // Calculate magnetic declination for each waypoint
    waypoints.forEach(waypoint => {
        const magVar = getMagneticDeclination(waypoint.lat, waypoint.lon);
        waypoint.magVar = magVar;
        if (magVar === null) {
            console.warn(`[Route] Failed to calculate magnetic variation for ${waypoint.ident || waypoint.icao} at ${waypoint.lat.toFixed(4)}, ${waypoint.lon.toFixed(4)}`);
        }
    });

    // Fetch winds aloft if wind correction is enabled
    let windsData = null;
    let windsMetadata = null;
    if (enableWinds && altitude && typeof fetchWindsAloft === 'function') {
        try {
            const fetchedData = await fetchWindsAloft(forecastPeriod);
            windsData = fetchedData.stations;
            windsMetadata = fetchedData.metadata;
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
                    leg.windTemp = windData.temperature;

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
        fuelStatus,
        windData: windsData,  // Include fetched wind data for persistence
        windMetadata: windsMetadata  // Include wind metadata (timestamps, validity)
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
            const magVar = calculateMagneticDeclination(lat, lon);
            if (magVar !== null) {
                return magVar;
            } else {
                console.warn(`[MagVar] calculateMagneticDeclination returned null for (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
                return null;
            }
        } else {
            console.warn('[MagVar] calculateMagneticDeclination function not available');
        }
    } catch (error) {
        console.error('[MagVar] Error calculating magnetic declination:', error);
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
// UTILITIES
// ============================================

function getWaypointCode(waypoint) {
    if (waypoint.waypointType === 'airport') {
        return waypoint.icao;
    } else {
        return waypoint.ident;
    }
}

// DEPRECATED: Use Utils.formatters instead
// These wrappers maintained for backward compatibility
function formatCoordinate(value, type) {
    console.warn('[RouteCalculator] formatCoordinate is deprecated. Use Utils.formatCoordinate instead.');
    return window.Utils ? window.Utils.formatCoordinate(value, type) : `${value}`;
}

function formatNavaidFrequency(freqKhz, type) {
    console.warn('[RouteCalculator] formatNavaidFrequency is deprecated. Use Utils.formatNavaidFrequency instead.');
    if (!window.Utils) return `${freqKhz}`;

    // Utils.formatNavaidFrequency expects frequency in correct units and navaid type
    // Convert to format Utils expects
    if (type === 'VOR' || type === 'VOR-DME' || type === 'VORTAC' || type === 'TACAN') {
        const freqMhz = freqKhz > 200 ? freqKhz / 1000 : freqKhz;
        return window.Utils.formatNavaidFrequency(freqMhz, type);
    } else if (type === 'NDB' || type === 'NDB-DME') {
        return window.Utils.formatNavaidFrequency(freqKhz, type);
    } else {
        return `${freqKhz}`;
    }
}

function getCardinalDirection(bearing) {
    console.warn('[RouteCalculator] getCardinalDirection is deprecated. Use Utils.getCardinalDirection instead.');
    return window.Utils ? window.Utils.getCardinalDirection(bearing) : '';
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
    calculateDistance,
    calculateBearing,

    // Magnetic variation
    getMagneticDeclination,

    // Utilities
    getWaypointCode,
    formatCoordinate,
    formatNavaidFrequency,
    getCardinalDirection,
    checkLibraries
};
