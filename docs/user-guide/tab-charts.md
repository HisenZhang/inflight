# CHARTS Tab

The **CHARTS** tab provides quick access to FAA Terminal Procedures Publication (TPP) charts, including airport diagrams, instrument approach procedures, departure procedures, and arrival procedures.

## Overview

The Charts tab helps pilots:
- View airport diagrams for taxi planning
- Access instrument approach procedures (ILS, RNAV, VOR, NDB, LOC)
- Review departure procedures (DPs, ODPs, SIDs)
- Check standard arrivals (STARs)
- Access takeoff/alternate minimums

## Searching for Charts

### Direct Search

1. Enter an airport code (ICAO or IATA format)
   - ICAO: `KJFK`, `KLAX`, `KSFO`
   - IATA: `JFK`, `LAX`, `SFO`
2. Click **SEARCH** or press **Enter**

### Autocomplete

As you type, autocomplete suggestions appear:
- **Airport code** in bold
- **Airport name**
- **Location** (city, state)

Use **arrow keys** to navigate, **Enter** to select, **Escape** to close.

### Route Quick Select

When you have a calculated route, a quick-select bar appears:

```
ROUTE: [KSFO] [KLAS] [KPHX]
```

- **Green button** = Departure airport
- **Blue button** = Destination airport
- Gray buttons = Intermediate airports

Click any button to instantly load charts for that airport.

### Recent History

Below the search box, your **10 most recently viewed airports** are shown:

```
RECENT: KJFK  KLGA  KEWR  KTEB
```

Click any code to reload charts for that airport.

## Chart Categories

Charts are organized into logical groups:

### Airport Diagrams

Shows taxi diagrams with:
- Runways and taxiways
- Hot spots (hazardous areas)
- Terminal locations
- Ground control frequencies

### Instrument Approaches

Organized by approach type:

| Type | Description |
|------|-------------|
| **ILS** | Instrument Landing System (precision) |
| **RNAV (GPS)** | Area navigation with GPS |
| **GPS** | GPS-only approaches |
| **VOR** | VOR-based approaches |
| **NDB** | NDB-based approaches |
| **LOC** | Localizer-only approaches |
| **OTHER** | Visual, circling, etc. |

Each approach shows:
- **Runway** highlighted (e.g., `RWY 04L`)
- **Approach type** color-coded
- Full procedure name

### Departure Procedures

Includes:
- **DPs** = Standard Instrument Departures (SIDs)
- **ODPs** = Obstacle Departure Procedures

### Standard Arrivals (STARs)

Terminal arrival routes connecting enroute structure to approaches.

### Takeoff/Alternate Minimums

Part 91 vs Part 121/135 minimums and special procedures.

### Hot Spots

Airport surface hot spots requiring extra vigilance during taxi operations.

## Using Charts

### Viewing a Chart

Click any chart button to open the PDF in a new browser tab.

**Chart PDFs are hosted by FAA** via the Digital Terminal Procedures Publication (d-TPP).

### Chart Information

Each airport shows:
- **Airport code and name**
- **TPP Cycle** - Current publication cycle
- **Total Charts** - Number of available charts

```
KSFO - San Francisco International
TPP Cycle: 2411 (2024-11-14)
Total Charts: 47
```

### Runway Highlighting

Runway numbers are highlighted in charts listings:

```
ILS RWY 28R    ← 28R is highlighted
RNAV (GPS) RWY 01L
VOR RWY 28R
```

## Chart Data Source

Charts come from the FAA's **NASR (National Airspace System Resources)** database:

- Updated every 28 days (AIRAC cycle)
- Covers US airports with published procedures
- Includes both Part 91 and Part 97 procedures

::: warning IMPORTANT
Always verify chart currency before use. Check the amendment date on the chart itself against current NOTAMs.
:::

## Availability

### Charts Available For

- US airports with published instrument procedures
- Major airports with multiple approaches
- Smaller airports with at least one published approach

### Charts NOT Available For

- International airports (non-US)
- VFR-only airports (no instrument procedures)
- Private airports without published procedures

When no charts are available:

```
KXYZ - Small Municipal Airport

No charts available for this airport.

Charts are only available for US airports with published
instrument procedures. This airport may be international
(non-US), may not have instrument approaches, or may be
a small VFR-only airport.
```

## Integration with Other Tabs

### From NAVLOG

Click any **cyan airport identifier** in the navlog to open charts:

```
KSFO → Charts tab opens with KSFO charts
```

### From MAP

Click an airport on the map, then click **CHARTS** in the popup.

### From ROUTE

After computing a route, use the quick-select bar on the CHARTS tab.

## Offline Access

::: warning
Chart PDFs require internet access. They are hosted on FAA servers and not cached locally.
:::

The chart **index** (list of available charts) is loaded with the aviation database and works offline. However, viewing the actual PDF requires internet connectivity.

**Workaround for offline use:**
1. Before flight, open each needed chart PDF
2. Use browser's "Save as PDF" or print to PDF
3. Store locally for offline reference

## Best Practices

1. **Preflight:** Review approach procedures for destination and alternates
2. **Check currency:** Verify TPP cycle matches current AIRAC
3. **Brief approaches:** Open relevant approach plates before departure
4. **Save locally:** For offline flights, download PDFs in advance
5. **Cross-reference:** Always check NOTAMs for chart amendments

## Chart Refresh

The chart index updates when you reload the database from the DATA tab. This happens:

- Automatically every 7 days (cache expiration)
- Manually when you click **LOAD DATABASE**
- When app version updates trigger auto-reindex

## Related Tabs

- **[DATA Tab](tab-data)** - Reload database to refresh chart index
- **[WX Tab](tab-weather)** - Check weather before reviewing approaches
- **[NAVLOG Tab](tab-navlog)** - Click airport codes to access charts
- **[MAP Tab](tab-map)** - Visual airport selection

---

**Previous:** [WX Tab](tab-weather) - Weather information
**Next:** [DATA Tab](tab-data) - Database management
