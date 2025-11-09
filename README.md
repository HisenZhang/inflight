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
   - **Supported Route Formats**:
     - **Named waypoints**: `KJFK KORD KSFO` (airports, navaids, fixes)
     - **Airways**: `KORD V44 SWANN V433 DQO` (Victor, Jet, Q routes)
     - **Procedures**: `KBOS WYNDE3 KJFK` (STARs and DPs)
     - **Direct (DCT)**: `KORD DCT IOW DCT KMSP` (explicit direct routing)
     - **Lat/Long coordinates**: `3407/10615` (DDMM/DDDMM format) or `340730/1061530` (DDMMSS/DDDMMSS)
     - **Mixed routes**: Combine any of the above formats
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

### IFR Routes with Airways and Procedures
- **Airway Route**: `KORD V44 SWANN V433 DQO` (Chicago via Victor airways)
- **Jet Route**: `KLAX J5 LKV J3 GEG` (Los Angeles via Jet routes)
- **With STAR**: `KBOS MERIT WYNDE3 KJFK` (Boston to JFK with STAR)

### Direct Routes (DCT keyword)
- **Direct Flight**: `KORD DCT IOW DCT KMSP` (Chicago direct to Minneapolis)
- **Mixed Direct**: `KJFK DCT MERIT DCT EGLL` (Direct to VOR, then direct to London)

### RNAV Routes with Coordinates
- **Lat/Long Format**: `KORD 4149/08736 3407/10615 KABQ` (Chicago to Albuquerque via coordinates)
- **Random RNAV**: `3407/10615 3407/11546 KTUS` (High-altitude point-to-point navigation)
- **Mixed Route**: `KDEN DCT 3950/10430 DCT KSLC` (Denver to Salt Lake City via coordinate)

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

### Geodetic Calculations
The app uses **WGS84 ellipsoid geodesy** for accurate distance and bearing calculations:

**Distance Calculation:**
- Uses Vincenty's inverse formulae (via geodesy library)
- Calculates distances on WGS84 ellipsoid (not simple sphere)
- Accuracy: < 0.01% error (few meters over thousands of NM)
- Results in nautical miles (1 NM = 1852 meters)

**Bearing Calculation:**
- Geodetic azimuth (initial bearing) on WGS84 ellipsoid
- More accurate than spherical calculations, especially for long distances
- Accounts for Earth's oblateness

**Library:** `geodesy@2.4.0` by Chris Veness
- Source: https://www.npmjs.com/package/geodesy
- CDN: https://cdn.jsdelivr.net/npm/geodesy@2.4.0/
- Works offline after initial load (cached by Service Worker)

### Magnetic Variation
The app calculates **magnetic declination** (variation) at each waypoint:

**World Magnetic Model (WMM):**
- Current model: WMM2025 (valid 2025-2030)
- Calculates magnetic declination for any location worldwide
- Converts true headings to magnetic headings for compass navigation

**Library:** `geomag@1.0.2` (JavaScript implementation of NOAA's WMM)
- Source: https://www.npmjs.com/package/geomag
- CDN: https://cdn.jsdelivr.net/npm/geomag@1.0.2/
- Works offline after initial load (cached by Service Worker)

**Display:**
- Each waypoint shows magnetic variation (e.g., "VAR 12.3°E" or "VAR 8.5°W")
- Leg rows show both TRUE and MAG headings
- Magnetic headings displayed in cyan for easy identification
- Variation calculated for current date using WMM2025

### Aviation Data Sources

**Publishing Authority:** OurAirports (https://ourairports.com/)
- Community-maintained open aviation database
- Data compiled from official sources (ICAO, FAA, national aviation authorities)
- Updated regularly by volunteer contributors worldwide
- Public domain data

**Data Source:** GitHub Mirror by David Megginson
- Repository: https://github.com/davidmegginson/ourairports-data
- Mirror of OurAirports database in CSV format
- Updated daily from OurAirports.com
- Reliable CDN delivery via GitHub Pages / raw.githubusercontent.com

**Data Files Used:**

1. **Airports** (`airports.csv`)
   - URL: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airports.csv`
   - Contains: ICAO/IATA codes, names, coordinates (WGS84), elevation, airport type
   - ~70,000 airports worldwide

2. **Navaids** (`navaids.csv`)
   - URL: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/navaids.csv`
   - Contains: VOR, NDB, DME, TACAN identifiers, frequencies, coordinates (WGS84)
   - ~10,000 navigation aids worldwide

3. **Frequencies** (`airport-frequencies.csv`)
   - URL: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airport-frequencies.csv`
   - Contains: Tower, Ground, ATIS, Approach, Departure frequencies
   - Communication frequencies for airports worldwide

4. **Runways** (`runways.csv`)
   - URL: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/runways.csv`
   - Contains: Runway identifiers, length, width, surface type
   - Physical runway data for airports worldwide

**CORS Proxy:** User-provided proxy at `cors.hisenz.com`
- Required for cross-origin data fetching
- Proxies requests to GitHub raw content

### External Dependencies

**All dependencies are cached by Service Worker for offline use:**

1. **Geodesy Library**
   - Package: `geodesy@2.4.0`
   - Author: Chris Veness
   - Source: https://www.npmjs.com/package/geodesy
   - CDN: https://cdn.jsdelivr.net/npm/geodesy@2.4.0/latlon-ellipsoidal-vincenty.min.js
   - Purpose: WGS84 ellipsoid distance/bearing calculations (Vincenty's formulae)
   - License: MIT

2. **Magnetic Model Library**
   - Package: `geomag@1.0.2`
   - Implements: NOAA World Magnetic Model (WMM2025)
   - Authority: NOAA National Centers for Environmental Information
   - Source: https://www.npmjs.com/package/geomag
   - CDN: https://cdn.jsdelivr.net/npm/geomag@1.0.2/geomag.min.js
   - Purpose: Calculate magnetic declination worldwide
   - Model Valid: 2025-2030
   - License: Public Domain (US Government work)

3. **Font**
   - Font: Roboto Mono
   - Source: Google Fonts
   - URL: https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap
   - License: Apache License 2.0

### Storage
- **Technology**: IndexedDB (for large data storage)
- **Cache Duration**: Never expires (warns if > 7 days old)
- **Database**: `FlightPlanningDB` (version 3)
- **Storage Size**: Handles large datasets (30+ MB) without browser storage limits
- **Stored Data**: Airports CSV, Navaids CSV, Frequencies CSV, Runways CSV, and timestamp
- **Update Tracking**: Shows last update date/time and days since update
- **Offline Support**: Service Worker caches app shell and external libraries

## Route Format Reference

### Supported Waypoint Types

The app supports all standard IFR routing formats used in flight planning:

1. **Named Waypoints** (Airports, Navaids, Fixes)
   - **Airports**: Use ICAO codes (e.g., `KJFK`, `EGLL`, `RJAA`)
   - **Navaids**: VOR, NDB, DME identifiers (e.g., `OAK`, `MERIT`, `LAX`)
   - **Fixes**: Published waypoints including ARTCC fixes (e.g., `SWANN`, `KA03W`)

2. **Airways**
   - **Victor Airways**: Low altitude routes (e.g., `V44`, `V433`)
   - **Jet Routes**: High altitude routes (e.g., `J5`, `J45`)
   - **Q Routes**: RNAV routes (e.g., `Q822`)
   - **Format**: `WAYPOINT AIRWAY WAYPOINT` (e.g., `KORD V44 SWANN V433 DQO`)

3. **Procedures**
   - **STARs**: Standard Terminal Arrival Routes (e.g., `WYNDE3`, `MIP4`)
   - **DPs**: Departure Procedures/SIDs (e.g., `ACCRA5`)
   - **Format**: Include in route string (e.g., `KBOS WYNDE3 KJFK`)

4. **Direct Routes (DCT)**
   - Explicit direct routing between waypoints
   - **Format**: `WAYPOINT DCT WAYPOINT` (e.g., `KORD DCT IOW DCT KMSP`)
   - **Note**: DCT is optional - direct routing is implied between waypoints

5. **Latitude/Longitude Coordinates**
   - **DDMM/DDDMM format**: Degrees + Minutes (e.g., `3407/10615` = 34°07'N 106°15'W)
   - **DDMMSS/DDDMMSS format**: Degrees + Minutes + Seconds (e.g., `340730/1061530` = 34°07'30"N 106°15'30"W)
   - **Hemispheres**: Assumes North/West for US operations (add N/S/E/W suffix if needed)
   - **Use cases**: Random RNAV routes, high-altitude navigation (FL390+), point-to-point navigation
   - **Examples**:
     - `KORD 4149/08736 KABQ` (Chicago to Albuquerque via coordinate)
     - `3407/10615 3407/11546 KTUS` (Coordinate-based RNAV route)

### Route Format Examples

**Simple Direct Route:**
```
KJFK KORD KSFO
```

**Airway Route:**
```
KORD V44 SWANN V433 DQO
```

**With STAR Arrival:**
```
KBOS MERIT WYNDE3 KJFK
```

**Explicit Direct (DCT):**
```
KORD DCT IOW DCT KMSP
```

**Random RNAV with Coordinates:**
```
KDEN 3950/10430 3920/11200 KSLC
```

**Complex IFR Route:**
```
KLAX J5 LKV J3 GEG YXC FL330 J500 VLR
```

## Code Resolution Priority

To avoid conflicts between IATA codes and navaid identifiers, the app uses smart lookup priority:

1. **Lat/Long coordinates**: Checked first if format matches `DDMM/DDDMM` pattern
2. **4+ characters**: Try ICAO airport code (e.g., KJFK)
3. **Any length**: Try navaid identifier (e.g., MERIT, NY1, OAK)
4. **Any length**: Try fix/waypoint (e.g., SWANN, KA03W)
5. **3 characters**: Try IATA code via mapping to ICAO (e.g., JFK → KJFK)

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
- **Mobile Android**: Use "Add to Home Screen" from Chrome menu
- **iOS Safari**:
  1. Tap the Share button (square with arrow)
  2. Scroll down and tap "Add to Home Screen"
  3. Name it "InFlight" and tap "Add"
  4. Launch from home screen icon (works offline)
- **Offline**: Works completely offline after first load
- **Updates**: Service Worker automatically updates when new version available

### iOS Safari Notes
- First launch requires internet to load app files
- After initial load, works completely offline
- Database persists across sessions
- Service Worker caches app shell for instant loading

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

### GPS Waypoint Types
- **WP** (Waypoint): Standard GPS fix defined by latitude/longitude coordinates
- **RP** (Reporting Point): Mandatory or non-mandatory position reporting point for ATC
- **CN** (Computer Navigation Fix): RNAV waypoint defined for area navigation systems

## License

This project uses data from OurAirports via the [GitHub mirror](https://github.com/davidmegginson/ourairports-data). The data is in the public domain.
