# NAVLOG Tab

The NAVLOG tab displays your complete navigation log with detailed waypoint and leg information.

## Overview

After calculating a route, the navigation log provides a comprehensive, leg-by-leg breakdown of your flight plan including:
- Waypoint details (position, elevation, frequencies, runways)
- Leg information (headings, distances, times)
- Wind corrections (if enabled)
- Fuel calculations (if enabled)
- Cumulative totals

## Navigation Log Structure

The navlog alternates between two types of rows:

### 1. Waypoint Rows (Cyan border)

Shows information about each waypoint on your route.

**Displayed Information:**

| Column | Content |
|--------|---------|
| **#** | Waypoint sequence number |
| **Code** | Waypoint identifier (color-coded by type) |
| **Type** | AIRPORT, VOR, NDB, FIX, REPORTING POINT |
| **Position** | Latitude/Longitude |
| **Elevation** | Field elevation (airports) |
| **Mag Var** | Magnetic variation at waypoint |
| **Runways** | Available runways with length/surface (airports) |
| **Frequencies** | Tower, Ground, ATIS, etc. (airports and navaids) |

**Waypoint Color Coding:**
- **Cyan** = Airports
- **Magenta** = Navaids (VOR, NDB, DME, TACAN)
- **White** = Fixes
- **Amber** = Reporting Points

### 2. Leg Rows (Dark background)

Shows navigation information between waypoints.

**Basic Leg Information:**

| Field | Description |
|-------|-------------|
| **HDG(M)** | Magnetic heading to fly |
| **DIST** | Distance in nautical miles |
| **ETE** | Estimated time enroute (if wind enabled) |

**With Wind Correction Enabled:**

| Field | Description |
|-------|-------------|
| **TC** | True course (ground track) |
| **WCA** | Wind correction angle |
| **TH** | True heading (TC + WCA) |
| **MH** | Magnetic heading (TH - Var) |
| **GS** | Ground speed |
| **WIND** | Wind direction/speed at altitude |
| **CUM DIST** | Cumulative distance from departure |
| **CUM TIME** | Cumulative time from departure |
| **ETA** | Estimated time of arrival at waypoint |

**With Fuel Planning Enabled:**

| Field | Description |
|-------|-------------|
| **BURN** | Fuel burned for this leg |
| **CUM BURN** | Cumulative fuel burned |
| **REM** | Fuel remaining |
| **ENDUR** | Flight time possible with remaining fuel |

## Route Summary

At the top of the navlog, you'll see a summary:

```
ROUTE: KALB → KORD
WAYPOINTS: 8
TOTAL DISTANCE: 467.3 NM
TOTAL TIME: 4:12
TOTAL FUEL: 24.5 GAL (7.5 GAL REMAINING)
```

**Summary Includes:**
- Departure → Destination
- Number of waypoints
- Total distance
- Total flight time (if wind enabled)
- Fuel totals (if fuel enabled)

## Interactive Features

### Clickable Airport Links

Airport waypoint codes are **clickable links** that open detailed airport information on AirNav.com.

**To use:**
1. Click any cyan (airport) waypoint code
2. Opens in new tab: `https://www.airnav.com/airport/KALB`

**AirNav provides:**
- Current charts and diagrams
- METAR/TAF weather
- FBO information
- Fuel prices
- Runway details
- Frequencies and procedures

> 💡 **Tip**: Links open in new tab so you don't lose your navlog

### Wind Altitude Table

When wind correction is enabled, a wind summary table appears above the navlog:

```
FORECAST: 6-HOUR | ALTITUDE: 5500 FT

Waypoint    Wind Dir    Wind Speed    Temperature
KALB        270°        12 KT         -2°C
PAYGE       265°        15 KT         -3°C
FNT         260°        18 KT         -4°C
...
```

Shows winds aloft at each waypoint at your cruise altitude.

## Export & Import

### Export Navlog

Save your navigation log as a JSON file for later use or sharing.

**To export:**
1. Click **EXPORT** button
2. File downloads: `navlog_KALB_KORD_20251115.json`
3. Contains complete route data, options, and calculations

**Use cases:**
- Backup flight plans
- Share with other pilots
- Reference for future flights
- Flight planning records

### Import Navlog

Load a previously exported navigation log.

**To import:**
1. Click **IMPORT** button
2. Select `.json` navlog file
3. Route automatically loads and displays

**What gets restored:**
- Full route (departure, route, destination)
- All calculation results
- Wind data (if it was included)
- Fuel calculations (if they were included)

> ⚠️ **Note**: Wind data is historical from when navlog was created, not current conditions.

## Reading the Navlog

### Example Waypoint Row

```
1  KALB            N42°44.82' W073°48.18'
   AIRPORT         ELEV 285 FT | VAR 14.2°W
                   RWY 01/19 7200FT ASPHALT, 10/28 5000FT ASPHALT
                   TWR 120.100 GND 121.900 ATIS 135.000
```

**Interpretation:**
- Waypoint #1
- Albany International Airport
- Position: 42°44.82'N, 073°48.18'W
- Elevation: 285 feet MSL
- Magnetic variation: 14.2° West
- Two runways: 01/19 (7200 ft) and 10/28 (5000 ft), both asphalt
- Tower: 120.100, Ground: 121.900, ATIS: 135.000

### Example Leg Row (Simple)

```
HDG(M) 268°  |  DIST 45.2 NM  |  ETE 23 MIN
```

**Interpretation:**
- Fly magnetic heading 268°
- Distance to next waypoint: 45.2 NM
- Estimated time enroute: 23 minutes

### Example Leg Row (With Wind)

```
TC 272°  WCA +4°  TH 276°  MH 268°  |  GS 118 KT  |  WIND 310/15
DIST 45.2 NM  |  ETE 23 MIN  |  CUM 45.2 NM / 0:23  |  ETA 14:23Z
```

**Interpretation:**
- True course (ground track): 272°
- Wind correction angle: +4° (crab right)
- True heading: 276° (TC + WCA)
- Magnetic heading: 268° (TH - variation)
- Ground speed: 118 knots
- Wind: from 310° at 15 knots
- Distance: 45.2 NM
- ETE: 23 minutes
- Cumulative: 45.2 NM, 23 minutes from departure
- ETA: 14:23 Zulu time

### Example Leg Row (With Fuel)

```
TC 272°  WCA +4°  TH 276°  MH 268°  |  GS 118 KT
DIST 45.2 NM  |  ETE 23 MIN  |  FUEL: 3.8 GAL (27.8 CUM, 3.2 REM, 0:19 ENDUR)
```

**Interpretation:**
- (Same navigation data as above)
- Fuel burn: 3.8 gallons for this leg
- Cumulative: 27.8 gallons burned so far
- Remaining: 3.2 gallons (⚠️ LOW!)
- Endurance: 19 minutes of flight time remaining

> ⚠️ **Fuel Warning**: The navlog will highlight low fuel situations

## Understanding Wind Corrections

### Wind Correction Angle (WCA)

The WCA is the number of degrees to crab into the wind.

**Positive WCA**: Crab right (wind from left)
```
WCA +8°  means fly 8° right of course
```

**Negative WCA**: Crab left (wind from right)
```
WCA -6°  means fly 6° left of course
```

**Zero WCA**: Wind is aligned with course
```
WCA 0°   means direct headwind or tailwind
```

### Heading vs. Course

**True Course (TC)**:
- Your desired ground track
- Where you want to go

**True Heading (TH)**:
- Where you point the airplane
- TC + WCA

**Magnetic Heading (MH)**:
- What you fly using magnetic compass
- TH - Magnetic Variation
- **This is the number you use!**

### Ground Speed Calculation

Ground speed is affected by headwind/tailwind component:

**Tailwind**: GS > TAS
```
TAS 120 KT  +  Tailwind 15 KT  =  GS 135 KT
```

**Headwind**: GS < TAS
```
TAS 120 KT  -  Headwind 15 KT  =  GS 105 KT
```

**Crosswind**: GS ≈ TAS (minimal effect)

## Fuel Planning Interpretation

### Fuel Status

The navlog tracks fuel burn and remaining fuel at each waypoint.

**Green Zone** (Sufficient fuel):
```
FUEL: 3.2 GAL (18.5 CUM, 12.5 REM, 1:15 ENDUR)
```
- More than reserve requirement
- Safe to continue

**Yellow Zone** (Approaching reserve):
```
FUEL: 4.1 GAL (26.8 CUM, 4.2 REM, 0:25 ENDUR)
```
- Within 1-2 hours of reserve
- Monitor closely

**Red Zone** (Below reserve):
```
⚠️ INSUFFICIENT FUEL - RESERVE VIOLATED
```
- Not enough fuel for this route
- Must reduce distance, add fuel stop, or increase capacity

### Reserve Requirements

**VFR Day**: 30 minutes reserve
**VFR Night / IFR**: 45 minutes reserve

The navlog ensures you arrive at destination with required reserve, accounting for taxi fuel.

### Fuel Calculation Formula

```
Takeoff Fuel = Usable Fuel - Taxi Fuel
Total Burn = (Flight Time ÷ 60) × Burn Rate
Remaining = Takeoff Fuel - Total Burn
Required Reserve = (Reserve Time ÷ 60) × Burn Rate
```

## Using the Navlog In-Flight

### Pre-Flight

1. ✅ Review entire route
2. ✅ Note airport frequencies
3. ✅ Check fuel requirements
4. ✅ Verify headings and distances
5. ✅ Export for backup

### In-Flight

1. Follow leg-by-leg headings (MH column)
2. Monitor ETE vs. actual time
3. Check fuel remaining at each waypoint
4. Use MAP tab for real-time navigation
5. Reference frequencies for ATC communication

### Post-Flight

1. Compare planned vs. actual times
2. Check fuel burn accuracy
3. Export track from DATA tab
4. Review for future planning improvements

## Printing & Sharing

### Printing the Navlog

**Browser Print:**
1. Use browser's Print function (Ctrl+P / Cmd+P)
2. Select "Print to PDF" to save
3. Adjust page layout for best fit

**Mobile:**
- Export as JSON instead
- View on larger screen for printing

### Sharing with Crew

**Export Method:**
1. Export navlog as JSON
2. Share file via email/cloud
3. Recipient imports in their InFlight

**Manual Method:**
- Screenshot or photo of screen
- Copy route string from ROUTE tab

## Troubleshooting

### Navlog Not Displaying

**Problem**: NAVLOG tab is empty

**Solutions:**
1. Return to ROUTE tab
2. Click CALCULATE button
3. Ensure database is loaded
4. Check for route errors

### Wind Data Missing

**Problem**: No WCA or GS columns

**Solutions:**
1. Wind correction not enabled in ROUTE tab
2. Internet required for wind data
3. Try different forecast period
4. NOAA service may be unavailable

### Fuel Shows "N/A"

**Problem**: Fuel columns empty

**Solutions:**
1. Fuel planning not enabled
2. Wind correction required first (for time calculations)
3. Check fuel settings in ROUTE tab

### Airport Links Not Working

**Problem**: Can't click airport codes

**Solutions:**
1. Only airport waypoints are clickable (cyan)
2. Check internet connection for AirNav
3. Try right-click → Open in new tab

## Best Practices

1. **Review before filing** - Check all headings and distances
2. **Cross-reference charts** - Verify procedures and airways
3. **Check NOTAMs** - InFlight doesn't include NOTAMs or TFRs
4. **Update winds** - Recalculate closer to departure for current winds
5. **Export backup** - Save navlog before flight
6. **Monitor fuel closely** - Actual burn may differ from plan
7. **Use MAP tab** - Moving map provides real-time guidance

## Next Steps

- **[View on Map](tab-map.md)** - See your route visualized with GPS tracking
- **[Flight Statistics](tab-stats.md)** - Monitor fuel and flight time
- **[Wind Correction Details](features/wind-correction.md)** - Deep dive into wind calculations
- **[Fuel Planning Guide](features/fuel-planning.md)** - Understand fuel requirements

---

**Navlog ready?** Head to the [MAP](tab-map.md) tab to track your flight!
