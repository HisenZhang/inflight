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
        // Initialize UI controller
        UIController.init();
        const elements = UIController.getElements();

        // Initialize system checks (Internet, GPS)
        UIController.initSystemChecks();

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

    // Uppercase conversion for departure input
    elements.departureInput.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(start, end);
    });
    elements.departureInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !elements.calculateBtn.disabled) {
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

    // Uppercase conversion for destination input
    elements.destinationInput.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(start, end);
    });
    elements.destinationInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !elements.calculateBtn.disabled) {
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

    // Click outside to close autocomplete
    document.addEventListener('click', (e) => {
        if (!elements.routeInput.contains(e.target) && !elements.autocompleteDropdown.contains(e.target)) {
            UIController.hideAutocomplete();
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
    elements.loadDataBtn.disabled = true;

    // Update database status to loading
    UIController.updateDatabaseStatus('checking', 'LOADING...');

    try {
        await DataManager.loadData((message, type) => {
            // Don't update the old status box, just log progress
            console.log(`[DataManager] ${message}`);
        });
        UIController.showDataInfo();
        UIController.enableRouteInput();
    } catch (error) {
        console.error('Error loading data:', error);
        UIController.updateDatabaseStatus('error', 'LOAD FAILED');
        elements.loadDataBtn.disabled = false;
    }
}

async function handleReindexCache() {
    try {
        UIController.updateStatus('[...] REINDEXING TOKEN MAP', 'loading');
        await DataManager.rebuildTokenTypeMap();
        UIController.updateStatus('[✓] DATABASE READY', 'success');
        UIController.showDataInfo();
        alert('Token map reindexed successfully!');
    } catch (error) {
        console.error('Error reindexing:', error);
        alert('ERROR: REINDEX OPERATION FAILED');
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

        // Validate that at least departure and destination are provided
        if (!departure || !destination) {
            alert('ERROR: DEPARTURE AND DESTINATION REQUIRED\n\nEnter departure airport and destination airport');
            return;
        }

        // Build complete route string
        // If route is empty, assume DCT (direct)
        let fullRoute;
        if (routeMiddle) {
            fullRoute = `${departure} ${routeMiddle} ${destination}`;
        } else {
            fullRoute = `${departure} ${destination}`;
            console.log('[Route] No route specified - using DCT (direct)');
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
            departure: departure,
            destination: destination,
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
            })
            .catch((error) => {
                console.log('[App] ServiceWorker registration failed:', error);
            });
    });
}
