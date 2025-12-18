// Query Engine - Spatial Queries, Search, and Autocomplete
// Business logic for querying aviation data

// Wrap in IIFE to avoid global scope pollution
(function() {
    'use strict';

// ============================================
// STATE (Data References)
// ============================================

let qe_airportsData = null;
let qe_navaidsData = null;
let qe_fixesData = null;
let qe_airwaysData = null;
let qe_tokenTypeMap = null;

// Token type constants (imported from DataManager for memory efficiency)
// Initialize with fallback string literals in case init() isn't called before use
let TOKEN_TYPE_AIRPORT = 'AIRPORT';
let TOKEN_TYPE_NAVAID = 'NAVAID';
let TOKEN_TYPE_FIX = 'FIX';
let TOKEN_TYPE_AIRWAY = 'AIRWAY';
let TOKEN_TYPE_PROCEDURE = 'PROCEDURE';

// Waypoint type constants (for object property memory efficiency)
// Initialize with fallback string literals in case init() isn't called before use
let WAYPOINT_TYPE_AIRPORT = 'airport';
let WAYPOINT_TYPE_NAVAID = 'navaid';
let WAYPOINT_TYPE_FIX = 'fix';
let WAYPOINT_TYPE_AIRWAY = 'airway';
let WAYPOINT_TYPE_PROCEDURE = 'procedure';
let WAYPOINT_TYPE_PROCEDURE_TRANSITION = 'procedure_transition';

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize query engine with data references from DataManager
 * @param {Map} airports - Map of airport data
 * @param {Map} navaids - Map of navaid data
 * @param {Map} fixes - Map of fix data
 * @param {Map} airways - Map of airway data
 * @param {Map} tokenMap - Token type lookup map
 */
function init(airports, navaids, fixes, airways, tokenMap) {
    qe_airportsData = airports;
    qe_navaidsData = navaids;
    qe_fixesData = fixes;
    qe_airwaysData = airways;
    qe_tokenTypeMap = tokenMap;

    // Import constants from DataManager for memory efficiency
    if (window.DataManager) {
        TOKEN_TYPE_AIRPORT = window.DataManager.TOKEN_TYPE_AIRPORT;
        TOKEN_TYPE_NAVAID = window.DataManager.TOKEN_TYPE_NAVAID;
        TOKEN_TYPE_FIX = window.DataManager.TOKEN_TYPE_FIX;
        TOKEN_TYPE_AIRWAY = window.DataManager.TOKEN_TYPE_AIRWAY;
        TOKEN_TYPE_PROCEDURE = window.DataManager.TOKEN_TYPE_PROCEDURE;

        WAYPOINT_TYPE_AIRPORT = window.DataManager.WAYPOINT_TYPE_AIRPORT;
        WAYPOINT_TYPE_NAVAID = window.DataManager.WAYPOINT_TYPE_NAVAID;
        WAYPOINT_TYPE_FIX = window.DataManager.WAYPOINT_TYPE_FIX;
        // Note: WAYPOINT_TYPE_AIRWAY and WAYPOINT_TYPE_PROCEDURE use local defaults
        // as DataManager doesn't define these (they're specific to QueryEngine)
    }

    console.log(`[QueryEngine] Initialized with data references: ${tokenMap ? tokenMap.size : 0} tokens, ${airways ? airways.size : 0} airways`);
}

// ============================================
// AUTOCOMPLETE & SEARCH
// ============================================

/**
 * Search for waypoints matching a term (for autocomplete)
 * Enhanced with smart ranking and context-aware suggestions
 * @param {string} term - Search term
 * @param {string} previousToken - Previous token for context-aware suggestions (optional)
 * @param {number} limit - Maximum number of results (default: 15)
 * @returns {Array} Array of matching waypoints with type and display info
 */
/**
 * Search airports only (for departure/destination autocomplete)
 * @param {string} term - Search term
 * @param {number} limit - Maximum results to return
 * @returns {Array} Array of airport results
 */
function searchAirports(term, limit = 15) {
    // Early return if data not loaded yet
    if (!qe_airportsData || qe_airportsData.size === 0) {
        console.warn('[QueryEngine] searchAirports called but no airport data loaded yet');
        return [];
    }

    const upperTerm = term ? term.toUpperCase() : '';

    // Arrays for different priority levels
    const exactMatches = [];
    const prefixMatches = [];
    const substringMatches = [];
    const descriptionMatches = [];

    // Require at least 1 character
    if (!upperTerm || upperTerm.length < 1) return [];

    // Search airports only
    if (qe_airportsData) {
        for (const [code, airport] of qe_airportsData) {
            const upperCode = code.toUpperCase();
            const upperName = (airport.name || '').toUpperCase();
            const iata = (airport.iata || '').toUpperCase();

            const result = {
                code: code,
                name: airport.name || code,
                type: TOKEN_TYPE_AIRPORT,
                waypointType: WAYPOINT_TYPE_AIRPORT,
                lat: airport.lat,
                lon: airport.lon,
                location: `${airport.municipality || ''}, ${airport.country || ''}`.trim()
            };

            if (upperCode === upperTerm || iata === upperTerm) {
                exactMatches.push(result);
            } else if (upperCode.startsWith(upperTerm) || iata.startsWith(upperTerm)) {
                prefixMatches.push(result);
            } else if (upperCode.includes(upperTerm) || iata.includes(upperTerm)) {
                substringMatches.push(result);
            } else if (upperName.includes(upperTerm)) {
                descriptionMatches.push(result);
            }
        }
    }

    // Sort each group alphabetically by code
    exactMatches.sort((a, b) => a.code.localeCompare(b.code));
    prefixMatches.sort((a, b) => a.code.localeCompare(b.code));
    substringMatches.sort((a, b) => a.code.localeCompare(b.code));
    descriptionMatches.sort((a, b) => a.code.localeCompare(b.code));

    // Combine results with priority: exact > prefix > substring > description
    return [
        ...exactMatches,
        ...prefixMatches,
        ...substringMatches,
        ...descriptionMatches
    ].slice(0, limit);
}

function searchWaypoints(term, previousToken = null, limit = 15) {
    // Early return if data not loaded yet
    if (!qe_airportsData || qe_airportsData.size === 0) {
        console.warn('[QueryEngine] searchWaypoints called but no airport data loaded yet');
        return [];
    }

    const upperTerm = term ? term.toUpperCase() : '';
    const upperPrevToken = previousToken ? previousToken.toUpperCase() : null;

    // Check previous token type for context-aware suggestions
    const prevTokenType = upperPrevToken ? getTokenType(upperPrevToken) : null;

    // Debug logging for procedure detection
    if (upperPrevToken && /^[A-Z]{3,}\d+$/.test(upperPrevToken)) {
        console.log(`[QueryEngine] Autocomplete - Previous token: ${upperPrevToken}, Type: ${prevTokenType}, Search term: "${upperTerm}"`);
    }

    // Arrays for different priority levels
    const exactMatches = [];
    const prefixMatches = [];
    const substringMatches = [];
    const descriptionMatches = [];

    // Special case: if previous token is an airway, suggest waypoints along that airway
    if (prevTokenType === TOKEN_TYPE_AIRWAY && qe_airwaysData) {
        const airway = qe_airwaysData.get(upperPrevToken);
        if (airway && airway.fixes) {
            // Filter airway fixes by search term (or show all if term is empty)
            for (const fixIdent of airway.fixes) {
                if (exactMatches.length + prefixMatches.length + substringMatches.length >= limit) break;

                const upperFixIdent = fixIdent.toUpperCase();

                // Look up waypoint in all data sources (fixes, navaids, airports)
                let waypointData = qe_fixesData?.get(upperFixIdent);
                let waypointType = WAYPOINT_TYPE_FIX;
                let displayType = TOKEN_TYPE_FIX;

                if (!waypointData) {
                    waypointData = qe_navaidsData?.get(upperFixIdent);
                    if (waypointData) {
                        waypointType = WAYPOINT_TYPE_NAVAID;
                        displayType = waypointData.type || TOKEN_TYPE_NAVAID;
                    }
                }

                if (!waypointData) {
                    waypointData = qe_airportsData?.get(upperFixIdent);
                    if (waypointData) {
                        waypointType = WAYPOINT_TYPE_AIRPORT;
                        displayType = TOKEN_TYPE_AIRPORT;
                    }
                }

                if (!waypointData) continue; // Skip if waypoint not found in any database

                const result = {
                    code: upperFixIdent,
                    name: waypointType === WAYPOINT_TYPE_AIRPORT ? (waypointData.name || upperFixIdent) : upperFixIdent,
                    type: displayType,
                    waypointType: waypointType,
                    lat: waypointData.lat,
                    lon: waypointData.lon,
                    location: `On ${upperPrevToken}`,
                    contextHint: `Exit point on ${upperPrevToken}`
                };

                // If no search term, add all fixes
                if (!upperTerm || upperTerm.length === 0) {
                    prefixMatches.push(result);
                } else if (upperFixIdent === upperTerm) {
                    // Exact match
                    exactMatches.push(result);
                } else if (upperFixIdent.startsWith(upperTerm)) {
                    // Prefix match
                    prefixMatches.push(result);
                } else if (upperFixIdent.includes(upperTerm)) {
                    // Substring match
                    substringMatches.push(result);
                }
            }

            // Return airway-specific suggestions
            return [...exactMatches, ...prefixMatches, ...substringMatches].slice(0, limit);
        }
    }

    // Special case: if previous token is a procedure, suggest transitions
    if (prevTokenType === TOKEN_TYPE_PROCEDURE) {
        const transitions = getProcedureTransitions(upperPrevToken);
        if (transitions.length > 0) {
            for (const trans of transitions) {
                if (exactMatches.length + prefixMatches.length >= limit) break;

                const result = {
                    code: trans.display,
                    name: trans.display,
                    type: trans.type === 'DP' ? 'DP TRANSITION' : 'STAR TRANSITION',
                    waypointType: WAYPOINT_TYPE_PROCEDURE_TRANSITION,
                    location: `${trans.transition} transition`,
                    contextHint: `${trans.transition} transition for ${upperPrevToken}`
                };

                // If no search term, show all transitions
                if (!upperTerm || upperTerm.length === 0) {
                    prefixMatches.push(result);
                } else if (trans.transition.startsWith(upperTerm)) {
                    // Prefix match on transition name
                    prefixMatches.push(result);
                } else if (trans.display.toUpperCase().startsWith(upperTerm)) {
                    // Prefix match on full display name
                    prefixMatches.push(result);
                }
            }

            // Return procedure-specific suggestions
            return [...exactMatches, ...prefixMatches].slice(0, limit);
        }
    }

    // Special case: if previous token is a fix or navaid, suggest airways containing that waypoint
    if ((prevTokenType === TOKEN_TYPE_FIX || prevTokenType === TOKEN_TYPE_NAVAID) && qe_airwaysData) {
        for (const [airwayId, airway] of qe_airwaysData) {
            if (exactMatches.length + prefixMatches.length + substringMatches.length >= limit) break;

            // Check if this airway contains the previous waypoint
            if (airway.fixes && airway.fixes.some(f => f.toUpperCase() === upperPrevToken)) {
                const upperAirwayId = airwayId.toUpperCase();

                // If no search term, add all airways
                if (!upperTerm || upperTerm.length === 0) {
                    prefixMatches.push({
                        code: upperAirwayId,
                        name: upperAirwayId,
                        type: TOKEN_TYPE_AIRWAY,
                        waypointType: WAYPOINT_TYPE_AIRWAY,
                        location: `Contains ${upperPrevToken}`,
                        contextHint: `Airway via ${upperPrevToken}`
                    });
                } else if (upperAirwayId === upperTerm) {
                    exactMatches.push({
                        code: upperAirwayId,
                        name: upperAirwayId,
                        type: TOKEN_TYPE_AIRWAY,
                        waypointType: WAYPOINT_TYPE_AIRWAY,
                        location: `Contains ${upperPrevToken}`,
                        contextHint: `Airway via ${upperPrevToken}`
                    });
                } else if (upperAirwayId.startsWith(upperTerm)) {
                    prefixMatches.push({
                        code: upperAirwayId,
                        name: upperAirwayId,
                        type: TOKEN_TYPE_AIRWAY,
                        waypointType: WAYPOINT_TYPE_AIRWAY,
                        location: `Contains ${upperPrevToken}`,
                        contextHint: `Airway via ${upperPrevToken}`
                    });
                } else if (upperAirwayId.includes(upperTerm)) {
                    substringMatches.push({
                        code: upperAirwayId,
                        name: upperAirwayId,
                        type: TOKEN_TYPE_AIRWAY,
                        waypointType: WAYPOINT_TYPE_AIRWAY,
                        location: `Contains ${upperPrevToken}`,
                        contextHint: `Airway via ${upperPrevToken}`
                    });
                }
            }
        }

        // If we found airway suggestions, return them with high priority
        if (exactMatches.length + prefixMatches.length + substringMatches.length > 0) {
            return [...exactMatches, ...prefixMatches, ...substringMatches].slice(0, limit);
        }
    }

    // If no search term and no context-aware suggestions, return empty
    if (!upperTerm || upperTerm.length < 1) return [];

    // Search for airways that match the search term (e.g., Q822, V123, J45)
    if (qe_airwaysData && upperTerm.length >= 1) {
        for (const [airwayId, airway] of qe_airwaysData) {
            const upperAirwayId = airwayId.toUpperCase();

            if (upperAirwayId === upperTerm) {
                exactMatches.push({
                    code: upperAirwayId,
                    name: upperAirwayId,
                    type: TOKEN_TYPE_AIRWAY,
                    waypointType: WAYPOINT_TYPE_AIRWAY,
                    location: `${airway.fixes ? airway.fixes.length : 0} fixes`,
                    contextHint: 'Airway'
                });
            } else if (upperAirwayId.startsWith(upperTerm)) {
                prefixMatches.push({
                    code: upperAirwayId,
                    name: upperAirwayId,
                    type: TOKEN_TYPE_AIRWAY,
                    waypointType: WAYPOINT_TYPE_AIRWAY,
                    location: `${airway.fixes ? airway.fixes.length : 0} fixes`,
                    contextHint: 'Airway'
                });
            } else if (upperAirwayId.includes(upperTerm)) {
                substringMatches.push({
                    code: upperAirwayId,
                    name: upperAirwayId,
                    type: TOKEN_TYPE_AIRWAY,
                    waypointType: WAYPOINT_TYPE_AIRWAY,
                    location: `${airway.fixes ? airway.fixes.length : 0} fixes`,
                    contextHint: 'Airway'
                });
            }
        }
    }

    // Search for procedures that match the search term (e.g., HIDEY1, CHPPR1, WYNDE3)
    // Allow partial matches for better autocomplete UX
    if (upperTerm.length >= 2 && /^[A-Z0-9]+$/.test(upperTerm)) {
        // Search for procedures that match this pattern
        const dpsData = window.DataManager?.getDpsData?.() || new Map();
        const starsData = window.DataManager?.getStarsData?.() || new Map();

        // Check if it looks like a complete procedure name (letters + digits)
        const match = upperTerm.match(/^([A-Z]{3,})(\d*)$/);
        if (match) {
            const [, name, number] = match;

            // Search DPs - use Set to track unique procedure names
            const foundDPs = new Set();
            for (const [key, data] of dpsData) {
                // Match patterns like: HIDEY1, KORD_HIDEY1_RW28C, HIDEY.HIDEY1, HIDEY1.HIDEY
                const upperKey = key.toUpperCase();
                let procName = null;

                // Extract procedure name from different key formats
                if (upperKey.includes('_')) {
                    // CIFP format: KORD_HIDEY1_RW28C -> HIDEY1 is at position 1
                    const parts = upperKey.split('_');
                    if (parts.length >= 2) {
                        procName = parts[1];
                    }
                } else if (upperKey.includes('.')) {
                    // Legacy NASR format: HIDEY.HIDEY1 or HIDEY1.HIDEY
                    const parts = upperKey.split('.');
                    // Use the part that has digits (the procedure name)
                    procName = parts.find(p => /\d/.test(p)) || parts[0];
                } else {
                    // Simple key: just the procedure name
                    procName = upperKey;
                }

                // Check if procedure name matches search term
                if (procName && !foundDPs.has(procName)) {
                    if (procName === upperTerm || procName.startsWith(upperTerm)) {
                        prefixMatches.push({
                            code: procName,
                            name: procName,
                            type: 'DP',
                            waypointType: WAYPOINT_TYPE_PROCEDURE,
                            location: 'Departure Procedure',
                            contextHint: 'Click to see transitions'
                        });
                        foundDPs.add(procName);
                    } else if (procName.includes(upperTerm)) {
                        substringMatches.push({
                            code: procName,
                            name: procName,
                            type: 'DP',
                            waypointType: WAYPOINT_TYPE_PROCEDURE,
                            location: 'Departure Procedure',
                            contextHint: 'Click to see transitions'
                        });
                        foundDPs.add(procName);
                    }
                }
            }

            // Search STARs - use Set to track unique procedure names
            const foundSTARs = new Set();
            for (const [key, data] of starsData) {
                // Match patterns like: WYNDE3, KORD_WYNDE3_FNT, CHPPR.CHPPR1, CHPPR1.CHPPR
                const upperKey = key.toUpperCase();
                let procName = null;

                // Extract procedure name from different key formats
                if (upperKey.includes('_')) {
                    // CIFP format: KORD_WYNDE3_FNT -> WYNDE3 is at position 1
                    const parts = upperKey.split('_');
                    if (parts.length >= 2) {
                        procName = parts[1];
                    }
                } else if (upperKey.includes('.')) {
                    // Legacy NASR format: CHPPR.CHPPR1 or CHPPR1.CHPPR
                    const parts = upperKey.split('.');
                    // Use the part that has digits (the procedure name)
                    procName = parts.find(p => /\d/.test(p)) || parts[0];
                } else {
                    // Simple key: just the procedure name
                    procName = upperKey;
                }

                // Check if procedure name matches search term
                if (procName && !foundSTARs.has(procName)) {
                    if (procName === upperTerm || procName.startsWith(upperTerm)) {
                        prefixMatches.push({
                            code: procName,
                            name: procName,
                            type: 'STAR',
                            waypointType: WAYPOINT_TYPE_PROCEDURE,
                            location: 'Arrival Procedure',
                            contextHint: 'Click to see transitions'
                        });
                        foundSTARs.add(procName);
                    } else if (procName.includes(upperTerm)) {
                        substringMatches.push({
                            code: procName,
                            name: procName,
                            type: 'STAR',
                            waypointType: WAYPOINT_TYPE_PROCEDURE,
                            location: 'Arrival Procedure',
                            contextHint: 'Click to see transitions'
                        });
                        foundSTARs.add(procName);
                    }
                }
            }
        }
    }

    // Standard search with improved ranking
    // Search airports
    if (qe_airportsData) {
        for (const [code, airport] of qe_airportsData) {
            const upperCode = code.toUpperCase();
            const upperName = (airport.name || '').toUpperCase();
            const iata = (airport.iata || '').toUpperCase();

            const result = {
                code: code,
                name: airport.name || code,
                type: TOKEN_TYPE_AIRPORT,
                waypointType: WAYPOINT_TYPE_AIRPORT,
                lat: airport.lat,
                lon: airport.lon,
                location: `${airport.municipality || ''}, ${airport.country || ''}`.trim()
            };

            if (upperCode === upperTerm || iata === upperTerm) {
                exactMatches.push(result);
            } else if (upperCode.startsWith(upperTerm) || iata.startsWith(upperTerm)) {
                prefixMatches.push(result);
            } else if (upperCode.includes(upperTerm) || iata.includes(upperTerm)) {
                substringMatches.push(result);
            } else if (upperName.includes(upperTerm)) {
                descriptionMatches.push(result);
            }
        }
    }

    // Search navaids
    if (qe_navaidsData) {
        for (const [ident, navaid] of qe_navaidsData) {
            const upperIdent = ident.toUpperCase();
            const upperName = (navaid.name || '').toUpperCase();

            const result = {
                code: ident,
                name: navaid.name || ident,
                type: navaid.type || TOKEN_TYPE_NAVAID,
                waypointType: WAYPOINT_TYPE_NAVAID,
                lat: navaid.lat,
                lon: navaid.lon,
                location: navaid.country || ''
            };

            if (upperIdent === upperTerm) {
                exactMatches.push(result);
            } else if (upperIdent.startsWith(upperTerm)) {
                prefixMatches.push(result);
            } else if (upperIdent.includes(upperTerm)) {
                substringMatches.push(result);
            } else if (upperName.includes(upperTerm)) {
                descriptionMatches.push(result);
            }
        }
    }

    // Search fixes
    if (qe_fixesData) {
        for (const [name, fix] of qe_fixesData) {
            const upperName = name.toUpperCase();

            const result = {
                code: name,
                name: name,
                type: TOKEN_TYPE_FIX,
                waypointType: WAYPOINT_TYPE_FIX,
                lat: fix.lat,
                lon: fix.lon,
                location: `${fix.state || ''} ${fix.country || ''}`.trim()
            };

            if (upperName === upperTerm) {
                exactMatches.push(result);
            } else if (upperName.startsWith(upperTerm)) {
                prefixMatches.push(result);
            } else if (upperName.includes(upperTerm)) {
                substringMatches.push(result);
            }
        }
    }

    // Sort each group alphabetically by code
    exactMatches.sort((a, b) => a.code.localeCompare(b.code));
    prefixMatches.sort((a, b) => a.code.localeCompare(b.code));
    substringMatches.sort((a, b) => a.code.localeCompare(b.code));
    descriptionMatches.sort((a, b) => a.code.localeCompare(b.code));

    // Combine results with priority: exact > prefix > substring > description
    return [
        ...exactMatches,
        ...prefixMatches,
        ...substringMatches,
        ...descriptionMatches
    ].slice(0, limit);
}

/**
 * Get token type for route parsing (used for validation and resolution)
 * @param {string} token - Route token (airport code, navaid ident, fix name, etc.)
 * @returns {string|null} Token type ('airport', 'navaid', 'fix', 'airway', etc.) or null
 */
function getTokenType(token) {
    if (!qe_tokenTypeMap) {
        console.warn('[QueryEngine] getTokenType called but qe_tokenTypeMap is null');
        return null;
    }
    const upperToken = token.toUpperCase();
    const result = qe_tokenTypeMap.get(upperToken);
    if (!result) {
        console.debug(`[QueryEngine] Token not found: ${upperToken} (map has ${qe_tokenTypeMap.size} entries)`);
    } else {
        console.debug(`[QueryEngine] Token found: ${upperToken} = ${result}`);
    }
    return result || null;
}

/**
 * Get available transitions for a procedure
 * @param {string} procedureName - Procedure name (e.g., HIDEY1, CHPPR1)
 * @returns {Array} Array of transition objects {transition, type}
 */
function getProcedureTransitions(procedureName) {
    if (!window.DataManager) return [];

    const upperProc = procedureName.toUpperCase();
    const transitions = [];

    // Get DPs and STARs data
    const dpsData = window.DataManager.getDpsData?.() || new Map();
    const starsData = window.DataManager.getStarsData?.() || new Map();

    // Try to find procedure in DPs by name
    const dpProc = dpsData.get(upperProc);
    if (dpProc && dpProc.transitions && Array.isArray(dpProc.transitions)) {
        for (const trans of dpProc.transitions) {
            transitions.push({
                transition: trans.name,
                type: 'DP',
                entryFix: trans.entryFix,
                display: `${trans.name}.${upperProc}`  // FAA chart standard: TRANSITION.PROCEDURE
            });
        }
    }

    // Try to find procedure in STARs by name
    const starProc = starsData.get(upperProc);
    if (starProc && starProc.transitions && Array.isArray(starProc.transitions)) {
        for (const trans of starProc.transitions) {
            transitions.push({
                transition: trans.name,
                type: 'STAR',
                entryFix: trans.entryFix,
                display: `${trans.name}.${upperProc}`  // FAA chart standard: TRANSITION.PROCEDURE
            });
        }
    }

    return transitions;
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
    if (qe_airportsData) {
        for (const [code, airport] of qe_airportsData) {
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
    if (qe_navaidsData) {
        for (const [ident, navaid] of qe_navaidsData) {
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
    if (qe_airportsData) {
        for (const [code, airport] of qe_airportsData) {
            if (airport.lat >= bounds.minLat && airport.lat <= bounds.maxLat &&
                airport.lon >= bounds.minLon && airport.lon <= bounds.maxLon &&
                isToweredAirport(code)) {
                result.airports.push({ code, ...airport });
            }
        }
    }

    // Get navaids within bounds
    if (qe_navaidsData) {
        for (const [ident, navaid] of qe_navaidsData) {
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
    if (!qe_airportsData || !window.RouteCalculator) return null;

    const calculateDistance = window.RouteCalculator.calculateDistance;
    let nearest = null;
    let minDistance = Infinity;

    for (const [code, airport] of qe_airportsData) {
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
    if (qe_airportsData) {
        for (const [code, airport] of qe_airportsData) {
            const distance = calculateDistance(lat, lon, airport.lat, airport.lon);
            if (distance <= radiusNM) {
                result.airports.push({ code, ...airport, distance });
            }
        }
    }

    // Search navaids
    if (qe_navaidsData) {
        for (const [ident, navaid] of qe_navaidsData) {
            const distance = calculateDistance(lat, lon, navaid.lat, navaid.lon);
            if (distance <= radiusNM) {
                result.navaids.push({ ident, ...navaid, distance });
            }
        }
    }

    // Search fixes
    if (qe_fixesData) {
        for (const [name, fix] of qe_fixesData) {
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
    searchAirports,
    getTokenType,
    getProcedureTransitions,

    // Spatial queries
    getPointsNearRoute,
    getPointsInBounds,
    findNearestAirport,
    findWaypointsWithinRadius
};

})(); // End IIFE
