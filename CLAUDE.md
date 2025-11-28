# Claude Development Guide for IN-FLIGHT v3

## Project Overview

**IN-FLIGHT** is a free, offline-capable flight planning and navigation web application built by pilots, for pilots. It's a browser-based Progressive Web App (PWA) for IFR/VFR route planning, navigation log generation, wind correction calculations, GPS tracking, and moving map display.

**Architecture Version:** v3.0.0 - Complete layered architecture with dependency injection

**Tech Stack:**
- **Language:** Vanilla JavaScript (ES6+) - NO frameworks, NO bundler
- **Module Pattern:** `window.X` globals for universal browser compatibility
- **Architecture:** 5-layer (Display → Service → Compute → Query → Data)
- **Storage:** IndexedDB (aviation data), LocalStorage (flight plans)
- **Offline:** Service worker PWA
- **Testing:** Custom test framework + JSDOM (zero runtime dependencies)
- **Docs:** VitePress (Markdown → static site)

**Key Stats:**
- 15,000+ lines of JavaScript (including v3 architecture)
- 70,000+ airports, 10,000+ navaids
- 536 automated tests (all passing)
- Zero runtime dependencies

---

## Architecture: 5-Layer Model (v3.0.0)

```
┌─────────────────────────────────────────────────────────────┐
│ DISPLAY LAYER (/display)                                    │
│ - app.js: Main coordinator                                  │
│ - ui-controller.js: Forms, navlog, status                   │
│ - map-display.js: Vector map & GPS                          │
└─────────────────────────────────────────────────────────────┘
                            │ calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVICE LAYER (/services)                                   │
│ - route-service.js: Route planning orchestration            │
│ - weather-service.js: Weather data orchestration            │
└─────────────────────────────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ COMPUTE LAYER (/compute) - PURE FUNCTIONS                   │
│ - navigation.js: Distance, bearing, wind correction         │
│ - terrain.js: MORA analysis, clearance checking             │
│ - weather.js: METAR parsing, flight category                │
└─────────────────────────────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ QUERY LAYER (/query)                                        │
│ - query-engine-v2.js: Index coordinator                     │
│ - indexes/: MapIndex, TrieIndex, SpatialGridIndex           │
└─────────────────────────────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ DATA LAYER (/data)                                          │
│ - repository.js: L1/L2/L3 caching facade                    │
│ - core/: DataSource, StorageAdapter, CacheStrategy          │
│ - data-manager.js: Legacy IndexedDB orchestrator            │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Dependencies flow DOWNWARD only. Never up, never sideways.

---

## Development Workflow

### Setup (First Time)
```bash
nvm use                  # Use Node 20.18.1 (.nvmrc)
npm install              # Install jsdom + vitepress (dev only)
```

### Run Locally
```bash
npm start                # Opens index.html in browser
# OR just open index.html directly (works with file:// protocol)
```

### Testing
```bash
npm test                 # Run all 536 unit/integration tests (Node.js + JSDOM)
npm run test:browser     # Interactive browser tests (/tests/index.html)
npm run test:e2e         # Run Playwright E2E tests (requires browser install)
npm run test:e2e:headed  # E2E tests with visible browser
npm run test:e2e:ui      # Playwright UI mode for debugging
npm run test:all         # Run both unit tests and E2E tests
```

**E2E Setup (first time):**
```bash
npx playwright install chromium   # Install browser for E2E tests
```

**Test Structure:**
- **Unit Tests:** [/tests/test-framework.js](tests/test-framework.js) - Custom framework + JSDOM
- **Browser Tests:** [/tests/index.html](tests/index.html) - Interactive test runner
- **E2E Tests:** [/e2e/](e2e/) - Playwright browser automation
  - `app.spec.js` - App bootstrap, tabs, navigation
  - `route.spec.js` - Route planning, pure functions
  - `map.spec.js` - Map display, GPS tracking
- v3 test suites: `test-data-core.js`, `test-query-indexes.js`, `test-navigation.js`, `test-terrain.js`, `test-weather.js`, `test-services.js`, `test-integration.js`

### Documentation
```bash
npm run docs:dev         # Serve docs at http://localhost:5173
npm run docs:build       # Build docs → docs/.vitepress/dist
```

---

## Code Guidelines

### Before Making Edits

**ALWAYS read these files first:**
1. Relevant source file(s) you're editing
2. Related test file(s) in `/tests/`
3. [docs/developer/02-architecture.md](docs/developer/02-architecture.md) for v3 architecture

### Layer Rules

| Layer | Allowed to Call | NOT Allowed to Call |
|-------|-----------------|---------------------|
| Display | Service, State | Data, Query, Compute directly |
| Service | Compute, Query, Data | Display |
| Compute | Nothing (pure functions) | Everything else |
| Query | Data | Service, Display, Compute |
| Data | Nothing (storage only) | Everything else |

### Pure Functions (Compute Layer)

All Compute layer code MUST be pure:
```javascript
// GOOD: Pure function
function calculateDistance(lat1, lon1, lat2, lon2) {
    return Geodesy.vincentyDistance(lat1, lon1, lat2, lon2);
}

// BAD: Side effects in compute
function calculateDistance(lat1, lon1, lat2, lon2) {
    const result = Geodesy.vincentyDistance(lat1, lon1, lat2, lon2);
    localStorage.setItem('lastDistance', result);  // NO!
    return result;
}
```

### Dependency Injection (Services)

Services receive dependencies via constructor:
```javascript
// GOOD: Injected dependencies
class RouteService {
    constructor({ queryEngine, dataRepository }) {
        this._query = queryEngine;
        this._repo = dataRepository;
    }
}

// BAD: Hard-coded dependencies
class RouteService {
    constructor() {
        this._query = window.QueryEngine;  // NO!
    }
}
```

### Coding Conventions

**Style:**
- **Indentation:** 4 spaces
- **Quotes:** Single quotes `'string'`
- **Naming:**
  - Functions: `camelCase` (`calculateRoute`, `getAirport`)
  - Constants: `UPPER_SNAKE_CASE` (`DB_NAME`, `CACHE_DURATION`)
  - Classes: `PascalCase` (`RouteService`, `MapIndex`)
  - Files: `kebab-case` (`route-service.js`)
  - CSS: `kebab-case` (`btn-primary`, `navlog-table`)

**Module Pattern:**
```javascript
// v3: Class-based with window export
class RouteService {
    constructor({ queryEngine, dataRepository }) {
        this._query = queryEngine;
        this._repo = dataRepository;
    }

    async planRoute(routeString, options) {
        // ...
    }
}
window.RouteService = RouteService;

// Pure function modules
const Navigation = {
    calculateDistance(lat1, lon1, lat2, lon2) {
        return Geodesy.vincentyDistance(lat1, lon1, lat2, lon2);
    }
};
window.Navigation = Navigation;
```

**Console Logs:** Prefix with module name
```javascript
console.log('[RouteService] Planning route...');
console.log('[DataRepository] L3 source fetch: airports');
```

### Testing Protocol

**When adding features:**
1. Write test first (TDD encouraged)
2. Add to appropriate test file in `/tests/`
3. Run `npm test` to verify
4. Ensure all 536+ tests still pass

**v3 Test Pattern:**
```javascript
TestFramework.describe('Navigation - Distance Calculations', function({ it }) {
    it('should calculate SFO to LAX distance correctly (~294nm)', () => {
        const distance = window.Navigation.calculateDistance(
            37.62, -122.38, 33.94, -118.41
        );
        assert.isTrue(distance > 288 && distance < 300,
            `Distance should be ~294nm, got ${distance}`);
    });
});
```

---

## Version Management

### Versioning System

IN-FLIGHT uses **centralized version management** via [version.js](version.js).

**Files that must stay in sync:**
1. [version.js](version.js) - Single source of truth
2. [package.json](package.json) - `version` field
3. [manifest.json](manifest.json) - `version` field

### Releasing a New Version

```bash
# 1. Edit version.js
MAJOR: 3,           # Breaking changes
MINOR: 0,           # New features
PATCH: 0,           # Bug fixes
CACHE_VERSION: 144, # Increment ALWAYS
BUILD_DATE: '2025-11-28',
RELEASE_NAME: 'Description'

# 2. Sync package.json and manifest.json version

# 3. Test
npm test

# 4. Update CHANGELOG.md

# 5. Commit with version tag
git add .
git commit -m "chore: bump version to v3.0.0"
git tag v3.0.0
git push && git push --tags
```

---

## Common Tasks

### Adding a Pure Function (Compute Layer)

```javascript
// 1. Add to compute/your-module.js
const YourModule = {
    yourFunction(input) {
        // Pure calculation - no side effects!
        return result;
    }
};
window.YourModule = YourModule;

// 2. Add test to tests/test-your-module.js
TestFramework.describe('YourModule', function({ it }) {
    it('should calculate correctly', () => {
        const result = window.YourModule.yourFunction(input);
        assert.equals(result, expected);
    });
});

// 3. Run: npm test
```

### Adding a New Index Type (Query Layer)

```javascript
// 1. Create query/indexes/your-index.js extending IndexStrategy
class YourIndex extends window.IndexStrategy {
    build(data) { /* ... */ }
    query(params) { /* ... */ }
    // ...
}
window.YourIndex = YourIndex;

// 2. Register in main.js or where QueryEngine is created
queryEngine.registerIndex('your_index', new YourIndex());

// 3. Add tests to tests/test-query-indexes.js
```

### Adding a New Service (Service Layer)

```javascript
// 1. Create services/your-service.js
class YourService {
    constructor({ queryEngine, dataRepository }) {
        this._query = queryEngine;
        this._repo = dataRepository;
    }

    async yourMethod(input) {
        // Orchestrate Query + Compute + Data
        const data = await this._repo.get('source', 'key');
        return Navigation.calculate(data);
    }
}
window.YourService = YourService;

// 2. Add to main.js bootstrap
const yourService = new YourService({ queryEngine, dataRepository: repository });
window.App.yourService = yourService;

// 3. Add tests to tests/test-services.js
```

### Adding a Data Source (Data Layer)

```javascript
// 1. Create class extending DataSource
class YourSource extends window.DataSource {
    async fetch() {
        const response = await fetch('https://...');
        return response.text();
    }

    async parse(rawData) {
        return /* parsed data */;
    }
}

// 2. Register with repository
repository.registerSource('your_data', new YourSource(), new TTLStrategy(duration));
```

---

## Key Files Reference

### v3 Architecture (NEW)
- [main.js](main.js) - Application bootstrap
- [data/repository.js](data/repository.js) - DataRepository
- [data/core/data-source.js](data/core/data-source.js) - Abstract DataSource
- [query/query-engine-v2.js](query/query-engine-v2.js) - QueryEngineV2
- [query/indexes/](query/indexes/) - MapIndex, TrieIndex, SpatialGridIndex
- [compute/navigation.js](compute/navigation.js) - Pure navigation functions
- [compute/terrain.js](compute/terrain.js) - Pure terrain functions
- [compute/weather.js](compute/weather.js) - Pure weather functions
- [services/route-service.js](services/route-service.js) - Route orchestration
- [services/weather-service.js](services/weather-service.js) - Weather orchestration

### Entry Points
- [index.html](index.html) - Main HTML
- [service-worker.js](service-worker.js) - PWA offline support
- [version.js](version.js) - Version management

### State & Display
- [state/flight-state.js](state/flight-state.js) - Flight plan state
- [state/flight-tracker.js](state/flight-tracker.js) - GPS tracking
- [display/app.js](display/app.js) - Application coordinator
- [display/ui-controller.js](display/ui-controller.js) - UI rendering
- [display/map-display.js](display/map-display.js) - Vector map

### Legacy (Still Functional)
- [data/data-manager.js](data/data-manager.js) - IndexedDB orchestrator
- [compute/query-engine.js](compute/query-engine.js) - Legacy queries
- [compute/route-calculator.js](compute/route-calculator.js) - Legacy navigation

---

## Debugging Tips

### Access v3 Components
```javascript
// Browser console
window.App                          // v3 app object
window.App.architecture             // 'v3'
window.App.version                  // '3.0.0'
window.App.queryEngine.getStats()   // Index statistics
window.App.routeService.getAirport('KSFO')
```

### Test Pure Functions
```javascript
Navigation.calculateDistance(37.62, -122.38, 33.94, -118.41)  // ~294nm
Weather.getFlightCategory(10, 5000)  // 'VFR'
Terrain.checkClearance({ maxMORA: 6000, requiredClearance: 1000, maxTerrain: 5000 }, 8000)
```

### Check Legacy Components
```javascript
DataManager.getAirport('KORD')
RouteCalculator.calculateDistance(...)
QueryEngine.searchWaypoints('SFO', 10)
```

---

## Development Philosophy

### Core Principles

1. **Zero Dependencies:** No npm packages in production
2. **Offline First:** Must work with airplane mode
3. **No Build Step:** Direct file loading
4. **Test Before Merge:** All code requires tests
5. **Pure Compute:** Calculations have no side effects
6. **Dependency Injection:** Services receive dependencies

### Code Quality Standards

- Write tests for new features (536+ tests and growing)
- Keep Compute layer pure (no side effects)
- Use dependency injection in Services
- Update docs when changing APIs
- No console.logs in production (use prefixed logs for debug)

### Anti-Patterns to Avoid

- Adding npm dependencies (ask first!)
- Using frameworks (React, Vue, etc.)
- Introducing build tools
- Breaking offline functionality
- Side effects in Compute layer
- Hard-coded dependencies in Services
- Upward or sideways layer dependencies

---

## Questions?

**Read these first:**
- [docs/developer/02-architecture.md](docs/developer/02-architecture.md) - v3 Architecture
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [docs/developer/ARCHITECTURE_V2_SPEC.md](docs/developer/ARCHITECTURE_V2_SPEC.md) - Technical specification

**Check git history:**
```bash
git log --oneline -20  # Recent changes
git diff HEAD~5        # What changed
```

---

*Last Updated: 2025-11-28*
*IN-FLIGHT v3.0.0*
