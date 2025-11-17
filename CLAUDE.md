# Claude Development Guide for InFlight

## Project Overview

**InFlight** is a free, offline-capable flight planning and navigation web application built by pilots, for pilots. It's a browser-based Progressive Web App (PWA) for IFR/VFR route planning, navigation log generation, wind correction calculations, GPS tracking, and moving map display.

**Tech Stack:**
- **Language:** Vanilla JavaScript (ES6+) - NO frameworks, NO bundler
- **Module Pattern:** `window.X` globals for universal browser compatibility
- **Storage:** IndexedDB (aviation data), LocalStorage (flight plans)
- **Offline:** Service worker PWA
- **Testing:** Custom test framework + JSDOM (zero runtime dependencies)
- **Docs:** VitePress (Markdown → static site)

**Key Stats:**
- 12,820 lines of JavaScript
- 70,000+ airports, 10,000+ navaids
- 50+ automated tests
- 9,000+ lines of documentation
- Zero runtime dependencies

---

## Architecture: 3-Engine System

```
┌─────────────────────────────────────────────────────┐
│ DISPLAY LAYER (/display)                           │
│ - app.js: Main coordinator                         │
│ - ui-controller.js: Forms, navlog, status          │
│ - tactical-display.js: Vector map & GPS            │
│ - checklist-controller.js, stats-controller.js     │
└─────────────────────────────────────────────────────┘
                        ↓ ↑
┌─────────────────────────────────────────────────────┐
│ STATE MANAGEMENT (/state)                           │
│ - flight-state.js: Flight plan state + persistence │
│ - flight-tracker.js: GPS tracking & logging         │
└─────────────────────────────────────────────────────┘
                        ↓ ↑
┌─────────────────────────────────────────────────────┐
│ COMPUTE ENGINE (/compute)                           │
│ - route-engine.js: Orchestrator                     │
│ - route-lexer.js → parser.js → resolver.js         │
│ - route-expander.js: Airways/SIDs/STARs/DPs         │
│ - route-calculator.js: Navigation math (Vincenty)   │
│ - query-engine.js: Spatial queries, search          │
│ - winds-aloft.js: Wind data fetching                │
└─────────────────────────────────────────────────────┘
                        ↓ ↑
┌─────────────────────────────────────────────────────┐
│ DATA ENGINE (/data)                                 │
│ - data-manager.js: IndexedDB orchestrator           │
│ - nasr-adapter.js: FAA NASR CSV parser              │
│ - ourairports-adapter.js: OurAirports CSV parser    │
│ - /data/local/ (55MB, gitignored)                   │
└─────────────────────────────────────────────────────┘
```

**Data Flow:**
```
User Input → Display → Compute → Data
               ↓         ↓        ↓
            State ← Update ← Query
```

---

## Development Workflow

### 🔧 Setup (First Time)
```bash
nvm use                  # Use Node 20.18.1 (.nvmrc)
npm install              # Install jsdom + vitepress (dev only)
```

### 🚀 Run Locally
```bash
npm start                # Opens index.html in browser
# OR just open index.html directly (works with file:// protocol)
```

### ✅ Testing
```bash
npm test                 # Run all tests (Node.js + JSDOM, ~1 sec)
npm run test:browser     # Interactive browser tests (/tests/index.html)
```

**Test Structure:**
- Custom framework: [/tests/test-framework.js](tests/test-framework.js)
- Node runner: [/tests/test-runner.js](tests/test-runner.js)
- Suites:
  - [test-utils.js](tests/test-utils.js) - Formatters (100% coverage)
  - [test-state.js](tests/test-state.js) - Flight state (95% coverage)
  - [test-route-parser.js](tests/test-route-parser.js) - Parser
  - [test-route-expansion.js](tests/test-route-expansion.js) - Expansion

### 📚 Documentation
```bash
npm run docs:dev         # Serve docs at http://localhost:5173
npm run docs:build       # Build docs → docs/.vitepress/dist
npm run docs:preview     # Preview built docs
```

**Docs Structure:**
- [docs/user-guide/](docs/user-guide/) - Pilot documentation (11 files)
- [docs/developer/](docs/developer/) - Developer documentation (10 files)
  - [ARCHITECTURE.md](docs/developer/ARCHITECTURE.md)
  - [TESTING.md](docs/developer/TESTING.md)
  - [PARSER_ARCHITECTURE.md](docs/developer/PARSER_ARCHITECTURE.md)
  - [ROUTE_GRAMMAR.md](docs/developer/ROUTE_GRAMMAR.md)

---

## Code Guidelines

### 🎯 Before Making Edits

**ALWAYS read these files first:**
1. Relevant source file(s) you're editing
2. Related test file(s) in `/tests/`
3. [docs/developer/ARCHITECTURE.md](docs/developer/ARCHITECTURE.md) for system design
4. Module-specific docs if available

**Example workflow:**
```bash
# Before editing route-parser.js
1. Read compute/route-parser.js
2. Read tests/test-route-parser.js
3. Read docs/developer/PARSER_ARCHITECTURE.md
4. Make changes
5. Run: npm test
6. Update tests if needed
7. Update docs if API changed
```

### ✏️ Coding Conventions

**Style:**
- **Indentation:** 4 spaces
- **Quotes:** Single quotes `'string'`
- **Naming:**
  - Functions: `camelCase` (`calculateRoute`, `getAirport`)
  - Constants: `UPPER_SNAKE_CASE` (`DB_NAME`, `CACHE_DURATION`)
  - Files: `kebab-case` (`route-calculator.js`)
  - CSS: `kebab-case` (`btn-primary`, `navlog-table`)

**Module Pattern:**
```javascript
// All modules export to window for browser compatibility
window.ModuleName = {
    publicFunction() {
        return this._privateHelper();
    },

    _privateHelper() {
        // Leading underscore for private methods
    }
};
```

**Comments:**
```javascript
/**
 * Public function - JSDoc format
 * @param {string} route - Route string like "KALB Q822 FNT"
 * @returns {Array} Parsed route segments
 */
function parseRoute(route) {
    // Inline comments for complex logic
    const tokens = route.split(/\s+/);
    return tokens.map(t => processToken(t));
}
```

**Console Logs:** Prefix with module name for debugging
```javascript
console.log('[DataManager] Loading airports...');
console.error('[RouteParser] Invalid token:', token);
```

### 🧪 Testing Protocol

**When adding features:**
1. Write test first (TDD encouraged)
2. Add to appropriate test file in `/tests/`
3. Run `npm test` to verify
4. Ensure existing tests still pass
5. Update [docs/developer/TESTING.md](docs/developer/TESTING.md) if new pattern

**Test naming:**
```javascript
// tests/test-your-module.js
window.YourModuleTests = [
    {
        name: 'descriptive test name',
        run() {
            const result = YourModule.yourFunction('input');
            assert.equals(result, expectedValue, 'should do X when Y');
        }
    }
];
```

### 📝 Documentation Updates

**When to update docs:**
- ✅ New feature → Add to user guide
- ✅ API change → Update developer docs
- ✅ Architecture change → Update [ARCHITECTURE.md](docs/developer/ARCHITECTURE.md)
- ✅ New test pattern → Update [TESTING.md](docs/developer/TESTING.md)
- ✅ Breaking change → Update [CONTRIBUTING.md](docs/CONTRIBUTING.md)

**Docs are Markdown with VitePress:**
- Use relative links: `[text](./file.md)`
- Add to sidebar in [docs/.vitepress/config.mts](docs/.vitepress/config.mts)
- Test with `npm run docs:dev`

---

## Version Management

### 🏷️ Versioning System

InFlight uses **centralized version management** via [version.js](version.js) as the single source of truth.

**Version Numbers:**
- **Semantic Version** (`MAJOR.MINOR.PATCH`) - Follows [semver.org](https://semver.org)
  - `MAJOR` - Breaking changes, incompatible API changes
  - `MINOR` - New features, backwards-compatible
  - `PATCH` - Bug fixes, backwards-compatible
- **Cache Version** (`CACHE_VERSION`) - Incremental number for PWA updates

**Files that must stay in sync:**
1. [version.js](version.js) - Single source of truth ✅
2. [package.json](package.json) - `version` field
3. [manifest.json](manifest.json) - `version` field

### 📦 Releasing a New Version

**Every release must update these version numbers:**

```bash
# 1. Edit version.js
vim version.js

# Update these fields:
MAJOR: 2,        # Increment for breaking changes
MINOR: 1,        # Increment for new features
PATCH: 0,        # Increment for bug fixes
CACHE_VERSION: 57,  # Increment by 1 ALWAYS
BUILD_DATE: '2025-01-16',  # Today's date
RELEASE_NAME: 'Feature: New navigation mode'  # Brief description

# 2. Sync package.json (manual for now)
vim package.json
# Change "version": "2.0.0" → "2.1.0"

# 3. Sync manifest.json (manual for now)
vim manifest.json
# Change "version": "2.0.0" → "2.1.0"

# 4. Test locally
npm test

# 5. Commit with version tag
git add version.js package.json manifest.json
git commit -m "chore: bump version to v2.1.0"
git tag v2.1.0
git push && git push --tags
```

### 🔄 Version Number Guidelines

**When to increment MAJOR (2.0.0 → 3.0.0):**
- Changed route parsing grammar (breaks existing routes)
- Removed public APIs
- Changed IndexedDB schema incompatibly
- New architecture requiring data migration

**When to increment MINOR (2.0.0 → 2.1.0):**
- Added new features (e.g., RNAV approach support)
- Added new tabs/sections
- New data sources
- Enhanced existing features (backwards-compatible)

**When to increment PATCH (2.0.0 → 2.0.1):**
- Bug fixes only
- Performance improvements
- Documentation updates (code unchanged)
- Style/CSS tweaks

**When to increment CACHE_VERSION:**
- **ALWAYS** when deploying ANY code change
- Even for comment-only changes (triggers PWA update)
- Increment by 1 sequentially (v56 → v57 → v58)

### 🚀 Deployment Checklist

```bash
# Pre-deployment checklist:
☑ Updated version.js with new version numbers
☑ Synced package.json version
☑ Synced manifest.json version
☑ Incremented CACHE_VERSION by 1
☑ Updated BUILD_DATE to today
☑ Updated RELEASE_NAME with brief description
☑ All tests passing (npm test)
☑ Docs updated if API changed
☑ Committed with version tag (git tag v2.1.0)

# Deploy:
git push origin main
# Cloudflare auto-deploys from main branch

# Post-deployment:
☑ Test PWA update detection
☑ Verify version shows correctly in WELCOME tab
☑ Check browser console for version log
```

### 🛠️ Version Automation (Future)

Currently version syncing is manual. Future automation options:

```bash
# Option 1: npm version command (creates git tag automatically)
npm version patch  # 2.0.0 → 2.0.1
npm version minor  # 2.0.0 → 2.1.0
npm version major  # 2.0.0 → 3.0.0

# Option 2: Custom release script (future)
npm run release -- --type=minor
# Would auto-update version.js, package.json, manifest.json
# Create git tag, push to origin
```

### 📍 Where Version Numbers Appear

**User-visible:**
- WELCOME tab → APP VERSION section
- Browser console on page load
- Service worker console logs

**Internal:**
- Service worker cache name (`flight-planning-v56`)
- PWA manifest
- Package metadata

### 🔍 Checking Current Version

**Via Browser Console:**
```javascript
window.AppVersion.getVersionInfo()
// Returns:
// {
//   version: "2.0.0",
//   cacheName: "flight-planning-v56",
//   cacheVersion: 56,
//   buildDate: "2025-01-15",
//   releaseName: "Initial PWA Update System"
// }
```

**Via UI:**
1. Open PWA
2. Go to WELCOME tab
3. Scroll to "APP VERSION" section
4. See: Version, Cache, Build Date

**Via Service Worker:**
```javascript
// DevTools → Application → Service Workers → Console
// Look for: "[ServiceWorker] Cache name: flight-planning-v56 | App version: 2.0.0"
```

---

## Common Tasks

### Adding a New Route Keyword/Operator

**Files to modify:**
1. [compute/route-lexer.js](compute/route-lexer.js) - Add token type
2. [compute/route-parser.js](compute/route-parser.js) - Add parsing logic
3. [compute/route-resolver.js](compute/route-resolver.js) - Add semantic analysis
4. [tests/test-route-parser.js](tests/test-route-parser.js) - Add test cases
5. [docs/developer/ROUTE_GRAMMAR.md](docs/developer/ROUTE_GRAMMAR.md) - Document grammar

**Example:** Adding `VIA` keyword
```javascript
// 1. route-lexer.js
const KEYWORDS = ['DCT', 'VIA', /* ... */];

// 2. route-parser.js
parseSegment(tokens) {
    if (token.type === 'VIA') {
        // Handle VIA logic
    }
}

// 3. tests/test-route-parser.js
{
    name: 'should parse VIA keyword',
    run() {
        const result = RouteParser.parse('KALB VIA PAYGE');
        assert.equals(result.segments[0].type, 'VIA');
    }
}

// 4. Run: npm test
```

### Adding a New UI Feature

**Files to modify:**
1. [index.html](index.html) - Add HTML structure
2. [styles/components.css](styles/components.css) - Add styles
3. [display/ui-controller.js](display/ui-controller.js) - Add event handlers
4. [display/app.js](display/app.js) - Wire up coordinator logic
5. [state/flight-state.js](state/flight-state.js) - Add state if needed
6. [docs/user-guide/](docs/user-guide/) - Add user documentation

**Example:** Adding a "Save Route" button
```javascript
// 1. index.html
<button id="save-route-btn" class="btn-primary">Save Route</button>

// 2. styles/components.css
.btn-primary { /* existing styles */ }

// 3. display/ui-controller.js
window.UIController = {
    init() {
        document.getElementById('save-route-btn').addEventListener('click', this.saveRoute.bind(this));
    },

    saveRoute() {
        const route = FlightState.flightPlan.route;
        FlightState.saveToStorage();
        this.showStatus('Route saved!');
    }
};

// 4. display/app.js
document.addEventListener('DOMContentLoaded', () => {
    UIController.init();
});
```

### Adding a New Data Source/Adapter

**Files to modify:**
1. [data/your-adapter.js](data/) - Create new adapter
2. [data/data-manager.js](data/data-manager.js) - Integrate adapter
3. [tests/test-data.js](tests/) - Add test suite (create if needed)
4. [docs/developer/ARCHITECTURE.md](docs/developer/ARCHITECTURE.md) - Document data flow

**Pattern:**
```javascript
// data/your-adapter.js
window.YourAdapter = {
    /**
     * Parses CSV data from your source
     * @param {string} csvData - Raw CSV string
     * @returns {Array} Parsed records
     */
    parseCsv(csvData) {
        const lines = csvData.split('\n');
        return lines.map(line => {
            // Parse logic
        });
    },

    async loadData() {
        const response = await fetch('https://your-source.com/data.csv');
        const csv = await response.text();
        return this.parseCsv(csv);
    }
};

// data/data-manager.js
async loadAllData() {
    const yourData = await YourAdapter.loadData();
    await this.storeInIndexedDB('yourStore', yourData);
}
```

### Updating Service Worker Cache

**File:** [service-worker.js](service-worker.js)

**When to update:**
- ✅ Adding new JS/CSS files
- ✅ Changing file paths
- ✅ Major version bump

**Steps:**
1. Increment `CACHE_NAME` version (e.g., `v47` → `v48`)
2. Add new files to `ASSETS_TO_CACHE` array
3. Test offline functionality in browser DevTools

```javascript
const CACHE_NAME = 'flight-planning-v48'; // Increment version

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './your-new-file.js', // Add new files here
    // ...
];
```

---

## Key Files Reference

### Entry Points
- [index.html](index.html) - Main HTML (1058 lines)
- [display/app.js](display/app.js) - Main coordinator (712 lines)
- [service-worker.js](service-worker.js) - PWA offline support

### Core Engines
- [data/data-manager.js](data/data-manager.js) - IndexedDB orchestrator (1293 lines)
- [compute/route-engine.js](compute/route-engine.js) - Route orchestrator (206 lines)
- [compute/query-engine.js](compute/query-engine.js) - Spatial queries (745 lines)

### Route Parsing Pipeline
1. [compute/route-lexer.js](compute/route-lexer.js) - Tokenization (45 lines)
2. [compute/route-parser.js](compute/route-parser.js) - Parsing (239 lines)
3. [compute/route-resolver.js](compute/route-resolver.js) - Semantic analysis (356 lines)
4. [compute/route-expander.js](compute/route-expander.js) - Airway expansion (600 lines)
5. [compute/route-calculator.js](compute/route-calculator.js) - Navigation math (566 lines)

### State & Display
- [state/flight-state.js](state/flight-state.js) - Flight plan state (432 lines)
- [state/flight-tracker.js](state/flight-tracker.js) - GPS tracking (497 lines)
- [display/ui-controller.js](display/ui-controller.js) - UI rendering (1550 lines)
- [display/tactical-display.js](display/tactical-display.js) - Vector map (1391 lines)

### Utilities
- [utils/formatters.js](utils/formatters.js) - Coordinate/frequency formatters (346 lines)
- [lib/geodesy.js](lib/geodesy.js) - WGS84 + WMM2025 (417 lines)
- [lib/wind-stations.js](lib/wind-stations.js) - Wind stations (246 lines)

### Styling
- [styles/base.css](styles/base.css) - Base styles (83 lines)
- [styles/components.css](styles/components.css) - UI components (1003 lines)
- [styles/map.css](styles/map.css) - Map styles (514 lines)
- [styles/tokens.css](styles/tokens.css) - Design tokens (25 lines)
- [styles/utilities.css](styles/utilities.css) - Utility classes (117 lines)

---

## CI/CD & Deployment

### GitHub Actions
- [.github/workflows/test.yml](.github/workflows/test.yml) - Test suite (Node 16/18/20)
- [.github/workflows/docs-check.yml](.github/workflows/docs-check.yml) - Docs validation

**Triggers:**
- Push to `main`, `develop`, `claude/*`
- Pull requests to `main`

### Deployment

**Main App:**
- Static hosting (Cloudflare Pages, GitHub Pages, Netlify)
- No build step required
- Just upload all files

**Documentation:**
- Cloudflare Pages (`inflight-docs.pages.dev`)
- Auto-deploys from GitHub
- Build: `npm run docs:build`
- Output: `docs/.vitepress/dist`

---

## Debugging Tips

### Browser DevTools
```javascript
// Access modules from console
DataManager.getAirport('KORD')
RouteParser.parse('KALB Q822 FNT')
FlightState.flightPlan

// Enable verbose logging
localStorage.setItem('debug', 'true')
```

### IndexedDB Inspection
- Chrome DevTools → Application → IndexedDB → `FlightPlanningDB`
- Stores: `airports`, `navaids`, `airways`, `fixes`, `procedures`

### Service Worker Debugging
- Chrome DevTools → Application → Service Workers
- Click "Unregister" to test fresh install
- Enable "Offline" checkbox to test offline mode

### GPS Testing
- Chrome DevTools → Sensors → Location
- Override position for testing navigation

---

## Common Gotchas

### 1. Module Load Order Matters
**Issue:** Modules use `window.X` globals, so load order matters
**Solution:** Check `<script>` tag order in [index.html](index.html)
```html
<!-- Libraries first -->
<script src="lib/geodesy.js"></script>
<!-- Data layer -->
<script src="data/data-manager.js"></script>
<!-- Compute layer -->
<script src="compute/route-engine.js"></script>
<!-- Display layer -->
<script src="display/app.js"></script>
```

### 2. Service Worker Cache Staleness
**Issue:** Changes not appearing after deploy
**Solution:** Increment `CACHE_NAME` in [service-worker.js](service-worker.js:11)

### 3. IndexedDB Version Conflicts
**Issue:** Schema changes not applying
**Solution:** Increment `DB_VERSION` in [data/data-manager.js](data/data-manager.js:10)

### 4. Test Failures on New Modules
**Issue:** Tests can't find new module
**Solution:** Add module to test runner imports in [tests/test-runner.js](tests/test-runner.js)

### 5. Route Parser Edge Cases
**Issue:** Parser fails on valid but unusual routes
**Solution:** Add test case to [tests/test-route-parser.js](tests/test-route-parser.js) first, then fix

---

## External Resources

### Data Sources
- **NASR:** `https://nasr.hisenz.com/files/` (FAA aviation data)
- **OurAirports:** `https://github.com/davidmegginson/ourairports-data`

### Aviation References
- FAA Route Service: `https://www.1800wxbrief.com`
- SkyVector: `https://skyvector.com` (route planning reference)
- AWC Winds Aloft: `https://aviationweather.gov/windtemp`

### Documentation
- VitePress: `https://vitepress.dev/`
- IndexedDB API: `https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API`
- Service Workers: `https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API`

---

## Quick Command Reference

```bash
# Development
npm start              # Run app locally
nvm use                # Switch to Node 20.18.1

# Testing
npm test               # Run all tests (fast)
npm run test:browser   # Browser tests (interactive)

# Documentation
npm run docs:dev       # Serve docs locally
npm run docs:build     # Build docs
npm run docs:preview   # Preview built docs

# Git workflow
git checkout -b feature/your-feature
# Make changes
npm test               # Ensure tests pass
git add .
git commit -m "feat: descriptive message"
git push origin feature/your-feature
# Create PR against main
```

---

## Development Philosophy

### 🎯 Core Principles

1. **Zero Dependencies:** No npm packages in production (current: 0 runtime deps)
2. **Offline First:** Must work with airplane mode enabled
3. **No Build Step:** Direct file loading for maximum portability
4. **Test Before Merge:** All code changes require tests
5. **Document Everything:** User docs + developer docs for all features

### 📏 Code Quality Standards

- ✅ Write tests for new features (aim for 80%+ coverage)
- ✅ Update docs when changing APIs
- ✅ No console.logs in production code (use prefixed logs for debugging)
- ✅ Keep functions small (<50 lines) and focused
- ✅ Use descriptive variable names (no `x`, `temp`, `data`)
- ✅ Comment complex algorithms (especially aviation math)

### 🚫 Anti-Patterns to Avoid

- ❌ Adding npm dependencies (ask first!)
- ❌ Using frameworks (React, Vue, etc.)
- ❌ Introducing build tools (webpack, rollup, etc.)
- ❌ Breaking offline functionality
- ❌ Hardcoding aviation data (use database)
- ❌ Skipping tests for "small" changes

---

## Questions?

**Read these first:**
- [docs/developer/ARCHITECTURE.md](docs/developer/ARCHITECTURE.md) - System design
- [docs/developer/TESTING.md](docs/developer/TESTING.md) - Testing guide
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) - Contribution workflow

**Still stuck?**
- Check existing code for similar patterns
- Search tests for examples (`grep -r "keyword" tests/`)
- Review git history (`git log --all -- path/to/file`)

---

*Last Updated: 2025-01-15*
*InFlight v2.0.0*
