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

    // Try to identify departure and destination airports for procedure context
    const departureAirport = tokens.length > 0 ? tokens[0] : null;
    const destinationAirport = tokens.length > 0 ? tokens[tokens.length - 1] : null;

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
        // Supports: 4814/06848, 4814N/06848W, 4814/06848NW
        const isCoordinate = /^(\d{4,6})([NS])?\/(\d{5,7})([EW])?$/.test(token);
        if (isCoordinate) {
            // Coordinate waypoint - pass through as-is (will be parsed by route calculator)
            expanded.push(token);
            i++;
            continue;
        }

        // Handle procedure (STAR/DP)
        // Try if explicitly marked as PROCEDURE, or if it looks like a procedure pattern
        const looksLikeProcedure = /^[A-Z]{3,}\d+$/.test(token);
        if (tokenType === 'PROCEDURE' || looksLikeProcedure) {
            const previousFix = expanded.length > 0 ? expanded[expanded.length - 1] : null;
            const nextFix = i + 1 < tokens.length ? tokens[i + 1] : null;
            // Pass airport context: if this is near the start, it's likely a DP from departure
            // if near the end, it's likely a STAR into destination
            const contextAirport = (i <= 2) ? departureAirport : destinationAirport;
            const procedure = expandProcedure(token, previousFix, contextAirport, nextFix);
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
            } else if (tokenType === 'PROCEDURE') {
                // Only error if it was explicitly marked as a procedure but failed to expand
                errors.push(`Procedure ${token} found in database but failed to expand`);
            }
            // If it just looks like a procedure but isn't in the DB, continue to regular waypoint handling
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

function expandProcedure(procedureName, previousFix = null, contextAirport = null, nextFix = null) {
    // Try to match STAR or DP with number suffix
    // E.g., WYNDE3 -> try to find WYNDE.WYNDE3 or similar variations
    // Also handles formats like: HIDEY1, CHPPR1
    // And transition-specific formats like: HIDEY1.DROPA, CHPPR1.KEAVY

    // Check if user specified a transition (e.g., HIDEY1.DROPA)
    const transitionMatch = procedureName.match(/^([A-Z]{3,}\d+)\.([A-Z]+)$/);
    if (transitionMatch) {
        const [, procName, transitionName] = transitionMatch;
        console.log(`[RouteExpander] User specified transition: ${procName}.${transitionName}`);

        // Try to find the procedure by name and then select the specific transition
        const dp = localDpsData.get(procName);
        if (dp && dp.body && dp.body.fixes && dp.transitions) {
            const trans = dp.transitions.find(t => t.name === transitionName);
            if (trans) {
                // Combine transition + body
                const combined = [...trans.fixes];
                const bodyStart = dp.body.fixes[0];
                if (combined[combined.length - 1] === bodyStart) {
                    combined.push(...dp.body.fixes.slice(1));
                } else {
                    combined.push(...dp.body.fixes);
                }
                console.log(`[RouteExpander] Found DP ${procName} with transition ${transitionName}`);
                return { expanded: true, fixes: combined, type: 'DP', name: procName, transition: transitionName };
            }
        }

        const star = localStarsData.get(procName);
        if (star && star.body && star.body.fixes && star.transitions) {
            const trans = star.transitions.find(t => t.name === transitionName);
            if (trans) {
                // Combine transition + body
                const combined = [...trans.fixes];
                const bodyStart = star.body.fixes[0];
                if (combined[combined.length - 1] === bodyStart) {
                    combined.push(...star.body.fixes.slice(1));
                } else {
                    combined.push(...star.body.fixes);
                }
                console.log(`[RouteExpander] Found STAR ${procName} with transition ${transitionName}`);
                return { expanded: true, fixes: combined, type: 'STAR', name: procName, transition: transitionName };
            }
        }

        console.warn(`[RouteExpander] Transition ${transitionName} not found for procedure ${procName}`);
    }

    const match = procedureName.match(/^([A-Z]{3,})(\d+)$/);
    if (!match) {
        return { expanded: false };
    }

    const name = match[1];
    const number = match[2];

    // Try exact match patterns and common variations
    // Pattern priority: exact match first, then common NASR formats
    const patterns = [
        procedureName,                // WYNDE3, HIDEY1 (exact match - try first)
        `${name}.${procedureName}`,  // WYNDE.WYNDE3, HIDEY.HIDEY1
        `${name}${number}.${name}`   // WYNDE3.WYNDE, HIDEY1.HIDEY
    ];

    // If we have airport context, also try airport-prefixed patterns
    // E.g., KSDF.HIDEY1, KATL.CHPPR1
    if (contextAirport) {
        patterns.push(
            `${contextAirport}.${procedureName}`,      // KSDF.HIDEY1
            `${contextAirport}.${name}.${procedureName}`, // KSDF.HIDEY.HIDEY1
            `${contextAirport}.${procedureName}.${name}`  // KSDF.HIDEY1.HIDEY
        );
    }

    // First, let's see what's actually available for this procedure name
    const allMatchingSTARs = Array.from(localStarsData.keys()).filter(k => k.toUpperCase().includes(name.toUpperCase()));
    const allMatchingDPs = Array.from(localDpsData.keys()).filter(k => k.toUpperCase().includes(name.toUpperCase()));

    console.log(`[RouteExpander] Expanding ${procedureName} (airport: ${contextAirport}, nextFix: ${nextFix})`);
    console.log(`[RouteExpander] Available in DB - STARs: [${allMatchingSTARs.join(', ') || 'none'}], DPs: [${allMatchingDPs.join(', ') || 'none'}]`);
    console.log(`[RouteExpander] Trying patterns:`, patterns);

    // Collect all matching procedures and score them based on connection points
    const candidates = [];

    // Try both STAR and DP datasets (some procedures appear in both)
    for (const pattern of patterns) {
        // Try STAR first
        const star = localStarsData.get(pattern);
        if (star) {
            // New structure: {name, computerCode, type, body: {name, fixes}, transitions: [{name, entryFix, fixes}]}
            if (star.body && star.body.fixes && Array.isArray(star.body.fixes)) {
                const result = selectBestTransition(star, previousFix, nextFix);
                candidates.push({
                    expanded: true,
                    fixes: result.fixes,
                    type: 'STAR',
                    name: pattern,
                    transition: result.transition,
                    pattern
                });
            }
            // Old structure: just array of fixes
            else if (Array.isArray(star) && star.length > 0) {
                candidates.push({
                    expanded: true,
                    fixes: star,
                    type: 'STAR',
                    name: pattern,
                    pattern
                });
            }
        }

        // Try DP
        const dp = localDpsData.get(pattern);
        if (dp) {
            // New structure: {name, computerCode, type, body: {name, fixes}, transitions: [{name, entryFix, fixes}]}
            if (dp.body && dp.body.fixes && Array.isArray(dp.body.fixes)) {
                const result = selectBestTransition(dp, previousFix, nextFix);
                candidates.push({
                    expanded: true,
                    fixes: result.fixes,
                    type: 'DP',
                    name: pattern,
                    transition: result.transition,
                    pattern
                });
            }
            // Old structure: just array of fixes
            else if (Array.isArray(dp) && dp.length > 0) {
                candidates.push({
                    expanded: true,
                    fixes: dp,
                    type: 'DP',
                    name: pattern,
                    pattern
                });
            }
        }
    }

    // If we have candidates, pick the best one based on connection to nextFix
    if (candidates.length > 0) {
        let bestCandidate = candidates[0];

        // If we have a nextFix, prefer the candidate whose last fix matches or connects to it
        if (nextFix) {
            for (const candidate of candidates) {
                const lastFix = candidate.fixes[candidate.fixes.length - 1];
                if (lastFix === nextFix) {
                    console.log(`[RouteExpander] Selected ${candidate.type} ${candidate.pattern} - last fix ${lastFix} matches nextFix ${nextFix}`);
                    bestCandidate = candidate;
                    break;
                }
            }
        }

        console.log(`[RouteExpander] Found ${candidates.length} candidate(s) for ${procedureName}, selected: ${bestCandidate.pattern}`);
        return bestCandidate;
    }

    // Log what procedures ARE available for debugging
    const availableSTARs = Array.from(localStarsData.keys()).filter(k => k.toUpperCase().includes(name.toUpperCase()));
    const availableDPs = Array.from(localDpsData.keys()).filter(k => k.toUpperCase().includes(name.toUpperCase()));

    console.warn(`[RouteExpander] Failed to expand ${procedureName}. Searched in ${localStarsData.size} STARs and ${localDpsData.size} DPs`);

    if (availableSTARs.length > 0 || availableDPs.length > 0) {
        console.warn(`[RouteExpander] Found similar procedures:`, {
            STARs: availableSTARs.slice(0, 10),  // Show first 10
            DPs: availableDPs.slice(0, 10)
        });
    } else {
        console.warn(`[RouteExpander] No similar procedures found containing "${name}"`);
    }

    return { expanded: false };
}

// Select best procedure transition based on previous fix or explicit nextFix
// Handles new structure: {body: {name, fixes}, transitions: [{name, entryFix, fixes}]}
function selectBestTransition(procedure, previousFix, nextFix) {
    const bodyFixes = procedure.body.fixes;

    // If no transitions, just use body
    if (!procedure.transitions || procedure.transitions.length === 0) {
        return { fixes: bodyFixes, transition: null };
    }

    // If nextFix is specified, try to find a transition that matches it
    if (nextFix) {
        for (const trans of procedure.transitions) {
            // Check if this transition's name matches the nextFix
            if (trans.name === nextFix) {
                // Combine transition + body, removing duplicate connection point
                const combined = [...trans.fixes];
                const bodyStart = bodyFixes[0];
                if (combined[combined.length - 1] === bodyStart) {
                    combined.push(...bodyFixes.slice(1));
                } else {
                    combined.push(...bodyFixes);
                }
                console.log(`[RouteExpander] Selected explicit transition: ${trans.name}`);
                return { fixes: combined, transition: trans.name };
            }
        }
    }

    // If no previous fix, just use body
    if (!previousFix) {
        return { fixes: bodyFixes, transition: null };
    }

    // If previous fix is already the start of the procedure body, don't add transition
    if (previousFix === bodyFixes[0]) {
        return { fixes: bodyFixes, transition: null };
    }

    // Get coordinates of previous fix from global data
    const prevCoords = window.DataManager?.getFixCoordinates(previousFix);

    if (!prevCoords) {
        return { fixes: bodyFixes, transition: null };
    }

    // Find closest transition entry point
    let bestTransition = null;
    let bestDistance = Infinity;

    for (const trans of procedure.transitions) {
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
        const bodyStart = bodyFixes[0];
        if (combined[combined.length - 1] === bodyStart) {
            combined.push(...bodyFixes.slice(1));
        } else {
            combined.push(...bodyFixes);
        }
        console.log(`[RouteExpander] Selected closest transition: ${bestTransition.name}`);
        return { fixes: combined, transition: bestTransition.name };
    }

    return { fixes: bodyFixes, transition: null };
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
