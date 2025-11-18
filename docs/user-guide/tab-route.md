# ROUTE Tab: Building Flight Plans

The ROUTE tab is where you enter your flight plan and let IN-FLIGHT do the heavy lifting—expanding procedures, resolving airways, and calculating performance.

**What makes this different from other flight planners:** The autocomplete actually understands routing context. After you enter a fix, it shows airways departing from that fix. After you enter an airway, it shows fixes on that airway. This is how FMS route entry works, not how most websites work.

## Input Modes: Two Ways to Enter Routes

IN-FLIGHT supports two input modes for maximum flexibility:

### Mode 1: Traditional Three-Field Input (Recommended for IFR)

**Departure Airport + Route + Destination Airport**

- **Departure Airport:** ICAO or IATA code (examples: `KSFO`, `SFO`, `KBOS`, `BOS`)
- **Route:** Space-separated waypoints, airways, procedures (leave blank for direct)
- **Destination Airport:** ICAO or IATA code (same as departure)

**Autocomplete:** Start typing and suggestions appear. Airport names, city names, and identifiers all work.

**Pro tip:** For Class B/C airports, just type the 3-letter code—`SFO` is faster than `KSFO` and works identically.

### Mode 2: Waypoint-Only Input (Quick Entry)

**Just use the Route field—leave Departure and Destination blank**

Enter waypoints in the route field only. IN-FLIGHT automatically treats:
- **First waypoint** as departure
- **Last waypoint** as destination

**Example:**
```text
Departure: (blank)
Route: KSFO KHAF KOAK
Destination: (blank)
```

This is equivalent to:
```text
Departure: KSFO
Route: KHAF
Destination: KOAK
```

**When to use waypoint-only mode:**
- Quick VFR planning (just type the waypoints)
- Simple direct routes
- When copying routes from other sources
- Faster entry for straightforward flights

**The magic:** IN-FLIGHT auto-expands everything. You type the shorthand, it generates the full route.

## Route Syntax: What Actually Works

### Direct Routing (VFR Cross-Country)
**Simplest case:** Just enter waypoints with spaces between them.

```text
KSFO KHAF
```

This means: San Francisco → Half Moon Bay (direct)

You can optionally use `DCT` keyword:
```text
KSFO DCT KHAF
```

But it's unnecessary—spaces imply direct routing.

### Airways (IFR Enroute)
**How airways work:** You don't enter every fix on the airway. Just the entry point, airway identifier, and exit point. IN-FLIGHT fills in the intermediate fixes.

**Example:**
```text
BSR V244 EHF V105 DVC
```

This means:
1. Direct to Big Sur VOR (BSR)
2. Fly V244 from BSR to Eddy VOR (EHF)
3. Fly V105 from EHF to Dove Creek (DVC)

IN-FLIGHT auto-expands all the intermediate fixes on V244 and V105.

**Airway types:**
- **V-routes** (Victor airways): Low altitude, 1,200 AGL to 18,000 MSL
- **J-routes** (Jet routes): High altitude, 18,000+ MSL
- **T-routes** (Tango airways): Low altitude RNAV, 1,200 AGL to 18,000 MSL
- **Q-routes** (RNAV routes): High altitude RNAV, 18,000+ MSL

### Procedures (SIDs and STARs)

**SID (Standard Instrument Departure):**
Enter the procedure name right after departure airport (or as first route element).

```text
KSFO JCOBY4 BSR J501 DRK
```

IN-FLIGHT expands JCOBY4 to include all the departure fixes based on the active runway.

**STAR (Standard Terminal Arrival):**
Enter the procedure name right before destination airport (or as last route element).

```text
BSR J501 DRK WYNDE3 KLAS
```

IN-FLIGHT expands WYNDE3 to include the arrival fixes and automatically selects the correct transition.

**Full IFR example with both:**
```text
KSFO JCOBY4 BSR J501 DRK WYNDE3 KLAS
```

Breaks down to:
- Depart KALB
- Fly direct to Big Sur VOR
- Follow J501 to Drakesbad VOR
- Arrive KORD via WYNDE THREE

### Procedure Transitions

Some SIDs/STARs have multiple transitions. IN-FLIGHT auto-selects based on your route:

```text
KBOS PAYGE SSOXS V3 SAX
```

If you type `SSOXS` as the first fix after PAYGE, IN-FLIGHT knows you want the SSOXS transition (not ROBUC or LBSTA).

**You can also be explicit using FAA chart standard notation:**
```text
KAYYS.WYNDE3
```

This forces the KAYYS transition for WYNDE3 STAR (follows FAA chart format: TRANSITION.PROCEDURE).

**How autocomplete helps:** Type `KAYYS.` and autocomplete shows all procedures with the KAYYS transition. Type `KAYYS.WY` to filter to procedures starting with WY (like WYNDE3).

**Works for both SIDs and STARs:**
- `RAMRD.HIDEY1` - HIDEY ONE departure via RAMRD transition
- `MTHEW.CHPPR1` - CHPPR ONE arrival via MTHEW transition
- `KAYYS.WYNDE3` - WYNDE THREE arrival via KAYYS transition

### Mixed Routing (Real World)

Most IFR routes combine all of the above:

```text
KALB JCOBY4 PAYGE Q822 FNT WYNDE3 KORD
```

Breakdown:
- **KALB**: Departure (Albany, NY)
- **JCOBY4**: SID (HIDEY ONE departure)
- **PAYGE**: Last fix on SID / first fix on airway
- **Q822**: RNAV route
- **FNT**: Flint VOR (exit Q822)
- **WYNDE3**: STAR (WYNDE THREE arrival)
- **KORD**: Destination (Chicago O'Hare)

IN-FLIGHT auto-expands this into 20+ waypoints with distances and courses.

## The Intelligent Autocomplete

**This is where IN-FLIGHT shines.** The autocomplete is context-aware.

### After You Type a Fix

Autocomplete shows **airways departing from that fix**.

Example: Type `PAYGE` → autocomplete shows:
- Q822 (departing PAYGE)
- V4 (departing PAYGE)
- Other airways that use PAYGE

**Why this matters:** You don't see 500 random airways. You see the 3-5 airways that actually make sense from your current position.

### After You Type an Airway

Autocomplete shows **fixes on that airway**.

Example: Type `Q822` → autocomplete shows:
- FNT (Flint VOR, on Q822)
- HARTH (fix on Q822)
- LAKES (fix on Q822)

**Why this matters:** You don't see 10,000 random fixes. You see the dozen or so fixes on Q822, so you can pick your exit point.

### Building a Route Interactively

Let's build **KBOS → KLGA** using autocomplete:

1. **Type:** `KBOS` in departure → autocomplete shows Boston Logan
2. **Type:** `SSOXS` in route → autocomplete shows PAYGE (the SID)
3. **Type:** `SSOXS` again → autocomplete shows the fix (SID exit)
4. **Type:** `V3` → autocomplete shows V3 airway
5. **Type:** `SAX` → autocomplete shows Sparta VOR (on V3)
6. **Type:** `J57` → autocomplete shows J57 airway
7. **Type:** `LRP` → autocomplete shows Linden VOR (on J57)
8. **Type:** `LENDY6` → autocomplete shows LENDY SIX STAR
9. **Type:** `KLGA` in destination → autocomplete shows LaGuardia

**Final route:** `KBOS PAYGE SSOXS V3 SAX J57 LRP LENDY6 KLGA`

Hit COMPUTE and you get a full IFR flight plan with 30+ waypoints.

## Wind Correction & Time Calculation

**What it does:** Fetches winds aloft, calculates wind-corrected headings and ground speeds, estimates ETEs.

**When to use it:**
- IFR flight planning (accurate ETAs for ATC)
- VFR cross-country (fuel/time estimates)
- Altitude optimization (try different altitudes, compare times)

### Required Fields

**Cruise Altitude (FT MSL):**
Your planned altitude. Examples: `5500`, `9500`, `FL230`

**For VFR:** Use hemispherical rules (eastbound odd +500, westbound even +500)
**For IFR:** Use assigned altitude or filed altitude

**True Airspeed (KT):**
Your aircraft's TAS at cruise power setting.

Examples:
- C172: `120` knots
- SR22: `170` knots
- King Air 350: `290` knots

**Check your POH** for TAS at your cruise altitude and power setting.

**Forecast Period:**
When you'll be flying. Options:
- **6 HR**: Departing in next 6 hours
- **12 HR**: Departing in 6-12 hours
- **24 HR**: Departing in 12-24 hours

IN-FLIGHT fetches NOAA winds aloft forecast for that time period.

### What Gets Calculated

With wind correction enabled, IN-FLIGHT calculates:

- **Wind correction angle (WCA)**: How much to crab for crosswind
- **Magnetic heading (MH)**: Course to fly (true course + WCA + magnetic variation)
- **Ground speed (GS)**: TAS adjusted for headwind/tailwind
- **ETE (Estimated Time En Route)**: Time for each leg
- **ETA (Estimated Time of Arrival)**: Cumulative time to each waypoint

All this appears in the NAVLOG tab after you hit COMPUTE.

### Multi-Altitude Wind Interpolation

**Advanced feature:** If you enter winds at multiple altitudes, IN-FLIGHT interpolates.

Example: You're climbing from 3,000 to 9,000 feet over a 50nm leg.

Instead of using wind from one altitude, IN-FLIGHT:
1. Finds wind at 3,000 ft (starting altitude)
2. Finds wind at 9,000 ft (ending altitude)
3. Calculates blended wind for the climb segment
4. Uses that for ground speed calculation

**To use this:** Enter manual winds in NAVLOG tab at different altitudes (3000, 6000, 9000). IN-FLIGHT automatically interpolates between them.

## Fuel Planning

**What it does:** Calculates fuel burn, shows fuel remaining at each waypoint, warns if you're cutting it close.

### Required: Wind Correction Must Be Enabled

Fuel planning needs time estimates, which come from wind correction. You can't enable fuel without enabling wind.

### Fields

**Fuel Capacity (GAL):**
Total usable fuel in your aircraft.

Examples:
- C172: `40` gallons
- PA28-180: `48` gallons
- SR22: `81` gallons (92 total - unusable)

**Use usable fuel, not total capacity.**

**Fuel Burn Rate (GAL/HR):**
Cruise fuel consumption.

Examples:
- C172 @ 65% power: `8.5` GPH
- SR22 @ 75% power: `17` GPH
- King Air 350: `90` GPH

**Check your POH** for fuel flow at cruise power.

**Reserve Fuel:**
Fuel you won't touch. Options:
- **VFR Day**: 30 minutes reserve (FAR 91.151)
- **VFR Night / IFR**: 45 minutes reserve (FAR 91.167)

Choose the regulatory minimum for your flight.

**Starting Fuel (GAL):**
How much fuel you're actually carrying (if not full).

Example: Fuel capacity is 48 gallons, but you're only loading 40 gallons. Enter `40`.

### What Gets Calculated

IN-FLIGHT shows:
- **Fuel burn per leg** (based on ETE and burn rate)
- **Fuel remaining at each waypoint**
- **Total fuel required** (burn + reserve)
- **Endurance** (how long you can fly)

**Warning system:** If fuel remaining drops below reserve, IN-FLIGHT highlights it in red.

### Fuel Calculation Example

**Route:** KSFO → KLAS (390 nm)
**Aircraft:** C172 (40 gal capacity, 8.5 GPH)
**Cruise:** 9,500 ft, 120 kt TAS
**Winds:** 25 kt headwind average

**Calculation:**
- Ground speed: ~95 kt (120 - 25)
- Flight time: 390 nm ÷ 95 kt = 4.1 hours
- Fuel burn: 4.1 hr × 8.5 GPH = 34.9 gallons
- Reserve (VFR day): 30 min = 4.3 gallons
- **Total required: 39.2 gallons** (barely fits in 40 gal tank!)

IN-FLIGHT shows this automatically when you hit COMPUTE.

## Buttons

### COMPUTE Button

**What it does:** Processes your route and generates the navigation log.

Click this after entering your route. If everything is valid, you'll see:
- Green success message
- Waypoint count (e.g., "Route calculated: 23 waypoints")
- Automatic switch to NAVLOG tab

**What happens behind the scenes:**
1. Validates departure/destination airports
2. Parses route string
3. Expands SIDs/STARs
4. Expands airways
5. Resolves all waypoints
6. Calculates distances (Vincenty's formula on WGS84)
7. Applies magnetic variation (WMM2025)
8. Fetches winds aloft (if enabled)
9. Calculates fuel (if enabled)
10. Generates navlog

**Errors?** Red error message appears. Common issues:
- Typo in waypoint name
- Airway doesn't connect those fixes
- Database not loaded
- No internet for winds aloft

### CLEAR Button

**What it does:** Resets the form.

Clears:
- Departure airport
- Route
- Destination airport

**Does NOT clear:**
- Wind correction settings (altitude, TAS, forecast period)
- Fuel planning settings (capacity, burn rate, reserve)

This is intentional—your aircraft performance doesn't change between flights.

## Recent Routes

If you've calculated routes before, you'll see a **RECENT ROUTES** list below the form.

**Shows:** Last 10 routes you've calculated

**Click any route** to reload it into the form. Useful for:
- Re-flying a common route
- Starting from a previous route and modifying it
- Checking a route you filed last week

## Real-World Route Examples

### VFR Cross-Country (Northern California)

**Traditional mode:**
```text
Departure: KSFO
Route: KHAF
Destination: KHAF
```

**Waypoint-only mode (faster):**
```text
Departure: (blank)
Route: KSFO KHAF
Destination: (blank)
```

San Francisco → Half Moon Bay (short coastal flight)

### IFR Short Hop (Northeast Corridor)
```text
Departure: KTEB
Route: RUUDY4 PARKE V1 MERIT CCC ROBUC4
Destination: KBOS
```

Teterboro → IFR routing via V1 → Boston

### IFR Cross-Country with Multiple Airways
```text
Departure: KSFO
Route: JCOBY4 BSR V244 EHF V105 DVC J58 KADDY WYNDE3
Destination: KLAS
```

San Francisco → Las Vegas via multiple airway segments

### IFR High-Altitude Jet Route
```text
Departure: KJFK
Route: HAPIE7 SAX J70 ETG J121 WYNNS ROBUC4
Destination: KBOS
```

New York JFK → Boston via jet routes (FL230+)

### Simple VFR Direct (Training Flight)
```text
Departure: KSQL
Route: (blank)
Destination: KRHV
```

San Carlos → Reid-Hillview direct (no route needed)

### Complex IFR with Transition
```text
Departure: KORD
Route: OHARE6.KUBBS KUBBS J146 PETTY J29 DJB ZACHH1
Destination: KDCA
```

Chicago → Washington National with explicit SID transition

## Troubleshooting Route Entry

### "Airport not found"

**Cause:** Typo in airport code, or database not loaded.

**Fix:**
1. Check spelling (KSFO not KSOF)
2. Try IATA code (SFO instead of KSFO)
3. Go to DATA tab and load database if needed

### "Waypoint not found: XXXXX"

**Cause:** Typo in waypoint name, or waypoint not in database.

**Fix:**
1. Use autocomplete to verify exact spelling
2. Check if waypoint exists (some fixes are regional)
3. Try alternate waypoint on same airway

### "No route found on airway"

**Cause:** Airway doesn't connect those two waypoints, or direction is wrong.

**Fix:**
1. Check if entry/exit points are actually on the airway
2. Try intermediate waypoint on the airway
3. Verify airway direction (some are one-way)

### "SID/STAR not found"

**Cause:** Procedure doesn't exist at that airport, or spelling error.

**Fix:**
1. Check airport supports that procedure (verify with charts)
2. Verify exact procedure name (JCOBY4 not OFFSHORE)
3. Some small airports don't have procedures—file direct or airways only

### "Wind data unavailable"

**Cause:** No internet connection, or NOAA service is down.

**Fix:**
1. Check your internet connection
2. Try different forecast period
3. Disable wind correction and enter winds manually in NAVLOG tab

### Route Computes But Looks Wrong

**Cause:** IN-FLIGHT chose a different airway segment than you expected.

**Fix:**
1. Check the NAVLOG to see which fixes were included
2. Add intermediate waypoint to force specific airway segment
3. Use explicit transitions on SIDs/STARs if needed

## Advanced Techniques

### Optimizing for Best Winds

**Workflow:**
1. Enter route with altitude 7,500 ft, hit COMPUTE
2. Note total time in NAVLOG
3. Change altitude to 9,500 ft, hit COMPUTE again
4. Compare times—pick better altitude
5. File the optimized altitude

### Pre-Filing Multiple Alternates

**Workflow:**
1. Enter primary route to destination A, hit COMPUTE
2. Export NAVLOG (or screenshot)
3. Change destination to alternate B, hit COMPUTE
4. Export again
5. Now you have both routes pre-planned

### Analyzing Expected Routes

Got a route from ForeFlight/fltplan.com? Analyze it in IN-FLIGHT:

1. Copy: `KSFO JCOBY4 BSR J501 DRK WYNDE3 KLAS`
2. Split into departure/route/destination:
   - Departure: `KSFO`
   - Route: `JCOBY4 BSR J501 DRK WYNDE3`
   - Destination: `KLAS`
3. Hit COMPUTE
4. Review expanded waypoints and fuel calculations

### Understanding Preferred Routes

Practice with FAA preferred routes to understand route structure:

Example: A typical route for KSFO → KLAS:
```text
KSFO JCOBY4 BSR J501 DRK WYNDE3 KLAS
```

Enter it to see how SIDs, airways, and STARs connect.

## Performance Tips

**Autocomplete is faster than typing full waypoint names:**
- Type `PAY` → select PAYGE from list → hit space
- Faster than typing `PAYGE` manually

**Use recent routes:**
- Re-flying the same route? Click it in RECENT ROUTES
- Faster than re-entering from scratch

**Pre-download database:**
- Go to DATA tab, load database ONCE
- Then all route planning works offline (except winds aloft)

**Save your aircraft settings:**
- Wind correction and fuel settings persist
- You only enter TAS/GPH once, then all routes use it

## What Happens Next?

After hitting COMPUTE, you'll see the full navigation log in the [NAVLOG tab](tab-navlog).

That's where you'll:
- Review each waypoint
- Check magnetic courses
- Verify fuel is sufficient
- Export or print the navlog

Then you can visualize the route in the [MAP tab](tab-map).

---

**Ready to build a route?** Make sure the database is loaded (DATA tab), then start typing!
