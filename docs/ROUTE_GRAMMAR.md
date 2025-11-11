# Route Grammar Reference (EBNF)

## Overview

This document specifies the formal grammar for InFlight route syntax using Extended Backus-Naur Form (EBNF). This grammar is implemented by the parser modules in `compute/route-lexer.js` and `compute/route-parser.js`.

## EBNF Notation

This grammar uses standard EBNF notation:

- `::=` - Definition
- `|` - Alternative (OR)
- `()` - Grouping
- `[]` - Optional (0 or 1)
- `{}` - Repetition (0 or more)
- `+` - One or more
- `" "` - Terminal symbol (literal)
- `< >` - Non-terminal symbol
- `(* *)` - Comment

## Grammar Specification

### Top-Level Structure

```ebnf
<route> ::= <waypoint_or_airport> { <route_segment> } <waypoint_or_airport>
```

A route consists of:
1. Starting point (usually departure airport)
2. Zero or more route segments
3. Ending point (usually destination airport)

### Route Segments

```ebnf
<route_segment> ::= <airway_segment>
                  | <direct_segment>
                  | <procedure>
                  | <waypoint>
                  | <coordinate>

<airway_segment> ::= <waypoint> <airway> <waypoint>

<direct_segment> ::= "DCT" <waypoint>
                   | <waypoint>  (* DCT is implicit *)

<procedure> ::= <procedure_with_transition>
              | <procedure_base>

<procedure_with_transition> ::= <transition_name> "." <procedure_name>
                              (* Chart standard notation *)

<procedure_base> ::= <procedure_name>
                   (* Auto-select transition based on proximity *)
```

### Terminal Symbols

```ebnf
<waypoint_or_airport> ::= <airport>
                        | <waypoint>

<airport> ::= <icao_code>
            | <iata_code>

<icao_code> ::= <letter> <letter> <letter> <letter>
              (* 4-letter ICAO code: KORD, KLGA, KATL *)

<iata_code> ::= <letter> <letter> <letter>
              (* 3-letter IATA code: ORD, LGA, ATL *)

<waypoint> ::= <fix>
             | <navaid>

<fix> ::= <alphanum> <alphanum> <alphanum> <alphanum> <alphanum>
        (* 5-character fix: PAYGE, GONZZ, MOBLE *)

<navaid> ::= <letter>+
           (* VOR/DME/NDB: MIP, ORD, FNT *)

<airway> ::= <airway_prefix> <digit>+

<airway_prefix> ::= "J"  (* Jet route - high altitude *)
                  | "V"  (* Victor route - low altitude *)
                  | "Q"  (* RNAV Q route *)
                  | "T"  (* RNAV T route *)
                  | "A"  (* RNAV A route *)
                  | "B"  (* RNAV B route *)
                  | "G"  (* RNAV G route *)
                  | "R"  (* RNAV R route *)

<procedure_name> ::= <letter>+ <digit>*
                   (* HIDEY1, CHPPR1, WYNDE3, OFFSH9 *)

<transition_name> ::= <letter>+
                    (* MTHEW, DROPA, HAMTN, RUTTH *)

<coordinate> ::= <latitude> "/" <longitude> [<hemisphere_suffix>]

<latitude> ::= <degrees_minutes>
             | <degrees_minutes_seconds>

<longitude> ::= <degrees_minutes>
              | <degrees_minutes_seconds>

<degrees_minutes> ::= <digit> <digit> <digit> <digit> [<ns_hemisphere>]
                    (* DDMM format: 4814N *)

<degrees_minutes_seconds> ::= <digit> <digit> <digit> <digit> <digit> <digit> [<ns_hemisphere>]
                             (* DDMMSS format: 481430N *)

<ns_hemisphere> ::= "N" | "S"

<ew_hemisphere> ::= "E" | "W"

<hemisphere_suffix> ::= <ns_hemisphere> <ew_hemisphere>
                      | <ew_hemisphere> <ns_hemisphere>
```

### Lexical Elements

```ebnf
<letter> ::= "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
           | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T"
           | "U" | "V" | "W" | "X" | "Y" | "Z"

<digit> ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

<alphanum> ::= <letter> | <digit>

<whitespace> ::= " " | "\t" | "\n" | "\r"
```

## Grammar Examples

### Simple Direct Route

```ebnf
<route> ::= "KORD" "KLGA"
```

**Expands to:**
```
KORD (direct) KLGA
```

### Route with Airway

```ebnf
<route> ::= "KORD" <airway_segment> "KLGA"
<airway_segment> ::= "PAYGE" "Q822" "GONZZ"
```

**Expands to:**
```
KORD → PAYGE → [Q822 waypoints] → GONZZ → KLGA
```

### Chained Airways

```ebnf
<route> ::= "PAYGE" "Q822" "GONZZ" "Q822" "FNT"
```

This parses as two consecutive airway segments:
1. `PAYGE Q822 GONZZ`
2. `GONZZ Q822 FNT`

The connection point `GONZZ` appears once in the expanded route.

### Route with Procedures

```ebnf
<route> ::= "KSDF" <procedure> <airway_segment> <procedure> "KATL"
<procedure> ::= "DROPA.HIDEY1"  (* Explicit transition *)
<airway_segment> ::= "PAYGE" "Q822" "GONZZ"
<procedure> ::= "MTHEW.CHPPR1"  (* Explicit transition *)
```

**Expands to:**
```
KSDF → [DROPA.HIDEY1 waypoints] → PAYGE → [Q822 waypoints] → GONZZ → [MTHEW.CHPPR1 waypoints] → KATL
```

### Route with Auto-Transition

```ebnf
<route> ::= "KSDF" "HIDEY1" "PAYGE" "Q822" "GONZZ" "CHPPR1" "KATL"
```

The parser marks `HIDEY1` and `CHPPR1` as procedures with auto-transition. The resolver selects transitions based on proximity to adjacent waypoints.

### Complex Route

```ebnf
<route> ::= "KORD" "DROPA.HIDEY1" <airway_segment> "DCT" <coordinate> "HAMTN.WYNDE3" "KLGA"
<airway_segment> ::= "PAYGE" "Q822" "GONZZ"
<coordinate> ::= "4814N/06848W"
```

**Parse tree:**
1. KORD (waypoint/airport)
2. DROPA.HIDEY1 (procedure with explicit transition)
3. PAYGE Q822 GONZZ (airway segment)
4. DCT (direct keyword)
5. 4814N/06848W (coordinate)
6. HAMTN.WYNDE3 (procedure with explicit transition)
7. KLGA (waypoint/airport)

## Pattern Recognition Order

The parser uses the following precedence order when matching tokens:

1. **DCT keyword** - Highest priority (explicit direct routing)
2. **Airway segment** - 3-token lookahead: `WAYPOINT AIRWAY WAYPOINT`
3. **Procedure with transition** - Pattern: `TRANSITION.PROCEDURE`
4. **Procedure base** - Pattern: `PROCEDURE` (ambiguous - may be waypoint)
5. **Coordinate** - Pattern: `DDMM/DDDMM` with optional hemispheres
6. **Waypoint** - Default case (airport, fix, or navaid)

## Ambiguity Resolution

### Procedure vs. Waypoint

The pattern `CHPPR1` matches both:
- `<procedure_base>` (CHPPR procedure version 1)
- `<fix>` (if a fix named CHPPR1 exists)

**Resolution Strategy:**

The parser marks these as `PROCEDURE_OR_WAYPOINT`. The resolver determines the actual type using:

1. **Database lookup** - Check if it exists as a procedure
2. **Context position** - Index <= 2 suggests DP, near end suggests STAR
3. **Fallback** - If not a procedure, treat as waypoint

### Airway Detection

The parser uses dual detection:

1. **Regex pattern** - `^[JVQTABGR]\d+$`
2. **QueryEngine token type** - Database lookup (if available)

This allows the parser to work in both production (with database) and test environments (without database).

## Grammar Extensions

The grammar is designed to be extensible. Future additions might include:

### Speed/Altitude Restrictions

```ebnf
<waypoint_restriction> ::= <waypoint> "/" <speed_altitude>
<speed_altitude> ::= "N" <speed> "F" <altitude>
                   (* Example: PAYGE/N0450F350 *)
```

### Hold Patterns

```ebnf
<hold> ::= "HOLD" <waypoint>
         (* Example: HOLD PAYGE *)
```

### Altitude Constraints

```ebnf
<altitude_constraint> ::= <waypoint> "/" "A" <altitude>
                        (* Example: PAYGE/A090 *)
```

### RNAV Waypoints

```ebnf
<rnav_waypoint> ::= <waypoint_name> "/" <coordinate>
                  (* Example: WPT001/3045N/08030W *)
```

## Grammar Validation

Routes are validated at three levels:

### 1. Lexical Validation (Lexer)

- Token structure (whitespace, case)
- Character validity

### 2. Syntactic Validation (Parser)

- Token pattern recognition
- Grammar rule compliance
- Structure validity

### 3. Semantic Validation (Resolver)

- Database lookups
- Waypoint existence on airways
- Procedure transition validity
- Coordinate format correctness

## Error Handling

### Syntax Errors

If a token doesn't match any pattern, it defaults to `<waypoint>`. The resolver will generate an error if the waypoint doesn't exist in the database.

### Semantic Errors

```ebnf
(* Waypoint not found *)
ERROR: "Waypoint not found: XYZ123"

(* Waypoint not on airway *)
ERROR: "PAYGE not found on Q999"

(* Invalid transition *)
ERROR: "Transition INVALID not found for CHPPR1"

(* Invalid coordinate format *)
ERROR: "Invalid coordinate format: 123/456"
```

## Grammar Properties

### Case Insensitivity

All input is normalized to uppercase during lexical analysis:

```
Input:  "kord payge q822 gonzz"
Tokens: ["KORD", "PAYGE", "Q822", "GONZZ"]
```

### Whitespace Handling

Multiple spaces are treated as single separators:

```
Input:  "KORD    PAYGE     Q822"
Tokens: ["KORD", "PAYGE", "Q822"]
```

### Left-to-Right Parsing

The parser processes tokens sequentially with lookahead, no backtracking required.

### Deterministic

For any given input, there is exactly one parse tree (after ambiguity resolution).

## Implementation Notes

### Token Types

The parser generates these node types:

- `WAYPOINT` - Airport, fix, or navaid
- `AIRWAY_SEGMENT` - Three-part airway structure
- `PROCEDURE` - SID/STAR with explicit transition
- `PROCEDURE_OR_WAYPOINT` - Ambiguous (resolved later)
- `COORDINATE` - Lat/lon position
- `DIRECT` - DCT keyword

### Parse Tree Structure

Each node contains:
- `type` - Node type (from list above)
- `token` - Original token object
- `expand` - Boolean indicating if expansion needed
- Type-specific fields (e.g., `from`, `airway`, `to` for airway segments)

### Performance

- **Time complexity:** O(n) where n = number of tokens
- **Space complexity:** O(n) for parse tree
- **No backtracking:** Single-pass with lookahead

## References

- [Route Syntax Reference](./ROUTE_SYNTAX.md) - User-facing documentation
- [Parser Architecture](./PARSER_ARCHITECTURE.md) - Implementation details
- [ICAO Doc 4444](https://www.icao.int/safety/acp/inactive%20working%20groups%20library/acp-wg-n-3/doc4444_pans-atm_15thedition_amendement5_en.pdf) - ICAO Flight Plan standards
- [FAA Order JO 7110.65](https://www.faa.gov/air_traffic/publications/atpubs/atc_html/) - Air Traffic Control procedures

## Changelog

### Version 1.0 (Current)

- Initial grammar specification
- Chart standard notation: `TRANSITION.PROCEDURE`
- Auto-transition support: `PROCEDURE`
- Airway segment chaining
- Coordinate waypoints
- DCT keyword support
