# InFlight Architecture Documentation

## Overview

InFlight is a browser-based flight planning and navigation application built with a **3-Engine Architecture** that cleanly separates data management, business logic, and presentation concerns.

## Design Philosophy

### Core Principles

1. **Separation of Concerns**: Each engine has a single, well-defined responsibility
2. **Hybrid Module Pattern**: Uses `window.X` globals for universal browser compatibility (no ES6 modules, no build tools required)
3. **Offline-First**: Works entirely in-browser with IndexedDB caching and service worker support
4. **Progressive Enhancement**: Core features work without internet; enhanced features (winds aloft) require connectivity

### Why 3-Engine Architecture?

The application has three distinct operational phases:
1. **Data Loading**: Fetch and cache aviation databases
2. **Planning (Pre-Flight)**: Route calculation, wind correction, fuel planning
3. **Navigation (In-Flight)**: GPS tracking, real-time guidance

This architecture maps directly to these phases while maintaining clear boundaries.

## Directory Structure

```
inflight/
├── index.html                  # Entry point
├── styles.css                  # Styling
├── manifest.json               # PWA manifest
├── service-worker.js           # Offline support
│
├── lib/                        # External Libraries (No dependencies)
│   ├── geodesy.js              # WGS84 + WMM2025 (geo calculations, mag variation)
│   ├── wind-stations.js        # 254 wind reporting stations
│   └── wind-stations.csv       # Station data
│
├── utils/                      # Shared Utilities (Pure functions)
│   └── formatters.js           # Coordinate, frequency, distance, time formatters
│
├── data/                       # DATA ENGINE (Data Layer)
│   ├── data-manager.js         # IndexedDB orchestrator, CRUD operations
│   ├── nasr-adapter.js         # FAA NASR data parser (US airports/navaids/airways)
│   └── ourairports-adapter.js  # OurAirports parser (worldwide fallback)
│
├── compute/                    # COMPUTE ENGINE (Business Logic)
│   ├── query-engine.js         # Spatial queries, search, autocomplete
│   ├── route-calculator.js     # Navigation calculations (distance, bearing, wind)
│   ├── route-expander.js       # Airway/STAR/DP expansion
│   └── winds-aloft.js          # Wind data fetching & interpolation
│
├── state/                      # STATE MANAGEMENT
│   └── flight-state.js         # Flight plan & navigation state, persistence
│
├── display/                    # DISPLAY LAYER (Presentation)
│   ├── app.js                  # Application coordinator, event handlers
│   ├── ui-controller.js        # Form inputs, navlog table, status display
│   └── tactical-display.js     # Vector map, GPS tracking, popups
│
└── docs/                       # Documentation
    ├── ARCHITECTURE.md         # This file
    ├── README.md               # User-facing docs
    └── QUICK_START.md          # Getting started tutorial
```

## Three-Engine Model

```
┌─────────────────────────────────────────────────────────┐
│ DISPLAY LAYER (Presentation)                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ app.js          - Orchestration, event handling     │ │
│ │ ui-controller.js - Forms, tables, status            │ │
│ │ tactical-display.js - Vector map, GPS visualization │ │
│ └─────────────────────────────────────────────────────┘ │
│                         ↑ (read outputs)                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ COMPUTE ENGINE (Business Logic)                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ query-engine.js      - Spatial queries, search      │ │
│ │ route-calculator.js  - Distance, bearing, wind calc │ │
│ │ route-expander.js    - Airway/STAR/DP expansion     │ │
│ │ winds-aloft.js       - Wind fetch & interpolation   │ │
│ └─────────────────────────────────────────────────────┘ │
│                    ↑ (query) ↓ (results)                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ DATA ENGINE (Data Layer)                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ data-manager.js         - IndexedDB, caching        │ │
│ │ nasr-adapter.js         - FAA NASR parser           │ │
│ │ ourairports-adapter.js  - OurAirports parser        │ │
│ └─────────────────────────────────────────────────────┘ │
│                    (CRUD operations only)               │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Data Loading Phase (Bootstrap)

```
User clicks "LOAD DATA"
    ↓
app.js (handleLoadData)
    ↓
DataManager.loadData()
    ↓
NASRAdapter.loadNASRData() + OurAirportsAdapter.loadOurAirportsData()
    ↓
IndexedDB (store parsed data)
    ↓
QueryEngine.init(data references)
    ↓
UIController.showDataInfo()
```

### 2. Planning Phase (Pre-Flight)

```
User enters route + options
    ↓
app.js (handleCalculateRoute)
    ↓
RouteCalculator.resolveWaypoints()  ← calls DataManager.getAirport/getNavaid/getFix
    ↓
RouteExpander.expandAirways()       ← expands "V25" to waypoint sequence
    ↓
WindsAloft.fetchWindData()          ← fetches real-time winds (if enabled)
    ↓
RouteCalculator.calculateRoute()    ← computes legs, wind correction, fuel
    ↓
FlightState.updateFlightPlan()      ← stores result
    ↓
FlightState.saveToStorage()         ← auto-save for crash recovery
    ↓
UIController.displayResults()       ← render navlog table
    ↓
VectorMap.displayMap()              ← render vector map
```

### 3. Navigation Phase (In-Flight)

```
User clicks "START GPS TRACKING"
    ↓
FlightState.startNavigation()
    ↓
GPS position updates arrive
    ↓
VectorMap.updateLiveNavigation()
    ↓
RouteCalculator.calculateDistance/Bearing()
    ↓
FlightState.updateNavigation()      ← store real-time state
    ↓
VectorMap.updateNavigationDisplay() ← update heading, ETA, distance
    ↓
VectorMap.generateMap()             ← redraw with GPS position
```

## State Management

### Flight Plan State (window.FlightState)

Managed by `state/flight-state.js`:

```javascript
flightPlan = {
    routeString: "KSFO KSQL",
    waypoints: [...],
    legs: [...],
    totalDistance: 25.3,
    totalTime: 12.5,
    fuelStatus: {...},
    options: {...},
    timestamp: 1699564823000
}
```

**Lifecycle**:
- Created: When user calculates route
- Persisted: Auto-saved to `localStorage` for crash recovery
- Cleared: When user clicks "CLEAR" or loads new route

### Navigation State (window.FlightState)

```javascript
navigation = {
    isActive: false,
    currentPosition: {lat, lon, heading, speed, accuracy},
    activeLegIndex: 0,
    distanceToNext: 12.3,
    headingToNext: 045,
    etaNext: Date,
    etaDest: Date,
    groundSpeed: 110
}
```

**Lifecycle**:
- Created: When user starts GPS tracking
- Updated: Every GPS position update (~1 Hz)
- Cleared: When user stops tracking

## Module Communication

### Hybrid Pattern (window.X Globals)

All modules export to `window` for universal browser compatibility:

```javascript
// Each module exports a namespace
window.DataManager = { ... };
window.RouteCalculator = { ... };
window.QueryEngine = { ... };
window.FlightState = { ... };
window.UIController = { ... };
window.VectorMap = { ... };
window.Utils = { ... };
```

**Benefits**:
- ✅ No build step required
- ✅ Works with `file://` protocol
- ✅ No CORS issues during development
- ✅ Service worker compatible
- ✅ Easy debugging (modules visible in console)

**Trade-offs**:
- ❌ Manual dependency management (order matters in HTML)
- ❌ No tree-shaking
- ❌ Global namespace pollution (mitigated by namespacing)

### Dependency Graph

```
Display Layer → Compute Engine → Data Engine
     ↓               ↓               ↓
State Management ← (read/write) → Utils
```

**Loading Order** (see index.html):
1. External libraries (geodesy, wind-stations)
2. Utilities (formatters)
3. Data Engine (adapters, data-manager)
4. Compute Engine (winds, expander, calculator, query)
5. State Management (flight-state)
6. Display Layer (ui-controller, tactical-display, app)

## Key Design Patterns

### 1. Pure Data Engine (CRUD Only)

`data-manager.js` provides **only** data access:

```javascript
window.DataManager = {
    getAirport(code),          // Returns raw object or null
    getNavaid(ident),          // Returns raw object or null
    getFix(name),              // Returns raw object or null
    getAllAirports(),          // Returns Map<code, airport>
    getAllNavaids(),           // Returns Map<ident, navaid>
    // NO business logic (queries, searches, calculations)
};
```

### 2. Compute Engine Receives Data References

`query-engine.js` is initialized with references to data:

```javascript
// In data-manager.js after loading:
QueryEngine.init(
    airportsData,   // Map reference
    navaidsData,    // Map reference
    fixesData,      // Map reference
    tokenTypeMap    // Map reference
);

// QueryEngine can now query without calling DataManager
```

### 3. State-Driven UI Updates

UI components are stateless; they render from `FlightState`:

```javascript
// app.js
async function handleCalculateRoute() {
    const result = await RouteCalculator.calculateRoute(...);

    // Update centralized state
    FlightState.updateFlightPlan(result);
    FlightState.saveToStorage();

    // Display components read from state
    UIController.displayResults();  // Reads FlightState.getFlightPlan()
    VectorMap.displayMap();         // Reads FlightState.getFlightPlan()
}
```

### 4. Event-Driven Architecture

`app.js` coordinates between engines via event handlers:

```javascript
setupEventListeners() {
    calculateBtn.addEventListener('click', handleCalculateRoute);
    clearRouteBtn.addEventListener('click', handleClearRoute);
    toggleGPSBtn.addEventListener('click', () => VectorMap.toggleGPS());
    // ... etc
}
```

## Performance Optimizations

### 1. Incremental Data Loading

NASR and OurAirports load in parallel using `Promise.allSettled()`:

```javascript
const results = await Promise.allSettled([
    NASRAdapter.loadNASRData(),
    OurAirportsAdapter.loadOurAirportsData()
]);
```

### 2. Token Type Map (O(1) Lookups)

Pre-built index for autocomplete and route parsing:

```javascript
tokenTypeMap = new Map([
    ['KSFO', 'airport'],
    ['OAK', 'navaid'],
    ['V25', 'airway'],
    // ... 60,000+ entries
]);

// Fast lookup
QueryEngine.getTokenType('KSFO');  // O(1) → 'airport'
```

### 3. Spatial Query Optimization

Route-based queries check distance to leg midpoints (not full segments):

```javascript
for (const leg of legs) {
    const distToFrom = calculateDistance(..., leg.from);
    const distToTo = calculateDistance(..., leg.to);

    const midLat = (leg.from.lat + leg.to.lat) / 2;
    const midLon = (leg.from.lon + leg.to.lon) / 2;
    const distToMid = calculateDistance(..., midLat, midLon);

    minDistance = Math.min(distToFrom, distToTo, distToMid);
}
```

### 4. SVG Transform for Pan/Zoom

Map panning uses transform attributes instead of regenerating SVG:

```javascript
// Wrap map content in transform group
svg += `<g id="mapContent" transform="translate(${panOffset.x}, ${panOffset.y})">`;

// On pan: only update transform
const mapContent = document.getElementById('mapContent');
mapContent.setAttribute('transform', `translate(${newX}, ${newY})`);
```

## Persistence Strategy

| Data Type | Storage | Lifespan | Size |
|-----------|---------|----------|------|
| Aviation database | IndexedDB | Until user clears | ~50MB |
| Token type map | IndexedDB | Until user clears | ~2MB |
| Flight plan (crash recovery) | LocalStorage | 24 hours | ~50KB |
| Route history | LocalStorage | Permanent | ~1KB |
| User preferences | (Future) LocalStorage | Permanent | <1KB |
| GPS tracking session | Runtime only | Session | N/A |

## Testing Strategy

### Manual Testing Checklist

1. **Data Loading**
   - Load NASR + OurAirports
   - Verify stats display
   - Check inspection panel

2. **Route Planning**
   - Simple route (airports only)
   - Complex route (airways, fixes)
   - IFR route (STAR/DP)
   - Lat/lon coordinates
   - Wind correction enabled
   - Fuel planning enabled

3. **Vector Map**
   - Route rendering
   - Zoom modes (full, to dest, 100nm)
   - Pinch-to-zoom
   - Pan (when zoomed)
   - Waypoint popups
   - Nearby points

4. **GPS Navigation**
   - Start tracking
   - Position updates
   - Waypoint passage (auto-advance)
   - ETA calculations

5. **Persistence**
   - Crash recovery
   - Export/import navlog
   - Route history

## Future Enhancements

### Planned Architecture Changes

1. **Plugin System**: Allow custom data sources, map layers
2. **Worker Threads**: Move heavy computations (route expansion, spatial queries) to Web Workers
3. **Streaming Data**: Use IndexedDB cursors for large result sets
4. **Virtual Scrolling**: For long navlog tables
5. **WebAssembly**: Geodesy calculations (if performance becomes issue)

### Backward Compatibility

When making architecture changes:
- Maintain `window.X` exports for existing code
- Use feature detection for new capabilities
- Provide migration path for cached data

## Debugging Tips

### 1. Check Module Load Order

```javascript
// In browser console
Object.keys(window).filter(k =>
    ['DataManager', 'RouteCalculator', 'FlightState', 'UIController', 'VectorMap'].includes(k)
);
// Should return all module names if loaded correctly
```

### 2. Inspect Flight State

```javascript
FlightState.getFlightPlan();      // See current route
FlightState.getNavigationState(); // See GPS tracking state
```

### 3. Query Engine Diagnostics

```javascript
QueryEngine.searchWaypoints('SFO', 10);  // Test autocomplete
QueryEngine.getTokenType('V25');          // Test token lookup
```

### 4. Data Engine Integrity

```javascript
DataManager.getDataStats();  // Check counts
DataManager.getFileStatus(); // Check individual files
```

## Contributing Guidelines

### Adding New Features

1. **Identify the right engine**: Data, Compute, or Display?
2. **Check dependencies**: Does it need new data? New calculations?
3. **Update state if needed**: Does it require persistent state?
4. **Write pure functions**: Avoid side effects in utilities
5. **Document exports**: Add to `window.X` exports section

### Code Style

- **Naming**: camelCase for functions, UPPER_SNAKE_CASE for constants
- **Comments**: JSDoc for public functions, inline for complex logic
- **Formatting**: 4-space indentation, single quotes for strings
- **Console logs**: Prefix with module name `[ModuleName]`

---

**Last Updated**: November 2025
**Architecture Version**: 3-Engine v1.0
