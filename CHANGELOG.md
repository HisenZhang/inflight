# Changelog

All notable changes to IN-FLIGHT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
