// Flight Planning Tool - Main Application Coordinator
// Orchestrates modules and handles high-level flow

// ============================================
// STATE
// ============================================

let currentNavlogData = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Populate version info
        if (window.AppVersion) {
            const versionInfo = window.AppVersion.getVersionInfo();
            const appVersionEl = document.getElementById('app-version');
            const cacheVersionEl = document.getElementById('cache-version');
            const buildDateEl = document.getElementById('build-date');

            if (appVersionEl) appVersionEl.textContent = versionInfo.version;
            if (cacheVersionEl) cacheVersionEl.textContent = versionInfo.cacheName;
            if (buildDateEl) buildDateEl.textContent = versionInfo.buildDate;
        }

        // Initialize UI controller
        UIController.init();
        const elements = UIController.getElements();

        // Initialize Charts controller
        if (window.ChartsController) {
            ChartsController.init();
        }

        // Initialize system checks (Internet, GPS)
        UIController.initSystemChecks();

        // Initialize wake lock (always enabled)
        if (window.WakeLock) {
            window.WakeLock.init();
        }

        // Check geodesy libraries
        RouteCalculator.checkLibraries();

        // Initialize database
        await DataManager.initDB();

        // Check for version changes and auto-reindex if needed
        await checkVersionAndReindex();

        // Setup feature toggles (must be before enableRouteInput)
        UIController.setupFeatureToggles();

        // Check for cached data
        const cacheResult = await DataManager.checkCachedData();
        if (cacheResult.loaded) {
            UIController.showDataInfo();
            UIController.enableRouteInput();
        } else if (cacheResult.corrupted) {
            // Data corruption detected - show error and prompt reload
            UIController.updateDatabaseStatus('error', 'DATA CORRUPTED');
            alert(
                'DATA INTEGRITY FAILURE\n\n' +
                'Cached aviation data failed checksum verification.\n' +
                'This indicates data corruption.\n\n' +
                'The corrupted cache has been cleared.\n' +
                'Please reload the database from the internet.\n\n' +
                'Click "LOAD DATA" to download fresh data.'
            );
        } else {
            UIController.updateDatabaseStatus('warning', 'NOT LOADED');
        }

        // Setup event listeners
        setupEventListeners();

        // Display query history
        UIController.displayQueryHistory();

        // Start GPS automatically
        if (window.VectorMap && window.VectorMap.startGPSTracking) {
            window.VectorMap.startGPSTracking();
        }

        // Load flight tracks list
        updateFlightTracksList();

        // Check for saved navlog (crash recovery) - use FlightState instead of DataManager
        const savedNavlog = window.FlightState ? window.FlightState.loadFromStorage() : null;
        if (savedNavlog && cacheResult.loaded) {
            // Prompt user to restore
            const ageMinutes = Math.floor((Date.now() - savedNavlog.timestamp) / (1000 * 60));
            const ageText = ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.floor(ageMinutes / 60)}h ago`;

            if (confirm(`SAVED NAVLOG FOUND\n\nRoute: ${savedNavlog.routeString}\nSaved: ${ageText}\n\nRestore this flight plan?`)) {
                UIController.restoreNavlog(savedNavlog);

                // Restore currentNavlogData so export works
                currentNavlogData = savedNavlog;

                // Restore FlightState
                if (window.FlightState) {
                    window.FlightState.restoreFlightPlan(savedNavlog);
                }
            } else {
                if (window.FlightState) window.FlightState.clearStorage();
            }
        }

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

    // Data management - Route tab buttons
    elements.loadDataBtn.addEventListener('click', handleLoadData);
    elements.reindexCacheBtn.addEventListener('click', handleReindexCache);
    elements.clearDataBtn.addEventListener('click', handleClearCache);

    // Data management - Data tab buttons (if separate DATA tab exists)
    const loadDataBtnData = document.getElementById('loadDataBtnData');
    const reindexCacheBtnData = document.getElementById('reindexCacheBtnData');
    const clearDataBtnData = document.getElementById('clearDataBtnData');

    if (loadDataBtnData) loadDataBtnData.addEventListener('click', handleLoadData);
    if (reindexCacheBtnData) reindexCacheBtnData.addEventListener('click', handleReindexCache);
    if (clearDataBtnData) clearDataBtnData.addEventListener('click', handleClearCache);

    // Route calculation
    elements.calculateBtn.addEventListener('click', handleCalculateRoute);
    elements.clearRouteBtn.addEventListener('click', handleClearRoute);

    // Navigation waypoint selection
    const prevNavWptBtn = document.getElementById('prevNavWptBtn');
    const nextNavWptBtn = document.getElementById('nextNavWptBtn');
    if (prevNavWptBtn) {
        prevNavWptBtn.addEventListener('click', () => VectorMap.navigateToPrevWaypoint());
    }
    if (nextNavWptBtn) {
        nextNavWptBtn.addEventListener('click', () => VectorMap.navigateToNextWaypoint());
    }

    // Zoom controls
    const zoomBtns = document.querySelectorAll('.zoom-btn[data-zoom]');
    zoomBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const zoomMode = btn.getAttribute('data-zoom');
            VectorMap.setZoomMode(zoomMode);

            // Update active state
            zoomBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Zoom in/out buttons
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => VectorMap.zoomIn());
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => VectorMap.zoomOut());
    }

    // Navlog export/import dropdowns
    setupExportDropdown();
    setupImportDropdown();

    // Flight tracks management
    const refreshTracksBtn = document.getElementById('refreshTracksBtn');
    const clearAllTracksBtn = document.getElementById('clearAllTracksBtn');

    if (refreshTracksBtn) {
        refreshTracksBtn.addEventListener('click', updateFlightTracksList);
    }

    if (clearAllTracksBtn) {
        clearAllTracksBtn.addEventListener('click', () => {
            if (confirm('Delete ALL saved flight tracks? This cannot be undone.')) {
                window.FlightTracker.clearAllTracks();
                updateFlightTracksList();
            }
        });
    }

    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Departure input with autocomplete
    elements.departureInput.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(start, end);

        // Trigger autocomplete
        UIController.handleDepartureAutocompleteInput(e);
    });
    elements.departureInput.addEventListener('keydown', (e) => {
        UIController.handleDepartureKeydown(e);
        if (e.key === 'Enter' && !elements.departureAutocompleteDropdown.classList.contains('show') && !elements.calculateBtn.disabled) {
            handleCalculateRoute();
        }
    });

    // Route input with autocomplete
    elements.routeInput.addEventListener('input', (e) => {
        // Force uppercase
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(start, end);

        // Trigger autocomplete
        UIController.handleAutocompleteInput(e);
    });
    elements.routeInput.addEventListener('keydown', (e) => {
        UIController.handleAutocompleteKeydown(e);
        // Handle Enter key for calculation
        if (e.key === 'Enter' && !elements.autocompleteDropdown.classList.contains('show') && !elements.calculateBtn.disabled) {
            handleCalculateRoute();
        }
    });

    // Destination input with autocomplete
    elements.destinationInput.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(start, end);

        // Trigger autocomplete
        UIController.handleDestinationAutocompleteInput(e);
    });
    elements.destinationInput.addEventListener('keydown', (e) => {
        UIController.handleDestinationKeydown(e);
        if (e.key === 'Enter' && !elements.destinationAutocompleteDropdown.classList.contains('show') && !elements.calculateBtn.disabled) {
            handleCalculateRoute();
        }
    });
    // Prevent input blur when clicking autocomplete (which would hide it)
    let blurTimeout = null;

    elements.routeInput.addEventListener('blur', () => {
        // Delay hiding to allow click events to process first
        blurTimeout = setTimeout(() => {
            UIController.hideAutocomplete();
        }, 200);
    });

    // Cancel blur timeout when clicking on autocomplete dropdown
    elements.autocompleteDropdown.addEventListener('mousedown', (e) => {
        // Prevent the input from losing focus
        e.preventDefault();
        // Clear any pending blur timeout
        if (blurTimeout) {
            clearTimeout(blurTimeout);
            blurTimeout = null;
        }
    });

    // Expose function to cancel blur timeout (called when showing new suggestions)
    elements.cancelBlurTimeout = () => {
        if (blurTimeout) {
            clearTimeout(blurTimeout);
            blurTimeout = null;
        }
    };

    // Departure autocomplete blur handling
    let departureBlurTimeout = null;

    elements.departureInput.addEventListener('blur', () => {
        departureBlurTimeout = setTimeout(() => {
            UIController.hideDepartureAutocomplete();
        }, 200);
    });

    elements.departureAutocompleteDropdown.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (departureBlurTimeout) {
            clearTimeout(departureBlurTimeout);
            departureBlurTimeout = null;
        }
    });

    // Destination autocomplete blur handling
    let destinationBlurTimeout = null;

    elements.destinationInput.addEventListener('blur', () => {
        destinationBlurTimeout = setTimeout(() => {
            UIController.hideDestinationAutocomplete();
        }, 200);
    });

    elements.destinationAutocompleteDropdown.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (destinationBlurTimeout) {
            clearTimeout(destinationBlurTimeout);
            destinationBlurTimeout = null;
        }
    });

    // Click outside to close autocomplete
    document.addEventListener('click', (e) => {
        if (!elements.routeInput.contains(e.target) && !elements.autocompleteDropdown.contains(e.target)) {
            UIController.hideAutocomplete();
        }
        if (!elements.departureInput.contains(e.target) && !elements.departureAutocompleteDropdown.contains(e.target)) {
            UIController.hideDepartureAutocomplete();
        }
        if (!elements.destinationInput.contains(e.target) && !elements.destinationAutocompleteDropdown.contains(e.target)) {
            UIController.hideDestinationAutocomplete();
        }
    });
}

// ============================================
// TAB SWITCHING
// ============================================

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab content
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabContent) {
        tabContent.classList.add('active');
    }

    // Add active class to selected button
    const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

async function handleLoadData() {
    const elements = UIController.getElements();
    const progressContainer = document.getElementById('loadingProgress');
    const progressText = document.getElementById('progressText');

    elements.loadDataBtn.disabled = true;

    // Show progress text
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressText) progressText.textContent = 'Checking data sources...';
    UIController.updateDatabaseStatus('checking', 'CHECKING...');

    try {
        // Get actual download sizes from both sources with timeout protection
        const [nasrSize, oaSize] = await Promise.all([
            window.NASRAdapter.getNASRTotalSize().catch(err => {
                console.warn('[App] NASR size check failed:', err);
                return null;
            }),
            window.OurAirportsAdapter.getOATotalSize().catch(err => {
                console.warn('[App] OurAirports size check failed:', err);
                return null;
            })
        ]);

        // Calculate total size
        let totalSizeMB = 55; // Fallback estimate
        let sizeBreakdown = '';

        if (nasrSize && oaSize) {
            totalSizeMB = (parseFloat(nasrSize.totalMB) + parseFloat(oaSize.totalMB)).toFixed(1);
            sizeBreakdown = `\n  - NASR: ${nasrSize.totalMB}MB (${nasrSize.files.length} files)\n  - OurAirports: ${oaSize.totalMB}MB (${oaSize.files.length} files)\n\n`;
        } else if (nasrSize || oaSize) {
            const size = nasrSize || oaSize;
            const sourceName = nasrSize ? 'NASR' : 'OurAirports';
            totalSizeMB = size.totalMB;
            sizeBreakdown = `\n  - ${sourceName}: ${size.totalMB}MB (${size.files.length} files)\n  - Other sources: checking...\n\n`;
        }

        // Ask for user confirmation
        const confirmed = confirm(
            `LOAD DATABASE\n\n` +
            `Download ${totalSizeMB}MB of aviation data:${sizeBreakdown}` +
            `• US: Airports, navaids, airways, procedures\n` +
            `• Worldwide: Airports and frequencies\n\n` +
            `Continue?`
        );

        if (!confirmed) {
            UIController.updateDatabaseStatus('idle', 'NOT LOADED');
            elements.loadDataBtn.disabled = false;
            if (progressContainer) progressContainer.style.display = 'none';
            return;
        }

        // Update status to loading
        UIController.updateDatabaseStatus('checking', 'LOADING...');
        if (progressText) progressText.textContent = 'Starting download...';

        await DataManager.loadData((message, type) => {
            console.log(`[DataManager] ${message}`);

            // Update progress text - show what's being done
            if (progressText) {
                const cleanMessage = message.replace(/^\[...\]\s*/, '').replace(/^\[OK\]\s*/, '');
                progressText.textContent = cleanMessage;
            }
        });

        // Complete
        if (progressText) progressText.textContent = 'Database loaded successfully!';

        UIController.showDataInfo();
        UIController.enableRouteInput();

        // Hide progress text after a delay
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 2000);

    } catch (error) {
        console.error('Error loading data:', error);
        UIController.updateDatabaseStatus('error', 'LOAD FAILED');
        elements.loadDataBtn.disabled = false;

        if (progressText) progressText.textContent = `Error: ${error.message}`;

        // Hide progress text after error
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 3000);
    }
}

/**
 * Validate semantic version string format (e.g., "2.4.1")
 * @param {string} version - Version string to validate
 * @returns {boolean} True if valid semantic version format
 */
function isValidVersion(version) {
    return /^\d+\.\d+\.\d+$/.test(version);
}

/**
 * Validate cache version format (numeric string)
 * @param {string} cacheVersion - Cache version to validate (e.g., "110")
 * @returns {boolean} True if valid cache version format
 */
function isValidCacheVersion(cacheVersion) {
    return /^\d+$/.test(cacheVersion);
}

/**
 * Check if app version changed and auto-reindex if needed
 *
 * Automatically triggers reindex on:
 * - Service worker cache version change (CACHE_VERSION bump)
 * - Major or minor semantic version change (X.Y.0)
 *
 * Version tracking uses localStorage keys:
 * - 'app_version': Semantic version string (e.g., "2.4.1")
 * - 'app_cache_version': Cache version number string (e.g., "110")
 *
 * Process:
 * 1. First run: Store current versions, no reindex
 * 2. Version match: Skip reindex
 * 3. Version change: Clear in-memory data, re-parse cached CSV
 * 4. On failure: Prompt user with recovery options
 *
 * @returns {Promise<void>}
 * @throws {Error} Logs warning if AppVersion module not available
 *
 * @example
 * // Called during app initialization (after DB init)
 * await checkVersionAndReindex();
 *
 * @sideEffects
 * - Reads/writes localStorage (app_version, app_cache_version)
 * - Calls DataManager.clearInMemoryData() on version change
 * - Calls DataManager.loadFromCache() on version change
 * - Updates UI via UIController.updateStatus()
 *
 * @see {DataManager.checkCachedData}
 * @see {DataManager.clearInMemoryData}
 * @see {DataManager.loadFromCache}
 */
async function checkVersionAndReindex() {
    if (!window.AppVersion) {
        console.warn('[App] AppVersion not available, skipping version check');
        return;
    }

    const currentVersion = window.AppVersion.VERSION;
    const currentCacheVersion = window.AppVersion.CACHE_VERSION;

    // Get stored versions from localStorage
    let storedVersion = localStorage.getItem('app_version');
    let storedCacheVersion = localStorage.getItem('app_cache_version');

    // Validate stored versions
    if (storedVersion && !isValidVersion(storedVersion)) {
        console.warn('[App] Invalid stored version format:', storedVersion);
        localStorage.removeItem('app_version');
        storedVersion = null;
    }

    if (storedCacheVersion && !isValidCacheVersion(storedCacheVersion)) {
        console.warn('[App] Invalid stored cache version format:', storedCacheVersion);
        localStorage.removeItem('app_cache_version');
        storedCacheVersion = null;
    }

    console.log('[App] Version check:', {
        current: currentVersion,
        stored: storedVersion,
        currentCache: currentCacheVersion,
        storedCache: storedCacheVersion
    });

    // Check if this is first run (no stored version)
    if (!storedVersion || !storedCacheVersion) {
        console.log('[App] First run - storing version info');
        localStorage.setItem('app_version', currentVersion);
        localStorage.setItem('app_cache_version', String(currentCacheVersion));
        return;
    }

    // Parse versions (format: "2.4.1" -> [2, 4, 1])
    const [currentMajor, currentMinor] = currentVersion.split('.').map(Number);
    const [storedMajor, storedMinor] = storedVersion.split('.').map(Number);

    // Check if reindex is needed
    const cacheVersionChanged = String(currentCacheVersion) !== storedCacheVersion;
    const majorOrMinorChanged = (currentMajor !== storedMajor) || (currentMinor !== storedMinor);

    if (cacheVersionChanged || majorOrMinorChanged) {
        console.log('[App] Version change detected - auto-reindexing:', {
            cacheVersionChanged,
            majorOrMinorChanged,
            from: `${storedVersion} (cache v${storedCacheVersion})`,
            to: `${currentVersion} (cache v${currentCacheVersion})`
        });

        // Check if there's cached data to reindex
        const hasCachedData = await DataManager.checkCachedData();
        if (!hasCachedData || !hasCachedData.loaded) {
            console.log('[App] No cached data to reindex, skipping');
            localStorage.setItem('app_version', currentVersion);
            localStorage.setItem('app_cache_version', String(currentCacheVersion));
            return;
        }

        try {
            // Show status
            UIController.updateStatus('[...] AUTO-REINDEXING (VERSION UPDATE)', 'loading');
            console.log('[App] Starting automatic reindex...');

            // Clear in-memory data structures but keep cached files
            await DataManager.clearInMemoryData();

            // Re-parse cached files with updated parser
            await DataManager.loadFromCache((message, type) => {
                UIController.updateStatus(message, type);
                console.log(`[DataManager] ${message}`);
            });

            UIController.updateStatus('[✓] AUTO-REINDEX COMPLETE', 'success');
            console.log('[App] Auto-reindex successful');

            // Update stored versions
            localStorage.setItem('app_version', currentVersion);
            localStorage.setItem('app_cache_version', String(currentCacheVersion));

        } catch (error) {
            console.error('[App] Auto-reindex failed:', error);
            UIController.updateStatus('[!] AUTO-REINDEX FAILED', 'warning');

            // Notify user with actionable guidance
            const userAction = confirm(
                'AUTO-REINDEX FAILED\n\n' +
                `Error: ${error.message}\n\n` +
                'This can happen if:\n' +
                '• Cached data is corrupted\n' +
                '• Database is locked\n' +
                '• Browser storage is full\n\n' +
                'OPTIONS:\n' +
                '✓ OK: Try reloading the page\n' +
                '✗ Cancel: Skip auto-reindex for this session\n\n' +
                'You can manually reindex from WELCOME tab → LOAD DATA'
            );

            if (userAction) {
                // User chose to reload - don't update versions (will retry)
                console.log('[App] User chose to reload for retry');
            } else {
                // User chose to skip - update versions to prevent retry loop
                console.log('[App] User chose to skip auto-reindex');
                localStorage.setItem('app_version', currentVersion);
                localStorage.setItem('app_cache_version', String(currentCacheVersion));
                localStorage.setItem('app_skip_reindex', 'true'); // Flag for debugging
            }
        }
    } else {
        console.log('[App] Version unchanged, no reindex needed');
    }
}

async function handleReindexCache() {
    if (!confirm('This will re-parse all cached data files with the latest parser code.\n\nAny parser changes will be applied.\n\nContinue?')) {
        return;
    }

    const elements = UIController.getElements();
    elements.reindexCacheBtn.disabled = true;

    try {
        // Clear in-memory data structures but keep cached files
        UIController.updateStatus('[...] CLEARING IN-MEMORY DATA', 'loading');
        await DataManager.clearInMemoryData?.();

        // Re-parse cached files with updated parser
        UIController.updateStatus('[...] RE-PARSING CACHED FILES', 'loading');
        await DataManager.loadFromCache((message, type) => {
            UIController.updateStatus(message, type);
            console.log(`[DataManager] ${message}`);
        });

        UIController.updateStatus('[✓] DATABASE REINDEXED', 'success');
        UIController.showDataInfo();
        UIController.enableRouteInput();
        alert('Database reindexed successfully!\n\nCached data has been re-parsed with updated code.');
    } catch (error) {
        console.error('Error reindexing:', error);
        UIController.updateStatus('[✗] REINDEX FAILED', 'error');
        alert('ERROR: REINDEX OPERATION FAILED\n\n' + error.message);
    } finally {
        elements.reindexCacheBtn.disabled = false;
    }
}

async function handleClearCache() {
    if (confirm('WARNING: This will delete ALL cached data (airports, navaids, airways, procedures).\n\nYou will need to reload all data from scratch.\n\nContinue?')) {
        try {
            await DataManager.clearCache();
            const elements = UIController.getElements();

            // Update database status
            UIController.updateDatabaseStatus('warning', 'NOT LOADED');

            // Clear and reset UI
            elements.dataInfo.innerHTML = '';
            elements.dataInfo.style.display = 'none';
            elements.dataInspection.style.display = 'none';
            elements.dataInspection.innerHTML = '';

            // Reset buttons
            elements.loadDataBtn.disabled = false;
            elements.loadDataBtn.style.display = 'inline-block';
            elements.reindexCacheBtn.style.display = 'none';
            elements.clearDataBtn.style.display = 'none';

            elements.resultsSection.style.display = 'none';

            UIController.disableRouteInput();
        } catch (error) {
            console.error('Error clearing cache:', error);
            alert('ERROR: CACHE CLEAR OPERATION FAILED');
        }
    }
}

async function handleCalculateRoute() {
    try {
        const elements = UIController.getElements();

        // Get ICAO-style inputs (departure/route/destination)
        const departure = elements.departureInput.value.trim();
        const routeMiddle = elements.routeInput.value.trim();
        const destination = elements.destinationInput.value.trim();

        // Build complete route string
        // Support three input modes:
        // 1. All three fields: departure + route + destination (traditional)
        // 2. Only departure and destination: direct routing
        // 3. Only route field: first waypoint is departure, last is destination
        let fullRoute;
        let actualDeparture = departure;
        let actualDestination = destination;

        if (departure && destination) {
            // Traditional mode: departure and destination provided
            if (routeMiddle) {
                fullRoute = `${departure} ${routeMiddle} ${destination}`;
            } else {
                fullRoute = `${departure} ${destination}`;
                console.log('[Route] No route specified - using DCT (direct)');
            }
        } else if (!departure && !destination && routeMiddle) {
            // Waypoint-only mode: treat first waypoint as departure, last as destination
            const waypoints = routeMiddle.trim().split(/\s+/).filter(w => w.length > 0);
            if (waypoints.length < 2) {
                alert('ERROR: AT LEAST TWO WAYPOINTS REQUIRED\n\nEnter at least a departure and destination waypoint');
                return;
            }
            actualDeparture = waypoints[0];
            actualDestination = waypoints[waypoints.length - 1];
            fullRoute = routeMiddle;
            console.log(`[Route] Waypoint-only mode: ${actualDeparture} to ${actualDestination}`);
        } else {
            // Invalid input: some fields filled but not in a valid combination
            alert('ERROR: INVALID ROUTE INPUT\n\nEither:\n• Enter departure and destination\n• Or enter waypoints in the route field (first = departure, last = destination)');
            return;
        }

        console.log(`[Route] Full route: ${fullRoute}`);

        // Resolve waypoints
        const resolutionResult = RouteCalculator.resolveWaypoints(fullRoute);
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

        // Validate TAS and altitude (now mandatory)
        if (isNaN(tasValue) || tasValue <= 0) {
            alert('ERROR: TRUE AIRSPEED REQUIRED\n\nEnter TAS in knots (e.g., 110)');
            return;
        }

        if (isNaN(altitudeValue) || altitudeValue < 0) {
            alert('ERROR: CRUISE ALTITUDE REQUIRED\n\nEnter altitude in feet MSL (e.g., 5500)');
            return;
        }

        // Validate fuel inputs if fuel planning is enabled
        if (fuelEnabled && (isNaN(usableFuelValue) || usableFuelValue <= 0 || isNaN(burnRateValue) || burnRateValue <= 0)) {
            alert('ERROR: FUEL PLANNING REQUIRES VALID INPUTS\n\nEnter usable fuel and burn rate');
            return;
        }

        const options = {
            enableWinds: windsEnabled,
            altitude: altitudeValue, // Always pass altitude (mandatory)
            forecastPeriod: windsEnabled ? forecastPeriod : '06',
            enableTime: true, // Always calculate time (requires altitude & TAS)
            tas: tasValue, // Always pass TAS (mandatory)
            enableFuel: fuelEnabled,
            usableFuel: fuelEnabled ? usableFuelValue : null,
            taxiFuel: fuelEnabled ? taxiFuelValue : null,
            burnRate: fuelEnabled ? burnRateValue : null,
            vfrReserve: fuelEnabled ? vfrReserve : 30
        };

        // Calculate route (async now to support wind fetching)
        const { waypoints, legs, totalDistance, totalTime, fuelStatus, windData, windMetadata } = await RouteCalculator.calculateRoute(resolutionResult.waypoints, options);

        // Alert user if wind data is stale or expired
        if (windsEnabled && windMetadata) {
            const isWithinWindow = Utils.isWithinUseWindow(windMetadata.useWindow);
            const dataAge = Date.now() - windMetadata.parsedAt;

            // Determine max age based on forecast period
            // 6hr forecasts update every 6 hours, 12hr/24hr every 12 hours
            let maxAge;
            let updateFrequency;
            if (forecastPeriod === '24') {
                maxAge = 12 * 60 * 60 * 1000; // 12 hours
                updateFrequency = '12 hours';
            } else if (forecastPeriod === '12') {
                maxAge = 12 * 60 * 60 * 1000; // 12 hours
                updateFrequency = '12 hours';
            } else { // '06'
                maxAge = 6 * 60 * 60 * 1000; // 6 hours
                updateFrequency = '6 hours';
            }

            const isStale = dataAge > maxAge;

            if (!isWithinWindow || isStale) {
                const ageHours = Math.floor(dataAge / (60 * 60 * 1000));
                let warningMsg = 'WIND DATA WARNING\n\n';

                if (!isWithinWindow) {
                    warningMsg += `⚠ Wind forecast is OUTSIDE valid time window\n`;
                    warningMsg += `Valid: ${Utils.formatUseWindow(windMetadata.useWindow)}\n\n`;
                }

                if (isStale) {
                    warningMsg += `⚠ Wind data is ${ageHours} hours old\n`;
                    warningMsg += `(${forecastPeriod}-hour forecasts update every ${updateFrequency})\n\n`;
                }

                warningMsg += 'This may be cached data from when you were offline.\n';
                warningMsg += 'Route calculation will continue with this data.\n\n';
                warningMsg += 'Consider refreshing when online for latest forecasts.';

                alert(warningMsg);
            }
        }

        // Display results
        UIController.displayResults(waypoints, legs, totalDistance, totalTime, fuelStatus, { ...options, windMetadata });

        // Display vector map
        VectorMap.displayMap(waypoints, legs, options);

        // Update Flight Tracker with fuel data
        if (window.FlightTracker && fuelEnabled) {
            window.FlightTracker.setFuel(usableFuelValue, burnRateValue, taxiFuelValue || 0);
        }

        // Auto-switch to NAVLOG tab after calculation
        switchTab('navlog');

        // Save to history - use FlightState instead of DataManager
        if (window.FlightState) {
            window.FlightState.saveToHistory(fullRoute.trim().toUpperCase());
        }
        UIController.displayQueryHistory();

        // Store current navlog data (including separate departure/destination for crash recovery)
        currentNavlogData = {
            routeString: fullRoute.trim().toUpperCase(),
            departure: actualDeparture,
            destination: actualDestination,
            routeMiddle: routeMiddle,
            waypoints,
            legs,
            totalDistance,
            totalTime,
            fuelStatus,
            options,
            altitude: altitudeValue, // Always store (mandatory)
            tas: tasValue, // Always store (mandatory)
            windData: windData
        };

        // Update flight plan state and auto-save for crash recovery
        if (window.FlightState) {
            window.FlightState.updateFlightPlan(currentNavlogData);
            window.FlightState.saveToStorage();
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        alert(`ERROR: ROUTE CALCULATION FAILED\n\n${error.message}`);
    }
}

function handleClearRoute() {
    UIController.clearRoute();
    // Clear flight plan and storage - use FlightState instead of DataManager
    if (window.FlightState) {
        window.FlightState.clearFlightPlan();
        window.FlightState.clearStorage();
    }
    currentNavlogData = null;
}

// ============================================
// EXPORT/IMPORT SELECT SYSTEM
// ============================================

function setupExportDropdown() {
    const exportSelect = document.getElementById('exportNavlogSelect');
    if (!exportSelect) return;

    exportSelect.addEventListener('change', (e) => {
        const format = e.target.value;
        if (format) {
            handleExportFormat(format);
            // Reset to default option
            e.target.value = '';
        }
    });
}

function setupImportDropdown() {
    const importSelect = document.getElementById('importNavlogSelect');
    const fileInput = document.getElementById('importNavlogInput');

    if (!importSelect || !fileInput) return;

    importSelect.addEventListener('change', (e) => {
        const format = e.target.value;
        if (format) {
            // Trigger file input with correct accept type
            if (format === 'json') {
                fileInput.accept = '.json';
            }
            fileInput.click();
            // Reset to default option
            e.target.value = '';
        }
    });

    // Handle file selection
    fileInput.addEventListener('change', handleImportFile);
}

function handleExportFormat(format) {
    if (!currentNavlogData) {
        alert('ERROR: NO NAVLOG TO EXPORT\n\nCalculate a route first.');
        return;
    }

    if (!window.FlightState) {
        alert('ERROR: FLIGHTSTATE NOT AVAILABLE');
        return;
    }

    // Ensure FlightState has current data
    window.FlightState.updateFlightPlan(currentNavlogData);

    let success = false;

    switch (format) {
        case 'json':
            success = window.FlightState.exportAsFile();
            if (!success) {
                alert('ERROR: FAILED TO EXPORT JSON');
            }
            break;

        case 'csv':
            success = window.FlightState.exportToForeFlightCSV();
            if (success) {
                alert('CSV EXPORTED\n\nFilename: user_waypoints.csv\n\nImport into ForeFlight via:\n- Content Pack\n- iTunes/Finder');
            } else {
                alert('ERROR: FAILED TO EXPORT CSV');
            }
            break;

        case 'kml':
            success = window.FlightState.exportToForeFlightKML();
            if (success) {
                alert('KML EXPORTED\n\nFilename: user_waypoints.kml\n\nImport into ForeFlight via:\n- AirDrop from Mac\n- Email attachment\n- iTunes/Finder');
            } else {
                alert('ERROR: FAILED TO EXPORT KML');
            }
            break;

        default:
            alert('ERROR: UNKNOWN EXPORT FORMAT');
    }
}

async function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        if (!window.FlightState) {
            throw new Error('FlightState not available');
        }

        const navlogData = await window.FlightState.importFromFile(file);

        // Restore the navlog
        UIController.restoreNavlog(navlogData);

        // Store as current
        currentNavlogData = navlogData;

        // Update flight plan and save for crash recovery
        window.FlightState.updateFlightPlan(navlogData);
        window.FlightState.saveToStorage();

        alert(`NAVLOG IMPORTED\n\nRoute: ${navlogData.routeString}`);
    } catch (error) {
        console.error('Import error:', error);
        alert(`ERROR: FAILED TO IMPORT\n\n${error.message}`);
    } finally {
        // Clear file input
        event.target.value = '';
    }
}

// ============================================
// FLIGHT TRACKS MANAGEMENT
// ============================================

function updateFlightTracksList() {
    const tracksListDiv = document.getElementById('flightTracksList');
    const clearAllBtn = document.getElementById('clearAllTracksBtn');

    if (!tracksListDiv) return;

    const tracks = window.FlightTracker.getSavedTracks();

    if (tracks.length === 0) {
        tracksListDiv.innerHTML = '<p class="help-text">No saved flight tracks</p>';
        if (clearAllBtn) clearAllBtn.style.display = 'none';
        return;
    }

    // Show clear all button if there are tracks
    if (clearAllBtn) clearAllBtn.style.display = 'inline-block';

    // Sort tracks by timestamp (newest first)
    tracks.sort((a, b) => b.timestamp - a.timestamp);

    // Build tracks list HTML
    let html = '<div class="tracks-table">';

    tracks.forEach(track => {
        const date = new Date(track.timestamp);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const duration = formatDuration(track.flightDuration || 0);

        html += `
            <div class="track-item" data-track-id="${track.id}">
                <div class="track-info">
                    <div class="track-date text-primary font-bold">${dateStr} ${timeStr}</div>
                    <div class="track-stats text-secondary text-xs">
                        ${track.pointCount} points | ${duration} flight time
                    </div>
                </div>
                <div class="track-actions">
                    <button class="btn btn-secondary btn-sm export-track-btn" data-track-id="${track.id}">EXPORT</button>
                    <button class="btn btn-warning btn-sm delete-track-btn" data-track-id="${track.id}">DELETE</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    tracksListDiv.innerHTML = html;

    // Attach event listeners to export/delete buttons
    tracksListDiv.querySelectorAll('.export-track-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trackId = parseInt(btn.getAttribute('data-track-id'));
            const track = tracks.find(t => t.id === trackId);
            if (track) {
                window.FlightTracker.exportTrackAsGeoJSON(track);
            }
        });
    });

    tracksListDiv.querySelectorAll('.delete-track-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trackId = parseInt(btn.getAttribute('data-track-id'));
            if (confirm('Delete this flight track? This cannot be undone.')) {
                window.FlightTracker.deleteTrack(trackId);
                updateFlightTracksList();
            }
        });
    });
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}`;
    }
    return `${minutes}m`;
}

// ============================================
// SERVICE WORKER
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('[App] ServiceWorker registration successful:', registration.scope);

                // Check for updates once per day (24 hours)
                // Note: Browser also auto-checks every 24h when user navigates to page
                setInterval(() => {
                    console.log('[App] Performing daily update check');
                    registration.update();
                }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

                // Detect when a new service worker is waiting
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('[App] New ServiceWorker found, installing...');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available, show update notification
                            console.log('[App] New ServiceWorker installed, update available');
                            showUpdateNotification();
                        }
                    });
                });

                // Check if there's already a waiting service worker
                if (registration.waiting) {
                    console.log('[App] ServiceWorker update waiting');
                    showUpdateNotification();
                }
            })
            .catch((error) => {
                console.log('[App] ServiceWorker registration failed:', error);
            });
    });

    // Listen for controller change (when new SW activates)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[App] New ServiceWorker activated, reloading page');
        window.location.reload();
    });

    // Check for updates when user returns to app (changes tab/window)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.serviceWorker.controller) {
            console.log('[App] Page visible again, checking for updates');
            navigator.serviceWorker.ready.then((registration) => {
                registration.update();
            });
        }
    });
}

/**
 * Shows update notification banner to user with version info
 */
async function showUpdateNotification() {
    const notification = document.getElementById('update-notification');
    if (!notification) return;

    // Get new version info from waiting service worker
    try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.waiting) {
            // Fetch version.js from the new service worker to get new version info
            const response = await fetch('./version.js');
            const versionCode = await response.text();

            // Extract version info using regex (hacky but works without eval)
            const buildDateMatch = versionCode.match(/BUILD_DATE:\s*['"]([^'"]+)['"]/);
            const releaseNameMatch = versionCode.match(/RELEASE_NAME:\s*['"]([^'"]+)['"]/);
            const majorMatch = versionCode.match(/MAJOR:\s*(\d+)/);
            const minorMatch = versionCode.match(/MINOR:\s*(\d+)/);
            const patchMatch = versionCode.match(/PATCH:\s*(\d+)/);

            if (majorMatch && minorMatch && patchMatch) {
                const newVersion = `${majorMatch[1]}.${minorMatch[1]}.${patchMatch[1]}`;
                const currentVersion = window.AppVersion ? window.AppVersion.VERSION : 'unknown';

                // Update notification text
                const versionInfo = document.getElementById('update-version-info');
                const releaseInfo = document.getElementById('update-release-info');

                // Check if versions are actually different
                if (newVersion === currentVersion) {
                    // Same version - just show generic update message
                    // (happens during development/testing with same cache version)
                    if (versionInfo) {
                        versionInfo.textContent = 'New update available';
                    }
                    if (releaseInfo && releaseNameMatch && releaseNameMatch[1]) {
                        releaseInfo.textContent = releaseNameMatch[1];
                    }
                } else {
                    // Different versions - show detailed upgrade info
                    if (versionInfo) {
                        versionInfo.textContent = `v${currentVersion} to v${newVersion}`;
                    }

                    // Calculate days ago
                    let daysAgo = '';
                    if (buildDateMatch) {
                        const buildDate = new Date(buildDateMatch[1]);
                        const now = new Date();
                        const diffTime = Math.abs(now - buildDate);
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays === 0) {
                            daysAgo = 'Released today';
                        } else if (diffDays === 1) {
                            daysAgo = 'Released yesterday';
                        } else if (diffDays < 30) {
                            daysAgo = `Released ${diffDays} days ago`;
                        } else {
                            // Don't show if older than 30 days (probably wrong date)
                            daysAgo = '';
                        }
                    }

                    if (releaseInfo) {
                        const parts = [];
                        if (releaseNameMatch && releaseNameMatch[1]) {
                            parts.push(releaseNameMatch[1]);
                        }
                        if (daysAgo) {
                            parts.push(daysAgo);
                        }
                        releaseInfo.textContent = parts.join(' • ');
                    }
                }
            }
        }
    } catch (error) {
        console.error('[App] Failed to get new version info:', error);
        // Fallback to generic message
        const versionInfo = document.getElementById('update-version-info');
        if (versionInfo) {
            versionInfo.textContent = 'A new version of IN-FLIGHT is ready';
        }
    }

    // Show the notification
    notification.classList.add('show');
}

/**
 * Activates waiting service worker and reloads page
 */
window.activateUpdate = function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
            if (registration.waiting) {
                // Show updating message
                const notification = document.getElementById('update-notification');
                const updateText = notification?.querySelector('.update-notification-text strong');
                const updateBtn = notification?.querySelector('.btn-primary');

                if (updateText) updateText.textContent = 'UPDATING...';
                if (updateBtn) updateBtn.disabled = true;

                // Tell the waiting service worker to skip waiting
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                // Page will reload automatically via controllerchange listener
            } else {
                console.warn('[Update] No waiting service worker found');
                // Force reload anyway in case something went wrong
                setTimeout(() => window.location.reload(), 500);
            }
        });
    }
};

/**
 * Dismisses update notification (user wants to update later)
 */
window.dismissUpdate = function() {
    const notification = document.getElementById('update-notification');
    if (notification) {
        notification.classList.remove('show');
    }
};

/**
 * Manually checks for service worker updates
 * Called when user clicks "CHECK FOR UPDATES" button
 */
window.checkForUpdates = async function(event) {
    const statusEl = document.getElementById('update-check-status');
    const button = event ? event.target : null;

    if (!('serviceWorker' in navigator)) {
        if (statusEl) {
            statusEl.textContent = 'Service worker not supported';
            statusEl.style.color = 'var(--color-error)';
        }
        return;
    }

    try {
        // Disable button and show checking status
        if (button) {
            button.disabled = true;
            button.textContent = 'CHECKING...';
        }
        if (statusEl) {
            statusEl.textContent = 'Checking for updates...';
            statusEl.style.color = 'var(--text-secondary)';
        }

        const registration = await navigator.serviceWorker.ready;

        // Force check for updates
        await registration.update();

        // Wait a moment for the update check to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (registration.waiting) {
            // Update is available
            if (statusEl) {
                statusEl.textContent = 'Update available! Click "UPDATE NOW" in banner above.';
                statusEl.style.color = 'var(--color-metric)';
            }
            showUpdateNotification();
        } else if (registration.installing) {
            // Update is installing
            if (statusEl) {
                statusEl.textContent = 'Update installing... Please wait.';
                statusEl.style.color = 'var(--color-warning)';
            }
            // Listen for installation completion
            registration.installing.addEventListener('statechange', function() {
                if (this.state === 'installed') {
                    showUpdateNotification();
                    if (statusEl) {
                        statusEl.textContent = 'Update ready! Click "UPDATE NOW" in banner above.';
                        statusEl.style.color = 'var(--color-metric)';
                    }
                }
            });
        } else {
            // No update available
            if (statusEl) {
                statusEl.textContent = 'You are running the latest version!';
                statusEl.style.color = 'var(--color-metric)';
            }
        }

    } catch (error) {
        console.error('[App] Update check failed:', error);
        if (statusEl) {
            statusEl.textContent = 'Update check failed. Try again later.';
            statusEl.style.color = 'var(--color-error)';
        }
    } finally {
        // Re-enable button
        if (button) {
            button.disabled = false;
            button.textContent = 'CHECK FOR UPDATES';
        }
    }
};
