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

        // Initialize Weather controller
        if (window.WeatherController) {
            WeatherController.init();
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
        console.log('[App] Cache result:', cacheResult);
        if (cacheResult.loaded) {
            console.log('[App] Data loaded from cache, initializing v3 query engine...');
            // Initialize v3 query engine from IndexedDB
            if (window.App?.loadFromCache) {
                console.log('[App] Calling App.loadFromCache()...');
                await window.App.loadFromCache();
            } else {
                console.warn('[App] window.App.loadFromCache not available!');
            }
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
            // Automatically restore saved flight plan
            console.log('[App] Restoring saved flight plan:', savedNavlog.routeString);
            UIController.restoreNavlog(savedNavlog);

            // Restore currentNavlogData so export works
            currentNavlogData = savedNavlog;

            // Restore FlightState
            if (window.FlightState) {
                window.FlightState.restoreFlightPlan(savedNavlog);
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
        prevNavWptBtn.addEventListener('click', () => window.VectorMap.navigateToPrevWaypoint());
    }
    if (nextNavWptBtn) {
        nextNavWptBtn.addEventListener('click', () => window.VectorMap.navigateToNextWaypoint());
    }

    // Map control group toggling (VIEW / WX / AIRWAY)
    const viewControlBtn = document.getElementById('viewControlBtn');
    const wxControlBtn = document.getElementById('wxControlBtn');
    const airwayControlBtn = document.getElementById('airwayControlBtn');
    const viewControls = document.getElementById('viewControls');
    const wxControls = document.getElementById('wxControls');
    const airwayControls = document.getElementById('airwayControls');

    function switchControlGroup(activeBtn, activeGroup) {
        // Update primary button states
        document.querySelectorAll('.map-controls-primary .map-control-btn[data-control]').forEach(btn => {
            btn.classList.remove('active');
        });
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Update control group visibility
        document.querySelectorAll('.control-group').forEach(group => {
            group.classList.remove('active');
            group.style.display = 'none';
        });
        if (activeGroup) {
            activeGroup.classList.add('active');
            activeGroup.style.display = 'flex';
        }
    }

    if (viewControlBtn) {
        viewControlBtn.addEventListener('click', () => {
            switchControlGroup(viewControlBtn, viewControls);
        });
    }

    if (wxControlBtn) {
        wxControlBtn.addEventListener('click', () => {
            switchControlGroup(wxControlBtn, wxControls);
        });
    }

    if (airwayControlBtn) {
        airwayControlBtn.addEventListener('click', () => {
            switchControlGroup(airwayControlBtn, airwayControls);
        });
    }

    // Zoom controls
    const zoomBtns = document.querySelectorAll('.zoom-btn[data-zoom]');
    zoomBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const zoomMode = btn.getAttribute('data-zoom');
            window.VectorMap.setZoomMode(zoomMode);

            // Update active state
            zoomBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Zoom in/out buttons
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => window.VectorMap.zoomIn());
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => window.VectorMap.zoomOut());
    }

    // Airway filter buttons (LOW / HIGH / ALL / NONE)
    const airwayBtns = {
        low: document.getElementById('airwayLowBtn'),
        high: document.getElementById('airwayHighBtn'),
        all: document.getElementById('airwayAllBtn'),
        none: document.getElementById('airwayNoneBtn')
    };

    function setAirwayFilter(filter) {
        // Update VectorMap filter
        window.VectorMap.setAirwayFilter(filter);

        // Update button states
        Object.values(airwayBtns).forEach(btn => btn && btn.classList.remove('active'));
        if (airwayBtns[filter]) {
            airwayBtns[filter].classList.add('active');
        }
    }

    if (airwayBtns.low) {
        airwayBtns.low.addEventListener('click', () => setAirwayFilter('low'));
    }
    if (airwayBtns.high) {
        airwayBtns.high.addEventListener('click', () => setAirwayFilter('high'));
    }
    if (airwayBtns.all) {
        airwayBtns.all.addEventListener('click', () => setAirwayFilter('all'));
    }
    if (airwayBtns.none) {
        airwayBtns.none.addEventListener('click', () => setAirwayFilter('none'));
    }

    // Weather overlay toggle buttons
    const pirepBtn = document.getElementById('pirepBtn');
    const sigmetBtn = document.getElementById('sigmetBtn');
    const gairmetBtn = document.getElementById('gairmetBtn');

    if (pirepBtn) {
        pirepBtn.addEventListener('click', () => {
            const currentState = window.VectorMap.isWeatherEnabled('pireps');
            window.VectorMap.toggleWeatherOverlays('pireps', !currentState);

            // Update button appearance
            if (!currentState) {
                pirepBtn.classList.add('active');
            } else {
                pirepBtn.classList.remove('active');
            }
        });
    }

    if (sigmetBtn) {
        sigmetBtn.addEventListener('click', () => {
            const currentState = window.VectorMap.isWeatherEnabled('sigmets');
            window.VectorMap.toggleWeatherOverlays('sigmets', !currentState);

            // Update button appearance
            if (!currentState) {
                sigmetBtn.classList.add('active');
            } else {
                sigmetBtn.classList.remove('active');
            }
        });
    }

// G-AIRMET hazard type buttons
    const gairmetIceBtn = document.getElementById('gairmetIceBtn');
    const gairmetTurbBtn = document.getElementById('gairmetTurbBtn');
    const gairmetIfrBtn = document.getElementById('gairmetIfrBtn');
    const gairmetMtnBtn = document.getElementById('gairmetMtnBtn');
    const gairmetFzlvlBtn = document.getElementById('gairmetFzlvlBtn');
    const gairmetControls = document.getElementById('gairmetControls');

    function setupGairmetButton(btn, type) {
        if (!btn) return;
        btn.addEventListener('click', () => {
            const currentState = window.VectorMap.isWeatherEnabled(`gairmet-${type}`);
            window.VectorMap.toggleWeatherOverlays(`gairmet-${type}`, !currentState);

            // Update button appearance
            if (!currentState) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    setupGairmetButton(gairmetIceBtn, 'ice');
    setupGairmetButton(gairmetTurbBtn, 'turb');
    setupGairmetButton(gairmetIfrBtn, 'ifr');
    setupGairmetButton(gairmetMtnBtn, 'mtn');
    setupGairmetButton(gairmetFzlvlBtn, 'fzlvl');

    // WX All/None buttons
    const wxAllBtn = document.getElementById('wxAllBtn');
    const wxNoneBtn = document.getElementById('wxNoneBtn');

    if (wxAllBtn) {
        wxAllBtn.addEventListener('click', () => {
            // Enable all weather overlays
            const weatherTypes = ['pireps', 'sigmets', 'gairmet-ice', 'gairmet-turb', 'gairmet-ifr', 'gairmet-mtn', 'gairmet-fzlvl'];
            weatherTypes.forEach(type => {
                window.VectorMap.toggleWeatherOverlays(type, true);
            });

            // Update button states
            [pirepBtn, sigmetBtn, gairmetIceBtn, gairmetTurbBtn, gairmetIfrBtn, gairmetMtnBtn, gairmetFzlvlBtn].forEach(btn => {
                if (btn) btn.classList.add('active');
            });
        });
    }

    if (wxNoneBtn) {
        wxNoneBtn.addEventListener('click', () => {
            // Disable all weather overlays
            const weatherTypes = ['pireps', 'sigmets', 'gairmet-ice', 'gairmet-turb', 'gairmet-ifr', 'gairmet-mtn', 'gairmet-fzlvl'];
            weatherTypes.forEach(type => {
                window.VectorMap.toggleWeatherOverlays(type, false);
            });

            // Update button states
            [pirepBtn, sigmetBtn, gairmetIceBtn, gairmetTurbBtn, gairmetIfrBtn, gairmetMtnBtn, gairmetFzlvlBtn].forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
        });
    }

    // MORA grid toggle button
    const terrainBtn = document.getElementById('terrainBtn');

    if (terrainBtn) {
        terrainBtn.addEventListener('click', () => {
            window.VectorMap.toggleTerrainProfile();
        });
    }

    // Procedure overlay toggle button
    const procBtn = document.getElementById('procBtn');

    if (procBtn) {
        procBtn.addEventListener('click', () => {
            window.VectorMap.toggleProcedures();
        });
    }

    // Navlog export/import dropdowns
    setupExportDropdown();
    setupImportDropdown();
    setupClipboardButtons();

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

    // Departure time selection
    const departureTimeSelect = document.getElementById('departureTimeSelect');
    const departureTimeCustom = document.getElementById('departureTimeCustom');

    if (departureTimeSelect) {
        departureTimeSelect.addEventListener('change', () => {
            UIController.handleDepartureTimeChange();
        });
    }

    if (departureTimeCustom) {
        departureTimeCustom.addEventListener('change', () => {
            UIController.updateDepartureTimeDisplay();
        });
    }

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

        const loadResult = await DataManager.loadData((message, type) => {
            console.log(`[DataManager] ${message}`);

            // Update progress text - show what's being done
            if (progressText) {
                const cleanMessage = message.replace(/^\[...\]\s*/, '').replace(/^\[OK\]\s*/, '').replace(/^\[!\]\s*/, '');
                progressText.textContent = cleanMessage;
            }
        });

        // Complete
        if (progressText) progressText.textContent = 'Database loaded successfully!';

        // Initialize v3 query engine from IndexedDB
        if (window.App?.loadFromCache) {
            console.log('[App] Initializing v3 query engine from loaded data...');
            await window.App.loadFromCache();
        }

        UIController.showDataInfo();
        UIController.enableRouteInput();

        // Show any data warnings (e.g., expired NASR data)
        if (loadResult.warnings && loadResult.warnings.length > 0) {
            for (const warning of loadResult.warnings) {
                UIController.showDataWarning(warning.title, warning.message);
                console.warn(`[App] Data warning: ${warning.title} - ${warning.message}`);
            }
        }

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

            // Initialize v3 query engine from IndexedDB
            if (window.App?.loadFromCache) {
                console.log('[App] Initializing v3 query engine after auto-reindex...');
                await window.App.loadFromCache();
            }

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

        // Initialize v3 query engine from IndexedDB
        if (window.App?.loadFromCache) {
            console.log('[App] Initializing v3 query engine after manual reindex...');
            await window.App.loadFromCache();
        }

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

        // Update WX and Charts tabs with route airports
        const routeAirports = waypoints.filter(w => w.waypointType === 'airport').map(w => ({ icao: w.icao || w.ident }));
        if (window.WeatherController?.updateRouteAirports) {
            window.WeatherController.updateRouteAirports(routeAirports);
        }
        if (window.ChartsController?.updateRouteAirports) {
            window.ChartsController.updateRouteAirports(routeAirports);
        }

        // Update WX tab with all waypoints and legs for hazard analysis
        // Use user-selected departure time for time-based weather filtering
        const departureTime = UIController.getDepartureTime();
        if (window.WeatherController?.updateRouteWaypoints) {
            window.WeatherController.updateRouteWaypoints(waypoints);
        }
        if (window.WeatherController?.updateRouteLegs) {
            window.WeatherController.updateRouteLegs(legs, departureTime);
        }

        // Display vector map
        window.VectorMap.displayMap(waypoints, legs, options);

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
            windData: windData,
            windMetadata: windMetadata
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

    // Clear route airports from WX and Charts tabs
    if (window.WeatherController?.updateRouteAirports) {
        window.WeatherController.updateRouteAirports([]);
    }
    if (window.ChartsController?.updateRouteAirports) {
        window.ChartsController.updateRouteAirports([]);
    }

    // Clear route waypoints and legs for hazard analysis
    if (window.WeatherController?.updateRouteWaypoints) {
        window.WeatherController.updateRouteWaypoints([]);
    }
    if (window.WeatherController?.updateRouteLegs) {
        window.WeatherController.updateRouteLegs([], null);
    }
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
    const fileInput = document.getElementById('importNavlogInput');

    if (!fileInput) return;

    // Accept both JSON and FPL files - format is auto-detected
    fileInput.accept = '.json,.fpl';

    // Handle file selection - the label element triggers the file input directly
    // This works on iOS because clicking a <label for="input"> is a direct user gesture
    fileInput.addEventListener('change', (event) => {
        handleImportFile(event);
    });
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

        case 'fpl':
            success = window.FlightState.exportToForeFlightFPL();
            if (success) {
                alert('FPL EXPORTED\n\nGarmin FlightPlan format (.fpl)\n\nImport into ForeFlight via:\n- AirDrop from Mac\n- Email attachment\n- iTunes/Finder\n- iCloud Drive');
            } else {
                alert('ERROR: FAILED TO EXPORT FPL');
            }
            break;

        default:
            alert('ERROR: UNKNOWN EXPORT FORMAT');
    }
}

/**
 * Convert decimal degrees to FAA coordinate format (DDMM/DDDMM with hemisphere)
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lon - Longitude in decimal degrees
 * @returns {string} FAA format coordinate (e.g., "4814N/06848W")
 */
function decimalToFaaCoord(lat, lon) {
    // Latitude: DDMM format
    const latHemi = lat >= 0 ? 'N' : 'S';
    const latAbs = Math.abs(lat);
    const latDeg = Math.floor(latAbs);
    const latMin = Math.round((latAbs - latDeg) * 60);
    // Handle edge case where minutes round to 60
    const latDegFinal = latMin === 60 ? latDeg + 1 : latDeg;
    const latMinFinal = latMin === 60 ? 0 : latMin;
    const latStr = String(latDegFinal).padStart(2, '0') + String(latMinFinal).padStart(2, '0');

    // Longitude: DDDMM format
    const lonHemi = lon >= 0 ? 'E' : 'W';
    const lonAbs = Math.abs(lon);
    const lonDeg = Math.floor(lonAbs);
    const lonMin = Math.round((lonAbs - lonDeg) * 60);
    // Handle edge case where minutes round to 60
    const lonDegFinal = lonMin === 60 ? lonDeg + 1 : lonDeg;
    const lonMinFinal = lonMin === 60 ? 0 : lonMin;
    const lonStr = String(lonDegFinal).padStart(3, '0') + String(lonMinFinal).padStart(2, '0');

    return `${latStr}${latHemi}/${lonStr}${lonHemi}`;
}

/**
 * Calculate distance between two coordinates in nautical miles
 * Uses simple spherical approximation for small distances
 * @param {number} lat1 - Latitude 1 in decimal degrees
 * @param {number} lon1 - Longitude 1 in decimal degrees
 * @param {number} lat2 - Latitude 2 in decimal degrees
 * @param {number} lon2 - Longitude 2 in decimal degrees
 * @returns {number} Distance in nautical miles
 */
function simpleDistanceNm(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Look up a waypoint in the database and return it if found
 * @param {string} ident - Waypoint identifier
 * @returns {object|null} Waypoint object or null if not found
 */
function lookupWaypointInDatabase(ident) {
    // Check airports
    if (window.DataManager?.getAirport) {
        const airport = window.DataManager.getAirport(ident);
        if (airport) return airport;
    }

    // Check navaids directly via DataManager
    if (window.DataManager?.getNavaid) {
        const navaid = window.DataManager.getNavaid(ident);
        if (navaid) return navaid;
    }

    // Check fixes directly via DataManager
    if (window.DataManager?.getFix) {
        const fix = window.DataManager.getFix(ident);
        if (fix) return fix;
    }

    // Check navaids and fixes via QueryEngine (fallback)
    if (window.QueryEngine?.getWaypointByIdent) {
        const waypoint = window.QueryEngine.getWaypointByIdent(ident);
        if (waypoint) return waypoint;
    }

    // Check via App's queryEngine (v3 architecture)
    if (window.App?.queryEngine?.getWaypoint) {
        const waypoint = window.App.queryEngine.getWaypoint(ident);
        if (waypoint) return waypoint;
    }

    return null;
}

/**
 * Validate imported waypoints against database
 * Returns unknown waypoints and coordinate mismatches
 * @param {Array} waypoints - Array of waypoint objects with ident, lat, lon
 * @returns {object} { unknown: [...], mismatches: [...] }
 *   - unknown: Array of {ident, lat, lon} for waypoints not in database
 *   - mismatches: Array of {ident, fplLat, fplLon, dbLat, dbLon, distanceNm} for coordinate disagreements
 */
function validateImportedWaypoints(waypoints) {
    const unknown = [];
    const mismatches = [];
    const MISMATCH_THRESHOLD_NM = 1.0; // Warn if coordinates differ by more than 1 nm

    if (!waypoints || !Array.isArray(waypoints)) {
        return { unknown: [], mismatches: [] };
    }

    for (const wp of waypoints) {
        const ident = wp.ident || wp.icao || '';
        if (!ident) continue;

        // Skip coordinate waypoints (already in lat/lon format)
        if (wp.waypointType === 'coordinate' || wp.type === 'COORDINATE') {
            continue;
        }

        const dbWaypoint = lookupWaypointInDatabase(ident);

        if (!dbWaypoint) {
            // Waypoint not in database - store with coordinates for substitution
            if (wp.lat !== undefined && wp.lon !== undefined) {
                unknown.push({
                    ident,
                    lat: wp.lat,
                    lon: wp.lon
                });
            } else {
                unknown.push({ ident, lat: null, lon: null });
            }
        } else {
            // Waypoint found in database - check coordinate agreement
            if (wp.lat !== undefined && wp.lon !== undefined &&
                dbWaypoint.lat !== undefined && dbWaypoint.lon !== undefined) {
                const distanceNm = simpleDistanceNm(wp.lat, wp.lon, dbWaypoint.lat, dbWaypoint.lon);
                if (distanceNm > MISMATCH_THRESHOLD_NM) {
                    mismatches.push({
                        ident,
                        fplLat: wp.lat,
                        fplLon: wp.lon,
                        dbLat: dbWaypoint.lat,
                        dbLon: dbWaypoint.lon,
                        distanceNm: distanceNm.toFixed(1)
                    });
                }
            }
        }
    }

    if (unknown.length > 0) {
        console.warn('[App] Unknown waypoints in import:', unknown.map(u => u.ident));
    }
    if (mismatches.length > 0) {
        console.warn('[App] Coordinate mismatches in import:', mismatches);
    }

    return { unknown, mismatches };
}

/**
 * Substitute unknown waypoint identifiers with their FPL coordinates in the route string
 * @param {string} routeString - Original route string
 * @param {Array} unknownWaypoints - Array of {ident, lat, lon} from validateImportedWaypoints
 * @returns {string} Modified route string with coordinates substituted
 */
function substituteUnknownWaypointsWithCoords(routeString, unknownWaypoints) {
    if (!unknownWaypoints || unknownWaypoints.length === 0) {
        return routeString;
    }

    let modifiedRoute = routeString;

    for (const wp of unknownWaypoints) {
        if (wp.lat !== null && wp.lon !== null) {
            const coordStr = decimalToFaaCoord(wp.lat, wp.lon);
            // Replace the identifier with the coordinate (case-insensitive, whole word)
            const regex = new RegExp(`\\b${wp.ident}\\b`, 'gi');
            modifiedRoute = modifiedRoute.replace(regex, coordStr);
            console.log(`[App] Substituted ${wp.ident} with ${coordStr}`);
        }
    }

    return modifiedRoute;
}

async function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileInput = event.target;

    try {
        if (!window.FlightState) {
            throw new Error('FlightState not available');
        }

        // Read file content to auto-detect format
        const content = await file.text();
        const trimmed = content.trim();

        // Auto-detect format: XML (FPL) starts with < or <?xml, JSON starts with {
        const isXml = trimmed.startsWith('<?xml') || trimmed.startsWith('<');
        const isJson = trimmed.startsWith('{');

        let format;
        if (isXml) {
            format = 'fpl';
        } else if (isJson) {
            format = 'json';
        } else {
            // Fallback to extension
            format = file.name.toLowerCase().endsWith('.fpl') ? 'fpl' : 'json';
        }

        let navlogData;

        if (format === 'fpl') {
            // Import Garmin FPL (XML) file
            navlogData = window.FlightState.parseFplXml(content);
            console.log('[App] Garmin FPL imported:', navlogData.routeString);
        } else {
            // Import IN-FLIGHT JSON file
            navlogData = JSON.parse(content);

            // Validate structure
            if (!navlogData.routeString || !navlogData.waypoints || !navlogData.legs) {
                throw new Error('Invalid navlog file structure');
            }

            console.log('[App] JSON navlog imported:', navlogData.routeString);
        }

        // Validate waypoints against database
        const validationResult = validateImportedWaypoints(navlogData.waypoints);
        const { unknown: unknownWaypoints, mismatches } = validationResult;

        // For FPL imports, DON'T substitute waypoint identifiers with coordinates
        // The waypoints already have their lat/lon from the FPL file
        // We keep their identifiers for display (e.g., "PLADO" instead of "5207N/17044E")
        // This only applies to named waypoints - coordinate waypoints already display as coordinates

        // Build import message
        let message = format === 'fpl'
            ? `FPL IMPORTED\n\nRoute: ${navlogData.routeString}\nAltitude: ${navlogData.altitude} ft`
            : `NAVLOG IMPORTED\n\nRoute: ${navlogData.routeString}`;

        if (unknownWaypoints.length > 0) {
            const unknownWithCoords = unknownWaypoints.filter(w => w.lat !== null);
            const unknownNoCoords = unknownWaypoints.filter(w => w.lat === null);

            if (unknownWithCoords.length > 0) {
                message += `\n\nNOTE: ${unknownWithCoords.length} waypoint(s) not in database - using FPL coordinates:\n${unknownWithCoords.map(w => `${w.ident} (${decimalToFaaCoord(w.lat, w.lon)})`).join(', ')}`;
            }
            if (unknownNoCoords.length > 0) {
                message += `\n\nWARNING: ${unknownNoCoords.length} waypoint(s) not in database (no coordinates):\n${unknownNoCoords.map(w => w.ident).join(', ')}`;
            }
        }

        if (mismatches.length > 0) {
            message += `\n\nNOTE: ${mismatches.length} waypoint(s) have different coordinates in FPL vs database - using FPL coordinates:\n`;
            message += mismatches.map(m => `${m.ident} (${decimalToFaaCoord(m.fplLat, m.fplLon)}, database: ${m.distanceNm} nm away)`).join(', ');
        }

        // Check if TAS and altitude are set for auto-recalculation
        const elements = UIController.getElements();
        const tasValue = parseFloat(elements.tasInput.value);
        const altitudeValue = parseFloat(elements.altitudeInput.value);
        const canAutoRecalc = !isNaN(tasValue) && tasValue > 0 && !isNaN(altitudeValue) && altitudeValue >= 0;

        // For FPL imports, tell user what will happen
        if (format === 'fpl') {
            if (canAutoRecalc) {
                message += '\n\nRoute will be recalculated automatically.';
            } else {
                message += '\n\nNote: Set TAS and altitude in ROUTE tab, then click CALCULATE.';
            }
        }

        alert(message);

        // Restore the navlog (populates route input fields)
        UIController.restoreNavlog(navlogData);

        // Store as current
        currentNavlogData = navlogData;

        // Update flight plan and save for crash recovery
        window.FlightState.updateFlightPlan(navlogData);
        window.FlightState.saveToStorage();

        // For FPL imports, auto-recalculate to compute distances/times if possible
        if (format === 'fpl' && canAutoRecalc) {
            console.log('[App] Auto-recalculating FPL import...');
            try {
                await handleCalculateRoute();
            } catch (calcError) {
                console.warn('[App] Auto-recalculation failed:', calcError.message);
                // Route is still imported, user can manually recalculate
            }
        }

    } catch (error) {
        console.error('Import error:', error);
        alert(`ERROR: FAILED TO IMPORT\n\n${error.message}`);
    } finally {
        // Clear file input
        fileInput.value = '';
    }
}

// ============================================
// CLIPBOARD OPERATIONS
// ============================================

function setupClipboardButtons() {
    const copyBtn = document.getElementById('copyNavlogBtn');
    const pasteBtn = document.getElementById('pasteNavlogBtn');

    if (copyBtn) {
        copyBtn.addEventListener('click', handleCopyToClipboard);
    }

    if (pasteBtn) {
        pasteBtn.addEventListener('click', handlePasteFromClipboard);
    }
}

async function handleCopyToClipboard() {
    if (!currentNavlogData) {
        alert('ERROR: NO NAVLOG TO COPY\n\nCalculate a route first.');
        return;
    }

    if (!window.FlightState) {
        alert('ERROR: FLIGHTSTATE NOT AVAILABLE');
        return;
    }

    // Ensure FlightState has current data
    window.FlightState.updateFlightPlan(currentNavlogData);

    try {
        const success = await window.FlightState.copyToClipboard();
        if (success) {
            alert('COPIED TO CLIPBOARD\n\nFlight plan copied as JSON.\nPaste into another IN-FLIGHT session or save to a file.');
        } else {
            alert('ERROR: FAILED TO COPY\n\nClipboard access may be blocked.');
        }
    } catch (error) {
        console.error('Copy error:', error);
        alert(`ERROR: FAILED TO COPY\n\n${error.message}`);
    }
}

async function handlePasteFromClipboard() {
    if (!window.FlightState) {
        alert('ERROR: FLIGHTSTATE NOT AVAILABLE');
        return;
    }

    try {
        const navlogData = await window.FlightState.pasteFromClipboard();

        // Restore the navlog
        UIController.restoreNavlog(navlogData);

        // Store as current
        currentNavlogData = navlogData;

        // Update flight plan and save for crash recovery
        window.FlightState.updateFlightPlan(navlogData);
        window.FlightState.saveToStorage();

        alert(`PASTED FROM CLIPBOARD\n\nRoute: ${navlogData.routeString}`);
    } catch (error) {
        console.error('Paste error:', error);
        alert(`ERROR: FAILED TO PASTE\n\n${error.message}`);
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

/**
 * Opens a modal to view the changelog
 * Feature added in v3.0.0
 */
window.viewChangelog = async function() {
    console.log('[App] viewChangelog called');

    // Check if modal already exists
    let modal = document.getElementById('changelog-modal');
    if (modal) {
        modal.style.display = 'flex';
        return;
    }

    // Create modal structure
    modal = document.createElement('div');
    modal.id = 'changelog-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>CHANGELOG</h2>
                <button class="modal-close" onclick="closeChangelog()">&times;</button>
            </div>
            <div class="modal-body" id="changelog-content">
                <p style="color: var(--text-secondary);">Loading changelog...</p>
            </div>
        </div>
    `;

    // Close on overlay click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeChangelog();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeChangelog();
        }
    });

    document.body.appendChild(modal);

    // Fetch and render changelog
    try {
        const response = await fetch('./CHANGELOG.md');
        if (!response.ok) {
            throw new Error('Failed to fetch changelog');
        }
        const markdown = await response.text();
        const contentEl = document.getElementById('changelog-content');
        if (contentEl) {
            contentEl.innerHTML = renderMarkdown(markdown);
        }
    } catch (error) {
        console.error('[App] Failed to load changelog:', error);
        const contentEl = document.getElementById('changelog-content');
        if (contentEl) {
            contentEl.innerHTML = '<p style="color: var(--color-error);">Failed to load changelog. Please try again later.</p>';
        }
    }
};

/**
 * Closes the changelog modal
 */
window.closeChangelog = function() {
    const modal = document.getElementById('changelog-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

/**
 * Simple markdown to HTML renderer for changelog
 * @param {string} markdown - Markdown text
 * @returns {string} HTML string
 */
function renderMarkdown(markdown) {
    const lines = markdown.split('\n');
    let html = '';
    let inList = false;
    let inTable = false;
    let isTableHeader = true;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Skip empty lines but close lists/tables
        if (!line.trim()) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (inTable) {
                html += '</tbody></table>';
                inTable = false;
                isTableHeader = true;
            }
            continue;
        }

        // Escape HTML in content
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Inline formatting
        const fmt = (s) => s
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // Headers
        if (line.startsWith('# ')) {
            html += `<h2 class="changelog-h1">${fmt(esc(line.slice(2)))}</h2>`;
        } else if (line.match(/^## \[(.+?)\] - (.+)$/)) {
            const match = line.match(/^## \[(.+?)\] - (.+)$/);
            html += `<h3 class="changelog-version">v${esc(match[1])} <span class="changelog-date">${esc(match[2])}</span></h3>`;
        } else if (line.startsWith('## ')) {
            html += `<h3 class="changelog-h2">${fmt(esc(line.slice(3)))}</h3>`;
        } else if (line.startsWith('### ')) {
            html += `<h4 class="changelog-h3">${fmt(esc(line.slice(4)))}</h4>`;
        } else if (line.startsWith('#### ')) {
            html += `<h5 class="changelog-h4">${fmt(esc(line.slice(5)))}</h5>`;
        }
        // List items
        else if (line.match(/^[-*] /)) {
            if (!inList) {
                html += '<ul class="changelog-list">';
                inList = true;
            }
            html += `<li>${fmt(esc(line.slice(2)))}</li>`;
        }
        // Indented list items (4 spaces or 2 spaces)
        else if (line.match(/^(\s{2,4})[-*] /)) {
            const content = line.replace(/^\s+[-*] /, '');
            if (!inList) {
                html += '<ul class="changelog-list">';
                inList = true;
            }
            html += `<li class="changelog-indent">${fmt(esc(content))}</li>`;
        }
        // Table separator - skip
        else if (line.match(/^\|[-:\s|]+\|$/)) {
            continue;
        }
        // Table rows
        else if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.slice(1, -1).split('|').map(c => c.trim());
            if (!inTable) {
                html += '<table class="changelog-table"><tbody>';
                inTable = true;
                isTableHeader = true;
            }
            const tag = isTableHeader ? 'th' : 'td';
            html += '<tr>' + cells.map(c => `<${tag}>${fmt(esc(c))}</${tag}>`).join('') + '</tr>';
            isTableHeader = false;
        }
        // Regular paragraph
        else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += `<p class="changelog-p">${fmt(esc(line))}</p>`;
        }
    }

    // Close any open tags
    if (inList) html += '</ul>';
    if (inTable) html += '</tbody></table>';

    return html;
}
