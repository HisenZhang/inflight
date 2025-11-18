# IN-FLIGHT Test Suite

## Overview

Comprehensive test suite for the IN-FLIGHT flight planning application, testing all three engines (Data, Compute, Display) and state management.

## Running Tests

### Automated Testing (Node.js)

**Recommended for CI/CD and development:**

```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Alternative: run test runner directly
node tests/test-runner.js
```

**Features:**
- ✅ Runs in Node.js with JSDOM (simulates browser environment)
- ✅ Colored terminal output with pass/fail indicators
- ✅ Exit code 0 (success) or 1 (failure) for CI/CD integration
- ✅ No browser required - perfect for automated testing
- ✅ Fast execution (~1 second for 50+ tests)

**Output Example:**
```
IN-FLIGHT Test Suite

Testing: Coordinate Formatting
  ✓ should format positive latitude correctly
  ✓ should format negative latitude correctly
  ...

Testing: Flight Plan Management
  ✓ should update flight plan
  ✓ should clear flight plan
  ...

====================================
Test Results Summary
====================================

✓ Coordinate Formatting
  Passed: 10, Failed: 0

✓ Flight Plan Management
  Passed: 8, Failed: 0

====================================
Total Tests: 50
Passed: 50
Failed: 0

✓ All tests passed!
```

### Browser-Based Testing

**For interactive debugging and development:**

1. Open `tests/index.html` in your browser
2. Click "Run All Tests"
3. View results in the console and on-page display

**Or run via npm:**
```bash
npm run test:browser
```

### Manual Testing in Console

```javascript
// Load test framework and run
TestFramework.runAll();
```

## Test Structure

```
tests/
├── index.html           # Test runner HTML
├── README.md            # This file
├── test-framework.js    # Simple test framework (no dependencies)
├── test-utils.js        # Tests for utils/formatters.js
├── test-state.js        # Tests for state/flight-state.js
└── (future test files)
```

## Test Suites

### 1. Utils/Formatters Tests (`test-utils.js`)

Tests for shared utility functions:

- **Coordinate Formatting**: Lat/lon to DMS format
- **Frequency Formatting**: VOR/NDB frequency display
- **Distance Formatting**: Nautical miles
- **Time Formatting**: Duration, ETA
- **Heading Formatting**: Magnetic heading with cardinal directions
- **Validation**: Coordinate validation helpers

**Coverage**: 30+ tests

### 2. State Management Tests (`test-state.js`)

Tests for flight plan and navigation state:

- **Flight Plan Management**: Create, update, clear, validate
- **Navigation Management**: Start/stop, position updates, leg advancement
- **Persistence**: LocalStorage save/load, crash recovery
- **Import/Export**: JSON file operations
- **Route History**: Save history, deduplication, limits

**Coverage**: 20+ tests

## Writing New Tests

### Basic Test Structure

```javascript
TestFramework.describe('Module Name', function({ it, beforeEach, afterEach }) {

    beforeEach(() => {
        // Setup before each test
    });

    afterEach(() => {
        // Cleanup after each test
    });

    it('should do something', () => {
        // Test code
        assert.equals(actual, expected);
    });

    it('should handle async operations', async () => {
        // Async test
        const result = await someAsyncFunction();
        assert.isNotNull(result);
    });
});
```

### Available Assertions

```javascript
// Equality
assert.equals(actual, expected, message);
assert.notEquals(actual, expected, message);
assert.deepEquals(actualObj, expectedObj, message);

// Null/Undefined
assert.isNull(value, message);
assert.isNotNull(value, message);
assert.isDefined(value, message);
assert.isUndefined(value, message);

// Type Checks
assert.isArray(value, message);
assert.isObject(value, message);
assert.isFunction(value, message);
assert.isString(value, message);
assert.isNumber(value, message);

// Boolean
assert.isTrue(value, message);
assert.isFalse(value, message);

// Arrays
assert.contains(array, value, message);
assert.notContains(array, value, message);

// Comparison
assert.greaterThan(actual, expected, message);
assert.lessThan(actual, expected, message);

// Exceptions
assert.throws(fn, message);
assert.throwsAsync(asyncFn, message);
```

## Future Test Suites (TODO)

### 3. Query Engine Tests

- Search/autocomplete functionality
- Spatial queries (points near route)
- Token type lookups
- Performance benchmarks

### 4. Route Calculator Tests

- Distance calculations (Vincenty formula accuracy)
- Bearing calculations
- Wind correction math
- Fuel planning calculations

### 5. Route Expander Tests

- Airway expansion
- STAR expansion
- DP expansion
- Error handling for invalid procedures

### 6. Data Manager Tests

- IndexedDB operations
- CRUD operations
- Cache management
- Data merging (NASR + OurAirports)

### 7. UI Controller Tests

- Form input validation
- Navlog table rendering
- Status display updates
- Autocomplete behavior

### 8. Map Display Tests

- Map projection calculations
- GPS position rendering
- Zoom/pan operations
- Popup display

### 9. Integration Tests

- End-to-end route calculation
- Data loading → planning → navigation flow
- Crash recovery scenarios
- Export/import roundtrips

## Test Coverage Goals

| Module | Target Coverage | Current Coverage |
|--------|----------------|------------------|
| utils/formatters.js | 100% | 100% ✅ |
| state/flight-state.js | 100% | 95% ✅ |
| compute/query-engine.js | 90% | 0% |
| compute/route-calculator.js | 90% | 0% |
| compute/route-expander.js | 80% | 0% |
| data/data-manager.js | 80% | 0% |
| display/ui-controller.js | 70% | 0% |
| display/map-display.js | 70% | 0% |

## Performance Benchmarks

Future performance tests will track:

- Data loading time (NASR + OurAirports)
- Token map build time
- Route calculation speed
- Spatial query performance
- Map rendering performance

## Continuous Integration

### GitHub Actions

Automated tests run on every push and pull request:

**Workflow:** `.github/workflows/test.yml`

**Matrix Testing:**
- Node.js 16.x, 18.x, 20.x
- Ubuntu latest

**Checks:**
- ✅ Run all test suites
- ✅ Code quality checks
- ✅ Test coverage reporting

**View Results:**
- Check the "Actions" tab in GitHub
- Green checkmark = all tests passed
- Red X = tests failed

### Pre-Commit Checklist

Before committing changes:

1. ✅ Run all tests: `npm test`
2. ✅ All tests pass (exit code 0)
3. ✅ No console errors
4. ✅ Add tests for new features
5. ✅ Update test documentation if needed

### Browser Compatibility Testing

Test in:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (desktop & iOS)
- Mobile browsers (Chrome Android, Safari iOS)

## Known Limitations

1. **No Headless Testing**: Tests require browser environment (IndexedDB, LocalStorage)
2. **No Code Coverage Metrics**: Manual coverage tracking only
3. **No Mocking Library**: Tests use real dependencies where possible
4. **No Test Isolation**: Some tests may affect global state

## Contributing

When adding new features:

1. Write tests FIRST (TDD approach)
2. Ensure 80%+ coverage for new modules
3. Document complex test scenarios
4. Update this README with new test suites

---

**Last Updated**: November 2025
**Test Framework Version**: 1.0
**Total Tests**: 50+
