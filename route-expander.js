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
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i];

        // Check for STAR/DP with number (e.g., WYNDE3, ACCRA5)
        if (/^[A-Z]{3,}\d+$/.test(token)) {
            const procedure = expandProcedure(token);
            if (procedure.expanded) {
                expanded.push(...procedure.fixes);
                i++;
                continue;
            }
        }

        // Check for airway pattern: WAYPOINT AIRWAY WAYPOINT
        if (i + 2 < tokens.length) {
            const fromFix = tokens[i];
            const airway = tokens[i + 1];
            const toFix = tokens[i + 2];

            // Check if middle token looks like an airway (V123, J45, Q822, etc.)
            if (/^[A-Z]\d+$/.test(airway)) {
                const segment = expandAirway(fromFix, airway, toFix);
                if (segment.expanded) {
                    expanded.push(...segment.fixes);
                    i += 3;
                    continue;
                }
            }
        }

        // Regular waypoint - add as-is
        expanded.push(token);
        i++;
    }

    return {
        original: routeString,
        expanded: expanded,
        expandedString: expanded.join(' ')
    };
}

// ============================================
// AIRWAY EXPANSION
// ============================================

function expandAirway(fromFix, airwayId, toFix) {
    const airway = localAirwaysData.get(airwayId);

    if (!airway || !airway.fixes) {
        return { expanded: false };
    }

    const fixes = airway.fixes;
    const fromIdx = fixes.indexOf(fromFix);
    const toIdx = fixes.indexOf(toFix);

    if (fromIdx === -1 || toIdx === -1) {
        return { expanded: false };
    }

    // Extract segment (inclusive)
    if (fromIdx < toIdx) {
        // Forward direction
        return {
            expanded: true,
            fixes: fixes.slice(fromIdx, toIdx + 1),
            direction: 'forward'
        };
    } else {
        // Reverse direction
        return {
            expanded: true,
            fixes: fixes.slice(toIdx, fromIdx + 1).reverse(),
            direction: 'reverse'
        };
    }
}

// ============================================
// PROCEDURE EXPANSION (STAR/DP)
// ============================================

function expandProcedure(procedureName) {
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

    // Try STAR first
    for (const pattern of patterns) {
        const star = localStarsData.get(pattern);
        if (star && star.length > 0) {
            return {
                expanded: true,
                fixes: star,
                type: 'STAR',
                name: pattern
            };
        }
    }

    // Try DP
    for (const pattern of patterns) {
        const dp = localDpsData.get(pattern);
        if (dp && dp.length > 0) {
            return {
                expanded: true,
                fixes: dp,
                type: 'DP',
                name: pattern
            };
        }
    }

    return { expanded: false };
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
