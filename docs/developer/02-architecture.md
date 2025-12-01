# IN-FLIGHT Architecture Documentation

## Overview

IN-FLIGHT is a browser-based flight planning and navigation application built with a **5-Layer Architecture** (v3.0.0) that cleanly separates concerns and enables testable, maintainable code.

## Architecture Version

**Current: v3.2.0** - Complete layered architecture with dependency injection

**Recent Updates (v3.1.0 - v3.2.0):**
- Enhanced weather hazard analysis with time-based filtering
- Return fuel calculations for round-trip planning
- Improved PIREP display with aircraft type and temperature
- NASR data expiration warning system
- Wind hazard consolidation with consecutive leg ranges

## Design Philosophy

### Core Principles

1. **Separation of Concerns**: Each layer has a single, well-defined responsibility
2. **Dependencies Flow Downward**: Higher layers depend on lower layers, never the reverse
3. **Pure Functions in Compute**: Calculations are stateless and side-effect free
4. **Dependency Injection**: Components receive dependencies, enabling testing
5. **Offline-First**: Works entirely in-browser with IndexedDB caching and service worker support

### Why 5-Layer Architecture?

The v3 architecture addresses fundamental design issues from earlier versions:

| Problem (v2) | Solution (v3) |
|--------------|---------------|
| Data layer calling compute layer | Dependencies flow downward only |
| Multiple storage systems | Single `DataRepository` facade |
| Circular dependencies | Clear layer boundaries |
| Untestable calculations | Pure functions in Compute layer |
| Hard-coded dependencies | Dependency injection throughout |

## Directory Structure

```
inflight/
├── index.html                  # Entry point
├── main.js                     # v3 Application bootstrap
├── version.js                  # Version management
├── styles/                     # CSS modules
│   ├── base.css
│   ├── components.css
│   ├── map.css
│   ├── tokens.css
│   └── utilities.css
├── manifest.json               # PWA manifest
├── service-worker.js           # Offline support
│
├── lib/                        # External Libraries
│   ├── geodesy.js              # WGS84 + WMM2025
│   ├── wind-stations.js        # Wind reporting stations
│   └── wind-stations.csv       # Station data
│
├── utils/                      # Shared Utilities (Pure functions)
│   ├── formatters.js           # Coordinate, frequency, distance, time
│   ├── checksum.js             # Data integrity
│   └── compression.js          # Data compression
│
├── data/                       # DATA LAYER
│   ├── core/
│   │   ├── data-source.js      # Abstract DataSource (Template Method)
│   │   ├── storage-adapter.js  # Abstract StorageAdapter interface
│   │   └── cache-strategy.js   # Cache strategies (TTL, Permanent, Version)
│   ├── storage/
│   │   └── memory-storage.js   # In-memory StorageAdapter
│   ├── repository.js           # DataRepository (L1/L2/L3 caching)
│   ├── data-manager.js         # Legacy: IndexedDB orchestrator
│   ├── nasr-adapter.js         # FAA NASR data parser
│   └── ourairports-adapter.js  # OurAirports parser
│
├── query/                      # QUERY LAYER
│   ├── core/
│   │   └── index-strategy.js   # Abstract IndexStrategy
│   ├── indexes/
│   │   ├── map-index.js        # O(1) key-value index
│   │   ├── trie-index.js       # Prefix search index
│   │   └── spatial-grid-index.js # Spatial queries
│   └── query-engine-v2.js      # QueryEngineV2 (index coordinator)
│
├── compute/                    # COMPUTE LAYER
│   ├── navigation.js           # Pure: distance, bearing, wind correction
│   ├── terrain.js              # Pure: terrain analysis, clearance
│   ├── weather.js              # Pure: METAR parsing, flight category
│   ├── query-engine.js         # Legacy: spatial queries
│   ├── route-engine.js         # Legacy: route orchestrator
│   ├── route-lexer.js          # Tokenization
│   ├── route-parser.js         # Parsing
│   ├── route-resolver.js       # Semantic analysis
│   ├── route-calculator.js     # Legacy: navigation math
│   ├── route-expander.js       # Airway/STAR/DP expansion
│   └── winds-aloft.js          # Wind data fetching
│
├── services/                   # SERVICE LAYER
│   ├── route-service.js        # Route planning orchestration
│   └── weather-service.js      # Weather data orchestration
│
├── state/                      # STATE MANAGEMENT
│   ├── flight-state.js         # Flight plan state + persistence
│   └── flight-tracker.js       # GPS tracking & logging
│
├── display/                    # DISPLAY LAYER
│   ├── app.js                  # Application coordinator
│   ├── ui-controller.js        # Form inputs, navlog, status
│   ├── map-display.js          # Vector map, GPS tracking
│   ├── weather-controller.js   # WX tab, METAR/TAF/PIREP/hazards
│   ├── charts-controller.js    # Charts tab, TPP chart access
│   ├── inflight-controller.js  # In-flight monitoring tab
│   ├── checklist-controller.js # Interactive checklist
│   └── stats-controller.js     # Flight statistics
│
└── tests/                      # Test suites
    ├── test-runner.js          # Node.js + JSDOM runner
    ├── index.html              # Browser test runner
    └── test-*.js               # Test files
```

## Five-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│ DISPLAY LAYER (Presentation)                                │
│ app.js, ui-controller.js, map-display.js                    │
│ - Renders UI, handles events                                │
│ - Calls Services only (not Data/Query directly)             │
└─────────────────────────────────────────────────────────────┘
                            │ calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVICE LAYER (Orchestration)                               │
│ route-service.js, weather-service.js                        │
│ - Orchestrates operations across layers                     │
│ - Entry point for all business operations                   │
│ - Combines Query + Compute results                          │
└─────────────────────────────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ COMPUTE LAYER (Pure Functions)                              │
│ navigation.js, terrain.js, weather.js                       │
│ - Stateless calculations                                    │
│ - NO fetching, NO caching, NO storage                       │
│ - Input → Output only (easily testable)                     │
└─────────────────────────────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ QUERY LAYER (Indexes & Search)                              │
│ query-engine-v2.js, indexes/*                               │
│ - Owns all indexes (Map, Trie, Spatial)                     │
│ - Spatial queries, search, lookups                          │
│ - Requests data from Repository                             │
└─────────────────────────────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ DATA LAYER (Storage & Retrieval)                            │
│ repository.js, data-source.js, storage-adapter.js           │
│ - Single source of truth for all data                       │
│ - L1 (memory) / L2 (persistent) / L3 (source) caching       │
│ - NO business logic, NO indexing                            │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Route Planning Flow

```
User enters route + options
    ↓
Display: app.js calls RouteService.planRoute()
    ↓
Service: RouteService orchestrates:
    ├── Query: Resolve waypoints via QueryEngineV2
    ├── Compute: Calculate route via Navigation.calculateRoute()
    ├── Data: Get MORA data via DataRepository
    └── Compute: Analyze terrain via Terrain.analyzeProfile()
    ↓
Service: Returns combined result
    ↓
Display: UIController.displayResults() renders navlog
    ↓
Display: MapDisplay.displayMap() renders vector map
```

### Weather Lookup Flow

```
User requests weather
    ↓
Display: calls WeatherService.getMETAR()
    ↓
Service: WeatherService orchestrates:
    ├── Data: Get raw METAR via DataRepository
    └── Compute: Parse via Weather.parseMETAR()
    ↓
Service: Returns parsed METAR
    ↓
Display: Renders weather information
```

## Design Patterns

### Strategy Pattern (Indexes & Cache)

```javascript
// query/core/index-strategy.js - Abstract base
class IndexStrategy {
    build(data) { throw new Error('not implemented'); }
    query(params) { throw new Error('not implemented'); }
    // ...
}

// query/indexes/map-index.js - Concrete implementation
class MapIndex extends IndexStrategy {
    build(data) { /* Map-based implementation */ }
    query({ key }) { return this._map.get(key); }
}

// Usage: Swap strategies without changing QueryEngine
queryEngine.registerIndex('airports', new MapIndex());
queryEngine.registerIndex('airports_search', new TrieIndex());
```

### Template Method Pattern (Data Sources)

```javascript
// data/core/data-source.js
class DataSource {
    // Template method - DO NOT override
    async load() {
        const raw = await this.fetch();       // Hook 1
        const parsed = await this.parse(raw);  // Hook 2
        if (!await this.validate(parsed)) {    // Hook 3
            throw new Error('Validation failed');
        }
        return await this.transform(parsed);   // Hook 4
    }

    // Hooks - Override in subclasses
    async fetch() { throw new Error('not implemented'); }
    async parse(raw) { throw new Error('not implemented'); }
    async validate(data) { return true; }  // Optional
    async transform(data) { return data; } // Optional
}
```

### Repository Pattern (Data Access)

```javascript
// data/repository.js
class DataRepository {
    async get(sourceName, key) {
        // L1: Memory cache
        if (cache.memory.has(key)) return cache.memory.get(key);

        // L2: Persistent storage
        if (this._storage) {
            const stored = await this._storage.get(key);
            if (stored && cache.strategy.isValid(stored)) return stored;
        }

        // L3: Source fetch
        const data = await source.load();
        // ... cache and return
    }
}
```

### Dependency Injection (Services)

```javascript
// services/route-service.js
class RouteService {
    constructor({ queryEngine, dataRepository }) {
        this._query = queryEngine;      // Injected
        this._repo = dataRepository;    // Injected
    }

    async planRoute(routeString, options) {
        // Uses injected dependencies
        const waypoints = await this._resolveWaypoints(routeString);
        // ...
    }
}

// Testable with mocks:
const service = new RouteService({
    queryEngine: mockQueryEngine,
    dataRepository: mockRepository
});
```

## Pure Functions (Compute Layer)

All Compute layer functions are **pure** - same input always produces same output:

```javascript
// compute/navigation.js
const Navigation = {
    // Pure: No side effects, no state, no external dependencies
    calculateDistance(lat1, lon1, lat2, lon2) {
        return Geodesy.vincentyDistance(lat1, lon1, lat2, lon2);
    },

    calculateWindCorrection(course, tas, windDir, windSpeed) {
        // Pure math - no fetching, no caching
        const wca = Math.asin((windSpeed / tas) * Math.sin(windRad - courseRad));
        // ...
        return { heading, groundSpeed, windCorrectionAngle };
    }
};
```

**Benefits:**
- Easily testable (no mocks needed)
- Predictable behavior
- Thread-safe
- Cacheable results

## Application Bootstrap

```javascript
// main.js
async function bootstrap() {
    // 1. Create storage
    const storage = new MemoryStorage();

    // 2. Create repository with sources
    const repository = new DataRepository()
        .setStorage(storage)
        .registerSource('airports', airportSource, new TTLStrategy(7 * 24 * 60 * 60 * 1000));

    // 3. Create query engine with indexes
    const queryEngine = new QueryEngineV2()
        .registerIndex('airports', new MapIndex())
        .registerIndex('airports_search', new TrieIndex())
        .registerIndex('airports_spatial', new SpatialGridIndex());

    // 4. Create services with injected dependencies
    const routeService = new RouteService({ queryEngine, dataRepository: repository });
    const weatherService = new WeatherService({ dataRepository: repository });

    // 5. Export to window.App
    window.App = {
        repository,
        queryEngine,
        routeService,
        weatherService,
        Navigation: window.Navigation,
        Terrain: window.Terrain,
        Weather: window.Weather,
        architecture: 'v3',
        version: '3.0.0'
    };
}
```

## Display Layer Controllers

### WeatherController

The `WeatherController` manages the WX tab and provides weather hazard analysis:

```javascript
window.WeatherController = {
    // Current state
    currentIcao: null,           // Currently displayed airport
    weatherData: null,           // Fetched weather data
    routeWaypoints: [],          // Route waypoints for hazard analysis
    routeLegs: [],               // Leg times for ETA calculation
    routeDepartureTime: null,    // Departure time for time filtering

    // Key methods
    fetchWeather(),              // Fetch METAR/TAF/PIREPs/SIGMETs
    updateRouteWaypoints(wps),   // Update route for hazard analysis
    updateRouteLegs(legs, dep),  // Update legs for ETA calculation
    calculateWaypointETAs(),     // Calculate ETAs for each waypoint
    filterAffectedByTime(),      // Time-based hazard filtering
    showHazardOnMap(type, idx),  // Display hazard polygon on map
};
```

**Route Integration:**
- Receives route waypoints from `UIController` after route calculation
- Calculates ETAs based on leg times and departure time
- Filters hazards by validity time vs. ETA at affected waypoints

### ChartsController

The `ChartsController` manages the Charts tab for TPP chart access:

```javascript
window.ChartsController = {
    // Methods
    searchCharts(),                    // Search by airport code
    showChartsForAirport(code, name),  // Display charts for airport
    updateRouteAirports(airports),     // Update quick-select bar

    // History
    saveToHistory(icao),               // Save to recent history
    displayChartsHistory(),            // Display recent airports
};
```

**Chart Organization:**
- Groups charts by type (APD, IAP, DP, STAR, MIN, HOT)
- Further groups approaches by type (ILS, RNAV, VOR, etc.)
- Formats runway numbers with highlighting

## Legacy Compatibility

v3 coexists with legacy code during migration:

| v3 Component | Legacy Equivalent | Status |
|--------------|-------------------|--------|
| `DataRepository` | `DataManager` | Parallel |
| `QueryEngineV2` | `QueryEngine` | Parallel |
| `Navigation` | `RouteCalculator` | Parallel |
| `RouteService` | `RouteEngine` | Parallel |
| `WeatherService` | `WeatherAPI` | Parallel |

Access v3 via `window.App`:
```javascript
// v3 way
const airport = window.App.queryEngine.getAirport('KSFO');
const route = await window.App.routeService.planRoute('KSFO KLAX');

// Legacy way (still works)
const airport = DataManager.getAirport('KSFO');
const route = await RouteEngine.processRoute('KSFO KLAX');
```

## Index Types

| Index | Use Case | Complexity |
|-------|----------|------------|
| `MapIndex` | Exact key lookup | O(1) |
| `TrieIndex` | Prefix search / autocomplete | O(k) where k = prefix length |
| `SpatialGridIndex` | Nearby / in-bounds queries | O(n/g²) where g = grid cells |

## Cache Strategies

| Strategy | Use Case | Behavior |
|----------|----------|----------|
| `TTLStrategy` | Weather data | Expires after duration |
| `PermanentStrategy` | Terrain data | Never expires |
| `VersionStrategy` | Aviation data | Expires on version change |

## Module Communication

### Hybrid Pattern (window.X Globals)

All modules export to `window` for browser compatibility:

```javascript
// Each layer exports namespaces
window.DataRepository = DataRepository;
window.QueryEngineV2 = QueryEngineV2;
window.Navigation = Navigation;
window.RouteService = RouteService;

// v3 components via App
window.App = { repository, queryEngine, routeService, ... };
```

**Benefits:**
- No build step required
- Works with `file://` protocol
- Service worker compatible
- Easy debugging (visible in console)

**Trade-offs:**
- Manual dependency management (order matters in HTML)
- Global namespace (mitigated by namespacing)

## Performance Optimizations

### Three-Level Caching (DataRepository)

```
L1: Memory Map (fastest)
    ↓ miss
L2: IndexedDB/LocalStorage (persistent)
    ↓ miss
L3: Network fetch (slowest)
```

### Spatial Grid Index

```javascript
// O(n/g²) queries instead of O(n) full scan
const index = new SpatialGridIndex(1.0); // 1-degree grid
index.build(airports); // 70,000 airports
index.query({ lat: 37.5, lon: -122.5, radiusNM: 50 }); // Fast!
```

### SVG Transform for Pan/Zoom

Map panning uses transform attributes instead of regenerating SVG.

## Testing Strategy

### Pure Functions (No Mocks)

```javascript
// Compute layer - test directly
it('calculates distance correctly', () => {
    const result = Navigation.calculateDistance(37.62, -122.38, 33.94, -118.41);
    assert.isTrue(result > 288 && result < 300);
});
```

### Services (Mock Dependencies)

```javascript
// Service layer - inject mocks
const service = new RouteService({
    queryEngine: { getAirport: () => mockAirport },
    dataRepository: { get: () => Promise.resolve(mockData) }
});
const result = await service.planRoute('KSFO KLAX');
```

### Integration (Real Components)

```javascript
// Test component interactions
const qe = new QueryEngineV2()
    .registerIndex('airports', new MapIndex());
qe._indexes.get('airports').build(airports);

const service = new RouteService({ queryEngine: qe, ... });
const result = await service.planRoute('KSFO KLAX');
```

## Debugging

### Access v3 Components

```javascript
// Browser console
window.App.queryEngine.getStats();
window.App.repository._sources;
window.App.routeService.getAirport('KSFO');
```

### Check Architecture Version

```javascript
window.App.architecture; // 'v3'
window.App.version;      // '3.0.0'
```

### Test Pure Functions

```javascript
Navigation.calculateDistance(37.62, -122.38, 33.94, -118.41); // ~294nm
Weather.getFlightCategory(10, 5000);  // 'VFR'
Terrain.checkClearance({ maxMORA: 6000 }, 8000); // { status: 'OK' }
```

## Contributing

### Adding New Features

1. **Identify the layer**: Data, Query, Compute, Service, or Display?
2. **Use patterns**: Strategy for variants, Template for workflows
3. **Keep Compute pure**: No side effects in calculations
4. **Inject dependencies**: Services receive dependencies via constructor
5. **Write tests**: Pure functions first, then integration

### Code Style

- **Naming**: camelCase for functions, UPPER_SNAKE_CASE for constants
- **Comments**: JSDoc for public functions
- **Formatting**: 4-space indentation, single quotes
- **Console logs**: Prefix with module name `[ModuleName]`

---

**Last Updated**: November 2025
**Architecture Version**: v3.2.0
