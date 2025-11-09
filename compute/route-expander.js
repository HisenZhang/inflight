// Route Expander Module - Handles airway and procedure expansion
// Supports: Airways (V123, J45, Q822), STARs (WYNDE3), SIDs (ACCRA5)

// Module-local references (set by DataManager)
let localAirwaysData = new Map();
let localStarsData = new Map();
let localDpsData = new Map();

// ============================================
// INITIALIZATION
// ============================================

function setAirwaysData(airways) {
    localAirwaysData = airways;
}

function setStarsData(stars) {
    localStarsData = stars;
}

function setDpsData(dps) {
    localDpsData = dps;
}

// ============================================
// ROUTE EXPANSION
// ============================================

function expandRoute(routeString) {
    const tokens = routeString.trim().toUpperCase().split(/\s+/).filter(t => t.length > 0);
    const expanded = [];
    const errors = [];
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i];
        const tokenType = window.QueryEngine?.getTokenType(token);

        // Skip DCT keyword (handled by route calculator)
        if (token === 'DCT') {
            i++;
            continue;
        }

        // Check if token is a lat/long coordinate (DDMM/DDDMM or DDMMSS/DDDMMSS format)
        // These are valid waypoints that don't exist in the database
        const isCoordinate = /^(\d{4,6})\/(\d{5,7})([NS])?([EW])?$/.test(token);
        if (isCoordinate) {
            // Coordinate waypoint - pass through as-is (will be parsed by route calculator)
            expanded.push(token);
            i++;
            continue;
        }

        // Handle procedure (STAR/DP)
        if (tokenType === 'PROCEDURE') {
            const previousFix = expanded.length > 0 ? expanded[expanded.length - 1] : null;
            const procedure = expandProcedure(token, previousFix);
            if (procedure.expanded) {
                // Check if first fix is already the last element (connecting fix)
                const lastFix = expanded[expanded.length - 1];
                if (lastFix === procedure.fixes[0]) {
                    // Don't duplicate the connecting fix
                    expanded.push(...procedure.fixes.slice(1));
                } else {
                    expanded.push(...procedure.fixes);
                }
                i++;
                continue;
            } else {
                errors.push(`Procedure ${token} found in database but failed to expand`);
            }
        }

        // Check for airway pattern: WAYPOINT AIRWAY WAYPOINT
        if (i + 2 < tokens.length) {
            const fromFix = tokens[i];
            const airwayToken = tokens[i + 1];
            const toFix = tokens[i + 2];
            const airwayType = window.QueryEngine?.getTokenType(airwayToken);

            console.debug(`[RouteExpander] Checking airway pattern: ${fromFix} ${airwayToken} ${toFix} - type: ${airwayType}`);

            // Check if middle token is an airway
            if (airwayType === 'AIRWAY') {
                const segment = expandAirway(fromFix, airwayToken, toFix);
                if (segment.expanded) {
                    console.log(`[RouteExpander] Expanded airway ${airwayToken}: ${fromFix} → ${toFix} (${segment.fixes.length} fixes)`);
                    // Check if fromFix is already the last element (for chained airways)
                    const lastFix = expanded[expanded.length - 1];
                    if (lastFix === fromFix) {
                        // Don't duplicate the connecting fix
                        expanded.push(...segment.fixes.slice(1));
                    } else {
                        expanded.push(...segment.fixes);
                    }
                    // Skip to toFix (i+2) instead of past it (i+3)
                    // This allows chaining: PAYGE Q822 GONZZ Q822 FNT
                    // After expanding PAYGE-GONZZ, we want to process GONZZ-FNT next
                    i += 2;
                    continue;
                } else {
                    console.warn(`[RouteExpander] Airway expansion failed: ${fromFix} ${airwayToken} ${toFix}`);
                    errors.push(`Airway ${airwayToken} expansion failed: ${fromFix} to ${toFix}`);
                }
            }
        }

        // Regular waypoint/airport/navaid/fix - pass through as-is
        // Let RouteCalculator.resolveWaypoints() handle validation
        expanded.push(token);
        i++;
    }

    return {
        original: routeString,
        expanded: expanded,
        expandedString: expanded.join(' '),
        errors: errors.length > 0 ? errors : null
    };
}

// ============================================
// AIRWAY EXPANSION
// ============================================

function expandAirway(fromFix, airwayId, toFix) {
    const airway = localAirwaysData.get(airwayId);

    if (!airway) {
        console.warn(`[RouteExpander] Airway ${airwayId} not found in database (${localAirwaysData.size} airways loaded)`);
        return { expanded: false, error: 'Airway not found' };
    }

    if (!airway.fixes) {
        console.warn(`[RouteExpander] Airway ${airwayId} has no fixes array`);
        return { expanded: false, error: 'Airway has no fixes' };
    }

    const fixes = airway.fixes;
    const fromIdx = fixes.indexOf(fromFix);
    const toIdx = fixes.indexOf(toFix);

    if (fromIdx === -1) {
        console.warn(`[RouteExpander] Fix ${fromFix} not found on airway ${airwayId} (has ${fixes.length} fixes)`);
        console.debug(`[RouteExpander] First 10 fixes on ${airwayId}:`, fixes.slice(0, 10));
        console.debug(`[RouteExpander] Last 10 fixes on ${airwayId}:`, fixes.slice(-10));
        return { expanded: false, error: `${fromFix} not on ${airwayId}` };
    }

    if (toIdx === -1) {
        console.warn(`[RouteExpander] Fix ${toFix} not found on airway ${airwayId} (has ${fixes.length} fixes)`);
        console.debug(`[RouteExpander] First 10 fixes on ${airwayId}:`, fixes.slice(0, 10));
        console.debug(`[RouteExpander] Last 10 fixes on ${airwayId}:`, fixes.slice(-10));
        return { expanded: false, error: `${toFix} not on ${airwayId}` };
    }

    // Extract segment (inclusive)
    if (fromIdx < toIdx) {
        // Forward direction
        const segment = fixes.slice(fromIdx, toIdx + 1);
        return {
            expanded: true,
            fixes: segment,
            direction: 'forward'
        };
    } else {
        // Reverse direction
        const segment = fixes.slice(toIdx, fromIdx + 1).reverse();
        return {
            expanded: true,
            fixes: segment,
            direction: 'reverse'
        };
    }
}

// ============================================
// PROCEDURE EXPANSION (STAR/DP)
// ============================================

function expandProcedure(procedureName, previousFix = null) {
    // Try to match STAR or DP with number suffix
    // E.g., WYNDE3 -> try to find WYNDE.WYNDE3 or similar variations

    const match = procedureName.match(/^([A-Z]{3,})(\d+)$/);
    if (!match) {
        return { expanded: false };
    }

    const name = match[1];
    const number = match[2];

    // Try exact match patterns
    const patterns = [
        `${name}.${procedureName}`,  // WYNDE.WYNDE3
        procedureName,                // WYNDE3 (exact)
        `${name}${number}.${name}`    // WYNDE3.WYNDE
    ];

    // Try both STAR and DP datasets (some procedures appear in both)
    for (const pattern of patterns) {
        // Try STAR first
        const star = localStarsData.get(pattern);
        if (star) {
            // New structure: {body: [...], transitions: [{name, entryFix, fixes}]}
            if (star.body && Array.isArray(star.body)) {
                const result = selectBestTransition(star, previousFix);
                return {
                    expanded: true,
                    fixes: result.fixes,
                    type: 'STAR',
                    name: pattern,
                    transition: result.transition
                };
            }
            // Old structure: just array of fixes
            else if (Array.isArray(star) && star.length > 0) {
                return {
                    expanded: true,
                    fixes: star,
                    type: 'STAR',
                    name: pattern
                };
            }
        }

        // Try DP
        const dp = localDpsData.get(pattern);
        if (dp) {
            // New structure: {body: [...], transitions: [{name, entryFix, fixes}]}
            if (dp.body && Array.isArray(dp.body)) {
                const result = selectBestTransition(dp, previousFix);
                return {
                    expanded: true,
                    fixes: result.fixes,
                    type: 'DP',
                    name: pattern,
                    transition: result.transition
                };
            }
            // Old structure: just array of fixes
            else if (Array.isArray(dp) && dp.length > 0) {
                return {
                    expanded: true,
                    fixes: dp,
                    type: 'DP',
                    name: pattern
                };
            }
        }
    }

    return { expanded: false };
}

// Select best STAR transition based on previous fix location
function selectBestTransition(star, previousFix) {
    // If no transitions or no previous fix, just use body
    if (!star.transitions || star.transitions.length === 0 || !previousFix) {
        return { fixes: star.body, transition: null };
    }

    // If previous fix is already the start of the procedure body, don't add transition
    if (previousFix === star.body[0]) {
        return { fixes: star.body, transition: null };
    }

    // Get coordinates of previous fix from global data
    const prevCoords = window.DataManager?.getFixCoordinates(previousFix);

    if (!prevCoords) {
        return { fixes: star.body, transition: null };
    }

    // Find closest transition entry point
    let bestTransition = null;
    let bestDistance = Infinity;

    for (const trans of star.transitions) {
        const entryCoords = window.DataManager?.getFixCoordinates(trans.entryFix);
        if (entryCoords) {
            const distance = calculateDistanceBetweenFixes(prevCoords, entryCoords);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestTransition = trans;
            }
        }
    }

    if (bestTransition) {
        // Combine transition + body, removing duplicate connection point
        const combined = [...bestTransition.fixes];
        const bodyStart = star.body[0];
        if (combined[combined.length - 1] === bodyStart) {
            combined.push(...star.body.slice(1));
        } else {
            combined.push(...star.body);
        }
        return { fixes: combined, transition: bestTransition.name };
    }

    return { fixes: star.body, transition: null };
}

// Simple distance calculation (Haversine formula)
function calculateDistanceBetweenFixes(coords1, coords2) {
    if (!coords1 || !coords2 || coords1.lat === undefined || coords2.lat === undefined ||
        coords1.lon === undefined || coords2.lon === undefined) {
        return NaN;
    }

    const R = 3440.065; // Earth radius in nautical miles
    const lat1 = Number(coords1.lat) * Math.PI / 180;
    const lat2 = Number(coords2.lat) * Math.PI / 180;
    const dLat = (Number(coords2.lat) - Number(coords1.lat)) * Math.PI / 180;
    const dLon = (Number(coords2.lon) - Number(coords1.lon)) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// ============================================
// UTILITIES
// ============================================

function getAirway(airwayId) {
    return localAirwaysData.get(airwayId);
}

function getStar(starName) {
    return localStarsData.get(starName);
}

function getDp(dpName) {
    return localDpsData.get(dpName);
}

function getStats() {
    return {
        airways: localAirwaysData.size,
        stars: localStarsData.size,
        dps: localDpsData.size
    };
}

// ============================================
// EXPORTS
// ============================================

window.RouteExpander = {
    // Initialization
    setAirwaysData,
    setStarsData,
    setDpsData,

    // Expansion
    expandRoute,
    expandAirway,
    expandProcedure,

    // Data access
    getAirway,
    getStar,
    getDp,
    getStats
};
