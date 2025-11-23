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
    utils: fs.readFileSync(path.join(projectRoot, 'utils/formatters.js'), 'utf8'),
    checksum: fs.readFileSync(path.join(projectRoot, 'utils/checksum.js'), 'utf8'),
    state: fs.readFileSync(path.join(projectRoot, 'state/flight-state.js'), 'utf8'),
    routeLexer: fs.readFileSync(path.join(projectRoot, 'compute/route-lexer.js'), 'utf8'),
    routeParser: fs.readFileSync(path.join(projectRoot, 'compute/route-parser.js'), 'utf8'),
    routeResolver: fs.readFileSync(path.join(projectRoot, 'compute/route-resolver.js'), 'utf8'),
    routeEngine: fs.readFileSync(path.join(projectRoot, 'compute/route-engine.js'), 'utf8'),
    windsAloft: fs.readFileSync(path.join(projectRoot, 'compute/winds-aloft.js'), 'utf8'),
    testFramework: fs.readFileSync(path.join(__dirname, 'test-framework.js'), 'utf8'),
    testUtils: fs.readFileSync(path.join(__dirname, 'test-utils.js'), 'utf8'),
    testState: fs.readFileSync(path.join(__dirname, 'test-state.js'), 'utf8'),
    testRouteParser: fs.readFileSync(path.join(__dirname, 'test-route-parser.js'), 'utf8'),
    testChecksum: fs.readFileSync(path.join(__dirname, 'test-checksum.js'), 'utf8'),
    testWinds: fs.readFileSync(path.join(__dirname, 'test-winds.js'), 'utf8')
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
global.URL = {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {}
};
global.Blob = class Blob {
    constructor(parts, options) {
        this.parts = parts;
        this.options = options;
    }
};

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
        const script = `
            ${files.utils}
            ${files.checksum}
            ${files.state}
            ${files.routeLexer}
            ${files.routeParser}
            ${files.routeResolver}
            ${files.routeEngine}
            ${files.windsAloft}
            ${files.testFramework}
            ${files.testUtils}
            ${files.testState}
            ${files.testRouteParser}
            ${files.testChecksum}
            ${files.testWinds}
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
