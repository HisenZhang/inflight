# Flight Planning Webapp

A lightweight web application for flight planning with a CDU/avionics-style interface that calculates distances and bearings between airports and navaids.

## Features

- **Comprehensive Database**: Caches airports, navaids, and frequency data from [OurAirports GitHub mirror](https://github.com/davidmegginson/ourairports-data) using IndexedDB
- **Navaid Support**: Supports radio navigation aids as waypoints:
  - VOR (VHF Omnidirectional Range)
  - VOR-DME (VOR with Distance Measuring Equipment)
  - VORTAC (VOR colocated with TACAN)
  - TACAN (Tactical Air Navigation)
  - NDB (Non-Directional Beacon)
  - NDB-DME (NDB with DME)
  - DME (Distance Measuring Equipment)
- **Detailed Waypoint Information**:
  - Field elevation (in feet and meters)
  - Airport communication frequencies (Tower, Ground, ATIS, etc.)
  - Navaid frequencies (properly formatted for VOR/NDB)
  - Waypoint type badges
  - Full coordinates in degrees/minutes
- **Smart Caching**: Stores data locally for 7 days to minimize network requests
- **Route Planning**: Input multiple waypoints (airports or navaids) to plan your route
- **Distance Calculation**: Uses the Haversine formula to calculate great circle distances in nautical miles
- **Bearing Calculation**: Computes initial bearing for each leg with cardinal direction
- **Dual Code Support**: Accepts both ICAO (e.g., KJFK) and IATA (e.g., JFK) airport codes
- **Database Timestamp**: Shows when data was last updated and how many days ago
- **CDU/Avionics UI**: High-contrast green-on-black interface inspired by aircraft CDUs
  - Monospace fonts throughout
  - Technical aviation formatting and terminology
  - Compact, efficient layout
  - All frequencies displayed (no truncation)
- **Smart Code Resolution**: ICAO codes prioritized over IATA to avoid navaid conflicts
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## How to Use

1. **Load Flight Data**
   - Open `index.html` in your web browser
   - Click "Load Flight Data" to fetch and cache airports, navaids, and frequency information
   - The data will be stored in your browser's IndexedDB for 7 days
   - You'll see the count of loaded airports and navaids, plus the last update timestamp

2. **Plan Your Route**
   - Enter waypoint codes separated by spaces (e.g., `KJFK MERIT EGLL`)
   - Mix airports and navaids as needed
   - **Code Priority**: ICAO (4 chars) → Navaid → IATA (3 chars)
     - Use ICAO codes (KJFK) to avoid conflicts with navaids
     - IATA codes (JFK) checked last to prevent navaid conflicts
   - Navaids: Use the navaid identifier (e.g., MERIT, OAK)
   - Click "COMPUTE" or press Enter

3. **View Results**
   - CDU-style display with high-contrast green/amber text
   - Route summary shows total distance and leg count
   - Each leg displays detailed information for DEPART and ARRIVE waypoints:
     - Name and type (with color-coded badge)
     - Location (municipality and country)
     - Position (POS) in degrees/minutes format
     - Elevation (ELEV) in feet and meters
     - Frequencies (FREQ):
       - Airports: All frequencies shown (Tower, Ground, ATIS, Approach, etc.)
       - Navaids: VOR frequency (MHz) or NDB frequency (kHz)
     - Distance (DIST) in nautical miles and kilometers
     - Track bearing with 3-digit formatting (001°, 090°, 270°)
     - Cardinal direction (N, NE, E, SE, S, SW, W, NW)

## Example Routes

### Airport-Only Routes
- **Transatlantic**: `KJFK EGLL` (New York to London)
- **European Tour**: `EGLL LFPG EDDF LIRF` (London → Paris → Frankfurt → Rome)
- **US Cross-Country**: `KLAX KORD KJFK` (Los Angeles → Chicago → New York)
- **Pacific Route**: `KSFO PHNL RJAA` (San Francisco → Honolulu → Tokyo)

### Routes with Navaids
- **VOR Navigation**: `KJFK MERIT EGLL` (New York → VOR → London)
- **Mixed Waypoints**: `KSFO OAK SFO` (San Francisco → Oakland VOR → San Francisco Airport)
- **NDB Navigation**: `KBOS PATSS CYYT` (Boston → NDB → St. John's)

## UI Design

The app features a CDU (Control Display Unit) / avionics-style interface:

### Visual Design
- **Color Scheme**: Dark background (#0a0e14) with bright green (#00ff00) primary text and amber (#ffb000) highlights
- **Typography**: Monospace fonts (Courier New, Consolas, Monaco) throughout
- **Layout**: Grid-based, compact design for efficient space usage
- **Formatting**: All uppercase text with letter-spacing for aviation readability

### Technical Presentation
- Status messages use aviation format: `[OK]`, `[ERR]`, `[!]`, `[...]`
- Labels use aviation terminology: DEPART, ARRIVE, TRACK, DIST, POS, ELEV, FREQ
- Numeric formatting: Zero-padded bearings (001°), leg numbers (LEG 01)
- ISO timestamps for database updates
- Route display uses hyphens (KJFK-MERIT-EGLL)

## Technical Details

### Distance Calculation
Uses the Haversine formula to calculate great circle distances:
```
a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
c = 2 * atan2(√a, √(1−a))
d = R * c
```
Where R is Earth's radius in nautical miles (3440.065 NM).

### Bearing Calculation
Calculates initial bearing (forward azimuth):
```
y = sin(Δlon) * cos(lat2)
x = cos(lat1) * sin(lat2) − sin(lat1) * cos(lat2) * cos(Δlon)
bearing = atan2(y, x)
```

### Data Source
Flight data is sourced from the [OurAirports GitHub mirror](https://github.com/davidmegginson/ourairports-data), which provides comprehensive aviation information including:

**Airports Data:**
- ICAO and IATA codes
- Airport names and locations
- Latitude, longitude, and elevation
- Airport type and country information

**Navaids Data:**
- Radio navigation aid identifiers
- Navaid types (VOR, NDB, DME, etc.)
- Frequencies (VHF for VOR, LF/MF for NDB)
- Latitude, longitude, and elevation

**Frequencies Data:**
- Airport communication frequencies
- Tower, Ground, ATIS, Approach, Departure, etc.
- Frequency descriptions

Data URLs (updated daily):
- Airports: `https://davidmegginson.github.io/ourairports-data/airports.csv`
- Navaids: `https://davidmegginson.github.io/ourairports-data/navaids.csv`
- Frequencies: `https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv`

### Storage
- **Technology**: IndexedDB (for large data storage)
- **Cache Duration**: 7 days
- **Database**: `FlightPlanningDB` (version 2)
- **Storage Size**: Handles large datasets (20+ MB) without browser storage limits
- **Stored Data**: Airports CSV, Navaids CSV, Frequencies CSV, and timestamp
- **Update Tracking**: Shows last update date/time and days since update

## Code Resolution Priority

To avoid conflicts between IATA codes and navaid identifiers, the app uses smart lookup priority:

1. **4+ characters**: Try ICAO code first (most specific, e.g., KJFK)
2. **Any length**: Try navaid identifier (e.g., MERIT, OAK)
3. **3 characters**: Try IATA code last (e.g., JFK) - least specific

**Best Practice**: Use ICAO codes (4 letters) for airports to ensure unambiguous waypoint resolution.

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

Requires a modern browser with support for:
- IndexedDB API (for large data storage)
- Fetch API
- ES6 JavaScript features
- CSS Grid and Flexbox

## Privacy

All data processing happens in your browser. No data is sent to any server except the initial fetch from the OurAirports GitHub mirror.

## Offline Usage

After loading the flight data once, the app can work offline for up to 7 days using the cached data. All route calculations are performed locally in your browser.

## Clearing Cache

Click the "Clear Cache" button to remove all stored flight data (airports, navaids, frequencies) from IndexedDB. You'll need to reload the data to use the app again.

## Navaid Information

The app displays detailed information for different navaid types:

### VOR-based Navaids
- **VOR**: Civilian VOR without DME - Frequency in MHz (108-118)
- **VOR-DME**: Civilian VOR with DME - Frequency in MHz
- **VORTAC**: Civilian VOR with military TACAN - Frequency in MHz

### NDB-based Navaids
- **NDB**: Non-directional beacon - Frequency in kHz (190-1750)
- **NDB-DME**: NDB with DME - Frequency in kHz

### Distance Measuring
- **TACAN**: Military TACAN (usable as DME by civilians)
- **DME**: Standalone distance-measuring equipment

## License

This project uses data from OurAirports via the [GitHub mirror](https://github.com/davidmegginson/ourairports-data). The data is in the public domain.
