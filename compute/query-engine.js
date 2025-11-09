// Query Engine - Spatial Queries, Search, and Autocomplete
// Business logic for querying aviation data

// ============================================
// STATE (Data References)
// ============================================

let airportsData = null;
let navaidsData = null;
let fixesData = null;
let tokenTypeMap = null;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize query engine with data references from DataManager
 * @param {Map} airports - Map of airport data
 * @param {Map} navaids - Map of navaid data
 * @param {Map} fixes - Map of fix data
 * @param {Map} tokenMap - Token type lookup map
 */
function init(airports, navaids, fixes, tokenMap) {
    airportsData = airports;
    navaidsData = navaids;
    fixesData = fixes;
    tokenTypeMap = tokenMap;

    console.log('[QueryEngine] Initialized with data references');
}

// ============================================
// AUTOCOMPLETE & SEARCH
// ============================================

/**
 * Search for waypoints matching a term (for autocomplete)
 * @param {string} term - Search term
 * @param {number} limit - Maximum number of results (default: 10)
 * @returns {Array} Array of matching waypoints with type and display info
 */
function searchWaypoints(term, limit = 10) {
    if (!term || term.length < 2) return [];

    const results = [];
    const upperTerm = term.toUpperCase();

    // Search airports
    if (airportsData) {
        for (const [code, airport] of airportsData) {
            if (results.length >= limit) break;

            if (code.startsWith(upperTerm) ||
                (airport.name && airport.name.toUpperCase().includes(upperTerm))) {
                results.push({
                    code: code,
                    name: airport.name || code,
                    type: 'airport',
                    lat: airport.lat,
                    lon: airport.lon,
                    display: `${code} - ${airport.name || 'Airport'}`
                });
            }
        }
    }

    // Search navaids
    if (navaidsData && results.length < limit) {
        for (const [ident, navaid] of navaidsData) {
            if (results.length >= limit) break;

            if (ident.startsWith(upperTerm) ||
                (navaid.name && navaid.name.toUpperCase().includes(upperTerm))) {
                results.push({
                    code: ident,
                    name: navaid.name || ident,
                    type: 'navaid',
                    navaidType: navaid.type,
                    lat: navaid.lat,
                    lon: navaid.lon,
                    display: `${ident} - ${navaid.name || 'Navaid'} (${navaid.type || 'NAV'})`
                });
            }
        }
    }

    // Search fixes
    if (fixesData && results.length < limit) {
        for (const [name, fix] of fixesData) {
            if (results.length >= limit) break;

            if (name.startsWith(upperTerm)) {
                results.push({
                    code: name,
                    name: name,
                    type: 'fix',
                    lat: fix.lat,
                    lon: fix.lon,
                    display: `${name} - Fix`
                });
            }
        }
    }

    return results;
}

/**
 * Get token type for route parsing (used for validation and resolution)
 * @param {string} token - Route token (airport code, navaid ident, fix name, etc.)
 * @returns {string|null} Token type ('airport', 'navaid', 'fix', 'airway', etc.) or null
 */
function getTokenType(token) {
    if (!tokenTypeMap) return null;
    return tokenTypeMap.get(token.toUpperCase()) || null;
}

// ============================================
// SPATIAL QUERIES
// ============================================

/**
 * Get points within specified distance (nm) of route legs
 * @param {Array} legs - Array of route leg objects
 * @param {number} distanceNM - Maximum distance from route (default: 45nm)
 * @returns {object} Object with arrays of nearby airports and navaids
 */
function getPointsNearRoute(legs, distanceNM = 45) {
    const result = {
        airports: [],
        navaids: []
    };

    if (!legs || legs.length === 0) return result;
    if (!window.RouteCalculator) {
        console.error('[QueryEngine] RouteCalculator not available');
        return result;
    }

    // Helper function to check if airport has tower frequencies
    const isToweredAirport = (code) => {
        if (!window.DataManager) return false;
        const freqs = window.DataManager.getFrequencies(code);
        if (!freqs || freqs.length === 0) return false;

        // Check for tower-related frequency types
        return freqs.some(f => {
            const type = (f.type || f.description || '').toUpperCase();
            return type.includes('TWR') || type.includes('TOWER') ||
                   type.includes('GND') || type.includes('GROUND') ||
                   type.includes('ATCT');
        });
    };

    const calculateDistance = window.RouteCalculator.calculateDistance;

    // Check each airport
    if (airportsData) {
        for (const [code, airport] of airportsData) {
            if (!isToweredAirport(code)) continue;

            let minDistance = Infinity;

            // Check distance to each leg
            for (const leg of legs) {
                // Simple approximation: check distance to both endpoints and a midpoint
                const distToFrom = calculateDistance(airport.lat, airport.lon, leg.from.lat, leg.from.lon);
                const distToTo = calculateDistance(airport.lat, airport.lon, leg.to.lat, leg.to.lon);

                // Calculate midpoint
                const midLat = (leg.from.lat + leg.to.lat) / 2;
                const midLon = (leg.from.lon + leg.to.lon) / 2;
                const distToMid = calculateDistance(airport.lat, airport.lon, midLat, midLon);

                minDistance = Math.min(minDistance, distToFrom, distToTo, distToMid);
            }

            if (minDistance <= distanceNM) {
                result.airports.push({ code, ...airport });
            }
        }
    }

    // Check each navaid
    if (navaidsData) {
        for (const [ident, navaid] of navaidsData) {
            let minDistance = Infinity;

            // Check distance to each leg
            for (const leg of legs) {
                const distToFrom = calculateDistance(navaid.lat, navaid.lon, leg.from.lat, leg.from.lon);
                const distToTo = calculateDistance(navaid.lat, navaid.lon, leg.to.lat, leg.to.lon);

                const midLat = (leg.from.lat + leg.to.lat) / 2;
                const midLon = (leg.from.lon + leg.to.lon) / 2;
                const distToMid = calculateDistance(navaid.lat, navaid.lon, midLat, midLon);

                minDistance = Math.min(minDistance, distToFrom, distToTo, distToMid);
            }

            if (minDistance <= distanceNM) {
                result.navaids.push({ ident, ...navaid });
            }
        }
    }

    return result;
}

/**
 * Get points within bounding box
 * @param {object} bounds - Bounding box {minLat, maxLat, minLon, maxLon}
 * @param {Array} legs - Optional: if provided, uses route-based logic instead
 * @returns {object} Object with arrays of airports and navaids
 */
function getPointsInBounds(bounds, legs = null) {
    // If legs provided, use route-based logic instead
    if (legs) {
        return getPointsNearRoute(legs, 45);
    }

    const result = {
        airports: [],
        navaids: []
    };

    // Helper function to check if airport has tower frequencies
    const isToweredAirport = (code) => {
        if (!window.DataManager) return false;
        const freqs = window.DataManager.getFrequencies(code);
        if (!freqs || freqs.length === 0) return false;

        // Check for tower-related frequency types
        return freqs.some(f => {
            const type = (f.type || f.description || '').toUpperCase();
            return type.includes('TWR') || type.includes('TOWER') ||
                   type.includes('GND') || type.includes('GROUND') ||
                   type.includes('ATCT');
        });
    };

    // Get towered airports within bounds only
    if (airportsData) {
        for (const [code, airport] of airportsData) {
            if (airport.lat >= bounds.minLat && airport.lat <= bounds.maxLat &&
                airport.lon >= bounds.minLon && airport.lon <= bounds.maxLon &&
                isToweredAirport(code)) {
                result.airports.push({ code, ...airport });
            }
        }
    }

    // Get navaids within bounds
    if (navaidsData) {
        for (const [ident, navaid] of navaidsData) {
            if (navaid.lat >= bounds.minLat && navaid.lat <= bounds.maxLat &&
                navaid.lon >= bounds.minLon && navaid.lon <= bounds.maxLon) {
                result.navaids.push({ ident, ...navaid });
            }
        }
    }

    return result;
}

/**
 * Find nearest airport to a coordinate
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} maxDistanceNM - Maximum search distance in nautical miles (default: 100)
 * @returns {object|null} Nearest airport object with distance, or null
 */
function findNearestAirport(lat, lon, maxDistanceNM = 100) {
    if (!airportsData || !window.RouteCalculator) return null;

    const calculateDistance = window.RouteCalculator.calculateDistance;
    let nearest = null;
    let minDistance = Infinity;

    for (const [code, airport] of airportsData) {
        const distance = calculateDistance(lat, lon, airport.lat, airport.lon);

        if (distance < minDistance && distance <= maxDistanceNM) {
            minDistance = distance;
            nearest = {
                code,
                ...airport,
                distance: distance
            };
        }
    }

    return nearest;
}

/**
 * Find all waypoints within radius
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} radiusNM - Search radius in nautical miles
 * @returns {object} Object with arrays of airports, navaids, and fixes
 */
function findWaypointsWithinRadius(lat, lon, radiusNM) {
    const result = {
        airports: [],
        navaids: [],
        fixes: []
    };

    if (!window.RouteCalculator) return result;

    const calculateDistance = window.RouteCalculator.calculateDistance;

    // Search airports
    if (airportsData) {
        for (const [code, airport] of airportsData) {
            const distance = calculateDistance(lat, lon, airport.lat, airport.lon);
            if (distance <= radiusNM) {
                result.airports.push({ code, ...airport, distance });
            }
        }
    }

    // Search navaids
    if (navaidsData) {
        for (const [ident, navaid] of navaidsData) {
            const distance = calculateDistance(lat, lon, navaid.lat, navaid.lon);
            if (distance <= radiusNM) {
                result.navaids.push({ ident, ...navaid, distance });
            }
        }
    }

    // Search fixes
    if (fixesData) {
        for (const [name, fix] of fixesData) {
            const distance = calculateDistance(lat, lon, fix.lat, fix.lon);
            if (distance <= radiusNM) {
                result.fixes.push({ name, ...fix, distance });
            }
        }
    }

    // Sort each category by distance
    result.airports.sort((a, b) => a.distance - b.distance);
    result.navaids.sort((a, b) => a.distance - b.distance);
    result.fixes.sort((a, b) => a.distance - b.distance);

    return result;
}

// ============================================
// EXPORTS
// ============================================

window.QueryEngine = {
    // Initialization
    init,

    // Autocomplete and search
    searchWaypoints,
    getTokenType,

    // Spatial queries
    getPointsNearRoute,
    getPointsInBounds,
    findNearestAirport,
    findWaypointsWithinRadius
};
