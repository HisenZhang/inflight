# Testing Guide

## Overview

InFlight has a comprehensive automated testing system that works in both browser and Node.js environments.

## Quick Start

### Prerequisites

**Node.js 8.3 or higher** (Node 16+ recommended for full compatibility)

Check your Node.js version:
```bash
node --version
```

If you need to upgrade Node.js:
- **macOS/Linux**: Use [nvm](https://github.com/nvm-sh/nvm)
  ```bash
  nvm install 16
  nvm use 16
  ```
- **Windows**: Download from [nodejs.org](https://nodejs.org/)

### Installation

```bash
# Install dependencies
npm install
```

### Running Tests

**Automated testing (recommended for CI/CD):**
```bash
npm test
```

**Browser testing (for interactive debugging):**
```bash
npm run test:browser
```

## Test Runners

### 1. Simple Test Runner (Default)

**File**: `tests/test-runner-simple.js`

**Features:**
- ✅ Works with Node.js 8.3+
- ✅ No external dependencies (except dev dependencies)
- ✅ Colored terminal output
- ✅ Exit codes for CI/CD (0 = success, 1 = failure)
- ✅ Fast execution (~1 second)

**Usage:**
```bash
npm test
```

**Example Output:**
```
InFlight Test Suite

Testing: Coordinate Formatting
  ✓ should format positive latitude correctly
  ✓ should format negative latitude correctly
  ✓ should format positive longitude correctly
  ...

============================================================
Test Results Summary
============================================================

✓ Coordinate Formatting
  Passed: 10, Failed: 0

✓ Frequency Formatting
  Passed: 6, Failed: 0

============================================================
Total Tests: 50
Passed: 50
Failed: 0

✓ All tests passed!
```

### 2. JSDOM Test Runner (Advanced)

**File**: `tests/test-runner.js`

**Features:**
- ✅ Full browser environment simulation with JSDOM
- ✅ More accurate DOM testing
- ✅ Requires Node.js 16+

**Usage:**
```bash
npm run test:jsdom
```

**Note**: Requires JSDOM dependency to be installed correctly. Use the simple runner if you encounter compatibility issues.

### 3. Browser Test Runner (Interactive)

**File**: `tests/index.html`

**Features:**
- ✅ Real browser environment
- ✅ Interactive debugging
- ✅ Visual test results
- ✅ No Node.js required

**Usage:**
```bash
npm run test:browser
# Or manually: open tests/index.html in your browser
```

## Test Structure

```
tests/
├── test-framework.js          # Custom test framework
├── test-utils.js             # Tests for utils/formatters.js (30+ tests)
├── test-state.js             # Tests for state/flight-state.js (20+ tests)
├── test-runner-simple.js     # Simple Node.js runner (default)
├── test-runner.js            # JSDOM Node.js runner (advanced)
├── index.html                # Browser test runner
```

## Continuous Integration

### GitHub Actions

Tests run automatically on every push and pull request.

**Workflow**: `.github/workflows/test.yml`

**Matrix Testing**:
- Node.js 16.x, 18.x, 20.x
- Ubuntu latest

**View Results**:
- Check the "Actions" tab in your GitHub repository
- Green checkmark ✓ = all tests passed
- Red X ✗ = tests failed

### Local Pre-Commit Testing

Before committing changes:

```bash
# 1. Run all tests
npm test

# 2. Verify exit code
echo $?  # Should be 0 if all tests passed

# 3. Commit if tests pass
git add .
git commit -m "Your commit message"
```

## Writing Tests

- Writing new test suites
- Available assertions
- Async testing
- Test patterns and best practices

## Troubleshooting

### Issue: "Unexpected token ..." error

**Cause**: Node.js version too old (< 8.3)

**Solution**: Upgrade Node.js to version 8.3 or higher
```bash
# Using nvm
nvm install 16
nvm use 16

# Verify version
node --version  # Should be v8.3.0 or higher
```

### Issue: JSDOM-related errors

**Cause**: JSDOM compatibility issues with your Node.js version

**Solution**: Use the simple test runner instead
```bash
npm test  # Uses simple runner by default
```

### Issue: Tests pass locally but fail in CI

**Possible Causes**:
1. Different Node.js versions
2. Missing dependencies
3. Environment-specific code

**Solution**:
```bash
# Test with the same Node version as CI
nvm use 16
npm test

# Check package-lock.json is committed
git status

# Verify dependencies
npm ci  # Clean install from package-lock.json
npm test
```

### Issue: Tests run but show no output

**Cause**: Console output being suppressed

**Solution**:
```bash
# Run test runner directly with verbose output
node tests/test-runner-simple.js

# Or check for redirected output
npm test 2>&1 | cat
```

## Test Coverage

| Module | Current Coverage | Target |
|--------|-----------------|--------|
| utils/formatters.js | 100% ✅ | 100% |
| state/flight-state.js | 95% ✅ | 100% |
| compute/query-engine.js | 0% ⚠️ | 90% |
| compute/route-calculator.js | 0% ⚠️ | 90% |
| compute/route-expander.js | 0% ⚠️ | 80% |
| data/data-manager.js | 0% ⚠️ | 80% |

## Performance

**Test Execution Times** (approximate):

- Simple runner: ~1 second
- JSDOM runner: ~2 seconds
- Browser runner: ~0.5 seconds (after page load)

**50+ tests total**

## Best Practices

1. **Run tests before every commit**
   ```bash
   npm test && git commit
   ```

2. **Watch for deprecation warnings**
   - Check console output for deprecated function usage

3. **Add tests for new features**
   - Follow TDD approach when possible
   - Aim for 80%+ coverage for new modules

4. **Keep tests fast**
   - Avoid unnecessary async operations
   - Mock external dependencies

5. **Use descriptive test names**
   ```javascript
   it('should format positive latitude correctly', () => {
       // Test implementation
   });
   ```

## Resources


## Support

If you encounter issues with automated testing:

1. Check this document for troubleshooting steps
2. Verify Node.js version: `node --version`
3. Try the browser test runner: `npm run test:browser`
4. Check GitHub Actions for CI logs
