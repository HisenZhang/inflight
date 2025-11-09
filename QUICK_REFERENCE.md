# InFlight - Quick Reference Card

## Automated Testing ✅

### Run Tests
```bash
# Make sure you're using Node.js 8.3+ (16+ recommended)
node --version

# Run all tests (fast, ~1 second)
npm test

# Run tests with JSDOM (full DOM simulation)
npm run test:jsdom

# Open browser test runner (interactive)
npm run test:browser
```

### After Setting nvm Default
```bash
# If you just ran: nvm alias default node
# You need to reload your shell or open a new terminal

# Option 1: Reload shell
source ~/.zshrc  # or source ~/.bashrc

# Option 2: Open new terminal
# Then run: npm test
```

### Expected Test Output
```
InFlight Test Suite

Testing: Coordinate Formatting
  ✓ should format positive latitude correctly
  ...

============================================================
Total Tests: 50
Passed: 50
Failed: 0

✓ All tests passed!
```

## Development Workflow

### 1. Install Dependencies (First Time)
```bash
npm install
```

### 2. Make Code Changes
```bash
# Edit any file
vim state/flight-state.js
```

### 3. Test Before Committing
```bash
# Run tests
npm test

# If tests pass (exit code 0)
git add .
git commit -m "Your message"
git push
```

### 4. View CI/CD Results
- GitHub → Actions tab
- Green ✓ = all tests passed
- Red ✗ = tests failed

## Architecture Overview

### Directory Structure
```
inflight/
├── lib/          # External libraries
├── utils/        # Shared utilities
├── data/         # Data Engine (CRUD)
├── compute/      # Compute Engine (business logic)
├── state/        # State management
├── display/      # Display Engine (UI)
├── tests/        # Test suite (50+ tests)
└── docs/         # Documentation
```

### The Three Engines

**Data Engine** (`data/`)
- CRUD operations, IndexedDB storage
- Modules: DataManager, adapters

**Compute Engine** (`compute/`)
- Business logic, calculations
- Modules: QueryEngine, RouteCalculator, RouteExpander

**Display Engine** (`display/`)
- UI, rendering, interaction
- Modules: UIController, TacticalDisplay, App

## Test Coverage

| Module | Coverage | Status |
|--------|----------|--------|
| utils/formatters.js | 100% | ✅ |
| state/flight-state.js | 95% | ✅ |
| compute/query-engine.js | 0% | ⚠️ TODO |
| compute/route-calculator.js | 0% | ⚠️ TODO |

## Common Commands

### Testing
```bash
npm test              # Run all tests
npm run test:browser  # Open browser test runner
npm start            # Open main app
```

### Git
```bash
git status           # Check status
git add .           # Stage all changes
git commit -m "msg" # Commit with message
git push            # Push to remote
```

### Node.js (nvm)
```bash
nvm install 16      # Install Node 16
nvm use 16          # Use Node 16
nvm alias default 16 # Set default to Node 16
node --version      # Check version
```

## Documentation

- **Testing Guide**: [TESTING.md](TESTING.md)
- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Test Suite**: [tests/README.md](tests/README.md)
- **Main README**: [README.md](README.md)
- **Refactoring Summary**: [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)
- **Automated Testing**: [AUTOMATED_TESTING_SUMMARY.md](AUTOMATED_TESTING_SUMMARY.md)

## Troubleshooting

### Tests Fail with "Unexpected token ..."
**Cause**: Node.js < 8.3
**Fix**: `nvm install 16 && nvm use 16`

### nvm alias doesn't work immediately
**Cause**: Shell hasn't reloaded
**Fix**: `source ~/.zshrc` or open new terminal

### JSDOM errors
**Cause**: Compatibility issues
**Fix**: Use simple runner: `npm test`

## Quick Tips

✅ **Always run tests before committing**: `npm test && git commit`
✅ **Tests must pass in CI**: Check Actions tab after push
✅ **Write tests for new features**: See tests/README.md
✅ **Use browser runner for debugging**: `npm run test:browser`

## Status

- ✅ 3-Engine Architecture Complete
- ✅ 50+ Tests with 100% Coverage (utils, state)
- ✅ Automated Testing with Node.js
- ✅ GitHub Actions CI/CD
- ✅ Comprehensive Documentation

---

**Need Help?**
- Check [TESTING.md](TESTING.md) for detailed testing guide
- Check [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for architecture details
- Run `npm test` to verify everything works
