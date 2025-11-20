// UI Controller Module - Handles all UI updates and interactions

// DOM elements (initialized in init())
let elements = {};

// Autocomplete state
let selectedAutocompleteIndex = -1;
let autocompleteResults = [];

// Airport autocomplete state (for departure/destination)
let selectedDepartureIndex = -1;
let departureResults = [];
let selectedDestinationIndex = -1;
let destinationResults = [];
let isProcessingAirportSelection = false;

// ============================================
// INITIALIZATION
// ============================================

function init() {
    elements = {
        // Status elements
        statusText: document.getElementById('statusText'),
        statusBox: document.getElementById('dataStatus'),
        dataInfo: document.getElementById('dataInfo'),
        loadDataBtn: document.getElementById('loadDataBtn'),
        reindexCacheBtn: document.getElementById('reindexCacheBtn'),
        clearDataBtn: document.getElementById('clearDataBtn'),
        dataInspection: document.getElementById('dataInspection'),
        inspectionContent: document.getElementById('inspectionContent'),

        // Input elements (ICAO-style: departure/route/destination)
        departureInput: document.getElementById('departureInput'),
        routeInput: document.getElementById('routeInput'),
        destinationInput: document.getElementById('destinationInput'),
        calculateBtn: document.getElementById('calculateBtn'),
        clearRouteBtn: document.getElementById('clearRouteBtn'),

        // Optional feature elements
        enableWindsToggle: document.getElementById('enableWindsToggle'),
        windInputs: document.getElementById('windInputs'),
        altitudeInput: document.getElementById('altitudeInput'),
        tasInput: document.getElementById('tasInput'),
        forecastBtns: document.querySelectorAll('.radio-btn[data-period]'),

        enableFuelToggle: document.getElementById('enableFuelToggle'),
        fuelInputs: document.getElementById('fuelInputs'),
        usableFuelInput: document.getElementById('usableFuelInput'),
        taxiFuelInput: document.getElementById('taxiFuelInput'),
        burnRateInput: document.getElementById('burnRateInput'),
        fuelReserveBtns: document.querySelectorAll('.radio-btn[data-reserve]'),

        enableWakeLockToggle: document.getElementById('enableWakeLockToggle'),

        // Results elements
        resultsSection: document.getElementById('resultsSection'),
        routeSummary: document.getElementById('routeSummary'),
        windAltitudeTable: document.getElementById('windAltitudeTable'),
        navlogTable: document.getElementById('navlogTable'),

        // Autocomplete elements
        autocompleteDropdown: document.getElementById('autocompleteDropdown'),
        departureAutocompleteDropdown: document.getElementById('departureAutocompleteDropdown'),
        destinationAutocompleteDropdown: document.getElementById('destinationAutocompleteDropdown'),

        // History elements
        queryHistoryDiv: document.getElementById('queryHistory'),
        historyList: document.getElementById('historyList')
    };
}

// ============================================
// SYSTEM CHECKS
// ============================================

function checkInternetConnection() {
    const statusEl = document.getElementById('internetStatus');
    if (!statusEl) return;

    // Check if online
    if (!navigator.onLine) {
        statusEl.textContent = 'OFFLINE';
        statusEl.style.color = 'var(--color-error)';
        return;
    }

    // Try to fetch a small resource to verify connectivity
    fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        cache: 'no-cache'
    })
    .then(() => {
        statusEl.textContent = 'ONLINE';
        statusEl.style.color = 'var(--color-metric)';
    })
    .catch(() => {
        statusEl.textContent = 'NO ACCESS';
        statusEl.style.color = 'var(--color-error)';
    });
}

function checkGPSAvailability() {
    const statusEl = document.getElementById('gpsStatus');
    const horizEl = document.getElementById('gpsHorizStatus');
    const vertEl = document.getElementById('gpsVertStatus');

    if (!statusEl) return;

    if (!navigator.geolocation) {
        statusEl.textContent = 'NOT AVAILABLE';
        statusEl.style.color = 'var(--color-error)';
        if (horizEl) {
            horizEl.textContent = '--';
            horizEl.style.color = 'var(--text-secondary)';
        }
        if (vertEl) {
            vertEl.textContent = '--';
            vertEl.style.color = 'var(--text-secondary)';
        }
        return;
    }

    // Try to get GPS position
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // Horizontal accuracy in feet (convert from meters)
            const horizAccuracyFt = Math.round(position.coords.accuracy * 3.28084);
            // Vertical accuracy in feet (if available)
            const vertAccuracyFt = position.coords.altitudeAccuracy
                ? Math.round(position.coords.altitudeAccuracy * 3.28084)
                : null;

            // Update horizontal accuracy
            if (horizEl) {
                if (horizAccuracyFt < 65) { // <20m
                    horizEl.textContent = `±${horizAccuracyFt}FT`;
                    horizEl.style.color = 'var(--color-metric)';
                } else if (horizAccuracyFt < 165) { // <50m
                    horizEl.textContent = `±${horizAccuracyFt}FT`;
                    horizEl.style.color = 'var(--color-metric)';
                } else if (horizAccuracyFt < 330) { // <100m
                    horizEl.textContent = `±${horizAccuracyFt}FT`;
                    horizEl.style.color = 'var(--color-warning)';
                } else {
                    horizEl.textContent = `±${horizAccuracyFt}FT`;
                    horizEl.style.color = 'var(--color-warning)';
                }
            }

            // Update vertical accuracy
            if (vertEl) {
                if (vertAccuracyFt !== null) {
                    if (vertAccuracyFt < 100) {
                        vertEl.textContent = `±${vertAccuracyFt}FT`;
                        vertEl.style.color = 'var(--color-metric)';
                    } else if (vertAccuracyFt < 200) {
                        vertEl.textContent = `±${vertAccuracyFt}FT`;
                        vertEl.style.color = 'var(--color-warning)';
                    } else {
                        vertEl.textContent = `±${vertAccuracyFt}FT`;
                        vertEl.style.color = 'var(--color-warning)';
                    }
                } else {
                    vertEl.textContent = 'N/A';
                    vertEl.style.color = 'var(--text-secondary)';
                }
            }

            // Update status
            statusEl.textContent = 'ACTIVE';
            statusEl.style.color = 'var(--color-metric)';
        },
        (error) => {
            if (horizEl) {
                horizEl.textContent = '--';
                horizEl.style.color = 'var(--text-secondary)';
            }
            if (vertEl) {
                vertEl.textContent = '--';
                vertEl.style.color = 'var(--text-secondary)';
            }

            if (error.code === error.PERMISSION_DENIED) {
                statusEl.textContent = 'DENIED';
                statusEl.style.color = 'var(--color-error)';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                statusEl.textContent = 'NO SIGNAL';
                statusEl.style.color = 'var(--color-error)';
            } else if (error.code === error.TIMEOUT) {
                statusEl.textContent = 'NO FIX';
                statusEl.style.color = 'var(--color-error)';
            } else {
                statusEl.textContent = 'ERROR';
                statusEl.style.color = 'var(--color-error)';
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function updateDatabaseStatus(status, message) {
    const statusEl = document.getElementById('databaseStatus');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `check-status status-${status}`;
}

function initSystemChecks() {
    checkInternetConnection();
    checkGPSAvailability();

    // Recheck internet connection every 60 seconds (less aggressive)
    setInterval(checkInternetConnection, 60000);

    // Also check when online/offline events fire
    window.addEventListener('online', () => {
        checkInternetConnection();
        console.log('[SystemCheck] Network connection restored');
    });

    window.addEventListener('offline', () => {
        const statusEl = document.getElementById('internetStatus');
        if (statusEl) {
            statusEl.textContent = 'OFFLINE';
            statusEl.style.color = 'var(--color-error)';
        }
        console.log('[SystemCheck] Network connection lost');
    });
}

// ============================================
// STATUS & DATA INFO
// ============================================

function updateStatus(message, type) {
    if (elements.statusText) {
        elements.statusText.textContent = message;
    }
    if (elements.statusBox) {
        elements.statusBox.className = 'status-box status-' + type;
    }

    // Also update Data tab status
    const statusTextData = document.getElementById('statusTextData');
    const dataStatusData = document.getElementById('dataStatusData');
    if (statusTextData) statusTextData.textContent = message;
    if (dataStatusData) dataStatusData.className = 'status-box status-' + type;

    if (type === 'success') {
        elements.loadDataBtn.style.display = 'none';
        const loadDataBtnData = document.getElementById('loadDataBtnData');
        if (loadDataBtnData) loadDataBtnData.style.display = 'none';
    }
}

function showDataInfo() {
    const stats = DataManager.getDataStats();
    const totalAirports = stats.airports;
    const totalNavaids = stats.navaids;
    const totalFixes = stats.fixes || 0;

    let timestampText = '';
    if (stats.timestamp) {
        const date = new Date(stats.timestamp);
        const daysAgo = Math.floor((Date.now() - stats.timestamp) / (24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0];
        timestampText = `<p style="margin-top: 0.5rem;"><strong>LAST UPDATE:</strong> ${dateStr} ${timeStr} UTC (${daysAgo}D AGO)</p>`;
    }

    const infoHTML = `
        <p><strong>AIRPORTS:</strong> ${totalAirports.toLocaleString()} | <strong>NAVAIDS:</strong> ${totalNavaids.toLocaleString()} | <strong>FIXES:</strong> ${totalFixes.toLocaleString()}</p>
        ${timestampText}
    `;

    elements.dataInfo.innerHTML = infoHTML;
    elements.dataInfo.style.display = 'block';

    // Update database status check
    updateDatabaseStatus('ok', 'LOADED');

    // Show management buttons
    elements.loadDataBtn.style.display = 'none';
    elements.reindexCacheBtn.style.display = 'inline-block';
    elements.clearDataBtn.style.display = 'inline-block';

    // Show and populate inspection details
    elements.dataInspection.style.display = 'block';
    populateInspection();
}

function populateInspection() {
    const stats = DataManager.getDataStats();
    const fileStatus = DataManager.getFileStatus();

    // Format cache timestamp
    let timestampFormatted = 'N/A';
    let cacheAge = 'N/A';
    let cacheColor = 'text-secondary';

    if (stats.timestamp) {
        const date = new Date(stats.timestamp);
        timestampFormatted = date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

        const daysAgo = Math.floor((Date.now() - stats.timestamp) / (24 * 60 * 60 * 1000));
        cacheAge = daysAgo === 0 ? 'TODAY' : `${daysAgo}D AGO`;

        if (daysAgo > 30) {
            cacheColor = 'text-warning';
        } else if (daysAgo > 90) {
            cacheColor = 'text-error';
        } else {
            cacheColor = 'text-metric';
        }
    }

    // Build file status table
    let fileStatusHTML = '';
    const nasrFiles = fileStatus.filter(f => f.source === 'NASR');
    const oaFiles = fileStatus.filter(f => f.source === 'OurAirports');

    const buildFileTable = (files) => {
        if (files.length === 0) return '<div class="text-secondary text-xs">No files loaded</div>';

        let html = '<div style="font-size: 0.7rem; margin-top: 4px;">';
        files.forEach(file => {
            if (file.loaded) {
                const ageColor = file.expired ? 'text-warning' : 'text-metric';
                const sizeKB = (file.recordCount * 50 / 1024).toFixed(0); // Rough estimate
                html += `
                    <details style="margin-bottom: 4px;">
                        <summary style="cursor: pointer; padding: 2px 0;">
                            <span class="${ageColor}">✓</span> ${file.name}
                            <span class="text-secondary">(${file.recordCount.toLocaleString()} records)</span>
                        </summary>
                        <div style="padding-left: 16px; margin-top: 2px; font-size: 0.65rem;">
                            <div class="text-secondary">Age: ${file.daysOld}d | ~${sizeKB}KB cached</div>
                        </div>
                    </details>
                `;
            } else {
                html += `<div class="text-error" style="padding: 2px 0;">✗ ${file.name} <span class="text-secondary">(not loaded)</span></div>`;
            }
        });
        html += '</div>';
        return html;
    };

    const inspectionHTML = `
        <div class="inspection-section">
            <div class="text-secondary font-bold" style="margin-bottom: 8px;">INDEXED CACHE</div>
            <div><span class="inspection-label">Airports:</span><span class="inspection-value">${stats.airports.toLocaleString()}</span></div>
            <div><span class="inspection-label">Navaids:</span><span class="inspection-value">${stats.navaids.toLocaleString()}</span></div>
            <div><span class="inspection-label">Fixes:</span><span class="inspection-value">${(stats.fixes || 0).toLocaleString()}</span></div>
            <div><span class="inspection-label">Airways:</span><span class="inspection-value">${(stats.airways || 0).toLocaleString()}</span></div>
            <div><span class="inspection-label">STARs:</span><span class="inspection-value">${(stats.stars || 0).toLocaleString()}</span></div>
            <div><span class="inspection-label">DPs:</span><span class="inspection-value">${(stats.dps || 0).toLocaleString()}</span></div>
            <div><span class="inspection-label">Token Map:</span><span class="inspection-value">${(stats.tokenTypes || 0).toLocaleString()} entries</span></div>
        </div>

        <div class="inspection-section">
            <div class="text-secondary font-bold" style="margin-bottom: 8px;">CACHE STATUS</div>
            <div><span class="inspection-label">Last Indexed:</span><span class="text-secondary">${timestampFormatted}</span></div>
            <div><span class="inspection-label">Cache Age:</span><span class="${cacheColor}">${cacheAge}</span></div>
            <div><span class="inspection-label">Data Sources:</span><span class="text-secondary">${stats.sources || 'Unknown'}</span></div>
            <div><span class="inspection-label">Storage:</span><span class="text-secondary">IndexedDB v8</span></div>
        </div>

        <div class="inspection-section">
            <details>
                <summary style="cursor: pointer;">
                    <span class="text-secondary font-bold">NASR DATA FILES (${nasrFiles.filter(f => f.loaded).length}/${nasrFiles.length})</span>
                </summary>
                ${buildFileTable(nasrFiles)}
            </details>
        </div>

        <div class="inspection-section">
            <details>
                <summary style="cursor: pointer;">
                    <span class="text-secondary font-bold">OURAIRPORTS DATA FILES (${oaFiles.filter(f => f.loaded).length}/${oaFiles.length})</span>
                </summary>
                ${buildFileTable(oaFiles)}
            </details>
        </div>

        <div class="inspection-section">
            <div class="text-secondary font-bold" style="margin-bottom: 8px;">SYSTEM LIBRARIES</div>
            <div><span class="inspection-label">Geo Model:</span><span class="text-metric">✓ WGS84 (Vincenty)</span></div>
            <div><span class="inspection-label">Mag Model:</span><span class="text-metric">✓ WMM2025</span></div>
            <div><span class="inspection-label">Wind Stations:</span><span class="text-metric">✓ 254 stations embedded</span></div>
            <div><span class="inspection-label">Winds Aloft API:</span><span class="text-warning">Requires internet</span></div>
        </div>
    `;

    elements.inspectionContent.innerHTML = inspectionHTML;

    // Also update Data tab inspection content
    const inspectionContentData = document.getElementById('inspectionContentData');
    if (inspectionContentData) {
        inspectionContentData.innerHTML = inspectionHTML;
    }
}

// ============================================
// INPUT CONTROLS
// ============================================

function enableRouteInput() {
    elements.departureInput.disabled = false;
    elements.routeInput.disabled = false;
    elements.destinationInput.disabled = false;
    elements.calculateBtn.disabled = false;

    // Hide route placeholder and show input section
    const routePlaceholder = document.getElementById('routePlaceholder');
    const inputSection = document.querySelector('#tab-route .input-section');
    if (routePlaceholder) {
        routePlaceholder.style.display = 'none';
    }
    if (inputSection) {
        inputSection.style.display = 'block';
    }

    // Enable inputs based on feature toggles (if they're enabled)
    if (elements.isWindsEnabled && elements.isWindsEnabled()) {
        elements.altitudeInput.disabled = false;
        elements.tasInput.disabled = false;
    }

    if (elements.isFuelEnabled && elements.isFuelEnabled()) {
        elements.usableFuelInput.disabled = false;
        elements.taxiFuelInput.disabled = false;
        elements.burnRateInput.disabled = false;
    }
}

function disableRouteInput() {
    elements.routeInput.disabled = true;
    elements.altitudeInput.disabled = true;
    elements.tasInput.disabled = true;
    elements.calculateBtn.disabled = true;
}

function clearRoute() {
    elements.departureInput.value = '';
    elements.routeInput.value = '';
    elements.destinationInput.value = '';
    elements.resultsSection.style.display = 'none';
    hideAutocomplete();
}

// ============================================
// FEATURE TOGGLES
// ============================================

function setupFeatureToggles() {
    let windsEnabled = false;
    let fuelEnabled = false;

    // Wind correction & time toggle (merged) - make entire row clickable
    const windsToggleRow = elements.enableWindsToggle.parentElement;
    windsToggleRow.addEventListener('click', () => {
        windsEnabled = !windsEnabled;
        if (windsEnabled) {
            elements.enableWindsToggle.classList.add('checked');
            elements.windInputs.classList.remove('hidden');
            if (!elements.routeInput.disabled) {
                elements.altitudeInput.disabled = false;
                elements.tasInput.disabled = false;
            }
        } else {
            elements.enableWindsToggle.classList.remove('checked');
            elements.windInputs.classList.add('hidden');
            elements.altitudeInput.disabled = true;
            elements.tasInput.disabled = true;
        }
    });

    // Fuel planning toggle - make entire row clickable
    const fuelToggleRow = elements.enableFuelToggle.parentElement;
    fuelToggleRow.addEventListener('click', () => {
        fuelEnabled = !fuelEnabled;
        if (fuelEnabled) {
            elements.enableFuelToggle.classList.add('checked');
            elements.fuelInputs.classList.remove('hidden');
            if (!elements.routeInput.disabled) {
                elements.usableFuelInput.disabled = false;
                elements.taxiFuelInput.disabled = false;
                elements.burnRateInput.disabled = false;
            }
        } else {
            elements.enableFuelToggle.classList.remove('checked');
            elements.fuelInputs.classList.add('hidden');
            elements.usableFuelInput.disabled = true;
            elements.taxiFuelInput.disabled = true;
            elements.burnRateInput.disabled = true;
        }
    });

    // Wake lock toggle - make entire row clickable
    const wakeLockToggleRow = elements.enableWakeLockToggle.parentElement;
    wakeLockToggleRow.addEventListener('click', async () => {
        if (window.WakeLock && window.WakeLock.isSupported) {
            const isEnabled = await window.WakeLock.toggle();
            if (isEnabled) {
                elements.enableWakeLockToggle.classList.add('checked');
            } else {
                elements.enableWakeLockToggle.classList.remove('checked');
            }
        } else {
            console.warn('[UIController] Wake Lock API not supported');
        }
    });

    // Forecast period radio buttons
    elements.forecastBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.forecastBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // Fuel reserve radio buttons
    elements.fuelReserveBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.fuelReserveBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // Store state getters
    elements.isWindsEnabled = () => windsEnabled;
    elements.isTimeEnabled = () => windsEnabled; // Same as winds now
    elements.isFuelEnabled = () => fuelEnabled;
    elements.getSelectedForecast = () => {
        const selected = document.querySelector('.radio-btn.selected[data-period]');
        return selected ? selected.getAttribute('data-period') : '06';
    };
    elements.getSelectedReserve = () => {
        const selected = document.querySelector('.radio-btn.selected[data-reserve]');
        return selected ? parseInt(selected.getAttribute('data-reserve')) : 30;
    };
}

// ============================================
// QUERY HISTORY
// ============================================

function displayQueryHistory() {
    // Use FlightState instead of DataManager for loading history
    const history = window.FlightState ? window.FlightState.loadHistory() : [];

    if (history.length === 0) {
        elements.queryHistoryDiv.style.display = 'none';
        return;
    }

    elements.queryHistoryDiv.style.display = 'block';
    elements.historyList.innerHTML = '';

    history.forEach(query => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = query;
        item.addEventListener('click', () => {
            // Parse the route to extract departure, middle, and destination
            const routeParts = query.trim().split(/\s+/);
            if (routeParts.length >= 2) {
                elements.departureInput.value = routeParts[0];
                elements.destinationInput.value = routeParts[routeParts.length - 1];
                elements.routeInput.value = routeParts.slice(1, -1).join(' ');
            } else {
                // Fallback: put everything in routeInput
                elements.routeInput.value = query;
            }
            elements.routeInput.focus();
        });
        elements.historyList.appendChild(item);
    });
}

// ============================================
// AUTOCOMPLETE
// ============================================

function handleAutocompleteInput(e) {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    const beforeCursor = value.substring(0, cursorPos);
    const words = beforeCursor.split(/\s+/).filter(w => w.length > 0);
    const currentWord = words.length > 0 ? words[words.length - 1].toUpperCase() : '';
    const previousWord = words.length > 1 ? words[words.length - 2].toUpperCase() : null;

    // ============================================
    // PROCEDURE TRANSITION AUTOCOMPLETE (FAA CHART STANDARD)
    // ============================================
    // Detects when user types "TRANSITION." and shows matching procedures
    // Follows FAA chart standard: TRANSITION.PROCEDURE (e.g., KAYYS.WYNDE3)
    //
    // Examples:
    //   "KAYYS."       -> Shows all procedures with KAYYS transition
    //   "KAYYS.WY"     -> Filters to procedures starting with "WY" (WYNDE3)
    //   "MTHEW."       -> Shows all procedures with MTHEW transition
    //   "MTHEW.CH"     -> Filters to procedures starting with "CH" (CHPPR1)
    //
    // Pattern: /^([A-Z]{3,})\.([A-Z]*)$/
    //   - [A-Z]{3,}  = 3+ uppercase letters (transition name)
    //   - \.         = literal dot
    //   - [A-Z]*     = 0+ uppercase letters (procedure prefix for filtering)

    const dotMatch = currentWord.match(/^([A-Z]{3,})\.([A-Z]*)$/);
    if (dotMatch) {
        const [, transitionName, procedurePrefix] = dotMatch;

        // Get all procedures that have this transition
        // We need to search through all procedures to find ones with this transition
        const results = [];
        const dpsData = window.DataManager?.getDpsData?.() || new Map();
        const starsData = window.DataManager?.getStarsData?.() || new Map();

        // Search DPs
        for (const [procName, procData] of dpsData.entries()) {
            if (procData.transitions && Array.isArray(procData.transitions)) {
                const hasTransition = procData.transitions.some(t => t.name === transitionName);
                if (hasTransition && (!procedurePrefix || procName.startsWith(procedurePrefix))) {
                    results.push({
                        code: `${transitionName}.${procName}`,
                        name: `${transitionName}.${procName}`,
                        type: 'DP TRANSITION',
                        waypointType: 'procedure_transition',
                        location: `${transitionName} transition`,
                        contextHint: `${transitionName} transition for ${procName} DP`
                    });
                }
            }
        }

        // Search STARs
        for (const [procName, procData] of starsData.entries()) {
            if (procData.transitions && Array.isArray(procData.transitions)) {
                const hasTransition = procData.transitions.some(t => t.name === transitionName);
                if (hasTransition && (!procedurePrefix || procName.startsWith(procedurePrefix))) {
                    results.push({
                        code: `${transitionName}.${procName}`,
                        name: `${transitionName}.${procName}`,
                        type: 'STAR TRANSITION',
                        waypointType: 'procedure_transition',
                        location: `${transitionName} transition`,
                        contextHint: `${transitionName} transition for ${procName} STAR`
                    });
                }
            }
        }

        if (results.length > 0) {
            // Sort alphabetically by procedure name
            results.sort((a, b) => a.code.localeCompare(b.code));
            autocompleteResults = results;
            displayAutocomplete(results);
            return;
        }
    }

    // Check if cursor is at the end and last character is a space (just finished a waypoint)
    const justFinishedWaypoint = cursorPos === value.length && value.endsWith(' ') && currentWord === '';

    // If we just finished a waypoint (pressed space), show context-aware suggestions
    if (justFinishedWaypoint && previousWord) {
        // Show all context-aware suggestions for the previous waypoint
        // Use a dummy search term that will match everything
        const results = window.QueryEngine?.searchWaypoints('', previousWord, 20) || [];
        if (results.length > 0) {
            autocompleteResults = results;
            displayAutocomplete(results);
            return;
        }
    }

    // Normal autocomplete behavior - require at least 2 characters to reduce lag
    // Exception: if we have context (previousWord), we can suggest airways/fixes after 1 char
    const minChars = previousWord ? 1 : 2;
    if (currentWord.length < minChars) {
        hideAutocomplete();
        return;
    }

    // Search for matches with context-aware suggestions
    const results = window.QueryEngine?.searchWaypoints(currentWord, previousWord) || [];
    autocompleteResults = results;
    displayAutocomplete(results);
}

function displayAutocomplete(results) {
    if (results.length === 0) {
        elements.autocompleteDropdown.innerHTML = '<div class="autocomplete-empty">No results found</div>';
        elements.autocompleteDropdown.classList.add('show');
        return;
    }

    let html = '';
    results.forEach((result, index) => {
        let colorClass = 'type-fix'; // Default to white for unspecified
        if (result.waypointType === 'airport') {
            colorClass = 'type-airport';
        } else if (result.waypointType === 'navaid') {
            colorClass = 'type-navaid';
        } else if (result.waypointType === 'fix') {
            colorClass = result.isReportingPoint ? 'type-reporting' : 'type-fix';
        } else if (result.waypointType === 'airway') {
            colorClass = 'type-airway';
        }

        // Build the display name/type line
        let displayType = result.type;
        if (result.waypointType === 'airway') {
            displayType = 'AIRWAY';
        }

        // Show context hint if available
        const contextHint = result.contextHint || '';
        const locationText = result.location || '';
        const showContextHint = contextHint && contextHint.length > 0;

        html += `
            <div class="autocomplete-item ${colorClass}" data-index="${index}">
                <span class="code">${result.code}</span>
                <span class="name">${displayType}${result.name !== result.code ? ' - ' + result.name : ''}</span>
                ${showContextHint
                    ? `<span class="location context-hint">${contextHint}</span>`
                    : `<span class="location">${locationText}</span>`
                }
            </div>
        `;
    });

    elements.autocompleteDropdown.innerHTML = html;
    elements.autocompleteDropdown.classList.add('show');
    selectedAutocompleteIndex = -1;

    // Add click handlers
    elements.autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            selectAutocompleteItem(index);
        });
    });
}

function hideAutocomplete() {
    // Don't hide if we're in the middle of processing a selection
    if (isProcessingSelection) {
        return;
    }

    elements.autocompleteDropdown.classList.remove('show');
    elements.autocompleteDropdown.innerHTML = '';
    selectedAutocompleteIndex = -1;
    autocompleteResults = [];
}

function handleAutocompleteKeydown(e) {
    if (!elements.autocompleteDropdown.classList.contains('show')) {
        if (e.key === 'Enter' && !elements.calculateBtn.disabled) {
            // Trigger calculate via event (handled in app.js)
            return;
        }
        return;
    }

    const items = elements.autocompleteDropdown.querySelectorAll('.autocomplete-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
        updateAutocompleteSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
        updateAutocompleteSelection(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedAutocompleteIndex >= 0) {
            selectAutocompleteItem(selectedAutocompleteIndex);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
    }
}

function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedAutocompleteIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

// Flag to prevent autocomplete from hiding during selection
let isProcessingSelection = false;

function selectAutocompleteItem(index) {
    const result = autocompleteResults[index];
    if (!result) return;

    isProcessingSelection = true;

    const value = elements.routeInput.value;
    const cursorPos = elements.routeInput.selectionStart;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);

    const words = beforeCursor.split(/\s+/);
    words[words.length - 1] = result.code;
    const newBefore = words.join(' ');

    elements.routeInput.value = newBefore + ' ' + afterCursor;
    const newPos = newBefore.length + 1;
    elements.routeInput.setSelectionRange(newPos, newPos);

    // Instead of hiding, trigger autocomplete to show next suggestions
    // Simulate the "just finished waypoint" scenario
    const selectedCode = result.code.toUpperCase();
    const nextResults = window.QueryEngine?.searchWaypoints('', selectedCode, 20) || [];

    if (nextResults.length > 0) {
        autocompleteResults = nextResults;
        displayAutocomplete(nextResults);

        // Cancel any pending blur timeout from app.js
        if (elements.cancelBlurTimeout) {
            elements.cancelBlurTimeout();
        }

        // Focus AFTER showing autocomplete to prevent blur from hiding it
        elements.routeInput.focus();

        // Keep protection longer than blur timeout (250ms > 200ms)
        setTimeout(() => {
            isProcessingSelection = false;
        }, 250);
    } else {
        // No next suggestions - allow immediate hiding
        isProcessingSelection = false;
        hideAutocomplete();
        elements.routeInput.focus();
    }
}

// ============================================
// AIRPORT AUTOCOMPLETE (DEPARTURE/DESTINATION)
// ============================================

function handleDepartureAutocompleteInput(e) {
    const value = e.target.value.toUpperCase();

    if (value.length < 1) {
        hideDepartureAutocomplete();
        return;
    }

    const results = window.QueryEngine?.searchAirports(value) || [];
    departureResults = results;
    displayDepartureAutocomplete(results);
}

function displayDepartureAutocomplete(results) {
    if (results.length === 0) {
        elements.departureAutocompleteDropdown.innerHTML = '<div class="autocomplete-empty">No airports found</div>';
        elements.departureAutocompleteDropdown.classList.add('show');
        return;
    }

    let html = '';
    results.forEach((result, index) => {
        html += `
            <div class="autocomplete-item type-airport" data-index="${index}">
                <span class="code">${result.code}</span>
                <span class="name">${result.name !== result.code ? result.name : ''}</span>
                <span class="location">${result.location}</span>
            </div>
        `;
    });

    elements.departureAutocompleteDropdown.innerHTML = html;
    elements.departureAutocompleteDropdown.classList.add('show');
    selectedDepartureIndex = -1;

    elements.departureAutocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            selectDepartureItem(index);
        });
    });
}

function hideDepartureAutocomplete() {
    if (isProcessingAirportSelection) return;
    elements.departureAutocompleteDropdown.classList.remove('show');
    elements.departureAutocompleteDropdown.innerHTML = '';
    selectedDepartureIndex = -1;
    departureResults = [];
}

function handleDepartureKeydown(e) {
    if (!elements.departureAutocompleteDropdown.classList.contains('show')) {
        return;
    }

    const items = elements.departureAutocompleteDropdown.querySelectorAll('.autocomplete-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedDepartureIndex = Math.min(selectedDepartureIndex + 1, items.length - 1);
        updateDepartureSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedDepartureIndex = Math.max(selectedDepartureIndex - 1, -1);
        updateDepartureSelection(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedDepartureIndex >= 0) {
            selectDepartureItem(selectedDepartureIndex);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideDepartureAutocomplete();
    }
}

function updateDepartureSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedDepartureIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function selectDepartureItem(index) {
    const result = departureResults[index];
    if (!result) return;

    isProcessingAirportSelection = true;
    elements.departureInput.value = result.code;

    setTimeout(() => {
        isProcessingAirportSelection = false;
        hideDepartureAutocomplete();
        elements.departureInput.blur();
    }, 100);
}

// Destination autocomplete functions
function handleDestinationAutocompleteInput(e) {
    const value = e.target.value.toUpperCase();

    if (value.length < 1) {
        hideDestinationAutocomplete();
        return;
    }

    const results = window.QueryEngine?.searchAirports(value) || [];
    destinationResults = results;
    displayDestinationAutocomplete(results);
}

function displayDestinationAutocomplete(results) {
    if (results.length === 0) {
        elements.destinationAutocompleteDropdown.innerHTML = '<div class="autocomplete-empty">No airports found</div>';
        elements.destinationAutocompleteDropdown.classList.add('show');
        return;
    }

    let html = '';
    results.forEach((result, index) => {
        html += `
            <div class="autocomplete-item type-airport" data-index="${index}">
                <span class="code">${result.code}</span>
                <span class="name">${result.name !== result.code ? result.name : ''}</span>
                <span class="location">${result.location}</span>
            </div>
        `;
    });

    elements.destinationAutocompleteDropdown.innerHTML = html;
    elements.destinationAutocompleteDropdown.classList.add('show');
    selectedDestinationIndex = -1;

    elements.destinationAutocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            selectDestinationItem(index);
        });
    });
}

function hideDestinationAutocomplete() {
    if (isProcessingAirportSelection) return;
    elements.destinationAutocompleteDropdown.classList.remove('show');
    elements.destinationAutocompleteDropdown.innerHTML = '';
    selectedDestinationIndex = -1;
    destinationResults = [];
}

function handleDestinationKeydown(e) {
    if (!elements.destinationAutocompleteDropdown.classList.contains('show')) {
        return;
    }

    const items = elements.destinationAutocompleteDropdown.querySelectorAll('.autocomplete-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedDestinationIndex = Math.min(selectedDestinationIndex + 1, items.length - 1);
        updateDestinationSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedDestinationIndex = Math.max(selectedDestinationIndex - 1, -1);
        updateDestinationSelection(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedDestinationIndex >= 0) {
            selectDestinationItem(selectedDestinationIndex);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideDestinationAutocomplete();
    }
}

function updateDestinationSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedDestinationIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function selectDestinationItem(index) {
    const result = destinationResults[index];
    if (!result) return;

    isProcessingAirportSelection = true;
    elements.destinationInput.value = result.code;

    setTimeout(() => {
        isProcessingAirportSelection = false;
        hideDestinationAutocomplete();
        elements.destinationInput.blur();
    }, 100);
}

// ============================================
// RESULTS DISPLAY
// ============================================

function displayResults(waypoints, legs, totalDistance, totalTime = null, fuelStatus = null, options = {}) {
    // Route summary
    const expandedRoute = waypoints.map(w => RouteCalculator.getWaypointCode(w)).join(' ');

    // Get user input route from the form
    const userRoute = `${elements.departureInput.value.trim()} ${elements.routeInput.value.trim()} ${elements.destinationInput.value.trim()}`.trim();

    // Get current timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + 'Z';

    let summaryHTML = `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">TIME GENERATED</span>
            <span class="summary-value text-secondary">${timestamp}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">USER ROUTE</span>
            <span class="summary-value text-navaid font-bold">${userRoute}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">EXPANDED ROUTE</span>
            <span class="summary-value text-secondary" style="font-size: 0.8rem; word-break: break-all;">${expandedRoute}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">DISTANCE</span>
            <span class="summary-value text-navaid font-bold">${totalDistance.toFixed(1)} NM</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">WAYPOINTS</span>
            <span class="summary-value text-navaid font-bold">${waypoints.length}</span>
        </div>
    `;

    // Add filed altitude if available
    if (options.altitude) {
        summaryHTML += `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">FILED ALTITUDE</span>
            <span class="summary-value text-metric font-bold">${options.altitude} FT</span>
        </div>
        `;
    }

    // Add filed speed (TAS) if available
    if (options.tas) {
        summaryHTML += `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">FILED SPEED</span>
            <span class="summary-value text-metric font-bold">${options.tas} KT</span>
        </div>
        `;
    }

    // Add total time if available
    if (totalTime !== null && options.enableTime) {
        const hours = Math.floor(totalTime / 60);
        const minutes = Math.round(totalTime % 60);
        summaryHTML += `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">TIME</span>
            <span class="summary-value text-navaid font-bold">${hours}H ${minutes}M</span>
        </div>
        `;
    }

    // Add fuel status if available
    if (fuelStatus) {
        const fuelColor = fuelStatus.isSufficient ? 'text-metric' : 'text-error';
        const fuelIcon = fuelStatus.isSufficient ? '✓' : '!';
        summaryHTML += `
        <div class="summary-item" style="border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
            <span class="summary-label text-secondary text-sm">FUEL STATUS</span>
            <span class="summary-value ${fuelColor} font-bold">${fuelIcon} ${fuelStatus.isSufficient ? 'SUFFICIENT' : 'INSUFFICIENT'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">FINAL FOB</span>
            <span class="summary-value ${fuelColor} font-bold">${fuelStatus.finalFob.toFixed(1)} GAL (${(fuelStatus.finalFob / fuelStatus.burnRate).toFixed(1)}H)</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">FUEL RESERVE REQ</span>
            <span class="summary-value text-secondary">${fuelStatus.requiredReserve.toFixed(1)} GAL (${fuelStatus.vfrReserve} MIN)</span>
        </div>
        `;
    }

    elements.routeSummary.innerHTML = summaryHTML;

    // Display wind altitude table if wind correction enabled
    if (options.enableWinds && legs.some(leg => leg.windsAtAltitudes)) {
        displayWindAltitudeTable(legs, options.altitude);
    } else {
        elements.windAltitudeTable.style.display = 'none';
    }

    // Build navlog table
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th class="text-sm font-bold">WPT</th>
                    <th class="text-sm font-bold">IDENT / TYPE</th>
                    <th colspan="2" class="text-sm font-bold">POSITION / ELEVATION / FREQUENCIES</th>
                </tr>
            </thead>
            <tbody>
    `;

    let cumulativeDistance = 0;
    let cumulativeTime = 0;

    waypoints.forEach((waypoint, index) => {
        const code = RouteCalculator.getWaypointCode(waypoint);

        // Determine color based on waypoint type
        let colorClass = 'text-fix'; // Default white for unspecified
        if (waypoint.waypointType === 'airport') {
            colorClass = 'text-airport'; // Cyan
        } else if (waypoint.waypointType === 'navaid') {
            colorClass = 'text-navaid'; // Magenta
        } else if (waypoint.waypointType === 'fix') {
            colorClass = waypoint.isReportingPoint ? 'text-reporting' : 'text-fix'; // Amber or White
        }

        const waypointNumber = index + 1;

        // Position
        const pos = `${window.Utils?.formatCoordinate(waypoint.lat, 'lat')} ${window.Utils?.formatCoordinate(waypoint.lon, 'lon')}`;

        // Elevation (only show if available)
        const hasElevation = waypoint.elevation !== null && !isNaN(waypoint.elevation);
        const elev = hasElevation ? `${Math.round(waypoint.elevation)} FT` : null;

        // Magnetic variation
        let magVarDisplay;
        if (waypoint.magVar === null || waypoint.magVar === undefined) {
            magVarDisplay = 'VAR -';
        } else {
            const magVarValue = Math.abs(waypoint.magVar).toFixed(1);
            const magVarDir = waypoint.magVar >= 0 ? 'E' : 'W';
            magVarDisplay = `VAR ${magVarValue}°${magVarDir}`;
        }

        // Frequencies
        let freqHTML = '';
        if (waypoint.waypointType === 'airport') {
            const code = waypoint.icao || waypoint.ident;
            if (code) {
                const frequencies = DataManager.getFrequencies(code);
                if (frequencies.length > 0) {
                    const grouped = {};
                    frequencies.forEach(f => {
                        const type = f.type.toUpperCase();
                        if (!grouped[type]) grouped[type] = [];
                        grouped[type].push(f.frequency.toFixed(3));
                    });
                    const freqItems = Object.entries(grouped).map(([type, freqs]) =>
                        `<span class="text-metric text-xs">${type} ${freqs.join('/')}</span>`
                    );
                    freqHTML = freqItems.join(' ');
                } else {
                    freqHTML = `<span class="text-secondary text-xs">NO FREQ DATA</span>`;
                }
            }
        } else if (waypoint.waypointType === 'navaid' && waypoint.frequency) {
            const formattedFreq = window.Utils?.formatNavaidFrequency(waypoint.frequency, waypoint.type);
            if (formattedFreq) {
                freqHTML = `<span class="text-metric text-xs">${formattedFreq}</span>`;
            }
        }

        // Runways
        let runwayHTML = '';
        if (waypoint.waypointType === 'airport') {
            const code = waypoint.icao || waypoint.ident;
            if (code) {
                const runways = DataManager.getRunways(code);
                if (runways.length > 0) {
                    const runwayInfo = runways.map(r => {
                        const idents = r.leIdent && r.heIdent ? `${r.leIdent}/${r.heIdent}` : (r.leIdent || r.heIdent || 'N/A');
                        const length = r.length ? `${r.length}FT` : '';
                        const surface = r.surface || '';
                        return `<strong>${idents}</strong> ${length} ${surface}`.trim();
                    }).join(', ');
                    runwayHTML = `<div class="text-secondary text-xs">RWY ${runwayInfo}</div>`;
                } else {
                    runwayHTML = `<div class="text-secondary text-xs">RWY NO DATA</div>`;
                }
            }
        }

        // Type display with reporting point indicator
        let typeDisplay;
        if (waypoint.waypointType === 'airport') {
            typeDisplay = 'AIRPORT';
        } else if (waypoint.waypointType === 'navaid') {
            typeDisplay = waypoint.type || 'NAVAID';
        } else if (waypoint.waypointType === 'fix') {
            typeDisplay = waypoint.isReportingPoint ? 'REPORTING POINT' : 'FIX';
        } else {
            typeDisplay = waypoint.type || 'WAYPOINT';
        }

        // Build elevation and magnetic variation line
        let elevMagLine = '';
        if (elev) {
            elevMagLine = `<div class="text-airport text-xs">ELEV ${elev} | ${magVarDisplay}</div>`;
        } else {
            elevMagLine = `<div class="text-airport text-xs">${magVarDisplay}</div>`;
        }

        // Airspace class for airports
        let airspaceHTML = '';
        if (waypoint.waypointType === 'airport') {
            const arptCode = waypoint.icao || waypoint.ident;
            const airspace = DataManager.getAirspaceClass(arptCode);
            if (airspace) {
                let airspaceText = `CLASS ${airspace.class}`;
                // Add hours if available (common for Class D)
                if (airspace.hours) {
                    airspaceText += ` ${airspace.hours}`;
                }
                airspaceHTML = `<div class="text-reporting text-xs">${airspaceText}</div>`;
            }
        }

        // Waypoint row
        tableHTML += `
            <tr class="wpt-row">
                <td class="wpt-num text-primary font-bold">${waypointNumber}</td>
                <td class="wpt-info-cell">
                    <div class="${colorClass} wpt-code">${waypoint.waypointType === 'airport' ? `<a href="https://www.airnav.com/airport/${code}" target="_blank" rel="noopener noreferrer" class="airport-link">${code}</a>` : code}</div>
                    <div class="text-xs text-secondary">${typeDisplay}</div>
                </td>
                <td colspan="2">
                    <div class="text-secondary text-xs">${pos}</div>
                    ${elevMagLine}
                    ${airspaceHTML}
                    ${runwayHTML}
                    ${freqHTML ? `<div class="mt-xs">${freqHTML}</div>` : ''}
                </td>
            </tr>
        `;

        // Leg row
        if (index < waypoints.length - 1) {
            const leg = legs[index];
            cumulativeDistance += leg.distance;
            const legDist = leg.distance.toFixed(1);

            // True course (ground track) for secondary display
            const trueCourse = String(Math.round(leg.trueCourse)).padStart(3, '0');
            const cardinal = window.Utils?.getCardinalDirection(leg.trueCourse);

            // Magnetic heading (corrected for WCA + mag var) for primary display
            const magHeadingDisplay = leg.magHeading !== null
                ? String(Math.round(leg.magHeading)).padStart(3, '0') + '°'
                : '-';

            // PRIMARY NAV DATA (emphasized with colored values only)
            let primaryNavHTML = '<div class="leg-section" style="margin-bottom: 6px;">';

            // Magnetic heading (WCA + mag var already applied)
            primaryNavHTML += `<span class="leg-primary">HDG <span class="text-airport">${magHeadingDisplay}</span></span>`;

            // ETE (green/metric color for value if available)
            if (leg.legTime !== undefined) {
                const hours = Math.floor(leg.legTime / 60);
                const minutes = Math.round(leg.legTime % 60);
                const timeDisplay = hours > 0 ? `${hours}H${minutes}M` : `${minutes}M`;
                primaryNavHTML += ` <span class="leg-primary">ETE <span class="text-metric">${timeDisplay}</span></span>`;
                cumulativeTime += leg.legTime;
            }

            // Distance (magenta/navaid color for value)
            primaryNavHTML += ` <span class="leg-primary">DIST <span class="text-navaid">${legDist}NM</span></span>`;
            primaryNavHTML += '</div>';

            // SECONDARY NAV DATA (de-emphasized, organized in groups)
            let secondaryNavHTML = '<div class="leg-section">';

            // Group 1: Basic heading/speed (shows true COURSE, not heading)
            secondaryNavHTML += `<span class="leg-secondary">TC <span class="text-navaid">${trueCourse}° ${cardinal}</span></span>`;

            if (leg.groundSpeed !== undefined) {
                const gs = Math.round(leg.groundSpeed);
                secondaryNavHTML += ` <span class="leg-secondary">• GS <span class="text-metric">${gs}KT</span></span>`;
            }

            // Group 2: Cumulative data
            secondaryNavHTML += ` <span class="leg-secondary">• CUM DIST <span class="text-navaid">${cumulativeDistance.toFixed(1)}NM</span></span>`;

            if (cumulativeTime > 0) {
                const cumHours = Math.floor(cumulativeTime / 60);
                const cumMinutes = Math.round(cumulativeTime % 60);
                const cumTimeDisplay = cumHours > 0 ? `${cumHours}H${cumMinutes}M` : `${cumMinutes}M`;
                secondaryNavHTML += ` <span class="leg-secondary">• CUM TIME <span class="text-metric">${cumTimeDisplay}</span></span>`;
            }

            secondaryNavHTML += '</div>';

            // Group 3: Wind info (if wind correction applied)
            let windSection = '';
            if (leg.windDir !== undefined && leg.windSpd !== undefined) {
                const windDir = String(Math.round(leg.windDir)).padStart(3, '0');
                const windSpd = Math.round(leg.windSpd);
                const headwind = leg.headwind !== undefined ? leg.headwind : 0;

                // Wind type (headwind/tailwind)
                const windType = headwind >= 0 ? 'HEAD' : 'TAIL';
                const windValue = Math.abs(Math.round(headwind));

                // Temperature display (if available)
                const tempDisplay = leg.windTemp !== null && leg.windTemp !== undefined
                    ? `/${leg.windTemp > 0 ? '+' : ''}${leg.windTemp}°C`
                    : '';

                windSection = '<div class="leg-section">';
                windSection += `<span class="leg-secondary">WIND <span class="text-airport">${windDir}°/${windSpd}KT${tempDisplay}</span></span>`;
                windSection += ` <span class="leg-secondary">• ${windType} <span class="text-metric">${windValue}KT</span></span>`;

                // Wind correction angle
                if (leg.wca !== undefined) {
                    windSection += ` <span class="leg-secondary">• WCA <span class="text-metric">${leg.wca >= 0 ? '+' : ''}${leg.wca.toFixed(1)}°</span></span>`;
                }

                windSection += '</div>';
            }

            // FUEL SECTION (if fuel planning enabled)
            let fuelSection = '';
            if (leg.fobGal !== undefined && leg.fobTime !== undefined) {
                const fobColor = leg.fobGal < 5 ? 'text-error' : (leg.fobGal < 10 ? 'text-warning' : 'text-metric');
                fuelSection = `
                    <div class="leg-section">
                        <span class="leg-secondary">FUEL BURN <span class="text-navaid">${leg.fuelBurnGal.toFixed(1)}GAL</span></span>
                        <span class="leg-secondary">• FOB <span class="${fobColor} font-bold">${leg.fobGal.toFixed(1)}GAL (${leg.fobTime.toFixed(1)}H)</span></span>
                    </div>
                `;
            }

            tableHTML += `
                <tr class="leg-row">
                    <td colspan="4" class="leg-info">
                        ${primaryNavHTML}
                        ${secondaryNavHTML}
                        ${windSection}
                        ${fuelSection}
                    </td>
                </tr>
            `;
        }
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    elements.navlogTable.innerHTML = tableHTML;

    // Hide placeholder and show results
    const navlogPlaceholder = document.getElementById('navlogPlaceholder');
    if (navlogPlaceholder) navlogPlaceholder.style.display = 'none';
    elements.resultsSection.style.display = 'block';
}

// ============================================
// WIND ALTITUDE TABLE
// ============================================

function displayWindAltitudeTable(legs, filedAltitude) {
    const altitudes = [
        filedAltitude - 2000,
        filedAltitude - 1000,
        filedAltitude,
        filedAltitude + 1000,
        filedAltitude + 2000
    ];

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th class="leg-col">LEG</th>
    `;

    // Add column for each altitude
    altitudes.forEach(alt => {
        const isFiledAlt = alt === filedAltitude;
        tableHTML += `<th class="wind-cell ${isFiledAlt ? 'text-metric' : ''}">${(alt / 1000).toFixed(1)}K FT</th>`;
    });

    tableHTML += `
                </tr>
            </thead>
            <tbody>
    `;

    // Filter legs to show winds at 20% intervals (6 sample points: 0%, 20%, 40%, 60%, 80%, 100%)
    // Calculate total route distance first
    const totalDistance = legs.reduce((sum, leg) => sum + (leg.distance || 0), 0);

    const filteredLegs = [];
    let cumulativeDistance = 0;
    const targetPercentages = [0, 20, 40, 60, 80, 100]; // 6 sample points
    let nextTargetIndex = 0;

    legs.forEach((leg, index) => {
        const isFirst = index === 0;
        const isLast = index === legs.length - 1;
        const percentComplete = totalDistance > 0 ? (cumulativeDistance / totalDistance) * 100 : 0;

        // Check if we've reached or passed the next target percentage
        if (nextTargetIndex < targetPercentages.length) {
            const targetPercent = targetPercentages[nextTargetIndex];

            if (isFirst || isLast || (percentComplete >= targetPercent && nextTargetIndex > 0)) {
                filteredLegs.push({
                    leg,
                    index,
                    distance: cumulativeDistance,
                    percent: Math.round(percentComplete)
                });
                nextTargetIndex++;
            }
        }

        cumulativeDistance += leg.distance || 0;
    });

    // Add row for each filtered leg
    filteredLegs.forEach(({ leg, index }) => {
        const from = RouteCalculator.getWaypointCode(leg.from);
        const to = RouteCalculator.getWaypointCode(leg.to);

        tableHTML += `<tr>`;
        tableHTML += `<td class="leg-col"><span class="font-bold">LEG ${index + 1}</span><br><span class="text-xs text-secondary">${from} - ${to}</span></td>`;

        altitudes.forEach(alt => {
            const isFiledAlt = alt === filedAltitude;

            if (leg.windsAtAltitudes && leg.windsAtAltitudes[alt]) {
                const wind = leg.windsAtAltitudes[alt];
                const dir = String(Math.round(wind.direction)).padStart(3, '0');
                const spd = Math.round(wind.speed);
                const temp = wind.temperature !== null && wind.temperature !== undefined
                    ? `/${wind.temperature > 0 ? '+' : ''}${wind.temperature}°C`
                    : '';
                const cellClass = isFiledAlt ? 'filed-altitude text-metric font-bold' : 'text-secondary';
                tableHTML += `<td class="wind-cell ${cellClass}">${dir}°/${spd}KT${temp}</td>`;
            } else {
                tableHTML += `<td class="wind-cell text-secondary">-</td>`;
            }
        });

        tableHTML += `</tr>`;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    elements.windAltitudeTable.innerHTML = tableHTML;
    elements.windAltitudeTable.style.display = 'block';
}

// ============================================
// NAVLOG RESTORE
// ============================================

function restoreNavlog(navlogData) {
    const { routeString, waypoints, legs, totalDistance, totalTime, fuelStatus, options } = navlogData;

    // Restore ICAO-style route inputs (departure/route/destination)
    // Check if saved data has separate fields (new format) or single routeString (legacy)
    if (navlogData.departure && navlogData.destination) {
        // New format: restore to separate fields
        elements.departureInput.value = navlogData.departure;
        elements.routeInput.value = navlogData.routeMiddle || '';
        elements.destinationInput.value = navlogData.destination;
    } else {
        // Legacy format: parse routeString to extract departure and destination
        const routeParts = routeString.trim().split(/\s+/);
        if (routeParts.length >= 2) {
            elements.departureInput.value = routeParts[0];
            elements.destinationInput.value = routeParts[routeParts.length - 1];
            elements.routeInput.value = routeParts.slice(1, -1).join(' ');
        } else {
            // Fallback: put everything in routeInput for backward compatibility
            elements.routeInput.value = routeString;
        }
    }

    // Restore optional feature settings
    if (options.enableWinds) {
        document.getElementById('enableWindsToggle').classList.add('active');
        document.getElementById('windInputs').classList.remove('hidden');
        if (options.altitude) elements.altitudeInput.value = options.altitude;
        if (options.tas) elements.tasInput.value = options.tas;

        // Restore forecast period
        document.querySelectorAll('.radio-btn[data-period]').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.getAttribute('data-period') === options.forecastPeriod) {
                btn.classList.add('selected');
            }
        });
    }

    if (options.enableFuel) {
        document.getElementById('enableFuelToggle').classList.add('active');
        document.getElementById('fuelInputs').classList.remove('hidden');
        if (options.usableFuel) elements.usableFuelInput.value = options.usableFuel;
        if (options.taxiFuel) elements.taxiFuelInput.value = options.taxiFuel;
        if (options.burnRate) elements.burnRateInput.value = options.burnRate;

        // Restore reserve setting
        document.querySelectorAll('.radio-btn[data-reserve]').forEach(btn => {
            btn.classList.remove('selected');
            if (parseInt(btn.getAttribute('data-reserve')) === options.vfrReserve) {
                btn.classList.add('selected');
            }
        });
    }

    // Display results
    displayResults(waypoints, legs, totalDistance, totalTime, fuelStatus, options);

    // Display vector map
    if (typeof window.VectorMap !== 'undefined') {
        window.VectorMap.displayMap(waypoints, legs, options);
    }

    // Restore FlightTracker fuel settings
    if (window.FlightTracker && options.enableFuel) {
        window.FlightTracker.setFuel(
            options.usableFuel || 0,
            options.burnRate || 0,
            options.taxiFuel || 0
        );
    }

    console.log('[UIController] Navlog restored:', routeString);
}

// ============================================
// EXPORTS
// ============================================

window.UIController = {
    // Initialization
    init,
    setupFeatureToggles,
    initSystemChecks,

    // Elements access
    getElements: () => elements,

    // Status
    updateStatus,
    showDataInfo,
    populateInspection,
    updateDatabaseStatus,

    // Input controls
    enableRouteInput,
    disableRouteInput,
    clearRoute,

    // Autocomplete
    handleAutocompleteInput,
    handleAutocompleteKeydown,
    hideAutocomplete,

    // Airport autocomplete (departure/destination)
    handleDepartureAutocompleteInput,
    handleDepartureKeydown,
    hideDepartureAutocomplete,
    handleDestinationAutocompleteInput,
    handleDestinationKeydown,
    hideDestinationAutocomplete,

    // Results
    displayResults,
    restoreNavlog,

    // History
    displayQueryHistory
};
