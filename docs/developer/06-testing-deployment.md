# Testing and Deployment

## Testing Framework

### Custom Test Framework

IN-FLIGHT uses a custom lightweight test framework instead of Jest/Mocha to maintain zero runtime dependencies.

**Implementation:** [tests/test-framework.js](../../tests/test-framework.js)

```javascript
const assert = {
    equals(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
        }
    },

    deepEquals(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
        }
    },

    throws(fn, message) {
        try {
            fn();
            throw new Error(`${message}\n  Expected function to throw but it didn't`);
        } catch (error) {
            // Expected
        }
    },

    true(value, message) {
        if (value !== true) {
            throw new Error(`${message}\n  Expected true but got ${value}`);
        }
    }
};
```

### Test Structure

**Test Suite Format:**

```javascript
window.FormatterTests = [
    {
        name: 'should format positive latitude correctly',
        run() {
            const result = Utils.formatCoordinate(40.6413, 'lat');
            assert.equals(result, '40.6413°N', 'Latitude formatting');
        }
    },
    {
        name: 'should format negative longitude correctly',
        run() {
            const result = Utils.formatCoordinate(-73.7781, 'lon');
            assert.equals(result, '73.7781°W', 'Longitude formatting');
        }
    }
];
```

### Running Tests

**Node.js Test Runner:** [tests/test-runner.js](../../tests/test-runner.js)

```bash
npm test
```

**Output:**
```
IN-FLIGHT Test Suite

Testing: Coordinate Formatting
  ✓ should format positive latitude correctly
  ✓ should format negative latitude correctly
  ✓ should format positive longitude correctly
  ✓ should format negative longitude correctly

Testing: Route Parser
  ✓ should tokenize simple route
  ✓ should parse airway segment
  ✓ should handle procedure notation

============================================================
Total Tests: 50
Passed: 50
Failed: 0

✓ All tests passed!
```

**Browser Test Runner:**

```bash
npm run test:browser
```

Opens `tests/index.html` in browser for interactive testing with visual results.

### Test Coverage

| Module | Coverage | Tests |
|--------|----------|-------|
| `utils/formatters.js` | 100% | 30 tests |
| `state/flight-state.js` | 95% | 20 tests |
| `compute/route-parser.js` | 90% | 25 tests |
| `compute/route-expansion.js` | 85% | 15 tests |
| `compute/route-lexer.js` | 100% | 10 tests |

**Total:** 100+ tests covering core functionality

### Writing New Tests

**Example:** Testing route parser

```javascript
// tests/test-route-parser.js
window.RouteParserTests = [
    {
        name: 'should parse simple direct route',
        run() {
            const tokens = RouteLexer.tokenize('KJFK KORD');
            const parseTree = RouteParser.parse(tokens);

            assert.equals(parseTree.length, 2, 'Should have 2 waypoints');
            assert.equals(parseTree[0].type, 'WAYPOINT', 'First token should be waypoint');
            assert.equals(parseTree[1].type, 'WAYPOINT', 'Second token should be waypoint');
        }
    },

    {
        name: 'should parse airway segment',
        run() {
            const tokens = RouteLexer.tokenize('PAYGE Q430 AIR');
            const parseTree = RouteParser.parse(tokens);

            assert.equals(parseTree.length, 1, 'Should have 1 airway segment');
            assert.equals(parseTree[0].type, 'AIRWAY_SEGMENT', 'Should be airway segment');
            assert.equals(parseTree[0].from.text, 'PAYGE', 'From waypoint');
            assert.equals(parseTree[0].airway.text, 'Q430', 'Airway identifier');
            assert.equals(parseTree[0].to.text, 'AIR', 'To waypoint');
        }
    },

    {
        name: 'should handle chained airways',
        run() {
            const tokens = RouteLexer.tokenize('PAYGE Q430 AIR Q430 FNT');
            const parseTree = RouteParser.parse(tokens);

            assert.equals(parseTree.length, 2, 'Should have 2 airway segments');
            assert.equals(parseTree[0].to.text, 'AIR', 'First segment ends at AIR');
            assert.equals(parseTree[1].from.text, 'AIR', 'Second segment starts at AIR');
        }
    }
];
```

### Test Isolation

Tests run in isolation without affecting each other:

```javascript
// Before each test: reset global state
beforeEach() {
    // Clear Maps
    airportsData.clear();
    navaidsData.clear();

    // Reset state
    FlightState.clear();
}

// After each test: cleanup
afterEach() {
    // No cleanup needed (stateless tests)
}
```

### Continuous Integration

**GitHub Actions:** [.github/workflows/test.yml](../../.github/workflows/test.yml)

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop, 'claude/*']
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]

    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

**Test Matrix:**
- Node.js 16, 18, 20
- Ubuntu latest
- Runs on every push and pull request

## Deployment

### Static Site Deployment

IN-FLIGHT is a **zero-build static site**. Deployment is as simple as uploading files.

### Deployment Options

#### 1. Cloudflare Pages (Recommended)

**Why:** Unlimited bandwidth, 200+ CDN locations, free SSL, branch previews

**Steps:**

1. Go to https://pages.cloudflare.com
2. Click "Create a project"
3. Connect to GitHub
4. Select repository: `HisenZhang/inflight`
5. Build settings:
   - **Build command:** (leave empty)
   - **Build output directory:** `/`
   - **Root directory:** `/`
6. Deploy

**Result:** `https://inflight.pages.dev`

**Custom Domain:**
- Add CNAME record: `app.yourdomain.com` → `inflight.pages.dev`
- Enable in Cloudflare Pages settings

#### 2. GitHub Pages

**Steps:**

1. Go to repository Settings → Pages
2. Source: Deploy from branch
3. Branch: `main`
4. Folder: `/ (root)`
5. Save

**Result:** `https://hisenzhang.github.io/inflight/`

**Custom Domain:**
- Add `CNAME` file to repository root: `inflight.yourdomain.com`
- Add DNS CNAME: `inflight` → `hisenzhang.github.io`

#### 3. Netlify

**Steps:**

1. Go to https://netlify.com
2. Import from Git
3. Select repository
4. Build settings:
   - **Build command:** (leave empty)
   - **Publish directory:** `/`
5. Deploy

**Result:** `https://inflight.netlify.app`

#### 4. Vercel

**Steps:**

1. Go to https://vercel.com
2. Import project from GitHub
3. Framework preset: Other
4. Build settings:
   - **Build command:** (leave empty)
   - **Output directory:** `/`
5. Deploy

**Result:** `https://inflight.vercel.app`

### Documentation Deployment

**VitePress Docs:** [docs/](../../docs/)

**Build Command:**
```bash
cd docs
npm run docs:build
```

**Output:** `docs/.vitepress/dist/`

**Deployment:**

Same as main app, but deploy from `docs/.vitepress/dist/` directory.

**Cloudflare Pages Settings:**
- **Build command:** `cd docs && npm install && npm run docs:build`
- **Build output directory:** `docs/.vitepress/dist`

### Service Worker Updates

**Important:** Increment cache version when deploying new code.

**File:** [service-worker.js:1](../../service-worker.js#L1)

```javascript
const CACHE_NAME = 'flight-planning-v48';  // Increment this!
```

**Why:** Forces browser to fetch new assets instead of using stale cache.

**Process:**
1. Make code changes
2. Increment `CACHE_NAME` version (v48 → v49)
3. Commit and deploy
4. Users automatically get new version on next visit

### Environment-Specific Configuration

IN-FLIGHT has **no environment variables**. All configuration is hardcoded:

**Data Sources:** [data/nasr-adapter.js:4](../../data/nasr-adapter.js#L4)
```javascript
const NASR_BASE_URL = 'https://nasr.hisenz.com';
```

**CORS Proxy:** [data/ourairports-adapter.js:4](../../data/ourairports-adapter.js#L4)
```javascript
const CORS_PROXY = 'https://cors.hisenz.com/?url=';
```

**To change:** Edit source files and redeploy.

### Performance Optimization

**Gzip Compression:** Enabled by default on all hosting platforms

**File Sizes:**
- Total HTML/JS/CSS: ~500KB
- Gzipped: ~150KB
- First load: ~150KB + 5MB database = ~5.15MB
- Subsequent visits: ~0KB (service worker cache)

**Caching Headers:**

Most platforms automatically set:
```
Cache-Control: public, max-age=31536000, immutable
```

For static assets (JS, CSS).

### Monitoring

**Error Tracking:** None (by design - no analytics)

**Performance Monitoring:**

Use browser DevTools:
- Performance tab: Measure route calculation time
- Network tab: Monitor database loading
- Application tab: Inspect IndexedDB and service worker

**Uptime Monitoring:**

Use external services (Pingdom, UptimeRobot) to monitor:
- `https://inflight.pages.dev/` (main app)
- `https://nasr.hisenz.com/files/` (NASR endpoint)

### Rollback Procedure

**Cloudflare Pages:**
1. Go to Deployments
2. Find previous deployment
3. Click "Rollback to this deployment"

**GitHub Pages:**
1. Revert git commit
2. Push to main branch
3. Wait 2-3 minutes for rebuild

**Manual Rollback:**
1. `git revert HEAD` (or specific commit)
2. `git push origin main`
3. Hosting platform auto-deploys reverted version

### Pre-Deployment Checklist

- [ ] Run all tests: `npm test` (all passing)
- [ ] Test in browser manually
- [ ] Increment service worker cache version
- [ ] Update version in manifest.json
- [ ] Test offline functionality
- [ ] Test on mobile device
- [ ] Review git diff for unintended changes
- [ ] Update CHANGELOG.md (if applicable)
- [ ] Create git tag for release: `git tag v2.1.0`

### Post-Deployment Verification

- [ ] Check live site loads
- [ ] Verify database loads successfully
- [ ] Test route calculation
- [ ] Test GPS tracking
- [ ] Check service worker installation
- [ ] Verify offline mode works
- [ ] Test on iOS/Android (PWA install)
- [ ] Monitor error logs (if available)

### Security Considerations

**No Backend:** Zero server-side code reduces attack surface

**CSP Headers:** Consider adding Content Security Policy:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline';
               connect-src 'self' https://nasr.hisenz.com https://cors.hisenz.com https://aviationweather.gov;
               style-src 'self' 'unsafe-inline';">
```

**HTTPS Only:** Service workers require HTTPS (all platforms provide free SSL)

**No User Data:** Application stores no personal information

---

**Last Updated:** January 2025
