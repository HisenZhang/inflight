// Route Engine - Main orchestrator for route parsing and expansion
// Coordinates lexer, parser, resolver, and expander

/**
 * Parse and expand a complete route
 * @param {string} routeString - Raw route input
 * @returns {Object} Parsed and expanded route with errors
 */
function parseAndExpand(routeString) {
    // Stage 1: Tokenize
    const tokens = window.RouteLexer.tokenize(routeString);

    if (tokens.length === 0) {
        return {
            original: routeString,
            tokens: [],
            parseTree: [],
            resolvedTree: [],
            expanded: [],
            expandedString: '',
            errors: null
        };
    }

    // Stage 2: Parse (syntactic analysis)
    const parseResult = window.RouteParser.parse(tokens);
    const parseTree = parseResult.tree;
    const parseErrors = parseResult.errors || [];

    // Determine context for resolver
    const context = {
        departure: tokens.length > 0 ? tokens[0].text : null,
        destination: tokens.length > 1 ? tokens[tokens.length - 1].text : null
    };

    // Stage 3: Resolve (semantic analysis)
    const resolveResult = window.RouteResolver.resolve(parseTree, context);
    const resolvedTree = resolveResult.tree;
    const resolveErrors = resolveResult.errors || [];

    // Stage 4: Expand (use existing RouteExpander)
    // Convert resolved tree back to a format the expander understands
    const expandResult = expandFromTree(resolvedTree);
    const expanded = expandResult.expanded;
    const expandErrors = expandResult.errors || [];

    // Combine all errors
    const allErrors = [...parseErrors, ...resolveErrors, ...expandErrors];

    return {
        original: routeString,
        tokens: tokens,
        parseTree: parseTree,
        resolvedTree: resolvedTree,
        expanded: expanded,
        expandedString: expanded.join(' '),
        errors: allErrors.length > 0 ? allErrors : null
    };
}

/**
 * Expand resolved tree using existing RouteExpander logic
 * This bridges the new parser with the existing expander
 */
function expandFromTree(resolvedTree) {
    const expanded = [];
    const errors = [];

    for (let i = 0; i < resolvedTree.length; i++) {
        const node = resolvedTree[i];

        switch (node.type) {
            case 'AIRWAY_SEGMENT':
                // Use existing airway expansion
                const segment = window.RouteExpander.expandAirway(
                    node.from.text,
                    node.airway.text,
                    node.to.text
                );

                if (segment.expanded) {
                    // Check for duplicate connection points
                    const lastFix = expanded[expanded.length - 1];
                    if (lastFix === segment.fixes[0]) {
                        expanded.push(...segment.fixes.slice(1));
                    } else {
                        expanded.push(...segment.fixes);
                    }
                } else {
                    errors.push(segment.error || `Failed to expand airway segment`);
                    // Add the waypoints anyway
                    expanded.push(node.from.text, node.to.text);
                }
                break;

            case 'PROCEDURE':
                // Use existing procedure expansion
                const previousFix = expanded.length > 0 ? expanded[expanded.length - 1] : null;
                const nextFix = i + 1 < resolvedTree.length ? resolvedTree[i + 1].token?.text : null;

                // Determine context airport
                const contextAirport = node.resolvedType === 'DP' ?
                    (resolvedTree.length > 0 ? resolvedTree[0].token?.text : null) :
                    (resolvedTree.length > 0 ? resolvedTree[resolvedTree.length - 1].token?.text : null);

                let procedureResult;

                if (node.explicit) {
                    // Explicit transition: MTHEW.CHPPR1
                    const fullName = `${node.transition}.${node.procedure}`;
                    procedureResult = window.RouteExpander.expandProcedure(
                        fullName,
                        previousFix,
                        contextAirport,
                        nextFix
                    );
                } else {
                    // Auto-select transition: CHPPR1
                    procedureResult = window.RouteExpander.expandProcedure(
                        node.procedure,
                        previousFix,
                        contextAirport,
                        nextFix
                    );
                }

                if (procedureResult.expanded) {
                    // Check for duplicate connection points
                    const lastFix = expanded[expanded.length - 1];
                    if (lastFix === procedureResult.fixes[0]) {
                        expanded.push(...procedureResult.fixes.slice(1));
                    } else {
                        expanded.push(...procedureResult.fixes);
                    }
                } else {
                    errors.push(`Failed to expand procedure ${node.procedure}`);
                    // Add the procedure name anyway
                    expanded.push(node.token.text);
                }
                break;

            case 'WAYPOINT':
                // Simple waypoint - pass through
                expanded.push(node.token.text);
                break;

            case 'COORDINATE':
                // Coordinate - pass through
                expanded.push(node.token.text);
                break;

            case 'DIRECT':
                // DCT keyword - skip (route calculator handles it)
                break;

            default:
                // Unknown type - pass through
                if (node.token) {
                    expanded.push(node.token.text);
                }
                break;
        }
    }

    return {
        expanded: expanded,
        errors: errors.length > 0 ? errors : null
    };
}

/**
 * Quick validation of route string (no expansion)
 * @param {string} routeString - Raw route input
 * @returns {Object} Validation result with errors
 */
function validate(routeString) {
    const tokens = window.RouteLexer.tokenize(routeString);
    const parseResult = window.RouteParser.parse(tokens);

    const context = {
        departure: tokens.length > 0 ? tokens[0].text : null,
        destination: tokens.length > 1 ? tokens[tokens.length - 1].text : null
    };

    const resolveResult = window.RouteResolver.resolve(parseResult.tree, context);

    const allErrors = [
        ...(parseResult.errors || []),
        ...(resolveResult.errors || [])
    ];

    return {
        valid: allErrors.length === 0,
        errors: allErrors.length > 0 ? allErrors : null,
        tokens: tokens
    };
}

// ============================================
// EXPORTS
// ============================================

window.RouteEngine = {
    parseAndExpand,
    validate
};
