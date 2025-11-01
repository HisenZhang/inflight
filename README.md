# Flight Planning Webapp

A lightweight web application for flight planning with a professional navigation log interface that calculates distances and bearings between airports and navaids.

## Features

- **Offline Support**: Full Progressive Web App (PWA) with Service Worker
  - Works completely offline after first load
  - Install to home screen on mobile devices
  - App shell cached for instant loading
  - Database never expires (warns if > 7 days old)
- **Mobile Optimized**:
  - Prevents accidental zoom with locked viewport
  - Touch-friendly interface
  - Responsive layout for all screen sizes
- **Comprehensive Database**: Caches airports, navaids, runway, and frequency data from [OurAirports GitHub mirror](https://github.com/davidmegginson/ourairports-data) using IndexedDB
- **Navaid Support**: Supports radio navigation aids as waypoints:
  - VOR (VHF Omnidirectional Range)
  - VOR-DME (VOR with Distance Measuring Equipment)
  - VORTAC (VOR colocated with TACAN)
  - TACAN (Tactical Air Navigation)
  - NDB (Non-Directional Beacon)
  - NDB-DME (NDB with DME)
  - DME (Distance Measuring Equipment)
- **Detailed Waypoint Information**:
  - Field elevation in feet (cyan color-coded)
  - Airport runway information (identifiers, length, surface)
  - Airport communication frequencies grouped by type (green color-coded)
  - Navaid frequencies (properly formatted for VOR/NDB)
  - Waypoint type badges
  - Full coordinates in degrees/minutes
  - Graceful handling of missing data (e.g., "NO FREQ DATA" if not in database)
- **Smart Caching**: Stores data locally indefinitely, warns if > 7 days old
- **Route Planning**: Input one or more waypoints (airports or navaids) to plan your route
  - Single waypoint: View detailed information
  - Multiple waypoints: Calculate distances and bearings between each leg
- **Distance Calculation**: Uses the Haversine formula to calculate great circle distances in nautical miles
- **Bearing Calculation**: Computes initial bearing for each leg with cardinal direction
- **Dual Code Support**: Accepts both ICAO (e.g., KJFK) and IATA (e.g., JFK) airport codes
- **Database Timestamp**: Shows when data was last updated and how many days ago
- **Autocomplete Search**: Smart waypoint search with dropdown suggestions
  - Search by ICAO, IATA, navaid identifier, or name
  - Prioritized ordering: exact matches first, then partial, then name matches
  - All waypoints shown in magenta
  - Keyboard navigation (↑↓ arrows, Enter, Esc)
  - Shows type, full name, and location
- **Navigation Log Table**: Professional airline-style navlog display
  - Numbered waypoints (1, 2, 3...)
  - Distance/heading rows between waypoints
  - Compact table format with all info inline
  - All frequencies grouped by type (e.g., "APP 118.250/120.600")
  - Runway information for airports
  - Color-coded information (magenta waypoints, cyan elevation, green frequencies)
- **Modern UI**: Clean professional interface
  - Roboto Mono font
  - Black background with white borders
  - Cyan/Magenta/Green color scheme
  - Efficient use of screen space
- **Smart Code Resolution**: ICAO codes prioritized over IATA to avoid navaid conflicts
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## How to Use

1. **Load Flight Data**
   - Open `index.html` in your web browser
   - Click "LOAD DATA" to fetch and cache airports, navaids, runway, and frequency information
   - The data will be stored in your browser's IndexedDB permanently
   - After 7 days, a warning appears recommending update, but data still works
   - You'll see the count of loaded airports and navaids, plus the last update timestamp
   - **Offline**: After first load, the app works completely offline

2. **Plan Your Route**
   - Start typing a waypoint code or name
   - Autocomplete dropdown will show suggestions:
     - All waypoints displayed in **magenta**
     - Shows code, type, full name, and location
     - Exact matches appear first, then partial, then name matches
   - Use arrow keys (↑↓) to navigate, Enter to select
   - Or click on a suggestion to add it
   - Enter one or more waypoints (separated by spaces)
   - Example routes: `KJFK MERIT EGLL` or `NY1` (single waypoint) or `KSFO OAK`
   - Click "COMPUTE" or press Enter when ready

3. **View Results**
   - Navigation log displayed in professional table format
   - **Summary Bar**: Route (space-separated), total distance, waypoint count, leg count (all in magenta)
   - **Navlog Table** layout:
     - **Waypoint rows** (numbered 1, 2, 3...):
       - Identifier (magenta) and type badge
       - Position (coordinates in degrees/minutes)
       - Elevation in feet (cyan)
       - Runway information (identifiers, length, surface)
       - Frequencies grouped by type (green) - e.g., "APP 118.250/120.600"
     - **Leg rows** (between waypoints):
       - Distance to next waypoint (magenta)
       - Heading and cardinal direction (magenta)
       - Cumulative distance (magenta)
   - **Color coding**:
     - All waypoints in MAGENTA
     - Elevation in CYAN
     - Frequencies in GREEN
     - Distances/headings in MAGENTA

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

The app features a professional navigation log interface:

### Visual Design
- **Color Scheme**:
  - Background: Black (#000000)
  - Borders: White (#ffffff)
  - Text: White for labels, Gray for secondary info
  - All Waypoints: Magenta (#ff00ff)
  - Elevation: Cyan (#00ffff)
  - Frequencies: Green (#00ff00)
  - Distances/Headings: Magenta (#ff00ff)
  - Warnings: Yellow (#ffff00)
  - Errors: Red (#ff0000)
- **Typography**: Roboto Mono (from Google Fonts)
- **Layout**: Compact table-based navigation log
- **Formatting**: Clean, professional airline-style presentation

### Navigation Log Table
- Numbered waypoint rows (1, 2, 3...)
- Distance/heading rows between waypoints
- All information displayed inline (no expanding rows)
- White borders with hover effects
- Horizontal scroll on smaller screens
- Frequencies grouped by type with slashes (e.g., "APP 118.250/120.600")
- Runway information for airports (e.g., "09/27 8000FT ASPH")
- Zero-padded track bearings (001°, 090°, 270°)
- Graceful missing data indicators ("NO FREQ DATA", "RWY NO DATA")

### Autocomplete Features
- Dropdown appears below input field
- Max 10 results shown at once
- Scrollable if more results
- Keyboard navigation support
- Visual distinction between airports and navaids
- Shows full context (code, type, name, location)

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

Data URLs (raw from GitHub, updated daily):
- Airports: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airports.csv`
- Navaids: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/navaids.csv`
- Frequencies: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airport-frequencies.csv`
- Runways: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/runways.csv`

### Storage
- **Technology**: IndexedDB (for large data storage)
- **Cache Duration**: Never expires (warns if > 7 days old)
- **Database**: `FlightPlanningDB` (version 3)
- **Storage Size**: Handles large datasets (30+ MB) without browser storage limits
- **Stored Data**: Airports CSV, Navaids CSV, Frequencies CSV, Runways CSV, and timestamp
- **Update Tracking**: Shows last update date/time and days since update
- **Offline Support**: Service Worker caches app shell for offline use

## Code Resolution Priority

To avoid conflicts between IATA codes and navaid identifiers, the app uses smart lookup priority:

1. **4+ characters**: Try ICAO code first (most specific, e.g., KJFK)
2. **Any length**: Try navaid identifier (e.g., MERIT, NY1, OAK)
3. **3 characters**: Try IATA code via mapping to ICAO (e.g., JFK → KJFK)

**Best Practice**: Use ICAO codes (4 letters) for airports to ensure unambiguous waypoint resolution.

**Indexing**: All airport ICAO/IATA codes and navaid identifiers are stored in uppercase for consistent lookup.

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera
- Mobile browsers (iOS Safari, Chrome Mobile, Samsung Internet)

Requires a modern browser with support for:
- Service Workers (for offline support)
- IndexedDB API (for large data storage)
- Fetch API
- ES6 JavaScript features (Map, Set, async/await, arrow functions)
- CSS Grid and Flexbox
- Google Fonts (Roboto Mono)

## Progressive Web App (PWA)

This app can be installed on your device:
- **Desktop**: Click the install icon in the browser address bar
- **Mobile**: Use "Add to Home Screen" from the browser menu
- **Offline**: Works completely offline after first load
- **Updates**: Service Worker automatically updates when new version available

## Privacy

All data processing happens in your browser. No data is sent to any server except the initial fetch from the OurAirports GitHub mirror.

## Offline Usage

After loading the flight data once, the app works completely offline:
- **App Shell**: HTML, CSS, and JavaScript cached by Service Worker
- **Data**: Airports, navaids, runways, and frequencies stored in IndexedDB
- **No Expiration**: Data never expires but warns if > 7 days old
- **Calculations**: All route calculations performed locally in your browser
- **Updates**: Reconnect to internet and click "LOAD DATA" to refresh database

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
