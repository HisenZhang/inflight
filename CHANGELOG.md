# Changelog

All notable changes to IN-FLIGHT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Procedure Display (SID/STAR/Approach) - MVP
- **Procedure Overlay** - Visual display of instrument procedures on moving map
  - Toggle button (PROC) in MAP tab weather overlay controls
  - Purple button styling with active state indicator
  - Draws selected procedure over map when procedures are enabled
  - File: [display/map-display.js](display/map-display.js) updated (~500 lines added)

- **Procedure Selector Modal** - Airport procedure selection interface
  - Triggered by tapping airport waypoints when PROC is active
  - Shows PROC button in waypoint info popup (airports only)
  - Three sections: SIDs, STARs, Approaches
  - Groups procedures by base name with transitions listed
  - Selectable list with visual feedback (purple highlight)
  - File: [index.html](index.html) - Modal HTML structure
  - File: [styles/map.css](styles/map.css) - Modal styling (~260 lines)

- **Procedure Visualization** - Color-coded procedure display
  - **SIDs**: Green dashed line (#00ff00)
  - **STARs**: Cyan dashed line (#00aaff)
  - **Approaches**: Magenta solid line (#ff00ff)
  - Waypoint markers with labels
  - Altitude constraints shown for approaches
  - FAF (Final Approach Fix) highlighted with fill
  - Automatic waypoint coordinate resolution from database

- **CIFP Procedure Data** - Wired to procedure display system
  - `window.App.cifpData` contains SIDs, STARs, Approaches
  - Procedure parsing from ARINC 424 PD/PE/PF/HF records
  - Runway/transition grouping and formatting
  - Approach type decoding (ILS, RNAV, VOR, NDB, etc.)
  - File: [data/data-manager.js](data/data-manager.js) - CIFP storage

#### CIFP Data Integration
- **FAA CIFP Data Source** - Added support for Coded Instrument Flight Procedures (ARINC 424-18)
  - Official FAA data source for procedures, airspace, and MORA grid
  - File: [data/sources/cifp-source.js](data/sources/cifp-source.js) (484 lines)
  - Downloads from FAA AeroNav: `https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_251127.zip` (~9 MB)
  - Uses CORS proxy (`cors.hisenz.com`) to bypass CORS restrictions
  - Uses JSZip library (CDN) to extract FAACIFP18 from ZIP archive
  - Updates every 28 days (AIRAC cycle) - update `CIFP_FILENAME` constant for new cycles

- **ARINC 424 Parser** - Full ARINC 424-18 record parsing
  - **AS Records** - Grid MORA (Minimum Off-Route Altitude) - 1° grid
  - **ER Records** - Airways (enroute) - **Now primary source for airways!**
  - **UC Records** - Controlled Airspace (Class B/C/D) with precise boundaries
  - **UR Records** - Special Use Airspace (MOA, Restricted, Warning, etc.)
  - **PD Records** - SID (Standard Instrument Departure) procedures
  - **PE Records** - STAR (Standard Terminal Arrival) procedures
  - **PF/HF Records** - Approach procedures (airport/heliport)
  - Coordinate parsing: ARINC 424 degrees/minutes/seconds format
  - Boundary codes: Circle, Arc, Great Circle, Rhumb Line
  - Path terminators: IF, TF, CF, RF (for future procedure visualization)

- **MORA Integration** - TerrainAnalyzer now uses official FAA CIFP MORA data
  - Preferred source: CIFP AS records (official FAA)
  - Fallback: NASR CSV (backward compatible)
  - Cached in IndexedDB for offline use
  - File: [compute/terrain-analyzer.js](compute/terrain-analyzer.js) updated

- **Testing**
  - 11 new tests for CIFP parser ([tests/test-cifp-parser.js](tests/test-cifp-parser.js))
  - Tests: Coordinate parsing, MORA, airspace, procedures
  - Total test count: ~612 tests (all passing)

- **Documentation**
  - Complete CIFP integration guide: [docs/developer/05-cifp-integration.md](docs/developer/05-cifp-integration.md)
  - ARINC 424 format reference
  - Coordinate parsing examples
  - Future roadmap (airspace display, procedure visualization)

### Changed
- **Data Manager** - Now loads NASR, OurAirports, and CIFP in parallel
  - File: [data/data-manager.js](data/data-manager.js) updated
  - UI text: "FAA NASR + OurAirports + CIFP (Procedures/Airspace)"
- **HTML** - Added CIFP source script to [index.html](index.html)

### Technical Details
- **Data Size:** CIFP adds ~9 MB (compressed) to total download
- **Parse Time:** ~2-5 seconds for full CIFP file
- **Record Count:** ~100,000 CIFP records parsed
- **Coverage:** US airspace, procedures, and MORA grid

### Future Enhancements (Not Yet Implemented)
- [ ] Airspace display on map (v3.5)
- [ ] Procedure visualization (SID/STAR/Approach routes) (v3.6)
- [ ] Path terminator engine (TF, RF, CF legs) (v3.6)
- [ ] Vertical guidance (VNAV) (v3.7)

## [3.3.0] - 2025-11-30

### Added

#### ForeFlight FPL Import/Export
- **Export to ForeFlight FPL (.fpl)** - Export flight plans in Garmin FlightPlan v1 XML format
  - Compatible with ForeFlight, Garmin, and many other aviation apps
  - Includes route waypoints with coordinates and types (AIRPORT, VOR, NDB, INT)
  - Contains aircraft tailnumber, altitude, and departure time
  - Filename format: `DEPARTURE_DESTINATION.fpl`
- **Import from ForeFlight FPL (.fpl)** - Import flight plans from ForeFlight and other EFBs
  - Parses Garmin FlightPlan v1 XML format
  - Extracts waypoints with coordinates, types, and altitude
  - Supports all waypoint types: AIRPORT, VOR, NDB, INT, USER WAYPOINT
  - Populates route inputs for recalculation with current winds

#### Clipboard Copy & Paste
- **COPY button** - Copy flight plan to clipboard as JSON for quick sharing
  - Works between IN-FLIGHT sessions on same or different devices
  - Full route, calculations, and settings included
- **PASTE button** - Paste flight plan from clipboard
  - Instantly restores navlog from copied JSON
  - Great for transferring between browser tabs or devices

#### Testing
- 12 new tests for ForeFlight FPL and clipboard functionality
- Total test count: 601 tests (all passing)

### Changed
- Export dropdown now includes ForeFlight FPL option alongside JSON, CSV, and KML
- Import dropdown now supports both IN-FLIGHT JSON and ForeFlight FPL formats
- Added COPY and PASTE buttons to navlog actions bar

## [3.0.0] - 2025-11-28

### Architecture v3.0.0 - Complete Layered Architecture

This major release introduces a complete architectural overhaul implementing proper separation of concerns, dependency injection, and testable pure functions.

### Added

#### Data Layer (`data/`)
- **Abstract Base Classes**
  - `DataSource` - Template method pattern for data loading (fetch → parse → validate → transform)
  - `StorageAdapter` - Abstract interface for storage backends
  - `CacheStrategy` - Pluggable cache validity strategies (TTL, Permanent, Version-based)
- **Concrete Implementations**
  - `MemoryStorage` - In-memory storage adapter for testing
  - `TTLStrategy` - Time-based cache expiration
  - `PermanentStrategy` - Never-expiring cache
  - `VersionStrategy` - Version-based cache invalidation
- **Repository Pattern**
  - `DataRepository` - Central data access facade with L1 (memory) / L2 (persistent) / L3 (source) caching

#### Query Layer (`query/`)
- **Index Strategy Pattern**
  - `IndexStrategy` - Abstract base class for index implementations
  - `MapIndex` - O(1) key-value lookups
  - `TrieIndex` - Prefix-based autocomplete search
  - `SpatialGridIndex` - Spatial queries with configurable grid size
- **Query Engine v2**
  - `QueryEngineV2` - Coordinates multiple indexes with dependency injection
  - Separate from legacy `QueryEngine` for backward compatibility

#### Compute Layer (`compute/`) - Pure Functions
- **Navigation Module**
  - `Navigation.calculateDistance()` - Vincenty distance (WGS84)
  - `Navigation.calculateBearing()` - True bearing calculations
  - `Navigation.calculateMagneticBearing()` - Magnetic bearing with WMM2025
  - `Navigation.calculateWindCorrection()` - Wind correction angle and ground speed
  - `Navigation.calculateLeg()` - Complete leg calculations
  - `Navigation.calculateRoute()` - Full route with totals
- **Terrain Module**
  - `Terrain.analyzeProfile()` - Route terrain analysis using MORA data
  - `Terrain.checkClearance()` - Clearance verification (standard/mountainous)
- **Weather Module**
  - `Weather.parseMETAR()` - METAR string parsing
  - `Weather.getFlightCategory()` - VFR/MVFR/IFR/LIFR determination
  - `Weather.calculateDensityAltitude()` - Density altitude calculation

#### Service Layer (`services/`)
- **RouteService** - Route planning orchestration
  - Combines Query + Compute layers
  - `planRoute()` - Complete route planning workflow
  - `searchWaypoints()` - Waypoint autocomplete
  - `getAirport()` - Airport lookup
- **WeatherService** - Weather data orchestration
  - `getMETAR()` - Parsed METAR retrieval
  - `getMETARs()` - Bulk METAR retrieval
  - `getRouteWeather()` - Weather for all airports on route
  - `getFlightCategory()` - Flight category lookup
  - `getDensityAltitude()` - Station density altitude
  - `getWeatherBriefing()` - Complete weather summary

#### Bootstrap (`main.js`)
- Application initialization and dependency wiring
- Creates `window.App` with all v3 components
- Legacy `DataManager` integration for backward compatibility

#### Testing
- 236 new tests for v3 architecture
- Test suites for all new modules:
  - `test-data-core.js` - Data layer abstractions
  - `test-query-indexes.js` - Index implementations
  - `test-navigation.js` - Navigation pure functions
  - `test-terrain.js` - Terrain analysis
  - `test-weather.js` - Weather parsing
  - `test-services.js` - Service layer
  - `test-integration.js` - Component integration
- Browser test runner (`tests/index.html`) with filter options
- Total test count: 536 tests (all passing)

### Changed

- **Architecture**: From 3-engine to 5-layer architecture
  - Display → Service → Compute → Query → Data
  - Dependencies flow downward only
- **Module Loading**: All v3 scripts added to `index.html`
- **Test Runner**: Updated to include all v3 modules and integration tests

### Design Patterns Implemented

| Pattern | Location | Purpose |
|---------|----------|---------|
| Strategy | IndexStrategy, CacheStrategy | Swap algorithms without changing clients |
| Template Method | DataSource.load() | Define skeleton, let subclasses fill details |
| Repository | DataRepository | Abstract data access behind consistent interface |
| Facade | RouteService, WeatherService | Simplified interface to complex subsystem |
| Dependency Injection | Service constructors | Inject dependencies, enable testing |

### Migration Notes

- Legacy code (`DataManager`, `QueryEngine`, `RouteCalculator`, etc.) remains fully functional
- v3 components coexist with legacy code
- `window.App` provides access to v3 architecture
- Gradual migration path: update Display layer to use Services

### File Structure

```
NEW in v3:
data/
├── core/
│   ├── data-source.js          # Abstract DataSource
│   ├── storage-adapter.js      # Abstract StorageAdapter
│   └── cache-strategy.js       # CacheStrategy + implementations
├── storage/
│   └── memory-storage.js       # In-memory implementation
└── repository.js               # DataRepository

query/
├── core/
│   └── index-strategy.js       # Abstract IndexStrategy
├── indexes/
│   ├── map-index.js            # O(1) key-value
│   ├── trie-index.js           # Prefix search
│   └── spatial-grid-index.js   # Spatial queries
└── query-engine-v2.js          # New QueryEngine

compute/
├── navigation.js               # Navigation (pure)
├── terrain.js                  # Terrain (pure)
└── weather.js                  # Weather (pure)

services/
├── route-service.js            # Route planning
└── weather-service.js          # Weather data

main.js                         # Bootstrap
```

---

## [2.10.0] - 2025-11-26

### Added
- Terrain profile in navlog with MORA overlay and collision detection

---

## [2.0.0] - 2025-01-15

### Added
- Initial PWA update system
- Service worker with version management
- Centralized version management via `version.js`

---

## Pre-2.0.0

Historical changes before changelog was introduced. See git history for details.
