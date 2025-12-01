# WX Tab (Weather)

The **WX** tab provides comprehensive weather information for flight planning, including METARs, TAFs, PIREPs, SIGMETs, and G-AIRMETs.

## Overview

The Weather tab helps pilots:
- Check current conditions (METAR) and forecasts (TAF) at airports
- Review pilot reports (PIREPs) for real conditions
- Monitor significant weather hazards (SIGMETs)
- Track graphical AIRMETs (G-AIRMETs) for IFR, icing, turbulence, and mountain obscuration

## Getting Weather

### Airport Search

1. Enter a **4-letter ICAO code** (e.g., `KJFK`, `KLAX`, `KSFO`)
2. Click **SEARCH** or press **Enter**

Weather data is fetched from Aviation Weather Center (aviationweather.gov) and includes:
- Current METAR observation
- TAF forecast (if available)
- PIREPs within 100 NM (last 6 hours)
- Active SIGMETs affecting the area
- Active G-AIRMETs affecting the area

### Route Quick Select

When you have a calculated route, a quick-select bar appears showing all airports along your route:

```
ROUTE: [KSFO] [KLAS] [KPHX]
```

- **Green button** = Departure airport
- **Blue button** = Destination airport
- Gray buttons = Intermediate airports

Click any button to instantly load weather for that airport.

## Weather Sub-Tabs

### METAR (Current Conditions)

Displays the current surface observation:

| Field | Description |
|-------|-------------|
| **Flight Category** | VFR (green), MVFR (blue), IFR (red), LIFR (magenta) |
| **OBS TIME** | Observation timestamp (UTC) |
| **WIND** | Direction, speed, gusts (e.g., `270° 15KT G25KT`) |
| **VISIBILITY** | Statute miles (e.g., `10+ SM`) |
| **TEMPERATURE** | Current temp in °C and °F |
| **DEWPOINT** | Dewpoint in °C and °F |
| **TEMP/DEWPT SPREAD** | Difference (important for fog/icing potential) |
| **ALTIMETER** | Pressure in inches Hg and millibars |
| **SKY CONDITION** | Cloud layers (e.g., `Scattered at 2500 ft, Broken at 5000 ft`) |
| **PRESENT WEATHER** | Decoded weather phenomena (rain, snow, fog, etc.) |

**Flight Category Criteria:**

| Category | Ceiling | Visibility |
|----------|---------|------------|
| **VFR** | > 3,000 ft | > 5 SM |
| **MVFR** | 1,000-3,000 ft | 3-5 SM |
| **IFR** | 500-1,000 ft | 1-3 SM |
| **LIFR** | < 500 ft | < 1 SM |

The **RAW METAR** section shows the original encoded observation for reference.

### TAF (Forecast)

Displays the Terminal Aerodrome Forecast in a table format:

| Column | Description |
|--------|-------------|
| **TYPE** | Change type: FM (from), TEMPO, BECMG, PROB |
| **TIME** | Valid time period |
| **WIND** | Forecast wind direction and speed |
| **VIS** | Forecast visibility |
| **WX** | Weather phenomena |
| **SKY** | Cloud coverage |
| **CAT** | Flight category (color-coded) |

**Change Types:**
- **FM** = From (permanent change at this time)
- **TEMPO** = Temporary conditions (< 1 hour)
- **BECMG** = Becoming (gradual transition)
- **PROB30/40** = Probability percentage

The **RAW TAF** section shows the original encoded forecast.

### PIREP (Pilot Reports)

Displays recent pilot reports within 100 NM, sorted by time (newest first):

**Information shown:**
- **Time** = Report time and relative age (e.g., `2h ago`)
- **Aircraft type** = Reporting aircraft (e.g., `C172`, `B738`)
- **Flight level** = Altitude of report (e.g., `FL230`)
- **Location** = Lat/lon coordinates
- **Temperature** = Observed temperature at altitude
- **Icing** = Type and intensity (e.g., `MOD RIME`)
- **Turbulence** = Type, intensity, frequency (e.g., `LGT CHOP`)
- **Sky conditions** = Observed cloud layers
- **Wind** = Observed wind at altitude

**PIREP Types:**
- **UA** = Routine pilot report
- **UUA** = Urgent pilot report (severe conditions)

::: warning
PIREPs are actual observed conditions, not forecasts. They're often the best source of real icing and turbulence information.
:::

### SIGMET (Significant Meteorological Info)

Displays active SIGMETs affecting the search area:

| Column | Description |
|--------|-------------|
| **TYPE** | SIGMET or AIRMET type |
| **HAZARD** | Hazard type (convection, turbulence, icing, etc.) |
| **ALT** | Altitude range affected |
| **AFFECTS** | Route waypoints in the hazard area (if route calculated) |
| **VALID** | Valid time period (Zulu) |
| **VIEW** | Click `MAP →` to view on map |

**SIGMET Types:**
- **Convective SIGMET** = Thunderstorms, severe convection
- **Non-convective SIGMET** = Severe turbulence, icing, volcanic ash, sandstorm

**Clicking a row** switches to the MAP tab with the hazard polygon displayed.

### G-AIRMET (Graphical AIRMET)

Displays active G-AIRMETs in a table format:

| Column | Description |
|--------|-------------|
| **TYPE** | Product type (SIERRA, TANGO, ZULU) |
| **HAZARD** | Hazard description |
| **AFFECTS** | Route waypoints affected (if route calculated) |
| **VALID** | Valid time and relative time |
| **VIEW** | Click `MAP →` to view on map |

**G-AIRMET Products:**

| Product | Color | Hazards |
|---------|-------|---------|
| **SIERRA** | Blue | IFR conditions, mountain obscuration |
| **TANGO** | Orange | Turbulence, low-level wind shear |
| **ZULU** | Cyan | Icing, freezing level |

**Clicking a row:**
1. Switches to MAP tab
2. Enables the appropriate weather overlay
3. Centers the map on the hazard polygon

## Route Integration

When you have a calculated route, the Weather tab provides enhanced features:

### Affected Waypoints

SIGMETs and G-AIRMETs show which of your route waypoints are affected:

```
AFFECTS: KALB(1)-SYR(3)
```

This notation means:
- Hazard affects waypoints 1 through 3
- First affected: KALB (waypoint 1)
- Last affected: SYR (waypoint 3)

### Time-Based Filtering

::: tip NEW in v3.2.0
When a departure time is set, hazard analysis considers your ETA at each waypoint.
:::

The WX tab shows **geographic overlap** (all hazards that intersect your route). The NAVLOG tab's HAZARDS summary provides **time-filtered** analysis—only showing hazards that will be active when you actually arrive at affected waypoints.

**Example:**
- G-AIRMET valid until 18:00Z
- Your ETA at affected segment: 19:30Z
- WX tab: Shows hazard (geographic overlap)
- NAVLOG hazards: Filters out (expired by your ETA)

## Weather Hazard Colors

Hazards are color-coded by type:

| Hazard | Color |
|--------|-------|
| Convection/Thunderstorms | Red |
| Icing | Cyan |
| Turbulence | Orange |
| IFR/Low Visibility | Blue |
| Mountain Obscuration | Purple |
| Freezing Level | Light Cyan |
| Wind Shear | Yellow |

## Viewing Hazards on Map

To view any SIGMET or G-AIRMET on the map:

1. Click the hazard row in the WX tab
2. Map tab opens automatically
3. Appropriate weather overlay is enabled
4. Map centers on the hazard polygon

**Weather overlay buttons** on the MAP tab:
- **SIG** = SIGMETs
- **ICE** = G-AIRMET Icing
- **TRB** = G-AIRMET Turbulence
- **IFR** = G-AIRMET IFR conditions
- **MTN** = G-AIRMET Mountain Obscuration
- **FZL** = G-AIRMET Freezing Level

## Route Weather Display

On the ROUTE tab, when you enter departure and destination airports, weather summaries appear automatically:

```
KSFO  [VFR] 270°/15KT • 10+SM • 15°C • FEW250
```

This shows:
- Flight category badge
- Wind direction/speed
- Visibility
- Temperature
- Cloud coverage

## Offline Behavior

::: warning
Weather data requires an internet connection. The WX tab will show an error if you're offline.
:::

Weather data is fetched live from Aviation Weather Center and cached briefly (METARs: 5 minutes past the hour, TAFs: until validity expires).

## Best Practices

1. **Check weather before computing route** - Weather at departure/destination appears automatically
2. **Review all sub-tabs** - METARs for current, TAFs for forecast, PIREPs for real conditions
3. **Pay attention to PIREPs** - Actual reported icing/turbulence is more reliable than forecasts
4. **Use time-based filtering** - Set departure time to see relevant hazards for your ETA
5. **Cross-reference with official sources** - IN-FLIGHT weather is for planning, not for filing

## Related Tabs

- **[MAP Tab](tab-map)** - View weather overlays on the map
- **[NAVLOG Tab](tab-navlog)** - See hazard summary for your route
- **[ROUTE Tab](tab-route)** - Set departure time for ETA-based filtering
- **[IN-FLIGHT Tab](tab-inflight)** - Real-time weather at your position

---

**Next:** [CHARTS Tab](tab-charts) - View instrument approach procedures and airport diagrams
