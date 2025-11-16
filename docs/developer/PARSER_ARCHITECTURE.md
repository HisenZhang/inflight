# Route Parser Architecture

## Overview

The InFlight route parser uses a **4-stage pipeline** architecture that separates lexical analysis, syntactic analysis, semantic analysis, and expansion into distinct, testable modules.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER INPUT                            │
│         "KORD DROPA.JCOBY4 PAYGE Q822 GONZZ"            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│               1. LEXER (route-lexer.js)                  │
│  - Tokenization                                          │
│  - Case normalization (UPPERCASE)                        │
│  - Whitespace filtering                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
          [KORD, DROPA.JCOBY4, PAYGE, Q822, GONZZ]
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              2. PARSER (route-parser.js)                 │
│  - Pattern recognition (lookahead)                       │
│  - Structure identification                              │
│  - Parse tree construction                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
          Parse Tree (typed nodes)
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            3. RESOLVER (route-resolver.js)               │
│  - Database lookups                                      │
│  - Type resolution                                       │
│  - Semantic validation                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
      Annotated Parse Tree (with coordinates)
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            4. EXPANDER (route-expander.js)               │
│  - Airway expansion                                      │
│  - Procedure expansion                                   │
│  - Waypoint deduplication                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        Expanded Waypoint Sequence
```

## Module Descriptions

### 1. Lexer (`compute/route-lexer.js`)

**Responsibility:** Convert raw input string into structured tokens.

**Functions:**
- `tokenize(input)` - Main tokenization function
- `peek(tokens, index)` - Helper to access tokens safely
- `matches(token, pattern)` - Helper to test token against regex

**Algorithm:**
```javascript
1. Trim whitespace from input
2. Convert to UPPERCASE
3. Split on whitespace (/\s+/)
4. Filter empty strings
5. Create token objects with metadata
```

**Token Structure:**
```javascript
{
    text: "PAYGE",      // Normalized text (uppercase)
    index: 2,           // Position in token array
    type: null,         // Filled by parser
    raw: "Payge"        // Original input (preserves case)
}
```

**Example:**
```javascript
Input:  "kord Payge q822 gonzz"
Output: [
    { text: "KORD", index: 0, type: null, raw: "kord" },
    { text: "PAYGE", index: 1, type: null, raw: "Payge" },
    { text: "Q822", index: 2, type: null, raw: "q822" },
    { text: "GONZZ", index: 3, type: null, raw: "gonzz" }
]
```

### 2. Parser (`compute/route-parser.js`)

**Responsibility:** Identify patterns and build parse tree using lookahead.

**Key Features:**
- **3-token lookahead** for airway segments
- **Pattern-based matching** using regex
- **Token type integration** with QueryEngine
- **Cursor management** for chained patterns

**Pattern Recognition Order:**
1. DCT keyword
2. Airway segment (3-token pattern: `WAYPOINT AIRWAY WAYPOINT`)
3. Procedure with explicit transition (`TRANSITION.PROCEDURE`)
4. Procedure base (auto-transition) (`PROCEDURE`)
5. Coordinate (`LAT/LON`)
6. Waypoint (default)

**Token Patterns:**
```javascript
const TokenPatterns = {
    PROCEDURE_WITH_TRANSITION: /^([A-Z]{3,})\.([A-Z]{3,}\d*)$/,
    PROCEDURE_BASE: /^([A-Z]{3,})(\d*)$/,
    AIRWAY: /^[JVQTABGR]\d+$/,
    COORDINATE: /^(\d{4,6})([NS])?\/(\d{5,7})([EW])?$/,
    ICAO_AIRPORT: /^[A-Z]{4}$/,
    DIRECT_KEYWORD: /^DCT$/
};
```

**Airway Detection:**

The parser uses **dual detection** for airways:
```javascript
// 1. Regex pattern (always available)
const isAirwayPattern = this.match(TokenPatterns.AIRWAY, 1);

// 2. QueryEngine token type (production only)
const isAirwayType = window.QueryEngine?.getTokenType(next1.text) === 'AIRWAY';

// Use either method
if (isAirwayPattern || isAirwayType) {
    return this.parseAirwaySegment();
}
```

This allows:
- **Production:** Uses database-backed token type map (accurate)
- **Testing:** Falls back to regex patterns (no database required)

**Cursor Advancement:**

Special handling for airway segments to support chaining:

```javascript
parseAirwaySegment() {
    const from = this.tokens[this.cursor];      // PAYGE
    const airway = this.tokens[this.cursor + 1]; // Q822
    const to = this.tokens[this.cursor + 2];    // GONZZ

    // Advance to 'to' waypoint (not past it)
    this.cursor += 2;  // Now at GONZZ

    // Main loop checks if next pattern is another airway
    // If yes: GONZZ Q822 FNT → chained
    // If no: skip GONZZ to avoid duplication
}
```

**Parse Tree Structure:**
```javascript
[
    {
        type: 'WAYPOINT',
        token: { text: 'KORD', ... },
        expand: false
    },
    {
        type: 'AIRWAY_SEGMENT',
        from: { text: 'PAYGE', ... },
        airway: { text: 'Q822', ... },
        to: { text: 'GONZZ', ... },
        expand: true
    },
    {
        type: 'PROCEDURE',
        token: { text: 'MTHEW.CHPPR1', ... },
        transition: 'MTHEW',
        procedure: 'CHPPR1',
        explicit: true,
        expand: true
    }
]
```

### 3. Resolver (`compute/route-resolver.js`)

**Responsibility:** Resolve token types via database lookups and validate semantics.

**Functions:**
- `resolve(parseTree, context)` - Main resolution function
- `resolveNode(node, ...)` - Resolve individual node
- `resolveWaypoint(node, ...)` - Waypoint lookup
- `resolveProcedure(node, ...)` - Procedure lookup with context
- `resolveAirwaySegment(node, ...)` - Airway validation
- `resolveCoordinate(node, ...)` - Coordinate parsing

**Context Information:**
```javascript
context = {
    departure: 'KORD',      // First token (usually)
    destination: 'KLGA'     // Last token (usually)
}
```

**Waypoint Resolution Priority:**
```javascript
1. Check QueryEngine.getTokenType(token)
2. If AIRPORT → lookup in airports database
3. If NAVAID → lookup in navaids database
4. If FIX → lookup in fixes database
5. If unknown → try all three in order
```

**Procedure Resolution:**

Uses **context-aware lookup** to determine procedure type:

```javascript
const isNearStart = index <= 2;  // Likely DP
const isNearEnd = index >= parseTree.length - 3;  // Likely STAR

// Try multiple pattern variations
const patterns = [
    'WYNDE3',                    // Exact match
    'WYNDE.WYNDE3',              // Name.Full
    'WYNDE3.WYNDE',              // Full.Name
    'KSDF.WYNDE3',               // Airport.Full (if context available)
    'KSDF.WYNDE.WYNDE3'          // Airport.Name.Full
];
```

**Transition Validation:**

For explicit transitions (`MTHEW.CHPPR1`):
```javascript
// Verify transition exists in procedure data
const transition = procedureData.transitions?.find(
    t => t.name === 'MTHEW'
);

if (!transition) {
    errors.push(`Transition MTHEW not found for CHPPR1`);
}
```

**Coordinate Parsing:**

Converts coordinate strings to decimal degrees:

```javascript
Input:  "4814N/06848W"
Parse:  lat=48°14' N, lon=068°48' W
Output: { lat: 48.233, lon: -68.8 }
```

### 4. Expander (`compute/route-expander.js`)

**Responsibility:** Expand airways and procedures into waypoint sequences.

**This is the existing module** - now receives a structured parse tree instead of raw strings.

**Bridge Function:**

`route-engine.js` contains `expandFromTree()` which converts the parse tree into calls to the existing expander:

```javascript
for (node of resolvedTree) {
    switch (node.type) {
        case 'AIRWAY_SEGMENT':
            // Call existing expandAirway()
            segment = RouteExpander.expandAirway(
                node.from.text,
                node.airway.text,
                node.to.text
            );
            expanded.push(...segment.fixes);
            break;

        case 'PROCEDURE':
            // Call existing expandProcedure()
            procedure = RouteExpander.expandProcedure(
                node.explicit ? `${node.transition}.${node.procedure}` : node.procedure,
                previousFix,
                contextAirport,
                nextFix
            );
            expanded.push(...procedure.fixes);
            break;

        case 'WAYPOINT':
            expanded.push(node.token.text);
            break;
    }
}
```

**Waypoint Deduplication:**

Connection points are automatically deduplicated:

```javascript
// Airway segment returns: [PAYGE, INTER1, INTER2, GONZZ]
const lastFix = expanded[expanded.length - 1];

if (lastFix === segment.fixes[0]) {
    // Don't duplicate PAYGE if it's already in the expanded list
    expanded.push(...segment.fixes.slice(1));
} else {
    expanded.push(...segment.fixes);
}
```

## Engine Orchestrator (`compute/route-engine.js`)

**Responsibility:** Coordinate all stages of the pipeline.

**Main Function:**
```javascript
function parseAndExpand(routeString) {
    // Stage 1: Tokenize
    const tokens = RouteLexer.tokenize(routeString);

    // Stage 2: Parse
    const { tree: parseTree, errors: parseErrors } = RouteParser.parse(tokens);

    // Stage 3: Resolve
    const context = {
        departure: tokens[0]?.text,
        destination: tokens[tokens.length - 1]?.text
    };
    const { tree: resolvedTree, errors: resolveErrors } = RouteResolver.resolve(parseTree, context);

    // Stage 4: Expand
    const { expanded, errors: expandErrors } = expandFromTree(resolvedTree);

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
```

## Error Handling

Errors are collected at each stage and returned together:

```javascript
{
    original: "KORD INVALID Q999 BADFIX",
    errors: [
        {
            token: "INVALID",
            index: 1,
            error: "Waypoint not found: INVALID"
        },
        {
            token: "Q999",
            error: "Airway not found: Q999"
        },
        {
            token: "BADFIX",
            error: "Waypoint not found: BADFIX"
        }
    ]
}
```

This provides **complete feedback** to the user about all issues.

## Testing Strategy

### Unit Tests

Each module is tested independently:

**Lexer tests:**
- Tokenization
- Case normalization
- Whitespace handling

**Parser tests:**
- Pattern recognition for each token type
- Airway segment detection
- Procedure notation (explicit and auto)
- Complex route parsing
- Chained airways

**Resolver tests:**
- Database lookups (mocked)
- Type resolution
- Context-aware procedure detection

**Integration tests:**
- Complete pipeline
- Error propagation
- Expansion accuracy

### Test Environment

Tests run in **JSDOM** (Node.js) without a full database:
- Lexer: No dependencies, pure logic
- Parser: Uses regex patterns (QueryEngine unavailable)
- Resolver: Mock DataManager and QueryEngine
- Expander: Mock procedures and airways data

### Current Status

**56/56 tests passing** (100%)
- 10 parser architecture tests
- 46 existing system tests

## Performance Characteristics

### Lexer
- **O(n)** - Single pass over input string
- **Fast:** Regex-based splitting

### Parser
- **O(n)** - Single pass with lookahead
- **Fast:** Pattern matching only
- **No backtracking**

### Resolver
- **O(n × m)** where m = database lookup time
- **Optimized:** Uses QueryEngine token type map
- **Cached:** Database lookups are cached by DataManager

### Expander
- **O(n × k)** where k = average airway/procedure size
- **Dependent on:** Database size and route complexity

## Integration with Existing System

The new parser integrates seamlessly:

1. **QueryEngine** - Provides token type map for accurate airway detection
2. **DataManager** - Provides waypoint/airway/procedure data
3. **RouteExpander** - Reused for airway/procedure expansion
4. **RouteCalculator** - Receives expanded waypoint sequence (unchanged)

## Future Enhancements

### Potential Improvements

1. **Enhanced autocomplete** - Use parser for context-aware suggestions
2. **Real-time validation** - Parse as user types
3. **Syntax highlighting** - Color-code tokens by type
4. **Smart insertion** - Auto-complete patterns like `__ AIRWAY __`
5. **Route templates** - Save common route patterns

### Parser Extensions

The architecture supports adding:
- **Speed/altitude restrictions** - `WAYPOINT/N0450F350`
- **Holds** - `HOLD WAYPOINT`
- **Altitude constraints** - `WAYPOINT/A090`
- **RNAV waypoints** - `WPT001/3045N/08030W`

## References

- [Route Syntax Reference](./ROUTE_SYNTAX.md)
- [EBNF Grammar](./ROUTE_GRAMMAR.md)
-  Source Code: `compute/` directory
-  Tests: `tests/test-route-parser.js`
