// Flight Planning Tool - Main Application Coordinator
// Orchestrates modules and handles high-level flow

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize UI controller
        UIController.init();
        const elements = UIController.getElements();

        // Check geodesy libraries
        RouteCalculator.checkLibraries();

        // Initialize database
        await DataManager.initDB();

        // Setup feature toggles (must be before enableRouteInput)
        UIController.setupFeatureToggles();

        // Check for cached data
        const cacheResult = await DataManager.checkCachedData();
        if (cacheResult.loaded) {
            UIController.updateStatus(cacheResult.status, cacheResult.type);
            UIController.showDataInfo();
            UIController.enableRouteInput();
        }

        // Setup event listeners
        setupEventListeners();

        // Display query history
        UIController.displayQueryHistory();

    } catch (error) {
        console.error('Failed to initialize application:', error);
        UIController.updateStatus('[ERR] INITIALIZATION FAILED', 'error');
    }
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    const elements = UIController.getElements();

    // Data management
    elements.loadDataBtn.addEventListener('click', handleLoadData);
    elements.clearCacheBtn.addEventListener('click', handleClearCache);

    // Route calculation
    elements.calculateBtn.addEventListener('click', handleCalculateRoute);
    elements.clearRouteBtn.addEventListener('click', handleClearRoute);

    // Autocomplete
    elements.routeInput.addEventListener('input', UIController.handleAutocompleteInput);
    elements.routeInput.addEventListener('keydown', (e) => {
        UIController.handleAutocompleteKeydown(e);
        // Handle Enter key for calculation
        if (e.key === 'Enter' && !elements.autocompleteDropdown.classList.contains('show') && !elements.calculateBtn.disabled) {
            handleCalculateRoute();
        }
    });
    elements.routeInput.addEventListener('blur', () => {
        setTimeout(() => UIController.hideAutocomplete(), 200);
    });

    // Click outside to close autocomplete
    document.addEventListener('click', (e) => {
        if (!elements.routeInput.contains(e.target) && !elements.autocompleteDropdown.contains(e.target)) {
            UIController.hideAutocomplete();
        }
    });
}

// ============================================
// EVENT HANDLERS
// ============================================

async function handleLoadData() {
    const elements = UIController.getElements();
    elements.loadDataBtn.disabled = true;

    try {
        await DataManager.loadData(UIController.updateStatus);
        UIController.showDataInfo();
        UIController.enableRouteInput();
    } catch (error) {
        console.error('Error loading data:', error);
        elements.loadDataBtn.disabled = false;
    }
}

async function handleClearCache() {
    if (confirm('CONFIRM: CLEAR ALL CACHED DATA?')) {
        try {
            await DataManager.clearCache();
            const elements = UIController.getElements();

            UIController.updateStatus('[!] CACHE CLEARED - RELOAD DATABASE', 'warning');
            elements.dataInfo.innerHTML = '';
            UIController.disableRouteInput();
            elements.loadDataBtn.disabled = false;
            elements.loadDataBtn.style.display = 'inline-block';
            elements.clearCacheBtn.style.display = 'none';
            elements.resultsSection.style.display = 'none';
        } catch (error) {
            console.error('Error clearing cache:', error);
            alert('ERROR: CACHE CLEAR OPERATION FAILED');
        }
    }
}

async function handleCalculateRoute() {
    try {
        const elements = UIController.getElements();
        const routeValue = elements.routeInput.value;

        // Resolve waypoints
        const resolutionResult = RouteCalculator.resolveWaypoints(routeValue);
        if (resolutionResult.error) {
            alert(resolutionResult.error);
            return;
        }

        // Gather options from UI
        const tasValue = parseFloat(elements.tasInput.value);
        const altitudeValue = parseFloat(elements.altitudeInput.value);
        const windsEnabled = elements.isWindsEnabled();
        const fuelEnabled = elements.isFuelEnabled();
        const forecastPeriod = elements.getSelectedForecast();

        const usableFuelValue = parseFloat(elements.usableFuelInput.value);
        const taxiFuelValue = parseFloat(elements.taxiFuelInput.value);
        const burnRateValue = parseFloat(elements.burnRateInput.value);
        const vfrReserve = elements.getSelectedReserve();

        // Validate TAS if wind correction is enabled
        if (windsEnabled && (isNaN(tasValue) || tasValue <= 0)) {
            alert('ERROR: TRUE AIRSPEED REQUIRED FOR WIND CORRECTION\n\nEnter TAS in knots (e.g., 120)');
            return;
        }

        // Validate fuel inputs if fuel planning is enabled
        if (fuelEnabled && !windsEnabled) {
            alert('ERROR: FUEL PLANNING REQUIRES WIND CORRECTION & TIME\n\nEnable WIND CORRECTION & TIME first');
            return;
        }

        if (fuelEnabled && (isNaN(usableFuelValue) || usableFuelValue <= 0 || isNaN(burnRateValue) || burnRateValue <= 0)) {
            alert('ERROR: FUEL PLANNING REQUIRES VALID INPUTS\n\nEnter usable fuel and burn rate');
            return;
        }

        const options = {
            enableWinds: windsEnabled,
            altitude: windsEnabled ? altitudeValue : null,
            forecastPeriod: windsEnabled ? forecastPeriod : '06',
            enableTime: windsEnabled, // Same as winds now
            tas: windsEnabled ? tasValue : null,
            enableFuel: fuelEnabled,
            usableFuel: fuelEnabled ? usableFuelValue : null,
            taxiFuel: fuelEnabled ? taxiFuelValue : null,
            burnRate: fuelEnabled ? burnRateValue : null,
            vfrReserve: fuelEnabled ? vfrReserve : 30
        };

        // Calculate route (async now to support wind fetching)
        const { waypoints, legs, totalDistance, totalTime, fuelStatus } = await RouteCalculator.calculateRoute(resolutionResult.waypoints, options);

        // Display results
        UIController.displayResults(waypoints, legs, totalDistance, totalTime, fuelStatus, options);

        // Save to history
        DataManager.saveQueryHistory(routeValue.trim().toUpperCase());
        UIController.displayQueryHistory();
    } catch (error) {
        console.error('Error calculating route:', error);
        alert(`ERROR: ROUTE CALCULATION FAILED\n\n${error.message}`);
    }
}

function handleClearRoute() {
    UIController.clearRoute();
}

// ============================================
// SERVICE WORKER
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('[App] ServiceWorker registration successful:', registration.scope);
            })
            .catch((error) => {
                console.log('[App] ServiceWorker registration failed:', error);
            });
    });
}
