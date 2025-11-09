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

console.log(`${colors.cyan}${colors.bright}InFlight Test Suite${colors.reset}\n`);

// Read all required source files
const projectRoot = path.join(__dirname, '..');
const files = {
    utils: fs.readFileSync(path.join(projectRoot, 'utils/formatters.js'), 'utf8'),
    state: fs.readFileSync(path.join(projectRoot, 'state/flight-state.js'), 'utf8'),
    testFramework: fs.readFileSync(path.join(__dirname, 'test-framework.js'), 'utf8'),
    testUtils: fs.readFileSync(path.join(__dirname, 'test-utils.js'), 'utf8'),
    testState: fs.readFileSync(path.join(__dirname, 'test-state.js'), 'utf8')
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

console.log = (...args) => {
    const message = args.join(' ');

    // Detect test suite start
    if (message.includes('Testing:')) {
        currentSuite = {
            name: message.replace('Testing:', '').trim(),
            tests: [],
            passed: 0,
            failed: 0
        };
        testResults.suites.push(currentSuite);
        originalLog(`${colors.cyan}${message}${colors.reset}`);
    }
    // Detect test pass
    else if (message.includes('✓')) {
        testResults.total++;
        testResults.passed++;
        if (currentSuite) {
            currentSuite.passed++;
            currentSuite.tests.push({ name: message, passed: true });
        }
        originalLog(`${colors.green}  ${message}${colors.reset}`);
    }
    // Detect test fail
    else if (message.includes('✗')) {
        testResults.total++;
        testResults.failed++;
        if (currentSuite) {
            currentSuite.failed++;
            currentSuite.tests.push({ name: message, passed: false });
        }
        originalLog(`${colors.red}  ${message}${colors.reset}`);
    }
    // Summary lines
    else if (message.includes('passed') || message.includes('failed')) {
        originalLog(`${colors.bright}${message}${colors.reset}`);
    }
    // Other messages
    else {
        originalLog(message);
    }
};

console.error = (...args) => {
    originalError(`${colors.red}${args.join(' ')}${colors.reset}`);
};

// Load source files in order
try {
    // Execute code in the context of the window object
    const script = `
        ${files.utils}
        ${files.state}
        ${files.testFramework}
        ${files.testUtils}
        ${files.testState}
    `;

    // Evaluate in window context
    window.eval(script);

    // Run all tests
    console.log(''); // Blank line
    if (typeof window.TestFramework !== 'undefined') {
        window.TestFramework.runAll();
    } else {
        console.error('TestFramework not loaded!');
        process.exit(1);
    }

    // Wait a bit for async tests to complete
    setTimeout(() => {
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.bright}Test Results Summary${colors.reset}`);
        console.log('='.repeat(60));

        testResults.suites.forEach(suite => {
            const status = suite.failed === 0 ?
                `${colors.green}✓${colors.reset}` :
                `${colors.red}✗${colors.reset}`;
            console.log(`\n${status} ${colors.bright}${suite.name}${colors.reset}`);
            console.log(`  Passed: ${colors.green}${suite.passed}${colors.reset}, Failed: ${suite.failed > 0 ? colors.red : colors.gray}${suite.failed}${colors.reset}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log(`${colors.bright}Total Tests: ${testResults.total}${colors.reset}`);
        console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
        console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);

        if (testResults.failed === 0) {
            console.log(`\n${colors.green}${colors.bright}✓ All tests passed!${colors.reset}\n`);
            process.exit(0);
        } else {
            console.log(`\n${colors.red}${colors.bright}✗ Some tests failed${colors.reset}\n`);
            process.exit(1);
        }
    }, 1000);

} catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
}
