# Design Goals and Principles

## Project Vision

InFlight is a free, offline-capable flight planning and navigation web application built by pilots, for pilots. The core vision is to provide professional-grade IFR/VFR route planning tools that work entirely in the browser without requiring servers, subscriptions, or internet connectivity.

## Design Goals

### 1. Offline-First Operation

**Goal:** The application must work completely offline after initial database load.

**Why:** Pilots need reliable tools in environments with limited or no internet connectivity (airports, remote areas, in-flight).

**Implementation:**
- All aviation data cached in IndexedDB (50MB)
- Service worker for PWA offline support
- No server-side dependencies for core functionality
- Optional online features (winds aloft) gracefully degrade

**Trade-offs:**
- Initial 5MB database download required
- 7-day cache expiration requires periodic refresh
- Wind data requires internet connection

### 2. Zero Runtime Dependencies

**Goal:** No npm packages in production code.

**Why:** Eliminates supply chain vulnerabilities, ensures long-term maintainability, and keeps the codebase auditable.

**Implementation:**
- Vanilla JavaScript (ES6+)
- No frameworks (React, Vue, Angular)
- No bundlers (webpack, rollup, parcel)
- Custom libraries for geodesy and magnetic variation

**Trade-offs:**
- Manual module management (`window.X` globals)
- More verbose code without framework abstractions
- Custom implementations of common patterns

### 3. No Build Step

**Goal:** The application runs directly from HTML/JS/CSS files.

**Why:** Maximum portability, easier debugging, works with `file://` protocol.

**Implementation:**
- Direct `<script>` tags in HTML
- `window.X` module pattern instead of ES6 modules
- CSS loaded directly without preprocessing
- Service worker registered at runtime

**Benefits:**
- ✅ Works offline without build server
- ✅ Inspect source directly in browser DevTools
- ✅ No build failures in production
- ✅ Easy to fork and modify

**Trade-offs:**
- ❌ No tree-shaking (unused code removal)
- ❌ Manual dependency ordering in HTML
- ❌ No TypeScript compilation

### 4. Progressive Web App (PWA)

**Goal:** Installable on iOS, Android, and desktop as a native-like app.

**Why:** Provides app-like experience without app store distribution.

**Implementation:**
- `manifest.json` for install prompts
- Service worker for offline caching
- Responsive design for mobile/tablet/desktop
- Touch-optimized UI (pan, pinch-zoom)

**Features:**
- Install to home screen (iOS/Android)
- Offline operation after install
- Full-screen mode
- App-like navigation

### 5. Professional Accuracy

**Goal:** Aviation calculations must be accurate and verifiable.

**Why:** Flight planning requires precision for safety and regulatory compliance.

**Implementation:**
- Vincenty formula for great circle distance (accurate to ~0.5mm)
- WGS84 ellipsoid model (EPSG:4326)
- WMM2025 magnetic variation model
- FAA NASR data (official source)

**Accuracy Guarantees:**
- Distance: ±0.01 nautical miles
- Bearing: ±0.1 degrees
- Magnetic variation: ±0.5 degrees
- Fuel calculations: based on user-provided performance data

## Core Principles

### Separation of Concerns

The application uses a **3-Engine Architecture** with clear boundaries:

```text
DATA ENGINE (data/)
  ↓ provides data to
COMPUTE ENGINE (compute/)
  ↓ provides results to
DISPLAY LAYER (display/)
  ↓ updates
STATE MANAGEMENT (state/)
```

**Why:** Each layer has a single responsibility, making testing and maintenance easier.

**Example:**
- `data-manager.js`: CRUD operations only, no business logic
- `route-calculator.js`: Navigation math, no data access
- `ui-controller.js`: Rendering only, no calculations

### Pure Functions

**Principle:** Functions should not have side effects.

**Why:** Predictable behavior, easier testing, better debugging.

**Example:**
```javascript
// Good: Pure function
function calculateDistance(lat1, lon1, lat2, lon2) {
    // Only depends on inputs, returns calculated value
    return haversineDistance(lat1, lon1, lat2, lon2);
}

// Bad: Side effects
function calculateRoute() {
    const route = buildRoute(); // depends on global state
    updateUI(route);            // side effect
    saveToLocalStorage(route);  // side effect
    return route;
}
```

**Application:**
- All `utils/formatters.js` functions are pure (100% test coverage)
- `compute/route-calculator.js` functions are stateless
- Side effects isolated to specific modules (`flight-state.js`, `data-manager.js`)

### State-Driven UI

**Principle:** UI components read from centralized state, not local variables.

**Why:** Single source of truth, easier debugging, crash recovery.

**Implementation:**
```javascript
// Centralized state
window.FlightState = {
    flightPlan: {...},      // Current route
    navigation: {...}       // GPS tracking state
};

// UI components read from state
UIController.displayResults() {
    const plan = FlightState.getFlightPlan();
    renderNavlogTable(plan.legs);
}
```

**Benefits:**
- Crash recovery via localStorage persistence
- Multiple components stay synchronized
- Easy to debug (inspect `window.FlightState` in console)

### Progressive Enhancement

**Principle:** Core features work without internet; enhanced features require connectivity.

**Implementation:**

| Feature | Offline | Online Required |
|---------|---------|-----------------|
| Route planning | ✅ | - |
| Navigation calculations | ✅ | - |
| Vector map | ✅ | - |
| GPS tracking | ✅ | - |
| Winds aloft | - | ✅ Required |
| Database updates | - | ✅ Required |

**Why:** Maximum reliability in variable connectivity environments.

### Fail Gracefully

**Principle:** Errors should not crash the application.

**Implementation:**
```javascript
try {
    const winds = await WindsAloft.fetchWindData();
    applyWindCorrection(winds);
} catch (error) {
    console.error('[RouteCalculator] Wind fetch failed:', error);
    // Continue without wind correction
    showWarning('Wind data unavailable - using no-wind calculations');
}
```

**Error Handling Strategy:**
- Network errors: Degrade to offline mode
- Parse errors: Show user-friendly error messages
- GPS errors: Show accuracy warnings, continue tracking
- Database errors: Attempt recovery, fallback to OurAirports data

### Performance First

**Principle:** The application should feel instant on mobile devices.

**Implementation:**
- IndexedDB for fast local queries (vs. fetching from network)
- Token type map for O(1) lookups (vs. linear search)
- SVG transforms for pan/zoom (vs. regenerating map)
- Spatial query optimization (midpoint approximation)

**Performance Targets:**
- Route calculation: < 100ms (typical)
- Map rendering: < 200ms (1000+ waypoints)
- GPS update: < 50ms (smooth tracking)
- Database query: < 10ms (autocomplete)

### Security and Privacy

**Principle:** No user data leaves the device.

**Implementation:**
- All processing in-browser (no server uploads)
- No analytics or tracking
- No external API calls except:
  - Aviation database downloads (public data)
  - Winds aloft (optional, NOAA public API)

**Privacy Guarantees:**
- Flight plans stored locally only
- GPS tracks never uploaded
- No cookies or session tracking
- Open source (auditable)

## Technical Constraints

### Browser Compatibility

**Target:** Modern browsers with ES6+ support.

**Minimum Versions:**
- Chrome 80+ (2020)
- Safari 13+ (2019)
- Firefox 75+ (2020)
- Edge 80+ (2020)

**Why:** Allows use of modern JavaScript without transpilation.

**Required APIs:**
- IndexedDB (offline storage)
- Service Workers (PWA)
- Geolocation API (GPS tracking)
- SVG (vector map rendering)

### File Protocol Support

**Constraint:** Must work with `file://` URLs (no web server required).

**Why:** Allows users to download and run locally without hosting.

**Implications:**
- No ES6 modules (CORS restrictions with `file://`)
- Service worker requires HTTPS or localhost (not `file://`)
- localStorage and IndexedDB work normally

### Mobile Performance

**Constraint:** Must perform well on mid-range smartphones.

**Target Devices:**
- iPhone 8 (2017) or newer
- Android devices with 2GB+ RAM

**Optimization Strategies:**
- Minimize DOM manipulation (virtual scrolling for long lists)
- Use CSS transforms for animations (GPU-accelerated)
- Lazy load large data sets
- Debounce user input (autocomplete)

## Development Workflow Principles

### Test-Driven Development

**Principle:** Write tests before or alongside new features.

**Why:** Catches regressions early, documents expected behavior.

**Current Coverage:**
- `utils/formatters.js`: 100% ✅
- `state/flight-state.js`: 95% ✅
- `compute/route-parser.js`: 90% ✅
- `compute/route-expansion.js`: 85% ✅

**Target:** 80%+ coverage for all modules.

### Documentation as Code

**Principle:** Documentation lives alongside code and is version-controlled.

**Why:** Keeps docs synchronized with implementation changes.

**Structure:**
- User guide: `/docs/user-guide/` (Markdown)
- Developer guide: `/docs/developer/` (Markdown)
- Code comments: JSDoc for public APIs
- Inline comments: Complex algorithms only

### Code Review Standards

**Principles:**
1. **No feature commits without tests**
2. **No API changes without documentation updates**
3. **No new dependencies without justification**
4. **All code must pass `npm test`**

### Version Control Strategy

**Branching:**
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `fix/*`: Bug fixes

**Commit Messages:**
```text
feat: add airway expansion support
fix: correct magnetic variation calculation
docs: update route parser documentation
test: add coverage for wind interpolation
```

## Future Architecture Decisions

### Web Workers (Planned)

**Goal:** Move heavy computations off main thread.

**Candidates:**
- Route expansion (airways with 100+ waypoints)
- Spatial queries (nearby points search)
- CSV parsing (database loading)

**Benefits:**
- Non-blocking UI during calculations
- Better mobile performance

**Trade-offs:**
- More complex message passing
- Data serialization overhead

### WebAssembly (Under Consideration)

**Goal:** Optimize performance-critical calculations.

**Candidates:**
- Vincenty distance calculations (called thousands of times)
- Magnetic variation (WMM2025 model)

**Benefits:**
- 2-10x performance improvement
- Portable across platforms

**Trade-offs:**
- Build complexity increases
- Debugging becomes harder
- Binary size increases

### IndexedDB vs. OPFS (Future)

**Current:** IndexedDB for all storage

**Alternative:** Origin Private File System (OPFS) for large data sets

**Benefits:**
- Better performance for large files
- Direct file access
- No size limits (IndexedDB has browser-specific limits)

**Blockers:**
- Limited browser support (Chrome 86+, Safari 15.2+)
- More complex API

---

**Last Updated:** January 2025
