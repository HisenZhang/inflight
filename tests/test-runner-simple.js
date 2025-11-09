#!/usr/bin/env node

// Simple Node.js Test Runner for Automated Testing
// Works without JSDOM by mocking browser globals

const fs = require('fs');
const path = require('path');

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

console.log(colors.cyan + colors.bright + 'InFlight Test Suite' + colors.reset + '\n');

// Read all required source files
const projectRoot = path.join(__dirname, '..');
const files = {
    utils: fs.readFileSync(path.join(projectRoot, 'utils/formatters.js'), 'utf8'),
    state: fs.readFileSync(path.join(projectRoot, 'state/flight-state.js'), 'utf8'),
    testFramework: fs.readFileSync(path.join(__dirname, 'test-framework.js'), 'utf8'),
    testUtils: fs.readFileSync(path.join(__dirname, 'test-utils.js'), 'utf8'),
    testState: fs.readFileSync(path.join(__dirname, 'test-state.js'), 'utf8')
};

// Create minimal browser globals
global.window = global;
global.document = {
    createElement: function(tag) {
        return {
            click: function() {},
            addEventListener: function() {},
            setAttribute: function() {},
            getAttribute: function() { return null; },
            href: '',
            download: ''
        };
    }
};
global.navigator = { userAgent: 'Node.js' };

// Mock localStorage
const localStorageMock = (function() {
    let store = {};
    return {
        getItem: function(key) { return store[key] || null; },
        setItem: function(key, value) { store[key] = value.toString(); },
        removeItem: function(key) { delete store[key]; },
        clear: function() { store = {}; }
    };
})();
global.localStorage = localStorageMock;

// Mock URL and Blob for export tests
global.URL = {
    createObjectURL: function() { return 'blob:mock'; },
    revokeObjectURL: function() {}
};
global.Blob = function Blob(parts, options) {
    this.parts = parts;
    this.options = options;
};

// Mock FileReader for import tests
global.FileReader = function FileReader() {
    this.readAsText = function(blob) {
        const self = this;
        setTimeout(function() {
            self.result = blob.parts ? blob.parts.join('') : '';
            if (self.onload) self.onload({ target: self });
        }, 0);
    };
};

// Capture console output for test results
let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    suites: []
};

// Override console.log to capture test output
const originalLog = console.log;
const originalError = console.error;
let currentSuite = null;

console.log = function() {
    const args = Array.prototype.slice.call(arguments);
    const message = args.join(' ');

    // Detect test suite start
    if (message.indexOf('Testing:') !== -1) {
        currentSuite = {
            name: message.replace('Testing:', '').trim(),
            tests: [],
            passed: 0,
            failed: 0
        };
        testResults.suites.push(currentSuite);
        originalLog(colors.cyan + message + colors.reset);
    }
    // Detect test pass
    else if (message.indexOf('✓') !== -1) {
        testResults.total++;
        testResults.passed++;
        if (currentSuite) {
            currentSuite.passed++;
            currentSuite.tests.push({ name: message, passed: true });
        }
        originalLog(colors.green + '  ' + message + colors.reset);
    }
    // Detect test fail
    else if (message.indexOf('✗') !== -1) {
        testResults.total++;
        testResults.failed++;
        if (currentSuite) {
            currentSuite.failed++;
            currentSuite.tests.push({ name: message, passed: false });
        }
        originalLog(colors.red + '  ' + message + colors.reset);
    }
    // Summary lines
    else if (message.indexOf('passed') !== -1 || message.indexOf('failed') !== -1) {
        originalLog(colors.bright + message + colors.reset);
    }
    // Other messages
    else {
        originalLog(message);
    }
};

console.error = function() {
    const args = Array.prototype.slice.call(arguments);
    originalError(colors.red + args.join(' ') + colors.reset);
};

// Load source files in order
try {
    // Use eval to execute in global scope
    eval(files.utils);
    eval(files.state);
    eval(files.testFramework);
    eval(files.testUtils);
    eval(files.testState);

    // Run all tests
    console.log(''); // Blank line
    if (typeof global.window.TestFramework !== 'undefined') {
        global.window.TestFramework.runAll();
    } else {
        console.error('TestFramework not loaded!');
        process.exit(1);
    }

    // Wait a bit for async tests to complete
    setTimeout(function() {
        console.log('\n' + '='.repeat(60));
        console.log(colors.bright + 'Test Results Summary' + colors.reset);
        console.log('='.repeat(60));

        testResults.suites.forEach(function(suite) {
            const status = suite.failed === 0 ?
                colors.green + '✓' + colors.reset :
                colors.red + '✗' + colors.reset;
            console.log('\n' + status + ' ' + colors.bright + suite.name + colors.reset);
            console.log('  Passed: ' + colors.green + suite.passed + colors.reset +
                       ', Failed: ' + (suite.failed > 0 ? colors.red : colors.gray) + suite.failed + colors.reset);
        });

        console.log('\n' + '='.repeat(60));
        console.log(colors.bright + 'Total Tests: ' + testResults.total + colors.reset);
        console.log(colors.green + 'Passed: ' + testResults.passed + colors.reset);
        console.log(colors.red + 'Failed: ' + testResults.failed + colors.reset);

        if (testResults.failed === 0) {
            console.log('\n' + colors.green + colors.bright + '✓ All tests passed!' + colors.reset + '\n');
            process.exit(0);
        } else {
            console.log('\n' + colors.red + colors.bright + '✗ Some tests failed' + colors.reset + '\n');
            process.exit(1);
        }
    }, 1000);

} catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
}
