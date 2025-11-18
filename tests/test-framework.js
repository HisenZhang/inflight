// Simple Test Framework for IN-FLIGHT
// No external dependencies - pure browser JavaScript

// ============================================
// ENVIRONMENT DETECTION
// ============================================

// Detect if running in Node.js vs Browser
const isNodeJS = typeof process !== 'undefined' && process.versions && process.versions.node;

// ANSI color codes for Node.js terminal output
const ansiColors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

// Helper function for environment-aware logging
const colorLog = (message, style) => {
    if (isNodeJS) {
        // Node.js: Use ANSI colors
        let color = ansiColors.reset;
        if (style.includes('bold')) color = ansiColors.bright;
        if (style.includes('#00ff00') || style.includes('green')) color = ansiColors.green;
        if (style.includes('#ff0000') || style.includes('red')) color = ansiColors.red;
        if (style.includes('#00aaff') || style.includes('cyan')) color = ansiColors.cyan + ansiColors.bright;
        console.log(color + message + ansiColors.reset);
    } else {
        // Browser: Use CSS colors
        console.log('%c' + message, style);
    }
};

// ============================================
// TEST FRAMEWORK
// ============================================

const TestFramework = {
    tests: [],
    suites: {},
    results: {
        passed: 0,
        failed: 0,
        errors: []
    },

    /**
     * Define a test suite
     * @param {string} name - Suite name
     * @param {Function} fn - Suite function
     */
    describe(name, fn) {
        this.suites[name] = {
            name,
            tests: [],
            beforeEach: null,
            afterEach: null
        };
        const currentSuite = this.suites[name];

        // Provide test context
        const context = {
            it: (testName, testFn) => {
                currentSuite.tests.push({ name: testName, fn: testFn });
            },
            beforeEach: (fn) => {
                currentSuite.beforeEach = fn;
            },
            afterEach: (fn) => {
                currentSuite.afterEach = fn;
            }
        };

        fn.call(context, context);
    },

    /**
     * Run all tests
     */
    async runAll() {
        colorLog('=== IN-FLIGHT Test Suite ===', 'font-weight: bold; font-size: 16px;');
        this.results = { passed: 0, failed: 0, errors: [] };

        for (const suiteName in this.suites) {
            await this.runSuite(suiteName);
        }

        this.printSummary();
        return this.results;
    },

    /**
     * Run a specific test suite
     */
    async runSuite(suiteName) {
        const suite = this.suites[suiteName];
        colorLog(`\n${suiteName}`, 'font-weight: bold; color: #00aaff;');

        for (const test of suite.tests) {
            try {
                // Run beforeEach if defined
                if (suite.beforeEach) {
                    await suite.beforeEach();
                }

                // Run test
                await test.fn();

                // Run afterEach if defined
                if (suite.afterEach) {
                    await suite.afterEach();
                }

                this.results.passed++;
                colorLog(`  ✓ ${test.name}`, 'color: #00ff00;');
            } catch (error) {
                this.results.failed++;
                this.results.errors.push({
                    suite: suiteName,
                    test: test.name,
                    error: error.message || error
                });
                colorLog(`  ✗ ${test.name}`, 'color: #ff0000;');
                console.error(`    ${error.message || error}`);
            }
        }
    },

    /**
     * Print test summary
     */
    printSummary() {
        colorLog('\n=== Test Summary ===', 'font-weight: bold; font-size: 14px;');
        colorLog(`Passed: ${this.results.passed}`, 'color: #00ff00;');
        colorLog(`Failed: ${this.results.failed}`, 'color: #ff0000;');

        if (this.results.failed > 0) {
            colorLog('\nFailed Tests:', 'font-weight: bold; color: #ff0000;');
            this.results.errors.forEach(err => {
                console.log(`  ${err.suite} > ${err.test}: ${err.error}`);
            });
        }
    }
};

// ============================================
// ASSERTION HELPERS
// ============================================

const assert = {
    isTrue(value, message = 'Expected true') {
        if (value !== true) {
            throw new Error(message);
        }
    },

    isFalse(value, message = 'Expected false') {
        if (value !== false) {
            throw new Error(message);
        }
    },

    equals(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
    },

    notEquals(actual, expected, message) {
        if (actual === expected) {
            throw new Error(message || `Expected ${actual} to not equal ${expected}`);
        }
    },

    deepEquals(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(message || `Objects are not equal:\nActual: ${JSON.stringify(actual)}\nExpected: ${JSON.stringify(expected)}`);
        }
    },

    isNull(value, message = 'Expected null') {
        if (value !== null) {
            throw new Error(message);
        }
    },

    isNotNull(value, message = 'Expected not null') {
        if (value === null) {
            throw new Error(message);
        }
    },

    isDefined(value, message = 'Expected defined value') {
        if (value === undefined) {
            throw new Error(message);
        }
    },

    isUndefined(value, message = 'Expected undefined') {
        if (value !== undefined) {
            throw new Error(message);
        }
    },

    isArray(value, message = 'Expected array') {
        if (!Array.isArray(value)) {
            throw new Error(message);
        }
    },

    isObject(value, message = 'Expected object') {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new Error(message);
        }
    },

    isFunction(value, message = 'Expected function') {
        if (typeof value !== 'function') {
            throw new Error(message);
        }
    },

    isString(value, message = 'Expected string') {
        if (typeof value !== 'string') {
            throw new Error(message);
        }
    },

    isNumber(value, message = 'Expected number') {
        if (typeof value !== 'number') {
            throw new Error(message);
        }
    },

    contains(array, value, message) {
        if (!array.includes(value)) {
            throw new Error(message || `Expected array to contain ${value}`);
        }
    },

    notContains(array, value, message) {
        if (array.includes(value)) {
            throw new Error(message || `Expected array to not contain ${value}`);
        }
    },

    greaterThan(actual, expected, message) {
        if (actual <= expected) {
            throw new Error(message || `Expected ${actual} to be greater than ${expected}`);
        }
    },

    lessThan(actual, expected, message) {
        if (actual >= expected) {
            throw new Error(message || `Expected ${actual} to be less than ${expected}`);
        }
    },

    throws(fn, message = 'Expected function to throw') {
        let threw = false;
        try {
            fn();
        } catch (e) {
            threw = true;
        }
        if (!threw) {
            throw new Error(message);
        }
    },

    async throwsAsync(fn, message = 'Expected async function to throw') {
        let threw = false;
        try {
            await fn();
        } catch (e) {
            threw = true;
        }
        if (!threw) {
            throw new Error(message);
        }
    }
};

// ============================================
// EXPORTS
// ============================================

window.TestFramework = TestFramework;
window.assert = assert;
