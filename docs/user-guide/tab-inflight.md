# IN-FLIGHT Tab

The **IN-FLIGHT** tab provides real-time situational awareness during flight, helping pilots maintain safety by monitoring fuel status, current weather conditions, potential hazards, and nearby airports for diversion.

## Overview

This tab is designed to be used **during active flight** and updates automatically based on your GPS position. It provides critical information at a glance:

- ✅ **Current position and flight status** - GPS coordinates, altitude, ground speed, heading
- ✅ **Fuel status** - Remaining fuel, endurance, range based on current ground speed
- ✅ **Weather at position** - Wind direction/speed, temperature, headwind/crosswind components
- ✅ **Hazard warnings** - Alerts for icing conditions, high winds, strong crosswinds
- ✅ **Nearest airports** - List of towered airports within 50 NM for emergency diversion

## Prerequisites

To use the IN-FLIGHT tab, you need:

1. **GPS enabled** - Your device must have GPS/location services enabled
2. **Flight plan calculated** - Calculate a route in the ROUTE tab with:
   - Wind correction enabled (for weather data)
   - Fuel planning enabled (for fuel status)
3. **In-flight status** - GPS tracking must detect takeoff (ground speed >40 knots)

## Tab Sections

### 1. CURRENT POSITION

Displays your real-time GPS position and flight parameters:

| Field | Description |
|-------|-------------|
| **LAT** | Latitude in degrees/minutes format (e.g., `42°39.12'N`) |
| **LON** | Longitude in degrees/minutes format (e.g., `73°45.67'W`) |
| **ALT** | GPS altitude in feet MSL |
| **GS** | Ground speed in knots |
| **HDG** | True heading in degrees (from GPS track) |
| **TIME** | Current UTC time (Zulu) |

**Note:** Altitude from GPS may be less accurate than barometric altitude. Use for reference only.

### 2. FUEL STATUS

Monitors your fuel consumption and calculates remaining endurance and range:

| Field | Description |
|-------|-------------|
| **REM** | Fuel remaining in gallons (calculated from burn rate and flight time) |
| **ENDUR** | Endurance in hours:minutes (how long you can fly with remaining fuel) |
| **RANGE** | Range in nautical miles (endurance × current ground speed) |
| **USED** | Fuel used so far in gallons |

**Warnings:**
- Fuel remaining **turns orange** when less than 20% of starting fuel
- Range **turns orange** when less than 50 NM

**Example:**
```
REM: 18.5 GAL
ENDUR: 1:51
RANGE: 222 NM (at 120 kt GS)
USED: 13.5 GAL
```

**Note:** Fuel calculations are based on:
- Initial fuel entered in ROUTE tab
- Burn rate (GPH) from flight plan
- Taxi fuel allowance
- Actual flight time since takeoff

### 3. WEATHER AT POSITION

Shows interpolated wind and temperature data for your current position and altitude:

| Field | Description |
|-------|-------------|
| **WIND DIR** | Wind direction (true, where wind is FROM) |
| **WIND SPD** | Wind speed in knots |
| **TEMP** | Temperature in Celsius at your altitude |
| **H-WIND** | Headwind component (+ = headwind, - = tailwind) |
| **X-WIND** | Crosswind component (absolute value) |
| **STATUS** | Data status (FORECAST, NO DATA, ERROR) |

**How it works:**
- Uses winds aloft forecast data from your flight plan
- Interpolates wind for your exact position and altitude
- Calculates headwind/crosswind components based on your heading
- Updates every 5 seconds

**Example:**
```
WIND DIR: 270°
WIND SPD: 18 KT
TEMP: -5°C
H-WIND: +12 KT (headwind)
X-WIND: 14 KT (crosswind from left)
STATUS: FORECAST
```

### 4. POTENTIAL HAZARDS

**Automatically detects and displays warnings for:**

#### High Wind Warning
- **Trigger:** Wind speed exceeds 30 knots
- **Display:** Orange warning box
- **Example:** `WIND SPEED 35 KT exceeds 30 KT`

#### Icing Potential
- **Trigger:** Temperature between 0°C and -20°C
- **Condition:** Assumes visible moisture (clouds)
- **Display:** Orange warning box
- **Example:** `Temperature -8°C in icing range (0 to -20°C)`

::: warning
This is a **potential icing alert only**. Actual icing requires visible moisture (clouds, precipitation). Always check PIREPs and AIRMET/SIGMET for icing conditions.
:::

#### Strong Crosswind
- **Trigger:** Crosswind component exceeds 20 knots
- **Display:** Yellow caution box
- **Example:** `Crosswind component 23 KT`

**Note:** Hazard warnings are based on **forecast data** and your current flight parameters. Always use official weather sources and PIREPs for flight decision-making.

### 5. NEAREST AIRPORTS (DIVERSION)

Lists the **10 nearest towered airports** within 50 NM, sorted by distance:

| Column | Description |
|--------|-------------|
| **AIRPORT** | ICAO/FAA identifier (bold) |
| **DIST** | Distance in nautical miles |
| **BRG** | Bearing from your position (true) |
| **ETE** | Estimated time enroute in minutes (based on current GS) |
| **ELEV** | Field elevation in feet MSL |

**Example:**
```
┌─────────┬─────────┬──────┬─────────┬──────────┐
│ AIRPORT │ DIST    │ BRG  │ ETE     │ ELEV     │
├─────────┼─────────┼──────┼─────────┼──────────┤
│ KALB    │ 12.3 NM │ 045° │ 6 MIN   │ 285 FT   │
│ KSCH    │ 18.7 NM │ 310° │ 9 MIN   │ 210 FT   │
│ KHPN    │ 34.2 NM │ 180° │ 17 MIN  │ 439 FT   │
└─────────┴─────────┴──────┴─────────┴──────────┘
```

**Why towered airports only?**
- Towered airports have:
  - ATC services for emergencies
  - Longer runways
  - Better facilities (fuel, maintenance, medical)
  - Weather reporting (ATIS/AWOS)

**Note:** You can still divert to non-towered airports - use the MAP tab to find all nearby airports.

## Update Frequency

The IN-FLIGHT tab updates:
- **GPS position:** Real-time (1-5 second intervals)
- **Fuel calculations:** Every 5 seconds
- **Weather interpolation:** Every 5 seconds
- **Nearby airports:** Every 5 seconds (recalculated based on new position)

## When to Use This Tab

**During flight:**
- ✅ Monitor fuel remaining and endurance
- ✅ Check current wind conditions
- ✅ Watch for hazard warnings (icing, high winds)
- ✅ Identify diversion airports if needed
- ✅ Verify GPS position and heading

**Pre-flight:**
- ❌ Tab shows placeholder when not in flight
- ❌ Use ROUTE and NAVLOG tabs for planning

## Limitations

::: warning IMPORTANT
The IN-FLIGHT tab is for **situational awareness only** and has these limitations:
:::

- **GPS Altitude:** Less accurate than barometric altitude
- **Wind Data:** Based on forecast, not real-time observations
- **Icing:** Alert is based on temperature only (assumes visible moisture)
- **Coverage:** Wind data limited to US stations
- **Currency:** Winds aloft forecast may be up to 6-24 hours old
- **Internet Required:** Wind data requires internet connection (cached for 3 hours)

**Always use:**
- Official weather sources (1800wxbrief, DUATS, ForeFlight, etc.)
- ATC for real-time weather and traffic
- Aircraft instruments for primary flight data
- PIREPs for actual conditions

## Troubleshooting

### Tab shows placeholder

**Problem:** "GPS and flight plan required" message

**Solutions:**
1. Enable GPS/location services on your device
2. Calculate a route in ROUTE tab with wind/fuel enabled
3. Ensure GPS detects takeoff (ground speed >40 knots)
4. Check MAP tab to verify GPS is working

### No weather data

**Problem:** "NO DATA" status in weather section

**Solutions:**
1. Ensure internet connection is available
2. Calculate route with "WIND CORRECTION & TIME" enabled
3. Check that forecast data was fetched (NAVLOG tab shows wind data)
4. Wind data expires after 3 hours - recalculate route

### No nearby airports shown

**Problem:** "No towered airports within 50 NM"

**Solutions:**
- You may be in a remote area with no towered airports nearby
- Use MAP tab to see all airports (including non-towered)
- Ensure database is loaded (DATA tab)

### Fuel status not showing

**Problem:** Fuel card is hidden

**Solution:**
- Calculate route with "FUEL PLANNING" enabled in ROUTE tab
- Enter usable fuel, taxi fuel, and burn rate

## Privacy & Data

**Location data:**
- GPS position is **never sent to external servers**
- All calculations happen **locally in your browser**
- Wind data is fetched from Aviation Weather (aviationweather.gov) only

**Offline capability:**
- Airport database works offline
- GPS tracking works offline
- Wind data requires internet (cached for 3 hours)

## Related Tabs

- **[ROUTE Tab](tab-route)** - Plan your route with wind/fuel
- **[NAVLOG Tab](tab-navlog)** - View detailed navigation log
- **[MAP Tab](tab-map)** - Visual map with GPS tracking
- **[STATS Tab](tab-stats)** - Post-flight statistics and GPS track export

---

**Next:** [CHKLST Tab](tab-chklst) - Pre-flight and in-flight checklists
