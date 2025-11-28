#!/usr/bin/env node

// Node.js Test Runner for Automated Testing
// Runs tests using JSDOM to simulate browser environment

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

console.log(`${colors.cyan}${colors.bright}IN-FLIGHT Test Suite${colors.reset}\n`);

// Read all required source files
const projectRoot = path.join(__dirname, '..');
const files = {
    // Source files - Libraries
    geodesy: fs.readFileSync(path.join(projectRoot, 'lib/geodesy.js'), 'utf8'),

    // Source files - Utils
    utils: fs.readFileSync(path.join(projectRoot, 'utils/formatters.js'), 'utf8'),
    checksum: fs.readFileSync(path.join(projectRoot, 'utils/checksum.js'), 'utf8'),
    compression: fs.readFileSync(path.join(projectRoot, 'utils/compression.js'), 'utf8'),

    // Source files - Data (Legacy)
    dataManager: fs.readFileSync(path.join(projectRoot, 'data/data-manager.js'), 'utf8'),

    // Source files - Data v3 Architecture
    dataSource: fs.readFileSync(path.join(projectRoot, 'data/core/data-source.js'), 'utf8'),
    storageAdapter: fs.readFileSync(path.join(projectRoot, 'data/core/storage-adapter.js'), 'utf8'),
    cacheStrategy: fs.readFileSync(path.join(projectRoot, 'data/core/cache-strategy.js'), 'utf8'),
    memoryStorage: fs.readFileSync(path.join(projectRoot, 'data/storage/memory-storage.js'), 'utf8'),
    repository: fs.readFileSync(path.join(projectRoot, 'data/repository.js'), 'utf8'),

    // Source files - Query v3 Architecture
    indexStrategy: fs.readFileSync(path.join(projectRoot, 'query/core/index-strategy.js'), 'utf8'),
    mapIndex: fs.readFileSync(path.join(projectRoot, 'query/indexes/map-index.js'), 'utf8'),
    trieIndex: fs.readFileSync(path.join(projectRoot, 'query/indexes/trie-index.js'), 'utf8'),
    spatialGridIndex: fs.readFileSync(path.join(projectRoot, 'query/indexes/spatial-grid-index.js'), 'utf8'),
    queryEngineV2: fs.readFileSync(path.join(projectRoot, 'query/query-engine-v2.js'), 'utf8'),

    // Source files - Compute v3 Architecture (Pure Functions)
    navigation: fs.readFileSync(path.join(projectRoot, 'compute/navigation.js'), 'utf8'),
    terrain: fs.readFileSync(path.join(projectRoot, 'compute/terrain.js'), 'utf8'),
    weather: fs.readFileSync(path.join(projectRoot, 'compute/weather.js'), 'utf8'),

    // Source files - Services v3 Architecture
    routeService: fs.readFileSync(path.join(projectRoot, 'services/route-service.js'), 'utf8'),
    weatherService: fs.readFileSync(path.join(projectRoot, 'services/weather-service.js'), 'utf8'),

    // Source files - State
    state: fs.readFileSync(path.join(projectRoot, 'state/flight-state.js'), 'utf8'),
    flightTracker: fs.readFileSync(path.join(projectRoot, 'state/flight-tracker.js'), 'utf8'),

    // Source files - Compute (Legacy)
    weatherAPI: fs.readFileSync(path.join(projectRoot, 'compute/weather-api.js'), 'utf8'),
    queryEngine: fs.readFileSync(path.join(projectRoot, 'compute/query-engine.js'), 'utf8'),
    routeLexer: fs.readFileSync(path.join(projectRoot, 'compute/route-lexer.js'), 'utf8'),
    routeParser: fs.readFileSync(path.join(projectRoot, 'compute/route-parser.js'), 'utf8'),
    routeResolver: fs.readFileSync(path.join(projectRoot, 'compute/route-resolver.js'), 'utf8'),
    routeEngine: fs.readFileSync(path.join(projectRoot, 'compute/route-engine.js'), 'utf8'),
    routeCalculator: fs.readFileSync(path.join(projectRoot, 'compute/route-calculator.js'), 'utf8'),
    windsAloft: fs.readFileSync(path.join(projectRoot, 'compute/winds-aloft.js'), 'utf8'),
    terrainAnalyzer: fs.readFileSync(path.join(projectRoot, 'compute/terrain-analyzer.js'), 'utf8'),

    // Test framework
    testFramework: fs.readFileSync(path.join(__dirname, 'test-framework.js'), 'utf8'),

    // Test suites - Legacy
    testUtils: fs.readFileSync(path.join(__dirname, 'test-utils.js'), 'utf8'),
    testState: fs.readFileSync(path.join(__dirname, 'test-state.js'), 'utf8'),
    testRouteParser: fs.readFileSync(path.join(__dirname, 'test-route-parser.js'), 'utf8'),
    testChecksum: fs.readFileSync(path.join(__dirname, 'test-checksum.js'), 'utf8'),
    testWinds: fs.readFileSync(path.join(__dirname, 'test-winds.js'), 'utf8'),
    testWeatherAPI: fs.readFileSync(path.join(__dirname, 'test-weather-api.js'), 'utf8'),
    testGeodesy: fs.readFileSync(path.join(__dirname, 'test-geodesy.js'), 'utf8'),
    testRouteCalculator: fs.readFileSync(path.join(__dirname, 'test-route-calculator.js'), 'utf8'),
    testFlightTracker: fs.readFileSync(path.join(__dirname, 'test-flight-tracker.js'), 'utf8'),
    testCompression: fs.readFileSync(path.join(__dirname, 'test-compression.js'), 'utf8'),
    testTerrainAnalyzer: fs.readFileSync(path.join(__dirname, 'test-terrain-analyzer.js'), 'utf8'),
    testQueryEngine: fs.readFileSync(path.join(__dirname, 'test-query-engine.js'), 'utf8'),
    testDataManager: fs.readFileSync(path.join(__dirname, 'test-data-manager.js'), 'utf8'),

    // Test suites - v3 Architecture
    testDataCore: fs.readFileSync(path.join(__dirname, 'test-data-core.js'), 'utf8'),
    testQueryIndexes: fs.readFileSync(path.join(__dirname, 'test-query-indexes.js'), 'utf8'),
    testNavigation: fs.readFileSync(path.join(__dirname, 'test-navigation.js'), 'utf8'),
    testTerrain: fs.readFileSync(path.join(__dirname, 'test-terrain.js'), 'utf8'),
    testWeather: fs.readFileSync(path.join(__dirname, 'test-weather.js'), 'utf8'),
    testServices: fs.readFileSync(path.join(__dirname, 'test-services.js'), 'utf8')
};

// Create a minimal DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
    resources: 'usable'
});

const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
global.localStorage = localStorageMock;
window.localStorage = localStorageMock;

// Mock URL and Blob for export tests
class MockURL {
    static createObjectURL() { return 'blob:mock'; }
    static revokeObjectURL() {}
}
global.URL = MockURL;
window.URL = MockURL;

global.Blob = class Blob {
    constructor(parts, options) {
        this.parts = parts;
        this.options = options;
    }
};
window.Blob = global.Blob;

// Mock TextEncoder/TextDecoder for compression tests
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;

// Mock CompressionStream/DecompressionStream (not available in Node.js)
// Tests will use fallback path
global.CompressionStream = undefined;
global.DecompressionStream = undefined;

// Mock performance.now() for timing tests
if (!global.performance) {
    global.performance = { now: () => Date.now() };
}
window.performance = global.performance;

// Mock FileReader for import tests
global.FileReader = class FileReader {
    readAsText(blob) {
        setTimeout(() => {
            this.result = blob.parts ? blob.parts.join('') : '';
            if (this.onload) this.onload({ target: this });
        }, 0);
    }
};

// Track test results without overriding console.log
// The test framework now handles its own coloring based on environment
let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    suites: []
};

// Load source files and run tests
(async () => {
    try {
        // Execute code in the context of the window object
        // Wrap each file in IIFE to prevent function hoisting collisions
        // (same-named function declarations like formatCoordinate would otherwise shadow each other)
        const wrapInIIFE = (code) => `(function() {\n${code}\n})();`;

        const script = `
            // Libraries first (geodesy must be before route-calculator)
            ${wrapInIIFE(files.geodesy)}

            // Utils
            ${wrapInIIFE(files.utils)}
            ${wrapInIIFE(files.checksum)}
            ${wrapInIIFE(files.compression)}

            // Data v3 Architecture (abstract classes first)
            ${wrapInIIFE(files.dataSource)}
            ${wrapInIIFE(files.storageAdapter)}
            ${wrapInIIFE(files.cacheStrategy)}
            ${wrapInIIFE(files.memoryStorage)}
            ${wrapInIIFE(files.repository)}

            // Data Legacy (must be before query-engine)
            ${wrapInIIFE(files.dataManager)}

            // Query v3 Architecture (abstract class first, then implementations)
            ${wrapInIIFE(files.indexStrategy)}
            ${wrapInIIFE(files.mapIndex)}
            ${wrapInIIFE(files.trieIndex)}
            ${wrapInIIFE(files.spatialGridIndex)}
            ${wrapInIIFE(files.queryEngineV2)}

            // Compute v3 Architecture (pure functions)
            ${wrapInIIFE(files.navigation)}
            ${wrapInIIFE(files.terrain)}
            ${wrapInIIFE(files.weather)}

            // Services v3 Architecture
            ${wrapInIIFE(files.routeService)}
            ${wrapInIIFE(files.weatherService)}

            // State
            ${wrapInIIFE(files.state)}
            ${wrapInIIFE(files.flightTracker)}

            // Compute Legacy (order matters for dependencies)
            ${wrapInIIFE(files.weatherAPI)}
            ${wrapInIIFE(files.queryEngine)}
            ${wrapInIIFE(files.routeLexer)}
            ${wrapInIIFE(files.routeParser)}
            ${wrapInIIFE(files.routeResolver)}
            ${wrapInIIFE(files.routeEngine)}
            ${wrapInIIFE(files.routeCalculator)}
            ${wrapInIIFE(files.windsAloft)}
            ${wrapInIIFE(files.terrainAnalyzer)}

            // Test framework
            ${wrapInIIFE(files.testFramework)}

            // Test suites - v3 Architecture (run first)
            ${wrapInIIFE(files.testDataCore)}
            ${wrapInIIFE(files.testQueryIndexes)}
            ${wrapInIIFE(files.testNavigation)}
            ${wrapInIIFE(files.testTerrain)}
            ${wrapInIIFE(files.testWeather)}
            ${wrapInIIFE(files.testServices)}

            // Test suites - Legacy
            ${wrapInIIFE(files.testUtils)}
            ${wrapInIIFE(files.testState)}
            ${wrapInIIFE(files.testRouteParser)}
            ${wrapInIIFE(files.testChecksum)}
            ${wrapInIIFE(files.testWinds)}
            ${wrapInIIFE(files.testWeatherAPI)}
            ${wrapInIIFE(files.testGeodesy)}
            ${wrapInIIFE(files.testRouteCalculator)}
            ${wrapInIIFE(files.testFlightTracker)}
            ${wrapInIIFE(files.testCompression)}
            ${wrapInIIFE(files.testTerrainAnalyzer)}
            ${wrapInIIFE(files.testQueryEngine)}
            ${wrapInIIFE(files.testDataManager)}
        `;

        // Evaluate in window context
        window.eval(script);

        // Run all tests
        console.log(''); // Blank line
        if (typeof window.TestFramework !== 'undefined') {
            const results = await window.TestFramework.runAll();

            // Use test framework's built-in results
            if (results.failed === 0) {
                console.log(`\n${colors.green}${colors.bright}✓ All tests passed!${colors.reset}\n`);
                process.exit(0);
            } else {
                console.log(`\n${colors.red}${colors.bright}✗ ${results.failed} test(s) failed${colors.reset}\n`);
                process.exit(1);
            }
        } else {
            console.error('TestFramework not loaded!');
            process.exit(1);
        }

    } catch (error) {
        console.error('Error running tests:', error);
        process.exit(1);
    }
})();
