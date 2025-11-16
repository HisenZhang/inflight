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
├── styles/                     # CSS modules
│   ├── base.css
│   ├── components.css
│   ├── map.css
│   ├── tokens.css
│   └── utilities.css
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
│   ├── route-engine.js         # Route orchestrator
│   ├── route-lexer.js          # Tokenization
│   ├── route-parser.js         # Parsing
│   ├── route-resolver.js       # Semantic analysis
│   ├── route-calculator.js     # Navigation calculations (distance, bearing, wind)
│   ├── route-expander.js       # Airway/STAR/DP expansion
│   └── winds-aloft.js          # Wind data fetching & interpolation
│
├── state/                      # STATE MANAGEMENT
│   ├── flight-state.js         # Flight plan & navigation state, persistence
│   └── flight-tracker.js       # GPS tracking & logging
│
├── display/                    # DISPLAY LAYER (Presentation)
│   ├── app.js                  # Application coordinator, event handlers
│   ├── ui-controller.js        # Form inputs, navlog table, status display
│   ├── tactical-display.js     # Vector map, GPS tracking, popups
│   ├── checklist-controller.js # Interactive checklist
│   └── stats-controller.js     # Flight statistics & monitoring
│
└── docs/                       # Documentation
    ├── user-guide/             # Pilot documentation
    └── developer/              # Developer documentation
```

## Three-Engine Model

```
┌─────────────────────────────────────────────────────────┐
│ DISPLAY LAYER (Presentation)                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ app.js              - Orchestration, event handling │ │
│ │ ui-controller.js    - Forms, tables, status         │ │
│ │ tactical-display.js - Vector map, GPS visualization │ │
│ │ checklist-controller.js - Interactive checklist     │ │
│ │ stats-controller.js - Flight monitoring             │ │
│ └─────────────────────────────────────────────────────┘ │
│                         ↑ (read outputs)                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ STATE MANAGEMENT                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ flight-state.js    - Flight plan state              │ │
│ │ flight-tracker.js  - GPS tracking & logging         │ │
│ └─────────────────────────────────────────────────────┘ │
│                    ↑ (read/write) ↓                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ COMPUTE ENGINE (Business Logic)                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ route-engine.js      - Route orchestrator           │ │
│ │ route-lexer.js       - Tokenization                 │ │
│ │ route-parser.js      - Parsing                      │ │
│ │ route-resolver.js    - Semantic analysis            │ │
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
User clicks "LOAD DATABASE"
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
RouteEngine.processRoute()
    ↓
RouteLexer.tokenize() → RouteParser.parse() → RouteResolver.resolve()
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
TacticalDisplay.displayMap()        ← render vector map
```

### 3. Navigation Phase (In-Flight)

```
App initialization (automatic)
    ↓
TacticalDisplay.startGPSTracking()
    ↓
navigator.geolocation.watchPosition() (1Hz updates)
    ↓
Position callback → currentPosition
    ↓
FlightTracker.updateFlightState(groundSpeed)  ← detect takeoff/landing at 40kt threshold
    ↓
FlightTracker.recordGPSPoint()                ← record GPS track point
    ↓
TacticalDisplay.updateLiveNavigation()        ← update map & navigation display
    ↓
RouteCalculator.calculateDistance/Bearing()   ← compute to next waypoint
    ↓
FlightState.updateNavigation()                ← store real-time state
    ↓
TacticalDisplay.generateMap()                 ← redraw with GPS position
```

## Map Projection System

### Orthographic Projection

InFlight uses **orthographic projection** for the moving map display. This is a perspective projection from an infinite distance that creates a planar view of the sphere.

**Implementation:** [tactical-display.js:470-480](../display/tactical-display.js#L470-L480)

```javascript
// Orthographic projection formulas
const projectToSphere = (lat, lon) => {
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    const dLon = lonRad - centerLonRad;

    const x = Math.cos(latRad) * Math.sin(dLon);
    const y = Math.cos(centerLatRad) * Math.sin(latRad) -
              Math.sin(centerLatRad) * Math.cos(latRad) * Math.cos(dLon);

    return { x, y };
};
```

**Mathematical Formula:**
```
x = cos(lat) * sin(dLon)
y = cos(centerLat) * sin(lat) - sin(centerLat) * cos(lat) * cos(dLon)

where:
  dLon = lon - centerLon (both in radians)
  centerLat, centerLon = projection center (middle of visible bounds)
```

### Coordinate Transformation Pipeline

The system converts geographic coordinates (lat/lon) to SVG pixel coordinates through a multi-step process:

**1. Project to sphere** (spherical → projected plane)
```javascript
const {x, y} = projectToSphere(lat, lon);
```

**2. Scale and center** (projected plane → SVG viewport)
```javascript
const screenX = width/2 + (x - centerX) * scale;
const screenY = height/2 - (y - centerY) * scale;  // Y-axis inverted for SVG
```

**3. Apply pan offset** (SVG viewport → panned view)
```javascript
<g id="mapContent" transform="translate(${panOffset.x}, ${panOffset.y})">
```

**Scale Calculation:** [tactical-display.js:500-507](../display/tactical-display.js#L500-L507)

The scale factor ensures all waypoints fit in the viewport with 5% padding:

```javascript
const scaleX = width / (projRangeX * (1 + 2 * padding));
const scaleY = height / (projRangeY * (1 + 2 * padding));
const baseScale = Math.min(scaleX, scaleY);
const scale = baseScale * zoomLevel; // Apply pinch zoom
```

### Aspect Ratio Handling

InFlight adjusts for latitude-dependent longitude distances:

**Implementation:** [tactical-display.js:422-429](../display/tactical-display.js#L422-L429)

```javascript
// One degree of longitude varies by latitude: 1° lon = 60nm * cos(latitude)
const avgLat = (bounds.minLat + bounds.maxLat) / 2;
const latToLonRatio = Math.cos(avgLat * Math.PI / 180);
const physicalLonRange = lonRange * latToLonRatio;
const routeAspectRatio = physicalLonRange / latRange;
```

SVG dimensions adapt to route orientation:
- **Wide routes** (E-W): 1400×700px (landscape)
- **Tall routes** (N-S): 700×1400px (portrait)
- **Square routes**: 1400×980px (balanced)

### Pan and Zoom

**Zoom Range:** 1.0x (full view) to 3.0x (detailed view)

**Pinch-to-Zoom:** [tactical-display.js:1164-1175](../display/tactical-display.js#L1164-L1175)
```javascript
const currentDistance = getPinchDistance(e.touches);
const scale = currentDistance / initialPinchDistance;
const newZoomLevel = Math.max(1.0, Math.min(3.0, zoomLevel * scale));
```

**Pan Limits:** [tactical-display.js:1142-1149](../display/tactical-display.js#L1142-L1149)
```javascript
// Allow panning proportional to zoom level
const maxPanX = zoomLevel * svgDimensions.width / 2;
const maxPanY = zoomLevel * svgDimensions.height / 2;

panOffset.x = Math.max(-maxPanX, Math.min(maxPanX, panOffset.x));
panOffset.y = Math.max(-maxPanY, Math.min(maxPanY, panOffset.y));
```

At 2x zoom, the user can pan by the full viewport width to explore all areas.

## GPS Tracking System

### Geolocation API Configuration

InFlight uses `navigator.geolocation.watchPosition()` for continuous GPS tracking.

**Implementation:** [tactical-display.js:44-90](../display/tactical-display.js#L44-L90)

```javascript
watchId = navigator.geolocation.watchPosition(
    (position) => {
        currentPosition = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,          // horizontal accuracy (meters)
            altitudeAccuracy: position.coords.altitudeAccuracy,  // vertical accuracy (meters)
            altitude: position.coords.altitude,          // meters MSL
            heading: position.coords.heading,            // true heading (degrees)
            speed: position.coords.speed                 // m/s
        };
        // ... feed to FlightTracker
    },
    (error) => { console.error('[VectorMap] GPS error:', error); },
    {
        enableHighAccuracy: true,  // Use GPS instead of network location when available
        maximumAge: 1000,          // Accept cached position up to 1 second old
        timeout: 5000              // Wait 5 seconds for position before calling error callback
    }
);
```

**Options Explained:**
- `enableHighAccuracy: true`: Requests GPS instead of network triangulation
- `maximumAge: 1000`: Allows 1-second-old cached positions for performance
- `timeout: 5000`: 5-second timeout prevents indefinite waiting

### GPS vs Network Location

The Geolocation API does not distinguish between GPS and network location. InFlight relies on:

1. **`enableHighAccuracy: true` flag**: Requests GPS when available
2. **Accuracy thresholds**: Infers signal quality from `position.coords.accuracy`

**Accuracy Color Coding:** [tactical-display.js:1000-1035](../display/tactical-display.js#L1000-L1035)

| Accuracy | Color | Likely Source |
|----------|-------|---------------|
| < 50m (164ft) | Green | GPS |
| 50-100m (164-328ft) | Yellow | Degraded GPS or WiFi |
| > 100m (328ft) | Red | Network triangulation |

### Flight State Detection

InFlight automatically detects takeoff and landing using a **40-knot speed threshold**.

**Implementation:** [flight-tracker.js:41-87](../state/flight-tracker.js#L41-L87)

```javascript
const TAKEOFF_SPEED_THRESHOLD = 40; // knots
const MIN_SPEED_FOR_FLIGHT = 40;    // knots

function updateFlightState(groundSpeed) {
    const now = Date.now();

    // Detect takeoff (>40kt)
    if (!isInFlight && groundSpeed >= TAKEOFF_SPEED_THRESHOLD) {
        isInFlight = true;
        takeoffTime = now;
        if (recordingMode === 'auto') {
            startRecording(); // Auto-start recording
        }
    }

    // Detect landing (<40kt for 10+ seconds)
    if (isInFlight && groundSpeed < MIN_SPEED_FOR_FLIGHT) {
        if (lastUpdateTime && (now - lastUpdateTime) > 10000) { // 10 seconds
            isInFlight = false;
            if (recordingMode === 'auto') {
                stopRecording(); // Auto-stop and save track
            }
        }
    }
}
```

**State Machine:**
- **ON GROUND → IN FLIGHT**: `groundSpeed >= 40 knots`
- **IN FLIGHT → ON GROUND**: `groundSpeed < 40 knots` for 10+ seconds

The 10-second requirement prevents false landing detection from temporary speed dips (e.g., strong headwinds, slow flight).

### GPS Track Recording

**Track Point Structure:** [flight-tracker.js:111-139](../state/flight-tracker.js#L111-L139)

```javascript
const point = {
    timestamp: Date.now(),              // Unix timestamp (milliseconds)
    lat: position.lat,                  // Decimal degrees
    lon: position.lon,                  // Decimal degrees
    alt: position.altitude || null,     // meters MSL
    speed: position.speed || null,      // knots
    heading: position.heading || null,  // true heading (degrees)
    accuracy: position.accuracy || null,          // horizontal accuracy (meters)
    verticalAccuracy: position.verticalAccuracy || null  // vertical accuracy (meters)
};

gpsTrack.push(point);
```

**Storage:** localStorage under key `'flight_tracks'` [flight-tracker.js:187-213](../state/flight-tracker.js#L187-L213)

**GeoJSON Export:** [flight-tracker.js:253-282](../state/flight-tracker.js#L253-L282)

```javascript
const geojson = {
    type: "Feature",
    properties: {
        name: `Flight Track ${new Date(track.timestamp).toLocaleString()}`,
        timestamp: track.timestamp,
        date: track.date,
        takeoffTime: track.takeoffTime,
        landingTime: track.landingTime,
        flightDuration: track.flightDuration,
        pointCount: track.pointCount
    },
    geometry: {
        type: "LineString",
        coordinates: track.points.map(p => [p.lon, p.lat, p.alt || 0])  // [lon, lat, alt]
    }
};
```

**GeoJSON coordinates use `[longitude, latitude, altitude]` order** (GeoJSON standard), not `[lat, lon]`.

## State Management

### Flight Plan State (window.FlightState)

Managed by [state/flight-state.js](../state/flight-state.js):

```javascript
flightPlan = {
    routeString: "KJFK RBV Q430 AIR CLPRR3 KCMH",
    waypoints: [...],
    legs: [...],
    totalDistance: 432.1,  // nautical miles
    totalTime: 81.3,       // minutes
    fuelStatus: {...},
    options: {...},
    timestamp: 1699564823000
}
```

**Lifecycle**:
- **Created**: When user calculates route
- **Persisted**: Auto-saved to `localStorage` for crash recovery
- **Cleared**: When user clicks "CLEAR" or loads new route

### Navigation State (window.FlightState)

```javascript
navigation = {
    isActive: false,
    currentPosition: {lat, lon, heading, speed, accuracy},
    activeLegIndex: 0,
    distanceToNext: 12.3,    // nautical miles
    headingToNext: 045,      // degrees
    etaNext: Date,
    etaDest: Date,
    groundSpeed: 110         // knots
}
```

**Lifecycle**:
- **Created**: When GPS tracking starts (automatic)
- **Updated**: Every GPS position update (~1 Hz)
- **Cleared**: Never explicitly cleared (updates continuously)

### GPS Tracking State (window.FlightTracker)

Managed by [state/flight-tracker.js](../state/flight-tracker.js):

```javascript
{
    isInFlight: false,           // State: ON GROUND or IN FLIGHT
    takeoffTime: null,           // Unix timestamp
    flightDuration: 0,           // seconds
    isRecording: false,          // Recording active (auto or manual)
    recordingMode: 'auto',       // 'auto' or 'manual'
    gpsTrack: [],                // Array of GPS points
    totalDistance: 0             // nautical miles flown
}
```

## Module Communication

### Hybrid Pattern (window.X Globals)

All modules export to `window` for universal browser compatibility:

```javascript
// Each module exports a namespace
window.DataManager = { ... };
window.RouteEngine = { ... };
window.RouteCalculator = { ... };
window.QueryEngine = { ... };
window.FlightState = { ... };
window.FlightTracker = { ... };
window.UIController = { ... };
window.TacticalDisplay = { ... };
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
Display Layer → State Management → Compute Engine → Data Engine
     ↓               ↓                    ↓               ↓
  (events)      (read/write)         (queries)       (CRUD)
                                         ↓
                                       Utils
```

**Loading Order** (see [index.html](../index.html)):
1. External libraries (geodesy, wind-stations)
2. Utilities (formatters)
3. Data Engine (adapters, data-manager)
4. Compute Engine (route-lexer, parser, resolver, expander, calculator, query, winds)
5. State Management (flight-state, flight-tracker)
6. Display Layer (ui-controller, checklist-controller, stats-controller, tactical-display, app)

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
    const result = await RouteEngine.processRoute(...);

    // Update centralized state
    FlightState.updateFlightPlan(result);
    FlightState.saveToStorage();

    // Display components read from state
    UIController.displayResults();     // Reads FlightState.getFlightPlan()
    TacticalDisplay.displayMap();      // Reads FlightState.getFlightPlan()
}
```

### 4. Event-Driven Architecture

`app.js` coordinates between engines via event handlers:

```javascript
setupEventListeners() {
    calculateBtn.addEventListener('click', handleCalculateRoute);
    clearRouteBtn.addEventListener('click', handleClearRoute);
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
| Aviation database | IndexedDB | 7 days (cache) | ~50MB |
| Token type map | IndexedDB | 7 days (cache) | ~2MB |
| Flight plan (crash recovery) | LocalStorage | Session | ~50KB |
| GPS tracks | LocalStorage | Permanent | ~100KB per track |
| Checklist state | LocalStorage | Permanent | ~5KB |

## Testing Strategy

See [Testing & Deployment](06-testing-deployment.md) for comprehensive testing documentation.

**Test Coverage**:
- `utils/formatters.js`: 100% ✅
- `state/flight-state.js`: 95% ✅
- `compute/route-parser.js`: 90% ✅
- `compute/route-expansion.js`: 85% ✅

## Debugging Tips

### 1. Check Module Load Order

```javascript
// In browser console
Object.keys(window).filter(k =>
    ['DataManager', 'RouteEngine', 'FlightState', 'FlightTracker', 'UIController', 'TacticalDisplay'].includes(k)
);
// Should return all module names if loaded correctly
```

### 2. Inspect Flight State

```javascript
FlightState.getFlightPlan();        // See current route
FlightState.getNavigationState();   // See GPS tracking state
FlightTracker.getFlightState();     // See flight tracking state
FlightTracker.getCurrentTrack();    // See GPS track points
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

### 5. GPS Tracking Diagnostics

```javascript
TacticalDisplay.getCurrentPosition();  // See current GPS position
FlightTracker.getFlightState();       // See flight state (in flight or on ground)
```

## Contributing Guidelines

### Adding New Features

1. **Identify the right engine**: Data, Compute, State, or Display?
2. **Check dependencies**: Does it need new data? New calculations?
3. **Update state if needed**: Does it require persistent state?
4. **Write pure functions**: Avoid side effects in utilities
5. **Document exports**: Add to `window.X` exports section
6. **Add tests**: Write tests for new functionality

### Code Style

- **Naming**: camelCase for functions, UPPER_SNAKE_CASE for constants
- **Comments**: JSDoc for public functions, inline for complex logic
- **Formatting**: 4-space indentation, single quotes for strings
- **Console logs**: Prefix with module name `[ModuleName]`

---

**Last Updated**: January 2025
**Architecture Version**: 3-Engine v2.0
