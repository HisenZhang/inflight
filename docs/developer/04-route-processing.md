# Route Processing

## Overview

InFlight processes IFR/VFR routes through a **4-stage pipeline**: Lexer → Parser → Resolver → Expander → Calculator. Each stage transforms the route from raw text to calculated navigation legs.

```
"KJFK RBV Q430 AIR CLPRR3 KCMH"
    ↓ Lexer
[KJFK, RBV, Q430, AIR, CLPRR3, KCMH]
    ↓ Parser
Parse Tree (typed nodes)
    ↓ Resolver
Annotated Tree (with coordinates)
    ↓ Expander
Waypoint Sequence
    ↓ Calculator
Navigation Legs (distance, bearing, time, fuel)
```

## Stage 1: Lexer (Tokenization)

**Module:** [compute/route-lexer.js](../../compute/route-lexer.js)

**Purpose:** Convert raw input string into normalized tokens.

### Implementation

```javascript
function tokenize(input) {
    const tokens = input
        .trim()
        .toUpperCase()
        .split(/\s+/)
        .filter(t => t.length > 0)
        .map((text, index) => ({
            text: text,
            index: index,
            type: null,
            raw: input.split(/\s+/)[index]  // Preserve original case
        }));
    return tokens;
}
```

### Token Structure

```javascript
{
    text: "PAYGE",      // Normalized (UPPERCASE)
    index: 2,           // Position in token array
    type: null,         // Filled by parser/resolver
    raw: "Payge"        // Original input (preserves case)
}
```

### Example

```javascript
Input:  "kjfk RBV q430 air"
Output: [
    { text: "KJFK", index: 0, type: null, raw: "kjfk" },
    { text: "RBV", index: 1, type: null, raw: "RBV" },
    { text: "Q430", index: 2, type: null, raw: "q430" },
    { text: "AIR", index: 3, type: null, raw: "air" }
]
```

## Stage 2: Parser (Pattern Recognition)

**Module:** [compute/route-parser.js](../../compute/route-parser.js)

**Purpose:** Identify patterns and build parse tree using lookahead.

### Pattern Recognition Order

The parser tries patterns in this order:

1. **DCT keyword** → Explicit direct
2. **Airway segment** → `WAYPOINT AIRWAY WAYPOINT` (3-token lookahead)
3. **Procedure with transition** → `TRANSITION.PROCEDURE`
4. **Procedure base** → `PROCEDURE` (auto-transition)
5. **Coordinate** → `LAT/LON`
6. **Waypoint** → Default (airport, navaid, fix)

### Token Patterns

**Regex Patterns:** [route-parser.js:10-17](../../compute/route-parser.js#L10-L17)

```javascript
const TokenPatterns = {
    PROCEDURE_WITH_TRANSITION: /^([A-Z]{3,})\.([A-Z]{3,}\d*)$/,  // MTHEW.CHPPR1
    PROCEDURE_BASE: /^([A-Z]{3,})(\d*)$/,                        // CHPPR1
    AIRWAY: /^[JVQTABGR]\d+$/,                                   // Q430, V25, J500
    COORDINATE: /^(\d{4,6})([NS])?\/(\d{5,7})([EW])?$/,         // 4048N/07400W
    ICAO_AIRPORT: /^[A-Z]{4}$/,                                  // KJFK
    DIRECT_KEYWORD: /^DCT$/                                      // DCT
};
```

### Airway Detection (Dual Method)

**Implementation:** [route-parser.js:89-96](../../compute/route-parser.js#L89-L96)

```javascript
// Method 1: Regex pattern (always works, including tests)
const isAirwayPattern = this.match(TokenPatterns.AIRWAY, 1);

// Method 2: Database lookup (production only, more accurate)
const isAirwayType = window.QueryEngine?.getTokenType(next1.text) === 'AIRWAY';

// Use either method
if (isAirwayPattern || isAirwayType) {
    return this.parseAirwaySegment();
}
```

**Why dual detection?**
- **Production:** Database token type map (includes non-standard airways)
- **Testing:** Regex fallback (no database required in tests)

### Airway Chaining

**Implementation:** [route-parser.js:135-159](../../compute/route-parser.js#L135-L159)

The parser supports chained airways: `PAYGE Q430 AIR Q430 FNT`

```javascript
parseAirwaySegment() {
    const from = this.tokens[this.cursor];      // PAYGE
    const airway = this.tokens[this.cursor + 1]; // Q430
    const to = this.tokens[this.cursor + 2];    // AIR

    // Advance to 'to' waypoint (not past it!)
    this.cursor += 2;  // Now at AIR

    // Main loop will check if next pattern is another airway
    // If yes: AIR Q430 FNT → chained
    // If no: skip AIR to avoid duplication
}
```

**Result:** `PAYGE Q430 AIR Q430 FNT` → Two airway segments sharing waypoint AIR

### Parse Tree Structure

```javascript
[
    {
        type: 'WAYPOINT',
        token: { text: 'KJFK', index: 0 },
        expand: false
    },
    {
        type: 'AIRWAY_SEGMENT',
        from: { text: 'RBV', index: 1 },
        airway: { text: 'Q430', index: 2 },
        to: { text: 'AIR', index: 3 },
        expand: true  // Needs expansion
    },
    {
        type: 'PROCEDURE',
        token: { text: 'CLPRR3', index: 4 },
        transition: null,      // Auto-transition
        procedure: 'CLPRR3',
        explicit: false,
        expand: true
    },
    {
        type: 'WAYPOINT',
        token: { text: 'KCMH', index: 5 },
        expand: false
    }
]
```

## Stage 3: Resolver (Semantic Analysis)

**Module:** [compute/route-resolver.js](../../compute/route-resolver.js)

**Purpose:** Resolve token types via database lookups and validate semantics.

### Resolution Process

```javascript
resolve(parseTree) {
    for (const node of parseTree) {
        if (node.type === 'WAYPOINT') {
            const coords = this.resolveWaypoint(node.token.text);
            node.coordinates = coords;
            node.resolved = (coords !== null);
        }
        else if (node.type === 'AIRWAY_SEGMENT') {
            const fromCoords = this.resolveWaypoint(node.from.text);
            const toCoords = this.resolveWaypoint(node.to.text);
            node.from.coordinates = fromCoords;
            node.to.coordinates = toCoords;
            node.resolved = (fromCoords !== null && toCoords !== null);
        }
        // ... procedures, coordinates
    }
    return parseTree;
}
```

### Waypoint Resolution

**Priority order:** Fix → Navaid → Airport

**Implementation:** [route-resolver.js:45-75](../../compute/route-resolver.js#L45-L75)

```javascript
resolveWaypoint(ident) {
    // 1. Check fixes first (most specific)
    const fix = DataManager.getFix(ident);
    if (fix) {
        return { lat: fix.lat, lon: fix.lon, type: 'FIX', source: fix };
    }

    // 2. Check navaids
    const navaid = DataManager.getNavaid(ident);
    if (navaid) {
        return { lat: navaid.lat, lon: navaid.lon, type: 'NAVAID', source: navaid };
    }

    // 3. Check airports
    const airport = DataManager.getAirport(ident);
    if (airport) {
        return { lat: airport.lat, lon: airport.lon, type: 'AIRPORT', source: airport };
    }

    // 4. Not found
    return null;
}
```

### Validation Errors

The resolver detects semantic errors:

```javascript
const errors = [];

// Unresolved waypoint
if (!node.resolved) {
    errors.push({
        type: 'UNRESOLVED_WAYPOINT',
        token: node.token.text,
        message: `Waypoint '${node.token.text}' not found in database`
    });
}

// Invalid airway connection
if (node.type === 'AIRWAY_SEGMENT') {
    const airway = DataManager.getAirway(node.airway.text);
    if (!airway) {
        errors.push({
            type: 'INVALID_AIRWAY',
            token: node.airway.text,
            message: `Airway '${node.airway.text}' not found`
        });
    }
}
```

## Stage 4: Expander (Airway/Procedure Expansion)

**Module:** [compute/route-expander.js](../../compute/route-expander.js)

**Purpose:** Expand airways and procedures into waypoint sequences.

### Airway Expansion

**Example:** `PAYGE Q430 AIR` expands to all intermediate fixes:

```javascript
Input:  PAYGE Q430 AIR
Airway: Q430 = [PAYGE, MOBLE, GLARE, LOFTT, AIR]
Output: [PAYGE, MOBLE, GLARE, LOFTT, AIR]
```

**Implementation:** [route-expander.js:156-234](../../compute/route-expander.js#L156-L234)

```javascript
expandAirway(fromFix, airwayId, toFix) {
    const airway = DataManager.getAirway(airwayId);
    if (!airway) return null;

    const fixes = airway.fixes;  // Full airway sequence
    const fromIndex = fixes.indexOf(fromFix);
    const toIndex = fixes.indexOf(toFix);

    if (fromIndex === -1 || toIndex === -1) {
        return null;  // Fixes not on airway
    }

    // Extract subsequence (inclusive)
    if (fromIndex < toIndex) {
        return fixes.slice(fromIndex, toIndex + 1);  // Forward
    } else {
        return fixes.slice(toIndex, fromIndex + 1).reverse();  // Backward
    }
}
```

**Bidirectional Support:**
- `PAYGE Q430 AIR` → Forward: [PAYGE, ..., AIR]
- `AIR Q430 PAYGE` → Reverse: [AIR, ..., PAYGE]

### Procedure Expansion

**STAR Example:** `CLPRR3` at KCMH

```javascript
Input:  CLPRR3 KCMH
STAR:   CLIPPER THREE arrival
Body:   [CLPRR, ARRAN, HOOPZ]
Output: [CLPRR, ARRAN, HOOPZ, KCMH]
```

**Implementation:** [route-expander.js:237-345](../../compute/route-expander.js#L237-L345)

```javascript
expandProcedure(procedureName, transitionName, destination) {
    const proc = DataManager.getProcedure(procedureName);
    if (!proc) return null;

    let fixes = [];

    // 1. Add transition fixes (if specified)
    if (transitionName && proc.transitions) {
        const transition = proc.transitions.find(t => t.name === transitionName);
        if (transition) {
            fixes = [...transition.fixes];
        }
    }

    // 2. Add body fixes
    if (proc.body && proc.body.fixes) {
        fixes = [...fixes, ...proc.body.fixes];
    }

    // 3. Add destination
    fixes.push(destination);

    return fixes;
}
```

### Deduplication

**Problem:** Expansion can create duplicate waypoints at boundaries:

```
Route:    PAYGE Q430 AIR Q430 FNT
Expand 1: [PAYGE, MOBLE, GLARE, AIR]
Expand 2: [AIR, LOFTT, DRAYY, FNT]
Result:   [PAYGE, MOBLE, GLARE, AIR, AIR, LOFTT, DRAYY, FNT]  ❌ Duplicate AIR
```

**Solution:** [route-expander.js:450-465](../../compute/route-expander.js#L450-L465)

```javascript
function deduplicateWaypoints(waypoints) {
    const result = [];
    for (let i = 0; i < waypoints.length; i++) {
        if (i === 0 || waypoints[i].ident !== waypoints[i - 1].ident) {
            result.push(waypoints[i]);
        }
    }
    return result;
}
```

## Stage 5: Calculator (Navigation Math)

**Module:** [compute/route-calculator.js](../../compute/route-calculator.js)

**Purpose:** Calculate distance, bearing, time, and fuel for each leg.

### Distance Calculation (Vincenty Formula)

InFlight uses the **Vincenty formula** for accurate great circle distance on WGS84 ellipsoid.

**Implementation:** [lib/geodesy.js:156-230](../../lib/geodesy.js#L156-L230)

```javascript
function vincentyDistance(lat1, lon1, lat2, lon2) {
    const a = 6378137.0;              // WGS84 semi-major axis (meters)
    const f = 1 / 298.257223563;      // WGS84 flattening
    const b = (1 - f) * a;            // Semi-minor axis

    // Convert to radians
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const λ1 = lon1 * Math.PI / 180;
    const λ2 = lon2 * Math.PI / 180;

    // Iterative solution (converges in ~3 iterations)
    // ... (50+ lines of spheroidal trigonometry)

    const distance = b * A * (σ - Δσ);  // meters
    return distance / 1852;              // Convert to nautical miles
}
```

**Accuracy:** ±0.5mm on WGS84 ellipsoid (sub-centimeter precision)

### Bearing Calculation

**Initial bearing:** [route-calculator.js:89-105](../../compute/route-calculator.js#L89-L105)

```javascript
function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    const bearing = (θ * 180 / Math.PI + 360) % 360;  // Normalize to 0-360

    return bearing;  // True bearing (not magnetic)
}
```

**Magnetic Variation:** [lib/geodesy.js:250-420](../../lib/geodesy.js#L250-L420)

InFlight uses **WMM2025** (World Magnetic Model) to convert true bearing to magnetic:

```javascript
const trueBearing = 045;
const magVar = calculateMagneticVariation(lat, lon, altitude, date);  // WMM2025
const magneticBearing = trueBearing - magVar;
```

### Wind Correction

**Implementation:** [route-calculator.js:180-245](../../compute/route-calculator.js#L180-L245)

```javascript
function calculateWindCorrection(trueCourse, trueAirspeed, windDirection, windSpeed) {
    // Convert to radians
    const tc = trueCourse * Math.PI / 180;
    const wd = windDirection * Math.PI / 180;

    // Wind triangle solution
    const wca = Math.asin((windSpeed / trueAirspeed) * Math.sin(wd - tc));  // Wind correction angle
    const groundSpeed = trueAirspeed * Math.cos(wca) - windSpeed * Math.cos(wd - tc);

    return {
        windCorrectionAngle: wca * 180 / Math.PI,
        groundSpeed: groundSpeed,
        heading: (trueCourse + wca * 180 / Math.PI + 360) % 360
    };
}
```

**Example:**
```
True Course:     090° (East)
True Airspeed:   120 knots
Wind:            270° at 20 knots (from West)
Result:
  Ground Speed:  140 knots (tailwind)
  WCA:           0° (direct tailwind)
  Heading:       090°
```

### Leg Calculation

**Implementation:** [route-calculator.js:310-405](../../compute/route-calculator.js#L310-L405)

```javascript
function calculateLeg(from, to, options) {
    const distance = vincentyDistance(from.lat, from.lon, to.lat, to.lon);
    const bearing = calculateBearing(from.lat, from.lon, to.lat, to.lon);

    // Apply wind correction if winds provided
    let groundSpeed = options.trueAirspeed;
    let heading = bearing;

    if (options.winds) {
        const wind = interpolateWind(from.lat, from.lon, options.altitude, options.winds);
        const correction = calculateWindCorrection(bearing, options.trueAirspeed, wind.direction, wind.speed);
        groundSpeed = correction.groundSpeed;
        heading = correction.heading;
    }

    // Calculate time
    const time = (distance / groundSpeed) * 60;  // minutes

    // Calculate fuel
    const fuelBurn = (time / 60) * options.fuelBurnRate;  // gallons

    return {
        from: from,
        to: to,
        distance: distance,          // nautical miles
        bearing: bearing,            // true bearing (degrees)
        heading: heading,            // magnetic heading with wind correction
        groundSpeed: groundSpeed,    // knots
        time: time,                  // minutes
        fuel: fuelBurn              // gallons (or user-specified unit)
    };
}
```

### Complete Route Calculation

**Orchestration:** [compute/route-engine.js:85-156](../../compute/route-engine.js#L85-L156)

```javascript
async function processRoute(departure, route, destination, options) {
    // 1. Tokenize
    const tokens = RouteLexer.tokenize(route);

    // 2. Parse
    const parseTree = RouteParser.parse(tokens);

    // 3. Resolve
    const resolvedTree = RouteResolver.resolve(parseTree);

    // 4. Expand
    const waypoints = RouteExpander.expand(resolvedTree, departure, destination);

    // 5. Calculate legs
    const legs = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const leg = RouteCalculator.calculateLeg(waypoints[i], waypoints[i + 1], options);
        legs.push(leg);
    }

    // 6. Calculate totals
    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
    const totalTime = legs.reduce((sum, leg) => sum + leg.time, 0);
    const totalFuel = legs.reduce((sum, leg) => sum + leg.fuel, 0);

    return {
        waypoints: waypoints,
        legs: legs,
        totalDistance: totalDistance,
        totalTime: totalTime,
        totalFuel: totalFuel
    };
}
```

## Route Grammar (EBNF)

### Top-Level Structure

```ebnf
<route> ::= <waypoint> { <route_segment> } <waypoint>
```

### Route Segments

```ebnf
<route_segment> ::= <airway_segment>
                  | <direct_segment>
                  | <procedure>
                  | <coordinate>

<airway_segment> ::= <waypoint> <airway> <waypoint>

<direct_segment> ::= "DCT" <waypoint>
                   | <waypoint>  (* DCT is implicit *)

<procedure> ::= <transition> "." <procedure_name>
              | <procedure_name>
```

### Terminal Symbols

```ebnf
<waypoint> ::= <airport> | <fix> | <navaid>

<airport> ::= [A-Z]{4}  (* ICAO: KJFK, KORD *)

<fix> ::= [A-Z0-9]{5}  (* PAYGE, MOBLE *)

<navaid> ::= [A-Z]{2,5}  (* DPA, RBV, AIR *)

<airway> ::= [JVQTABGR][0-9]+  (* Q430, V25, J500 *)

<procedure_name> ::= [A-Z]+[0-9]*  (* CLPRR3, JCOBY4 *)

<transition> ::= [A-Z]+  (* DROPA, MTHEW *)

<coordinate> ::= [0-9]{4,6}[NS]?/[0-9]{5,7}[EW]?
              (* 4048N/07400W *)
```

## Example Routes

### Simple VFR Route

```
Input:  KJFK KORD
Tokens: [KJFK, KORD]
Parse:  [WAYPOINT(KJFK), WAYPOINT(KORD)]
Expand: [KJFK, KORD]
Output: 1 leg, 720 nautical miles
```

### IFR Route with Airway

```
Input:  KJFK RBV Q430 AIR KCMH
Tokens: [KJFK, RBV, Q430, AIR, KCMH]
Parse:  [
    WAYPOINT(KJFK),
    WAYPOINT(RBV),
    AIRWAY_SEGMENT(RBV Q430 AIR),
    WAYPOINT(KCMH)
]
Expand: [KJFK, RBV, MOBLE, GLARE, LOFTT, AIR, KCMH]
Output: 6 legs
```

### IFR Route with STAR

```
Input:  KJFK RBV Q430 AIR CLPRR3 KCMH
Tokens: [KJFK, RBV, Q430, AIR, CLPRR3, KCMH]
Parse:  [
    WAYPOINT(KJFK),
    WAYPOINT(RBV),
    AIRWAY_SEGMENT(RBV Q430 AIR),
    PROCEDURE(CLPRR3),
    WAYPOINT(KCMH)
]
Expand: [KJFK, RBV, MOBLE, GLARE, LOFTT, AIR, CLPRR, ARRAN, HOOPZ, KCMH]
Output: 9 legs
```

## Performance Characteristics

| Stage | Complexity | Typical Time |
|-------|------------|--------------|
| Lexer | O(n) | < 1ms |
| Parser | O(n) | < 5ms |
| Resolver | O(n × m) | < 20ms |
| Expander | O(n × k) | < 50ms |
| Calculator | O(n) | < 100ms |

**Where:**
- n = number of tokens
- m = average database lookup time
- k = average airway/procedure expansion factor

**Total:** < 200ms for typical IFR route (10-20 waypoints)

## Error Handling

### Lexer Errors

```javascript
// No errors - always produces tokens
// Empty input → empty array
```

### Parser Errors

```javascript
{
    type: 'PARSE_ERROR',
    message: 'Invalid airway segment: missing TO waypoint',
    token: { text: 'Q430', index: 2 }
}
```

### Resolver Errors

```javascript
{
    type: 'UNRESOLVED_WAYPOINT',
    message: 'Waypoint not found: XYZ',
    token: { text: 'XYZ', index: 3 }
}
```

### Expander Errors

```javascript
{
    type: 'INVALID_AIRWAY_CONNECTION',
    message: 'Waypoints not on airway Q430: PAYGE to XYZ',
    airway: 'Q430',
    from: 'PAYGE',
    to: 'XYZ'
}
```

### Calculator Errors

```javascript
{
    type: 'CALCULATION_ERROR',
    message: 'Invalid coordinates for distance calculation',
    leg: { from: 'PAYGE', to: 'MOBLE' }
}
```

---

**Last Updated:** January 2025
