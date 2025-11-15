# ROUTE Tab

The ROUTE tab is where you plan your flight by entering departure, route, and destination information.

## Overview

InFlight supports sophisticated route planning using:
- **Direct routing** (DCT)
- **Airways** (Victor, Jet routes)
- **SID/STAR procedures**
- **Navaids and fixes**
- **Mixed routing** (combination of above)

The route syntax follows standard ICAO flight plan format.

## Route Entry Fields

### Departure Airport

**Format**: ICAO code (e.g., `KALB`, `KJFK`)

- **Required**: Yes
- **Type**: Airport only (navaids/fixes not accepted)
- **Autocomplete**: Type 2+ characters to see suggestions
- **Color coding**: Cyan = airport

**Examples:**
- `KALB` - Albany International
- `KORD` - Chicago O'Hare
- `KSFO` - San Francisco International

### Route (Optional)

**Format**: Space-separated waypoints, airways, and procedures

- **Required**: No (leave blank for direct routing)
- **Type**: Navaids, fixes, airways, SIDs, STARs
- **Autocomplete**: Shows matching waypoints as you type

**Common Patterns:**

```
# Direct to navaid then airway
PAYGE Q822 FNT

# Airway transition
V4 LAKES V93 FRNCH

# With SID and STAR
BAIRN6 GVE J548 MLI WYNDE3

# All direct waypoints
PAYGE HARTH FNT LAKES

# Mixed routing
PAYGE Q822 FNT DCT LAKES V93 FRNCH
```

> 💡 **Tip**: `DCT` keyword is optional - space between waypoints implies direct routing.

### Destination Airport

**Format**: ICAO code (e.g., `KORD`, `KBOS`)

- **Required**: Yes
- **Type**: Airport only
- **Autocomplete**: Type 2+ characters
- **Color coding**: Cyan = airport

## Route Syntax Rules

### Airways

Airways connect waypoints along published routes.

**Victor Airways** (Low altitude):
```
V4 LAKES V93
```

**Jet Routes** (High altitude):
```
J548 MLI J94
```

**Q Routes** (RNAV):
```
Q822 FNT Q16
```

**How Airways Work:**
1. InFlight finds the airway definition
2. Expands all waypoints along the airway
3. Includes only the segment you're flying

### SID/STAR Procedures

Standard departure and arrival procedures.

**SID (Standard Instrument Departure):**
```
BAIRN6    # Appended to departure airport
```

**STAR (Standard Terminal Arrival):**
```
WYNDE3    # Prepended to destination airport
```

**Full Example:**
```
KALB BAIRN6 GVE J548 MLI WYNDE3 KORD
      ^^^SID              ^^^STAR
```

### Waypoint Types

**Navaid** (VOR, NDB, etc.):
- Color: Magenta
- Examples: `GVE`, `MLI`, `FNT`

**Fix** (Intersection):
- Color: White (or amber if reporting point)
- Examples: `PAYGE`, `HARTH`, `LAKES`

**Airport**:
- Color: Cyan
- Examples: `KALB`, `KORD`

### Special Keywords

**DCT** - Direct (optional):
```
PAYGE DCT FNT    # Same as: PAYGE FNT
```

**Transition Points:**

Some procedures support transitions (auto-detected):
```
WYNDE3.PAYGE     # WYNDE3 via PAYGE transition
```

## Autocomplete Features

As you type, InFlight shows matching waypoints:

**Information Displayed:**
- Waypoint code
- Type (Airport, VOR, Fix, etc.)
- Name
- Location (city/state)

**Navigation:**
- Use ↑↓ arrow keys to select
- Press Enter to accept
- Click with mouse/touch
- Type complete code and space to skip

**Filtering:**
- Shows closest matches first
- Prioritizes airports for departure/destination
- Shows all types for route field

## Optional Features

### Wind Correction & Time

Enable this to calculate wind-corrected headings and accurate ETEs.

**Requires:**
1. Toggle **WIND CORRECTION & TIME**
2. **Cruise Altitude** (FT MSL): Flight level for wind data
3. **True Airspeed** (KT): Your aircraft's TAS
4. **Forecast Period**: When you'll be flying (6/12/24 hours ahead)

**What It Calculates:**
- Winds aloft at your altitude
- Wind correction angle (WCA)
- Ground speed
- Magnetic heading
- ETE (Estimated Time Enroute)
- ETA (Estimated Time of Arrival)

> ⚠️ **Requires Internet**: Wind data is fetched from NOAA

**Example Settings:**
```
Cruise Altitude: 5500 FT
True Airspeed: 120 KT
Forecast Period: 6 HR
```

### Fuel Planning

Calculate fuel burn, reserves, and endurance.

**Requires:**
- Wind correction must be enabled (for time calculations)

**Fields:**
1. **Usable Fuel** (GAL): Total fuel capacity
2. **Taxi Fuel** (GAL): Fuel burned before takeoff
3. **Burn Rate** (GAL/HR): Fuel consumption rate
4. **Fuel Reserve**: VFR Day (30 min) or VFR Night/IFR (45 min)

**What It Calculates:**
- Fuel burn per leg
- Cumulative fuel used
- Fuel remaining at each waypoint
- Endurance
- Reserve fuel status

**Example Settings:**
```
Usable Fuel: 32 GAL
Taxi Fuel: 1 GAL
Burn Rate: 10 GAL/HR
Reserve: VFR DAY (30 MIN)
```

> ⚠️ **Warning**: Fuel calculations are estimates only. Always follow aircraft procedures and check fuel physically.

## Buttons

### CALCULATE

Processes your route and generates the navigation log.

**Process:**
1. Validates departure and destination
2. Parses route syntax
3. Expands airways and procedures
4. Resolves all waypoints
5. Calculates distances and headings
6. Fetches wind data (if enabled)
7. Calculates fuel (if enabled)
8. Displays results in NAVLOG tab

**Automatically switches** to NAVLOG tab when complete.

### CLEAR

Resets all fields to empty state.

**What Gets Cleared:**
- Departure airport
- Route
- Destination airport
- All option toggles remain (wind, fuel settings preserved)

## Recent Routes

If you've calculated routes before, you'll see a **RECENT ROUTES** section below the form.

**Shows:**
- Up to 10 most recent routes
- Full route string (DEPARTURE ROUTE DESTINATION)

**Click any route** to load it back into the form.

## Example Routes

### Simple Direct Flight
```
Departure: KALB
Route: (leave blank)
Destination: KBOS
```

### With Airways
```
Departure: KALB
Route: PAYGE Q822 FNT WYNDE3
Destination: KORD
```

### Long Cross-Country
```
Departure: KSFO
Route: BSR V244 EHF V105 DVC
Destination: KLAS
```

### With SID/STAR
```
Departure: KJFK
Route: HAPIE7 SAX J70 ETG BDDIA3
Destination: KBOS
```

### Complex Multi-Segment
```
Departure: KMIA
Route: WINCO5 OMN J51 ORL J145 SULIT HAWES3
Destination: KATL
```

## Validation & Errors

### Common Errors

**"Airport not found"**
- Check spelling of ICAO code
- Verify database is loaded
- Try IATA code if ICAO fails

**"Waypoint not found: XXXXX"**
- Typo in waypoint name
- Waypoint not in database (oceanic?)
- Try nearby alternative waypoint

**"No route found on airway"**
- Airway doesn't connect those waypoints
- Check airway direction/structure
- Use intermediate waypoint

**"SID/STAR not found"**
- Procedure not in database
- Check airport supports that procedure
- Spelling error in procedure name

**"Wind data unavailable"**
- Internet connection lost
- NOAA service down
- Try different forecast period

### Tips for Success

1. **Use autocomplete** - Reduces typos
2. **Start simple** - Test with direct route first
3. **Build incrementally** - Add airways/procedures one at a time
4. **Check colors** - Waypoint colors indicate type
5. **Save fuel settings** - Settings persist across routes

## Advanced Routing

### Mixing Airways and Direct

You can combine airways with direct routing:

```
PAYGE Q822 FNT DCT KALAMAZOO V4 BADGER
      ^^^^airway ^^^^direct  ^^airway
```

### Airway Entry/Exit Points

Airways have designated entry/exit fixes. InFlight automatically:
1. Finds valid entry point nearest to previous waypoint
2. Follows airway to exit point
3. Validates airway connectivity

### Procedure Variations

Some SIDs/STARs have multiple variations:

```
WYNDE3           # Standard WYNDE3
WYNDE3.PAYGE     # Via PAYGE transition (if supported)
```

## Performance Optimization

For best results:

1. **Pre-download database** in DATA tab
2. **Use exact codes** when known (faster than autocomplete)
3. **Enable wind/fuel together** (single calculation pass)
4. **Cache results** by saving navlog exports

## Next Steps

After calculating your route:

- **[Review Navlog](tab-navlog.md)** - Check the flight plan details
- **[View Map](tab-map.md)** - See your route visualized
- **[Wind Correction Guide](features/wind-correction.md)** - Understand wind calculations
- **[Route Syntax Reference](features/route-syntax.md)** - Advanced syntax examples

---

**Ready to calculate?** Make sure the database is loaded, then enter your route!
