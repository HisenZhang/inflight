// Route Resolver - Semantic analysis for aviation routes
// Resolves token types via database lookups and validates

/**
 * Resolve parse tree with database lookups
 * @param {Array} parseTree - Parse tree from parser
 * @param {Object} context - Context information (departure, destination)
 * @returns {Object} Resolved tree with errors
 */
function resolve(parseTree, context = {}) {
    const errors = [];

    const resolvedTree = parseTree.map((node, index) => {
        try {
            return resolveNode(node, index, parseTree, context, errors);
        } catch (err) {
            errors.push({
                token: node.token?.text || 'unknown',
                index: index,
                error: err.message
            });
            return node;
        }
    });

    return {
        tree: resolvedTree,
        errors: errors.length > 0 ? errors : null
    };
}

/**
 * Resolve individual node
 */
function resolveNode(node, index, parseTree, context, errors) {
    switch (node.type) {
        case 'WAYPOINT':
            return resolveWaypoint(node, index, errors);

        case 'PROCEDURE_OR_WAYPOINT':
            return resolveProcedureOrWaypoint(node, index, parseTree, context, errors);

        case 'PROCEDURE':
            return resolveProcedure(node, index, parseTree, context, errors);

        case 'AIRWAY_SEGMENT':
            return resolveAirwaySegment(node, errors);

        case 'COORDINATE':
            return resolveCoordinate(node, errors);

        case 'DIRECT':
            return node; // No resolution needed

        default:
            return node;
    }
}

// ============================================
// RESOLVERS
// ============================================

function resolveWaypoint(node, index, errors) {
    const token = node.token.text;

    // Use QueryEngine to get token type
    const tokenType = window.QueryEngine?.getTokenType(token);

    let data = null;
    let resolvedType = null;

    // Try to resolve based on token type
    if (tokenType === 'AIRPORT') {
        data = window.DataManager?.getAirport(token);
        if (data) resolvedType = 'AIRPORT';
    } else if (tokenType === 'NAVAID') {
        data = window.DataManager?.getNavaid(token);
        if (data) resolvedType = 'NAVAID';
    } else if (tokenType === 'FIX') {
        data = window.DataManager?.getFix(token);
        if (data) resolvedType = 'FIX';
    } else {
        // Token type unknown, try in order: airport, navaid, fix
        data = window.DataManager?.getAirport(token);
        if (data) {
            resolvedType = 'AIRPORT';
        } else {
            data = window.DataManager?.getNavaid(token);
            if (data) {
                resolvedType = 'NAVAID';
            } else {
                data = window.DataManager?.getFix(token);
                if (data) resolvedType = 'FIX';
            }
        }
    }

    if (!data) {
        errors.push({
            token: token,
            index: index,
            error: `Waypoint not found: ${token}`
        });
    }

    return {
        ...node,
        resolvedType: resolvedType,
        data: data,
        coordinates: data ? { lat: data.lat, lon: data.lon } : null
    };
}

function resolveProcedureOrWaypoint(node, index, parseTree, context, errors) {
    const token = node.token.text;

    // Check if this token is marked as a procedure in the database
    const tokenType = window.QueryEngine?.getTokenType(token);

    if (tokenType === 'PROCEDURE') {
        // It's a procedure - resolve as procedure
        return resolveProcedure({
            ...node,
            type: 'PROCEDURE',
            procedure: token
        }, index, parseTree, context, errors);
    }

    // Not a procedure - resolve as waypoint
    return resolveWaypoint({
        ...node,
        type: 'WAYPOINT',
        expand: false
    }, index, errors);
}

function resolveProcedure(node, index, parseTree, context, errors) {
    const procedureName = node.procedure;
    const isNearStart = index <= 2;
    const isNearEnd = index >= parseTree.length - 3;

    let procedureData = null;
    let procedureType = null;

    // Get departure and destination from context
    const departureAirport = context.departure || (parseTree.length > 0 ? parseTree[0].token?.text : null);
    const destinationAirport = context.destination || (parseTree.length > 0 ? parseTree[parseTree.length - 1].token?.text : null);

    // Try to find procedure - search patterns based on your existing code
    const patterns = [
        procedureName,                           // WYNDE3, HIDEY1 (exact match)
        `${node.procedureName}.${procedureName}`, // WYNDE.WYNDE3
        `${procedureName}.${node.procedureName}`  // WYNDE3.WYNDE
    ];

    // Add airport-prefixed patterns if we have context
    const contextAirport = isNearStart ? departureAirport : destinationAirport;
    if (contextAirport) {
        patterns.push(
            `${contextAirport}.${procedureName}`,
            `${contextAirport}.${node.procedureName}.${procedureName}`,
            `${contextAirport}.${procedureName}.${node.procedureName}`
        );
    }

    // Try DP first if near start, STAR if near end
    if (isNearStart) {
        for (const pattern of patterns) {
            procedureData = window.RouteExpander?.getDp(pattern);
            if (procedureData) {
                procedureType = 'DP';
                break;
            }
        }
    }

    if (!procedureData && isNearEnd) {
        for (const pattern of patterns) {
            procedureData = window.RouteExpander?.getStar(pattern);
            if (procedureData) {
                procedureType = 'STAR';
                break;
            }
        }
    }

    // Try opposite type if not found
    if (!procedureData && isNearEnd) {
        for (const pattern of patterns) {
            procedureData = window.RouteExpander?.getDp(pattern);
            if (procedureData) {
                procedureType = 'DP';
                break;
            }
        }
    }

    if (!procedureData && isNearStart) {
        for (const pattern of patterns) {
            procedureData = window.RouteExpander?.getStar(pattern);
            if (procedureData) {
                procedureType = 'STAR';
                break;
            }
        }
    }

    if (!procedureData) {
        errors.push({
            token: procedureName,
            index: index,
            error: `Procedure not found: ${procedureName}`
        });
        return {
            ...node,
            resolvedType: null,
            data: null
        };
    }

    // Validate transition if explicit
    if (node.explicit && procedureData) {
        const transition = procedureData.transitions?.find(
            t => t.name === node.transition
        );

        if (!transition) {
            errors.push({
                token: `${node.transition}.${procedureName}`,
                index: index,
                error: `Transition ${node.transition} not found for ${procedureName}`
            });
        }
    }

    return {
        ...node,
        type: 'PROCEDURE',
        resolvedType: procedureType,
        data: procedureData,
        procedure: procedureName
    };
}

function resolveAirwaySegment(node, errors) {
    const airwayData = window.RouteExpander?.getAirway(node.airway.text);

    if (!airwayData) {
        errors.push({
            token: node.airway.text,
            error: `Airway not found: ${node.airway.text}`
        });
        return {
            ...node,
            data: null
        };
    }

    // Validate that from/to waypoints exist on airway
    if (airwayData && airwayData.fixes) {
        const fromIndex = airwayData.fixes.indexOf(node.from.text);
        const toIndex = airwayData.fixes.indexOf(node.to.text);

        if (fromIndex === -1) {
            errors.push({
                token: node.from.text,
                error: `${node.from.text} not found on ${node.airway.text}`
            });
        }

        if (toIndex === -1) {
            errors.push({
                token: node.to.text,
                error: `${node.to.text} not found on ${node.airway.text}`
            });
        }
    }

    return {
        ...node,
        data: airwayData
    };
}

function resolveCoordinate(node, errors) {
    // Parse coordinate string
    const match = node.token.text.match(
        /^(\d{4,6})([NS])?\/(\d{5,7})([EW])?$/
    );

    if (!match) {
        errors.push({
            token: node.token.text,
            error: `Invalid coordinate format: ${node.token.text}`
        });
        return node;
    }

    const [, latStr, latHemi, lonStr, lonHemi] = match;

    // Parse latitude (DDMM or DDMMSS)
    let lat;
    if (latStr.length === 4) {
        // DDMM format
        const deg = parseInt(latStr.substring(0, 2));
        const min = parseInt(latStr.substring(2, 4));
        lat = deg + min / 60;
    } else {
        // DDMMSS format
        const deg = parseInt(latStr.substring(0, 2));
        const min = parseInt(latStr.substring(2, 4));
        const sec = parseInt(latStr.substring(4, 6));
        lat = deg + min / 60 + sec / 3600;
    }

    // Parse longitude (DDDMM or DDDMMSS)
    let lon;
    if (lonStr.length === 5) {
        // DDDMM format
        const deg = parseInt(lonStr.substring(0, 3));
        const min = parseInt(lonStr.substring(3, 5));
        lon = deg + min / 60;
    } else {
        // DDDMMSS format
        const deg = parseInt(lonStr.substring(0, 3));
        const min = parseInt(lonStr.substring(3, 5));
        const sec = parseInt(lonStr.substring(5, 7));
        lon = deg + min / 60 + sec / 3600;
    }

    // Apply hemisphere (default North/West for US)
    if (latHemi === 'S') lat = -lat;
    if (lonHemi === 'W') lon = -lon;
    // If no hemisphere specified, assume positive (Northern hemisphere, Eastern longitude)
    // Note: For US routes, you might want to default to N/W

    return {
        ...node,
        coordinates: { lat, lon },
        parsed: {
            latStr,
            latHemi,
            lonStr,
            lonHemi
        }
    };
}

// ============================================
// EXPORTS
// ============================================

window.RouteResolver = {
    resolve
};
