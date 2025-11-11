// Route Parser - Syntactic analysis for aviation routes
// Identifies patterns and builds parse tree

// ============================================
// TOKEN PATTERNS (Regex-based Recognition)
// ============================================

const TokenPatterns = {
    // Chart standard: TRANSITION.PROCEDURE (e.g., MTHEW.CHPPR1)
    PROCEDURE_WITH_TRANSITION: /^([A-Z]{3,})\.([A-Z]{3,}\d*)$/,

    // Base procedure: HIDEY1, WYNDE3, CHPPR (auto-select transition)
    PROCEDURE_BASE: /^([A-Z]{3,})(\d*)$/,

    // Airways: J146, V123, Q822
    AIRWAY: /^[JVQTABGR]\d+$/,

    // Coordinates: 4814/06848, 4814N/06848W
    COORDINATE: /^(\d{4,6})([NS])?\/(\d{5,7})([EW])?$/,

    // ICAO airport: KORD, KLGA (4 letters)
    ICAO_AIRPORT: /^[A-Z]{4}$/,

    // Direct keyword
    DIRECT_KEYWORD: /^DCT$/
};

// ============================================
// PARSER CLASS
// ============================================

class RouteParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.cursor = 0;
        this.parseTree = [];
        this.errors = [];
    }

    parse() {
        while (this.cursor < this.tokens.length) {
            const node = this.parseToken();
            if (node) {
                this.parseTree.push(node);

                // Special case: after parsing airway segment, we're positioned at the 'to' waypoint
                // Only parse it if it starts a new airway segment (chained airways)
                // Otherwise skip it to avoid duplication
                if (node.type === 'AIRWAY_SEGMENT') {
                    const next1 = this.peek(1);
                    const next2 = this.peek(2);
                    const isNextAirway = next1 && next2 &&
                        (this.match(TokenPatterns.AIRWAY, 1) ||
                         (window.QueryEngine?.getTokenType(next1.text) === 'AIRWAY'));

                    // If next pattern is NOT an airway, skip the 'to' waypoint
                    if (!isNextAirway) {
                        this.cursor++; // Move past the 'to' waypoint
                    }
                }
            }
        }

        return {
            tree: this.parseTree,
            errors: this.errors.length > 0 ? this.errors : null
        };
    }

    parseToken() {
        const current = this.peek(0);
        const next1 = this.peek(1);
        const next2 = this.peek(2);

        if (!current) return null;

        // PATTERN 1: DCT keyword (skip, handled by route calculator)
        if (this.match(TokenPatterns.DIRECT_KEYWORD)) {
            this.cursor++;
            return {
                type: 'DIRECT',
                token: current,
                expand: false
            };
        }

        // PATTERN 2: AIRWAY SEGMENT (3-token lookahead)
        // Structure: WAYPOINT AIRWAY WAYPOINT
        // Check both regex pattern AND QueryEngine token type (if available)
        const isAirwayPattern = this.match(TokenPatterns.AIRWAY, 1);
        const isAirwayType = next1 && window.QueryEngine?.getTokenType(next1.text) === 'AIRWAY';

        if (next1 && next2 && (isAirwayPattern || isAirwayType)) {
            return this.parseAirwaySegment();
        }

        // PATTERN 3: PROCEDURE WITH EXPLICIT TRANSITION
        // Structure: TRANSITION.PROCEDURE (chart standard)
        if (this.match(TokenPatterns.PROCEDURE_WITH_TRANSITION)) {
            return this.parseProcedureWithTransition();
        }

        // PATTERN 4: PROCEDURE BASE (auto-select transition)
        // Structure: PROCEDURE
        // Note: This pattern is ambiguous (could be waypoint)
        // Marked as potential procedure, resolver will confirm
        if (this.match(TokenPatterns.PROCEDURE_BASE)) {
            return this.parseProcedureBase();
        }

        // PATTERN 5: COORDINATE
        if (this.match(TokenPatterns.COORDINATE)) {
            return this.parseCoordinate();
        }

        // PATTERN 6: WAYPOINT (airport, fix, navaid)
        // Default case - resolver will determine exact type
        return this.parseWaypoint();
    }

    // ==========================================
    // PATTERN PARSERS
    // ==========================================

    parseAirwaySegment() {
        const from = this.tokens[this.cursor];
        const airway = this.tokens[this.cursor + 1];
        const to = this.tokens[this.cursor + 2];

        // Advance to 'to' waypoint position (not past it)
        // For chained airways like "PAYGE Q822 GONZZ Q822 FNT",
        // after parsing PAYGE-Q822-GONZZ, cursor is at GONZZ
        // Next iteration will match GONZZ-Q822-FNT pattern
        this.cursor += 2;

        return {
            type: 'AIRWAY_SEGMENT',
            from: from,
            airway: airway,
            to: to,
            expand: true
        };
    }

    parseProcedureWithTransition() {
        const token = this.tokens[this.cursor];
        const match = token.text.match(TokenPatterns.PROCEDURE_WITH_TRANSITION);

        this.cursor++;

        return {
            type: 'PROCEDURE',
            token: token,
            transition: match[1],    // MTHEW
            procedure: match[2],     // CHPPR1
            explicit: true,          // User explicitly specified transition
            expand: true
        };
    }

    parseProcedureBase() {
        const token = this.tokens[this.cursor];
        const match = token.text.match(TokenPatterns.PROCEDURE_BASE);

        this.cursor++;

        // Mark as potential procedure
        // Resolver will confirm if it's actually a procedure or just a waypoint
        return {
            type: 'PROCEDURE_OR_WAYPOINT',
            token: token,
            procedureName: match[1],     // CHPPR
            procedureNumber: match[2],   // 1 (or empty string)
            transition: null,            // Auto-select based on proximity
            explicit: false,
            expand: true  // Will be set to false if resolved as waypoint
        };
    }

    parseCoordinate() {
        const token = this.tokens[this.cursor];
        this.cursor++;

        return {
            type: 'COORDINATE',
            token: token,
            expand: false
        };
    }

    parseWaypoint() {
        const token = this.tokens[this.cursor];
        this.cursor++;

        return {
            type: 'WAYPOINT',
            token: token,
            expand: false
        };
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    peek(offset) {
        const index = this.cursor + offset;
        return index < this.tokens.length ? this.tokens[index] : null;
    }

    match(pattern, offset = 0) {
        const token = this.peek(offset);
        return token && pattern.test(token.text);
    }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Parse tokens into structured parse tree
 * @param {Array} tokens - Array of token objects from lexer
 * @returns {Object} Parse result with tree and errors
 */
function parse(tokens) {
    const parser = new RouteParser(tokens);
    return parser.parse();
}

// ============================================
// EXPORTS
// ============================================

window.RouteParser = {
    parse,
    TokenPatterns
};
