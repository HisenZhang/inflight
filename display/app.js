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

        // Initialize system checks (Internet, GPS)
        UIController.initSystemChecks();

        // Initialize wake lock
        if (window.WakeLock) {
            const wakeLockInit = window.WakeLock.init();
            // Restore UI state if wake lock was previously enabled
            if (wakeLockInit && window.WakeLock.isEnabled) {
                const wakeLockToggle = document.getElementById('enableWakeLockToggle');
                if (wakeLockToggle) {
                    wakeLockToggle.classList.add('checked');
                }
            }
        }

        // Check geodesy libraries
        RouteCalculator.checkLibraries();

        // Initialize database
        await DataManager.initDB();

        // Setup feature toggles (must be before enableRouteInput)
        UIController.setupFeatureToggles();

        // Check for cached data
        const cacheResult = await DataManager.checkCachedData();
        if (cacheResult.loaded) {
            UIController.showDataInfo();
            UIController.enableRouteInput();
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

    // Navlog export/import
    const exportNavlogBtn = document.getElementById('exportNavlogBtn');
    const importNavlogBtn = document.getElementById('importNavlogBtn');
    const importNavlogInput = document.getElementById('importNavlogInput');

    if (exportNavlogBtn) {
        exportNavlogBtn.addEventListener('click', handleExportNavlog);
    }

    if (importNavlogBtn && importNavlogInput) {
        importNavlogBtn.addEventListener('click', () => {
            importNavlogInput.click();
        });

        importNavlogInput.addEventListener('change', handleImportNavlog);
    }

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
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    // Show progress bar
    if (progressContainer) {
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = 'Checking file sizes...';
    }

    elements.loadDataBtn.disabled = true;
    UIController.updateDatabaseStatus('checking', 'CHECKING...');

    try {
        // Get actual download sizes from both sources (parallel HEAD requests)
        const [nasrSize, oaSize] = await Promise.all([
            window.NASRAdapter.getNASRTotalSize(),
            window.OurAirportsAdapter.getOATotalSize()
        ]);

        // Calculate total size
        let totalSizeMB = 55; // Fallback estimate
        let sizeBreakdown = '';

        if (nasrSize && oaSize) {
            totalSizeMB = (parseFloat(nasrSize.totalMB) + parseFloat(oaSize.totalMB)).toFixed(1);
            sizeBreakdown = `\n  - NASR: ${nasrSize.totalMB}MB (${nasrSize.files.length} files)\n  - OurAirports: ${oaSize.totalMB}MB (${oaSize.files.length} files)\n\n`;
        } else if (nasrSize || oaSize) {
            const size = nasrSize || oaSize;
            totalSizeMB = size.totalMB;
            sizeBreakdown = `\n  - ${size.totalMB}MB (${size.files.length} files)\n  - Other sources: checking...\n\n`;
        }

        // Ask for user confirmation
        const confirmed = confirm(
            `LOAD DATABASE\n\n` +
            `This will download ${totalSizeMB}MB of aviation data:${sizeBreakdown}` +
            `• FAA NASR (US airports, navaids, airways, procedures)\n` +
            `• OurAirports (Worldwide airports, frequencies)\n\n` +
            `Downloads happen in parallel. Data is compressed and cached locally.\n\n` +
            `Continue with download?`
        );

        if (!confirmed) {
            UIController.updateDatabaseStatus('idle', 'NOT LOADED');
            elements.loadDataBtn.disabled = false;
            if (progressContainer) progressContainer.style.display = 'none';
            return;
        }

        // Update status to loading
        UIController.updateDatabaseStatus('checking', 'LOADING...');
        if (progressText) progressText.textContent = 'Downloading files...';

        // Track progress
        let totalSteps = 0;
        let completedSteps = 0;

        await DataManager.loadData((message, type) => {
            console.log(`[DataManager] ${message}`);

            // Update progress bar based on status messages
            if (message.includes('LOADING DATA SOURCES')) {
                totalSteps = 15; // Approximate total steps
                completedSteps = 1;
            } else if (message.includes('PARSING')) {
                completedSteps++;
            } else if (message.includes('INDEXING') || message.includes('BUILDING')) {
                completedSteps++;
            } else if (message.includes('MERGING')) {
                completedSteps++;
            } else if (message.includes('CACHING')) {
                completedSteps++;
            }

            // Update progress bar
            if (progressBar && totalSteps > 0) {
                const percentage = Math.min(100, (completedSteps / totalSteps) * 100);
                progressBar.style.width = `${percentage}%`;
            }

            // Update progress text
            if (progressText) {
                const cleanMessage = message.replace(/^\[...\]\s*/, '').replace(/^\[OK\]\s*/, '');
                progressText.textContent = cleanMessage;
            }
        });

        // Complete
        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = 'Database loaded successfully!';

        UIController.showDataInfo();
        UIController.enableRouteInput();

        // Hide progress bar after a delay
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 2000);

    } catch (error) {
        console.error('Error loading data:', error);
        UIController.updateDatabaseStatus('error', 'LOAD FAILED');
        elements.loadDataBtn.disabled = false;

        if (progressText) progressText.textContent = `Error: ${error.message}`;
        if (progressBar) progressBar.style.width = '0%';

        // Hide progress bar after error
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 3000);
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
            options
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

function handleExportNavlog() {
    if (!currentNavlogData) {
        alert('ERROR: NO NAVLOG TO EXPORT\n\nCalculate a route first.');
        return;
    }

    // Use FlightState for export instead of DataManager
    if (window.FlightState) {
        // Ensure FlightState has current data
        window.FlightState.updateFlightPlan(currentNavlogData);
        const success = window.FlightState.exportAsFile();
        if (!success) {
            alert('ERROR: FAILED TO EXPORT NAVLOG');
        }
    } else {
        alert('ERROR: FLIGHTSTATE NOT AVAILABLE');
    }
}

async function handleImportNavlog(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Use FlightState for import instead of DataManager
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
        alert(`ERROR: FAILED TO IMPORT NAVLOG\n\n${error.message}`);
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
