# Route Syntax Reference

## Overview

InFlight supports ICAO-standard route syntax for flight planning, including airways, SID/STAR procedures, coordinates, and direct routing.

## Basic Syntax

A route consists of space-separated tokens:

```
DEPARTURE [ROUTE] DESTINATION
```

### Example Routes

**Simple direct route:**
```
KORD KLGA
```

**With airways:**
```
KORD PAYGE Q822 GONZZ Q822 FNT KLGA
```

**With SID and STAR:**
```
KSDF DROPA.JCOBY4 PAYGE Q822 GONZZ MTHEW.CHPPR1 KATL
```

**Complex route:**
```
KORD DROPA.JCOBY4 PAYGE Q822 GONZZ DCT 4814N/06848W HAMTN.WYNDE3 KLGA
```

## Token Types

### 1. Airports

**ICAO codes** (4 letters) - **PREFERRED**:
```
KORD    (Chicago O'Hare)
KLGA    (LaGuardia)
KATL    (Atlanta)
KALB    (Albany International)
```

**IATA codes** (3 letters) - **Use only for airports without ICAO codes**:
```
ORD     (Chicago O'Hare - but prefer KORD)
LGA     (LaGuardia - but prefer KLGA)
ATL     (Atlanta - but prefer KATL)
```

**⚠️ AMBIGUITY WARNING:** 3-letter codes can conflict with navaids!
```
ALB     → Could be KALB airport OR ALB VORTAC
ORD     → Could be KORD airport OR ORD VOR/DME
```

**Recommendation:** Always use 4-letter ICAO codes for airports. Only use 3-letter IATA codes for small municipal airports that don't have ICAO codes.

When using autocomplete, if you type a 3-letter code, you'll see both the airport and navaid options to choose from.

### 2. Airways

Airways connect waypoints along published routes.

**Format:** `[PREFIX][NUMBER]`

**Prefixes:**
- `J` - Jet route (high altitude)
- `V` - Victor route (low altitude)
- `Q` - RNAV Q route
- `T` - RNAV T route
- `A`, `B`, `G`, `R` - Other RNAV routes

**Syntax:** `WAYPOINT AIRWAY WAYPOINT`

**Examples:**
```
PAYGE Q822 GONZZ        (Single airway segment)
PAYGE Q822 GONZZ Q822 FNT    (Chained airways)
```

**Bidirectional:** Airways automatically detect direction based on waypoint order.

### 3. Procedures (SID/STAR)

Procedures can be specified with or without transitions.

#### Chart Standard Notation (Recommended)

**Format:** `TRANSITION.PROCEDURE`

This matches how transitions appear on approach plates:
```
MTHEW TRANSITION (MTHEW.CHPPR1)
```

**Examples:**
```
DROPA.JCOBY4      (DROPA transition of JCOBY4 departure)
MTHEW.CHPPR1      (MTHEW transition of CHPPR1 arrival)
HAMTN.WYNDE3      (HAMTN transition of WYNDE3 arrival)
```

#### Auto-Transition

**Format:** `PROCEDURE`

Omit the transition to automatically select based on proximity:

```
JCOBY4      (Auto-selects closest transition)
CHPPR1      (Auto-selects closest transition)
WYNDE3      (Auto-selects closest transition)
```

**Selection Algorithm:**
1. If next waypoint matches a transition name → use that transition
2. If previous waypoint matches body start → use body only
3. Otherwise → select closest transition to previous waypoint (Haversine distance)

#### Procedure Naming

Procedures may include version numbers:
```
CHPPR1      (Version 1)
WYNDE3      (Version 3)
CHPPR       (No version number)
```

### 4. Waypoints

**Fixes** (5 characters, alphanumeric):
```
MOBLE
ADIME
GERBS
PAYGE
```

**Navaids** (VOR/DME/NDB):
```
MIP         (VOR)
ORD         (VOR/DME)
FNT         (VORTAC)
```

### 5. Coordinates

User-defined positions using lat/long.

**Format:** `LATITUDE/LONGITUDE[HEMISPHERE]`

**Latitude:**
- `DDMM` (Degrees-Minutes): `4814`
- `DDMMSS` (Degrees-Minutes-Seconds): `481430`
- Optional hemisphere: `N` or `S`

**Longitude:**
- `DDDMM` (Degrees-Minutes): `06848`
- `DDDMMSS` (Degrees-Minutes-Seconds): `0684815`
- Optional hemisphere: `E` or `W`

**Examples:**
```
4814/06848          (Implicit North/East)
4814N/06848W        (Explicit hemispheres)
481430/0684815      (Degrees-Minutes-Seconds)
4814/06848NW        (Direction suffix)
```

### 6. Direct Keyword

**DCT** - Direct routing (straight line between waypoints)

```
KORD DCT MOBLE DCT KLGA
```

The DCT keyword is optional - waypoints without airways are assumed direct.

## Route Patterns

### Airway Segments

**Single segment:**
```
FROM AIRWAY TO
```

**Example:**
```
PAYGE Q822 GONZZ
```

**Chained segments:**
```
FIX1 AIRWAY1 FIX2 AIRWAY2 FIX3
```

**Example:**
```
PAYGE Q822 GONZZ Q822 FNT
```

Connection points (like GONZZ) are automatically deduplicated.

### Procedure Integration

**Departure procedure + airways + arrival:**
```
AIRPORT SID WAYPOINT AIRWAY WAYPOINT STAR AIRPORT
```

**Example:**
```
KSDF JCOBY4 PAYGE Q822 GONZZ CHPPR1 KATL
```

**With explicit transitions:**
```
KSDF DROPA.JCOBY4 PAYGE Q822 GONZZ MTHEW.CHPPR1 KATL
```

### Mixed Routes

Combine all elements:

```
KORD DROPA.JCOBY4 PAYGE Q822 GONZZ DCT 4814N/06848W HAMTN.WYNDE3 KLGA
```

This route includes:
1. Departure: KORD
2. SID with transition: DROPA.JCOBY4
3. Airway segment: PAYGE Q822 GONZZ
4. Direct routing: DCT
5. Coordinate waypoint: 4814N/06848W
6. STAR with transition: HAMTN.WYNDE3
7. Arrival: KLGA

## Expansion

The route parser automatically expands:

### Airways
```
Input:  PAYGE Q822 GONZZ
Output: PAYGE → INTERMED1 → INTERMED2 → GONZZ
        (All waypoints along Q822 between PAYGE and GONZZ)
```

### Procedures
```
Input:  MTHEW.CHPPR1
Output: MTHEW → TRANS1 → TRANS2 → BODY1 → BODY2 → BODY3
        (Transition waypoints + procedure body waypoints)
```

### Chained Airways
```
Input:  PAYGE Q822 GONZZ Q822 FNT
Output: PAYGE → ... → GONZZ → ... → FNT
        (GONZZ appears once at connection point)
```

## Validation

Routes are validated in multiple stages:

### 1. Syntax Validation (Parser)
- Token pattern recognition
- Structure validation
- EBNF grammar compliance

### 2. Semantic Validation (Resolver)
- Database lookup for all waypoints
- Airway segment validation (waypoints must exist on airway)
- Procedure transition validation
- Coordinate format validation

### 3. Expansion Validation (Expander)
- Airway direction detection
- Transition selection
- Waypoint deduplication

## Error Handling

### Common Errors

**Waypoint not found:**
```
Error: Waypoint not found: XYZ123
```

**Waypoint not on airway:**
```
Error: PAYGE not found on Q999
```

**Invalid transition:**
```
Error: Transition INVALID not found for CHPPR1
```

**Invalid coordinate format:**
```
Error: Invalid coordinate format: 123/456
```

## Case Sensitivity

All input is **case-insensitive** and automatically converted to uppercase:

```
kord payge q822 gonzz  →  KORD PAYGE Q822 GONZZ
```

## Whitespace

Multiple spaces are treated as single separator:

```
KORD    PAYGE     Q822   GONZZ  →  KORD PAYGE Q822 GONZZ
```

## Best Practices

### 1. Use Chart Standard Notation

Prefer explicit transitions for clarity:
```
✓ MTHEW.CHPPR1
✗ CHPPR1
```

### 2. Specify Full Airways

Include entry and exit waypoints:
```
✓ PAYGE Q822 GONZZ
✗ Q822
```

### 3. Use ICAO Codes (Critical!)

**Always** prefer 4-letter ICAO over 3-letter IATA to avoid ambiguity:
```
✓ KORD   (unambiguous airport)
✗ ORD    (could be airport or navaid)

✓ KALB   (unambiguous airport)
✗ ALB    (ALB VORTAC or KALB airport?)
```

**Exception:** Only use 3-letter IATA codes for small municipal airports without ICAO codes.

**Autocomplete helps:** When typing a 3-letter code, the suggestion list will show both the ICAO airport code and any matching navaids, allowing you to choose the correct one.

### 4. Validate Procedures

Verify procedures exist for your airport:
```
✓ KSDF JCOBY4        (JCOBY4 exists at KSDF)
✗ KORD JCOBY4        (JCOBY4 doesn't exist at KORD)
```

## Examples by Use Case

### VFR Direct Flight
```
KALB KBOS
```

### IFR with Airways
```
KALB PAWLING J547 PARCH KBOS
```

### IFR with SID and STAR
```
KATL DAWGS3 MAGIO Q123 LENDY CAMRN4 KMCO
```

### Complex IFR Route
```
KSFO OFFSH9 FAITH Q1 PYE J501 ECA WYNDE3 KLAS
```

### Training Route with Coordinates
```
KPAO 3730N/12205W 3745N/12220W KPAO
```

## Reference

For detailed grammar specification, see [ROUTE_GRAMMAR.md](./ROUTE_GRAMMAR.md).

For parser implementation details, see [PARSER_ARCHITECTURE.md](./PARSER_ARCHITECTURE.md).
