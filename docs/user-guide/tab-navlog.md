# NAVLOG Tab: Your Flight Plan in Detail

After you hit COMPUTE in the ROUTE tab, this is where you end up—a complete navigation log with every waypoint, heading, distance, time, and fuel calculation.

**Think of this as your FAA flight plan form, but better.** It's got everything you'd write on a VFR cross-country navlog, plus real-time winds, automatic fuel tracking, and clickable airport links.

## What You're Looking At

The navlog alternates between two types of rows:

### Waypoint Rows (Cyan Border)

**What it shows:** Information about each point on your route.

For airports:
- Position (lat/lon)
- Field elevation
- Runways (length, surface, identifier)
- Frequencies (tower, ground, ATIS, approach, departure)
- Magnetic variation

For navaids (VOR/NDB):
- Position
- Frequency
- Magnetic variation

For fixes:
- Position
- Type (intersection, reporting point, GPS waypoint)

**Color coding:**
- **Cyan** = Airports (clickable links to AirNav)
- **Magenta** = Navaids (VOR, NDB, DME, TACAN)
- **White** = Fixes (intersections, waypoints)
- **Amber** = Reporting points (ATC callout required)

### Leg Rows (Dark Background)

**What it shows:** How to fly from the previous waypoint to this one.

**Basic mode** (no wind correction):
- **HDG(M)**: Magnetic heading to fly
- **DIST**: Distance in nautical miles

**With wind correction** (recommended):
- **TC**: True course (ground track you want)
- **WCA**: Wind correction angle (how much to crab)
- **TH**: True heading (where to point the nose)
- **MH**: Magnetic heading (**this is what you fly**)
- **GS**: Ground speed (accounting for wind)
- **WIND**: Wind direction/speed/temperature at altitude (e.g., 280°/25KT/-8°C)
- **ETE**: Estimated time en route for this leg
- **CUM DIST/TIME**: Cumulative from departure
- **ETA**: Estimated time of arrival at waypoint

**With fuel planning**:
- **BURN**: Fuel used for this leg
- **CUM BURN**: Total fuel burned so far
- **REM**: Fuel remaining
- **ENDUR**: How long you can fly on remaining fuel

## Route Summary (Top of Page)

Before the waypoint list, you'll see a summary:

```text
TIME GENERATED: 2025-11-15 18:34:22Z
USER ROUTE: KSFO V87 BSR V27 DRK KLAS
EXPANDED ROUTE: KSFO ARCHI WWAVS ALTAM GRTFL FAITH CARME BSR PANOCHE SNS AVE LANDO DRK KLAS
DISTANCE: 391.2 NM
WAYPOINTS: 14
FILED ALTITUDE: 9500 FT
FILED SPEED: 120 KT
TIME: 3H 18M
FUEL STATUS: ✓ SUFFICIENT
FINAL FOB: 9.9 GAL (1.2H)
FUEL RESERVE REQ: 4.3 GAL (30 MIN)
```

**What this tells you:**
- **Time generated**: When the navlog was calculated (UTC timestamp)
- **User route**: What you typed in (with airways)
- **Expanded route**: Full waypoint sequence (airways expanded)
- **Distance**: Total nautical miles
- **Waypoints**: Number of fixes/airports/navaids
- **Filed altitude**: Your planned cruising altitude
- **Filed speed**: Your true airspeed (TAS) used for calculations
- **Time**: Total flight time (if wind correction enabled)
- **Fuel status**: Whether you have sufficient fuel with required reserves

**Quick sanity check:**
- Does the distance match what you expected?
- Do you have enough fuel (remaining > reserve)?
- Does the time seem reasonable for your aircraft?
- Is the filed altitude appropriate for direction of flight?

If any of these look wrong, go back to ROUTE tab and check your settings.

## Hazard Summary

::: tip NEW in v3.2.0
The navlog now includes a consolidated hazard summary at the top of the page.
:::

When weather hazards, terrain issues, or fuel concerns affect your route, a hazard summary appears after the route summary:

```text
═══════════════════════════════════════════════════════════════
HAZARDS SUMMARY
═══════════════════════════════════════════════════════════════

⚠️ TERRAIN: MORA 8500 FT exceeds filed altitude (7500 FT)
   Affected: MISEN(2)-FAITH(4)

⚠️ ICING: G-AIRMET ZULU - Moderate icing FL040-FL120
   Affected: KALB(1)-SYR(3)
   Valid: Until 18:00Z

⚠️ WIND: Strong headwind component (>25 KT)
   Affected: BSR(5)-DRK(8)

⚠️ FUEL: Return trip requires 24.2 GAL (outbound: 18.5 GAL)

═══════════════════════════════════════════════════════════════
```

### Hazard Types

| Type | Description |
|------|-------------|
| **TERRAIN** | Route crosses areas requiring higher minimum altitude |
| **ICING** | G-AIRMET or SIGMET for icing conditions along route |
| **TURBULENCE** | G-AIRMET or SIGMET for turbulence along route |
| **IFR** | G-AIRMET for IFR conditions (low ceilings/visibility) |
| **CONVECTIVE** | Convective SIGMET for thunderstorms |
| **WIND** | Strong headwind or crosswind components |
| **FUEL** | Fuel concerns (insufficient, return trip, reserves) |
| **PIREP** | Recent PIREPs reporting hazardous conditions |

### Time-Based Filtering

Hazards are filtered based on your **departure time** and **ETA at each waypoint**:

- If a hazard expires before you reach the affected segment, it's excluded
- If a hazard starts after you pass the affected segment, it's excluded
- Only hazards that will be active during your transit are shown

**Example:**
- Departure: 14:00Z
- G-AIRMET valid: 12:00Z - 16:00Z
- ETA at affected waypoint: 15:30Z
- **Result: Hazard is shown** (still active at your ETA)

### Affected Waypoint Notation

The "Affected" field uses range notation:

```
KALB(1)-SYR(3)
```

- **KALB(1)** = First waypoint affected (waypoint #1 in your route)
- **SYR(3)** = Last waypoint affected (waypoint #3)
- All legs between these waypoints are potentially affected

## Reading a Navlog Entry

### Example: VFR Cross-Country Leg

**Waypoint row:**
```text
2  KHAF           N37°30.73' W122°30.06'
   APT             ELEV 66 FT | VAR 13.2°W
                   "Half Moon Bay Airport"
```

**Leg row:**
```text
HDG(M) 258°  |  DIST 18.5 NM  |  ETE 9 MIN
```

**Translation:**
- Waypoint #2 is KHAF (Half Moon Bay Airport)
- Located at 37°30.73'N, 122°30.06'W
- Field elevation 66 ft, magnetic variation 13.2° West
- Fly magnetic heading 258° for 18.5 nautical miles
- Should take about 9 minutes (at your planned TAS)

### Example: IFR Leg with Winds

**Waypoint row:**
```text
5  BSR            N36°18.54' W121°52.68'
   VOR 114.8      ELEV 2090 FT | VAR 12.9°W
```

**Leg row:**
```text
TC 141°  WCA +5°  TH 146°  MH 133°  |  GS 125 KT  |  WIND 280/25KT/-8°C
DIST 97.4 NM  |  ETE 0:47  |  CUM 109.6 NM / 0:53  |  ETA 15:47Z
FUEL: 6.7 GAL (9.9 CUM, 28.1 REM, 3:18 ENDUR)
```

**Translation:**
- Waypoint #5 is Big Sur VOR on 114.8 MHz
- You want to track 141° true course over the ground
- Wind is from 280° at 25 knots, temperature -8°C, requiring +5° right crab
- Fly true heading 146° (141° + 5°)
- Apply magnetic variation: fly magnetic heading 133°
- Ground speed will be 125 knots
- Distance is 97.4 NM, taking 47 minutes
- Cumulative: 109.6 NM and 53 minutes from departure
- ETA at BSR: 15:47 Zulu
- This leg burns 6.7 gallons
- Total burned so far: 9.9 gallons
- Fuel remaining: 28.1 gallons
- Endurance: 3 hours 18 minutes on remaining fuel

**What to pay attention to:**
- MH (133°) is what you dial into your heading indicator
- GS (125 kt) for E6B calculations or ETA updates
- Fuel remaining (28.1 gal) to ensure you're above reserve

## Understanding Wind Correction

### The WCA (Wind Correction Angle)

**Positive WCA** means crab right:
```text
TC 090°  WCA +8°  TH 098°
```
Wind is from the left, crab 8° right to track 090°.

**Negative WCA** means crab left:
```text
TC 270°  WCA -6°  TH 264°
```
Wind is from the right, crab 6° left to track 270°.

**Zero WCA** means direct headwind or tailwind:
```text
TC 180°  WCA 0°  TH 180°
```
Wind is aligned with course, no crab needed.

### The Four Headings

IN-FLIGHT shows all four headings for educational purposes, but **you only fly one**:

1. **TC (True Course)**: Ground track you want to maintain
2. **TH (True Heading)**: Where to point the aircraft (TC + WCA)
3. **MH (Magnetic Heading)**: TH corrected for magnetic variation
4. **Compass Heading**: MH corrected for deviation (not shown—do this yourself)

**For flight:** Use MH (magnetic heading). That's what your heading indicator shows.

### Ground Speed Math

Wind affects your ground speed:

**Tailwind scenario:**
- TAS: 120 knots
- Wind: 20 knot tailwind
- GS: ~140 knots (faster!)

**Headwind scenario:**
- TAS: 120 knots
- Wind: 20 knot headwind
- GS: ~100 knots (slower)

**Crosswind scenario:**
- TAS: 120 knots
- Wind: 20 knot direct crosswind
- GS: ~120 knots (minimal effect, but you'll crab)

IN-FLIGHT calculates the exact GS using vector math, not approximations.

## Fuel Planning Explained

### How IN-FLIGHT Calculates Fuel

For each leg:
```text
Leg Fuel Burn = (ETE ÷ 60) × Burn Rate
```

Example:
- ETE: 47 minutes
- Burn rate: 8.5 GPH
- Fuel burn: (47 ÷ 60) × 8.5 = **6.7 gallons**

Cumulative:
```text
Total Burned = Sum of all leg burns
Fuel Remaining = Starting Fuel - Total Burned - Taxi Fuel
Endurance = (Remaining ÷ Burn Rate) × 60
```

### Fuel Status Indicators

**Green (OK):**
```text
FUEL: 3.2 GAL (12.5 CUM, 19.5 REM, 2:18 ENDUR)
```
Remaining fuel is above reserve requirement. Good to go.

**Yellow (Caution):**
```text
FUEL: 5.1 GAL (25.8 CUM, 5.2 REM, 0:37 ENDUR)
```
Cutting it close. Check your math and consider fuel stop.

**Red (Insufficient):**
```text
INSUFFICIENT FUEL - RESERVE VIOLATED
```
You won't make it with required reserves. Options:
1. Add fuel stop
2. Reduce weight/distance
3. Increase fuel capacity (wrong aircraft?)
4. Check your burn rate (too high?)

### Return Fuel Calculation

::: tip NEW in v3.2.0
IN-FLIGHT now calculates fuel requirements for a return trip.
:::

When wind conditions differ significantly between outbound and return legs, the return trip may require more fuel than the outbound:

**Example scenario:**
- Outbound: 30 KT tailwind → Ground speed 150 KT
- Return: 30 KT headwind → Ground speed 90 KT
- Same distance, but return takes 67% longer!

**Return fuel display:**
```text
OUTBOUND FUEL: 18.5 GAL
RETURN FUEL:   24.2 GAL (+30%)
```

**Why this matters:**
- If you plan to return same day, ensure fuel for **both** legs
- Strong headwinds on return may require fuel stop
- Consider this for round-robin training flights

**Fuel hazard warning:**
When return fuel significantly exceeds outbound fuel, a hazard warning appears in the navlog summary:
```text
⚠️ RETURN FUEL: 24.2 GAL exceeds outbound (18.5 GAL)
```

### Reserve Fuel Rules

IN-FLIGHT enforces FAA minimums:

**VFR Day (FAR 91.151):**
- 30 minutes reserve at cruise burn rate
- Example: 8.5 GPH × 0.5 hr = **4.25 gal reserve**

**VFR Night / IFR (FAR 91.167):**
- 45 minutes reserve at cruise burn rate
- Example: 8.5 GPH × 0.75 hr = **6.375 gal reserve**

**Your fuel remaining at destination must exceed this.** Otherwise IN-FLIGHT flags it red.

## Interactive Features

### Clickable Airport Links

Any **cyan airport code** is a clickable link to AirNav.com.

**Why this is useful:**
- Check current METAR/TAF
- Review airport diagram
- Find FBO for fuel
- Get runway information
- Look up frequencies (if navlog is unclear)

**Example:**
Click `KSFO` → Opens `https://www.airnav.com/airport/KSFO` in new tab

You don't lose your navlog—it opens in a new tab.

### Wind Altitude Table

When wind correction is enabled, you'll see a wind altitude table above the navlog showing winds and temperatures at different altitudes for **6 sample points** along your route (every 20% of distance):

```text
WIND ALTITUDE TABLE
FILED ALTITUDE: 9500 FT

LEG            7.5K FT         8.5K FT         9.5K FT         10.5K FT        11.5K FT
KSFO→BSR       280°/15KT/+4°C  285°/20KT/+1°C  285°/25KT/-2°C  290°/28KT/-5°C  290°/30KT/-8°C
BSR→DRK        285°/25KT/-2°C  290°/28KT/-5°C  290°/30KT/-8°C  295°/32KT/-11°C 295°/33KT/-14°C
DRK→KLAS       290°/20KT/-5°C  295°/22KT/-8°C  295°/20KT/-11°C 300°/18KT/-14°C 300°/15KT/-17°C
```

The filed altitude column (9.5K FT) is highlighted in green.

**What this tells you:**
- Wind is generally from 280-300° (westerly)
- Wind strengthens mid-route (30-33 kt at BSR/DRK area)
- Temperature drops with altitude and distance (standard atmosphere)
- You can compare different altitudes to find favorable winds or comfortable temperatures

**Format:** Each cell shows `direction°/speed KT/temperature°C`. Negative temperatures are shown with minus sign (e.g., `-8°C`), positive with plus sign (e.g., `+4°C`).

**Cross-check:** Compare this with your weather briefing. If winds aloft forecast changed, recalculate the route.

## Multi-Altitude Wind Interpolation

**Advanced feature:** IN-FLIGHT interpolates winds if you're climbing or descending.

**Example scenario:**
- Depart KSFO at 3,000 ft
- Climb to 9,500 ft over 50nm
- Cruise at 9,500 ft
- Descend to pattern altitude at KLAS

**How IN-FLIGHT handles this:**
1. Looks up wind at 3,000 ft (departure altitude)
2. Looks up wind at 9,500 ft (cruise altitude)
3. **Blends the two** for climb segments (weighted average by altitude)
4. Uses 9,500 ft wind for cruise legs
5. Blends 9,500 ft and pattern altitude for descent

**Why this matters:**
- More accurate ground speeds during climb/descent
- Better fuel burn estimates
- More realistic ETAs

**To use this feature:**
Enter winds manually at multiple altitudes in the ROUTE tab. IN-FLIGHT automatically interpolates.

## Export & Import

### Export Your Navlog

**Use cases:**
- Backup before flight
- Share with copilot / flight instructor
- Keep records for logbook
- Compare planned vs. actual performance later

**To export:**
1. Click **EXPORT** button at top of NAVLOG tab
2. File downloads: `navlog_KSFO_KLAS_20251115.json`
3. Save to cloud / email to yourself

**What's included:**
- Full route (all waypoints)
- All calculations (headings, distances, fuel, time)
- Wind data (snapshot from when you calculated)
- Aircraft settings (TAS, burn rate, etc.)

### Import a Saved Navlog

**Use cases:**
- Re-fly a common route
- Load a backup from earlier
- Review a flight plan you made last week

**To import:**
1. Click **IMPORT** button
2. Select `.json` navlog file
3. Route loads instantly with all calculations

**Important:** Wind data is historical (from when you exported). If you're flying days later, recalculate with current winds.

## Using This In-Flight

### Pre-Flight Review

Before you depart:

1. ✅ **Scan entire navlog** - Any waypoints look weird?
2. ✅ **Check total distance** - Match what you expected?
3. ✅ **Verify fuel** - Remaining > reserve?
4. ✅ **Note departure frequency** - Tower/Ground at first airport
5. ✅ **Note arrival frequency** - ATIS/Tower at destination
6. ✅ **First heading** - What MH to fly after takeoff?
7. ✅ **Export backup** - Save as JSON in case iPad dies

### In-Flight Use

**For each leg:**

1. **Reference MH (Magnetic Heading)** - Dial this into heading indicator
2. **Monitor ETE vs. actual time** - Am I faster/slower than planned?
3. **Check fuel remaining** - Compare planned vs. fuel gauge
4. **Use MAP tab** - Real-time GPS shows position on route
5. **Update ETAs** - If GS is different, recalculate arrival time

**If you're behind schedule:**
- Note actual GS (from GPS or calculation)
- Adjust remaining ETAs mentally: `(Remaining NM ÷ Actual GS) × 60`

**If fuel burn is higher:**
- Check mixture (too rich?)
- Check power setting (climbing?)
- Consider fuel stop if trend continues

### Post-Flight Analysis

After landing:

1. **Export GPS track** (DATA tab) for actual path flown
2. **Compare planned vs. actual times** - Were winds accurate?
3. **Compare planned vs. actual fuel** - Is your burn rate correct?
4. **Note discrepancies** - Update aircraft settings for next flight

This makes future planning more accurate.

## Common Issues

### "Navlog is empty"

**Cause:** Route hasn't been calculated yet.

**Fix:** Go to ROUTE tab, enter route, click COMPUTE.

### "No wind data showing"

**Cause:** Wind correction not enabled, or internet unavailable.

**Fix:**
1. Go to ROUTE tab, enable "Wind Correction & Time"
2. Check internet connection
3. Try different forecast period
4. Or manually enter winds (see below)

### "Fuel shows N/A"

**Cause:** Fuel planning not enabled, or wind correction disabled.

**Fix:**
1. Wind correction must be enabled first (fuel needs time estimates)
2. Go to ROUTE tab, enable "Fuel Planning"
3. Enter fuel capacity, burn rate, reserve
4. Click COMPUTE again

### "Airport link doesn't work"

**Cause:** Only airports are clickable (cyan). Navaids/fixes aren't linked.

**Fix:** If you need navaid info, search it manually on SkyVector or your charts.

## Manual Wind Entry (No Internet)

If you're offline or NOAA winds are unavailable, you can manually enter winds:

**Method 1: Single altitude (simple)**
1. Note wind from weather briefing (e.g., "290° at 25 knots at 9,500 ft")
2. IN-FLIGHT uses this for all legs at that altitude

**Method 2: Multiple altitudes (better)**
1. Enter winds at 3,000 / 6,000 / 9,000 / 12,000 ft
2. IN-FLIGHT interpolates for climb/descent legs
3. More accurate fuel/time estimates

**Where to enter:** In the ROUTE tab wind section, there's a manual entry option.

## Printing the Navlog

IN-FLIGHT automatically switches to a **printer-friendly layout** when you print:

**What happens automatically:**
- ✅ Dark theme → High-contrast black-on-white
- ✅ Colors optimized for both color and grayscale printers
- ✅ Buttons and UI elements hidden
- ✅ Professional table formatting with clear borders
- ✅ Page breaks optimized to avoid splitting important sections

**To print:**
1. Press **Ctrl+P** (Windows/Linux) or **Cmd+P** (Mac)
2. Review print preview (should show clean black-on-white layout)
3. Choose landscape or portrait orientation (landscape recommended for wide tables)
4. Print to physical printer or save as PDF

**What gets printed:**
IN-FLIGHT prints **only the currently active tab**. When you're on the NAVLOG tab and press Ctrl+P:
- ✅ Complete navigation log table
- ✅ All waypoint and leg data
- ✅ Wind corrections and fuel calculations
- ❌ Tab navigation (hidden)
- ❌ Buttons and UI (hidden)

**To print other content:** Click the desired tab (STATS, CHKLST, etc.) first, then print.

**Color vs. Grayscale:**
- **Color printers**: Waypoints shown in dark blue, magenta, orange (professional colors)
- **B&W printers**: Colors convert to different gray shades for distinction
- **Both work great** - all text remains readable

**For VFR cross-country:**
1. Print navlog to PDF or paper
2. Landscape orientation works best for wide tables
3. Bring printout as backup to iPad/tablet
4. Mark key frequencies with highlighter after printing

**For backup reference:**
Having a paper copy can be useful:
1. Print navlog as backup to primary EFB
2. Highlight critical frequencies
3. Note any special procedures
4. Fold and keep in kneeboard pocket

**Pro tip:** Save as PDF for digital archival - no ink needed, easy to email or store.

For more printing details, see [Printing FAQ](faq.md#printing-questions).

## Tips for Professional Use

**Cross-check with other tools:**
- Compare distances with ForeFlight / Garmin Pilot
- Verify fuel with POH performance charts
- Check headings with manual E6B (good practice)

**Update before departure:**
- Winds aloft change—recalculate if >2 hours before flight
- NOTAMs may affect routing (IN-FLIGHT doesn't include NOTAMs)
- TFRs may require rerouting

**Monitor in-flight:**
- Actual winds often differ from forecast
- Update mental ETAs based on actual GS
- If significantly off, consider diversion or fuel stop

**Keep records:**
- Export navlog before flight (flight plan record)
- Export GPS track after flight (logbook evidence)
- Compare planned vs. actual for future planning

## What's Next?

Now that you've reviewed your navlog, it's time to see it visually and track your flight:

- **[MAP Tab](tab-map)** - GPS moving map, waypoint advancement, diversions
- **[DATA Tab](tab-data)** - Export flight tracks, manage database
- **[STATS Tab](tab-stats)** - Real-time fuel and flight time monitoring

---

**Navlog looks good?** Head to [MAP tab](tab-map) to see the route on a moving map!
