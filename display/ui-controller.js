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
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate age in milliseconds from a Zulu time string
 * @param {string} zuluTime - Zulu time in DDHHMMZ format (e.g., "230000Z")
 * @returns {number} Age in milliseconds
 */
function calculateZuluAge(zuluTime) {
    if (!zuluTime || typeof zuluTime !== 'string') {
        return 0;
    }

    // Parse DDHHMMZ format
    const match = zuluTime.match(/^(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) {
        return 0;
    }

    const day = parseInt(match[1]);
    const hour = parseInt(match[2]);
    const minute = parseInt(match[3]);

    // Get current UTC time
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    const currentDay = now.getUTCDate();

    // Create date object for the Zulu time
    // Assume same month/year as current (forecasts are always recent)
    let issueDate = new Date(Date.UTC(currentYear, currentMonth, day, hour, minute, 0));

    // Handle month rollover (e.g., if today is 1st but forecast is from 30th of last month)
    if (day > currentDay + 1) {
        // Forecast day is in previous month
        issueDate = new Date(Date.UTC(currentYear, currentMonth - 1, day, hour, minute, 0));
    }

    // Return age in milliseconds
    return now.getTime() - issueDate.getTime();
}

/**
 * Parse route string into components
 * @param {string} routeString - Full route string (e.g., "KALB ALB SYR KSYR")
 * @returns {Object|null} { departure, routeMiddle, destination, waypoints } or null if invalid
 */
function parseRouteString(routeString) {
    if (!routeString) return null;
    const waypoints = routeString.trim().split(/\s+/).filter(w => w.length > 0);
    if (waypoints.length < 2) return null;
    return {
        departure: waypoints[0],
        destination: waypoints[waypoints.length - 1],
        routeMiddle: waypoints.slice(1, -1).join(' '),
        waypoints
    };
}

/**
 * Set route input field values
 * @param {string} departure - Departure airport
 * @param {string} routeMiddle - Middle waypoints
 * @param {string} destination - Destination airport
 */
function setRouteInputs(departure, routeMiddle, destination) {
    elements.departureInput.value = departure || '';
    elements.routeInput.value = routeMiddle || '';
    elements.destinationInput.value = destination || '';
}

/**
 * Set radio button selection by data attribute
 * @param {string} selector - CSS selector for radio buttons
 * @param {string} dataAttr - Data attribute name (e.g., 'period', 'reserve')
 * @param {string|number} value - Value to select
 */
function setRadioSelection(selector, dataAttr, value) {
    document.querySelectorAll(selector).forEach(btn => {
        btn.classList.remove('selected');
        const btnValue = btn.getAttribute(`data-${dataAttr}`);
        if (btnValue == value) btn.classList.add('selected');
    });
}

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

        // Departure time elements
        departureTimeSelect: document.getElementById('departureTimeSelect'),
        departureTimeCustom: document.getElementById('departureTimeCustom'),
        departureTimeDisplay: document.getElementById('departureTimeDisplay'),

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

/**
 * Show data warning banner (e.g., for expired NASR data)
 * @param {string} title - Warning title (e.g., "NASR DATA EXPIRED")
 * @param {string} message - Warning message with details
 */
function showDataWarning(title, message) {
    const banner = document.getElementById('data-warning');
    const titleEl = document.getElementById('data-warning-title');
    const messageEl = document.getElementById('data-warning-message');

    if (!banner) return;

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    banner.classList.add('show');
    console.log(`[UIController] Data warning shown: ${title} - ${message}`);
}

/**
 * Hide data warning banner
 */
function hideDataWarning() {
    const banner = document.getElementById('data-warning');
    if (banner) {
        banner.classList.remove('show');
        console.log('[UIController] Data warning dismissed');
    }
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

    // Always enable altitude, TAS, and departure time (mandatory fields)
    elements.altitudeInput.disabled = false;
    elements.tasInput.disabled = false;
    if (elements.departureTimeSelect) {
        elements.departureTimeSelect.disabled = false;
    }
    if (elements.departureTimeCustom) {
        elements.departureTimeCustom.disabled = false;
    }

    // Initialize departure time display
    updateDepartureTimeDisplay();

    // Enable fuel inputs based on feature toggle (if enabled)
    if (elements.isFuelEnabled && elements.isFuelEnabled()) {
        elements.usableFuelInput.disabled = false;
        elements.taxiFuelInput.disabled = false;
        elements.burnRateInput.disabled = false;
    }
}

function disableRouteInput() {
    elements.departureInput.disabled = true;
    elements.routeInput.disabled = true;
    elements.destinationInput.disabled = true;
    elements.altitudeInput.disabled = true;
    elements.tasInput.disabled = true;
    elements.calculateBtn.disabled = true;
    if (elements.departureTimeSelect) {
        elements.departureTimeSelect.disabled = true;
    }
    if (elements.departureTimeCustom) {
        elements.departureTimeCustom.disabled = true;
    }
}

/**
 * Get the selected departure time as a Date object
 * @returns {Date} The departure time
 */
function getDepartureTime() {
    if (!elements.departureTimeSelect) {
        return new Date();
    }

    const selection = elements.departureTimeSelect.value;

    if (selection === 'custom' && elements.departureTimeCustom?.value) {
        return new Date(elements.departureTimeCustom.value);
    }

    const now = new Date();

    switch (selection) {
        case '+1':
            return new Date(now.getTime() + 1 * 60 * 60 * 1000);
        case '+2':
            return new Date(now.getTime() + 2 * 60 * 60 * 1000);
        case '+6':
            return new Date(now.getTime() + 6 * 60 * 60 * 1000);
        case '+12':
            return new Date(now.getTime() + 12 * 60 * 60 * 1000);
        case '+24':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        case 'now':
        default:
            return now;
    }
}

/**
 * Update the departure time display to show Zulu time
 */
function updateDepartureTimeDisplay() {
    if (!elements.departureTimeDisplay) return;

    const depTime = getDepartureTime();
    const zuluStr = depTime.toISOString().slice(11, 16) + 'Z';
    const dateStr = depTime.toISOString().slice(5, 10).replace('-', '/');

    elements.departureTimeDisplay.textContent = `${dateStr} ${zuluStr}`;
}

/**
 * Handle departure time selection change
 */
function handleDepartureTimeChange() {
    const selection = elements.departureTimeSelect?.value;

    // Show/hide custom input
    if (elements.departureTimeCustom) {
        if (selection === 'custom') {
            elements.departureTimeCustom.classList.remove('hidden');
            // Set default to current time in local format
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            elements.departureTimeCustom.value = now.toISOString().slice(0, 16);
        } else {
            elements.departureTimeCustom.classList.add('hidden');
        }
    }

    updateDepartureTimeDisplay();
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

    // Winds aloft data toggle - make entire row clickable
    const windsToggleRow = elements.enableWindsToggle.parentElement;
    windsToggleRow.addEventListener('click', () => {
        windsEnabled = !windsEnabled;
        if (windsEnabled) {
            elements.enableWindsToggle.classList.add('checked');
            elements.windInputs.classList.remove('hidden');
        } else {
            elements.enableWindsToggle.classList.remove('checked');
            elements.windInputs.classList.add('hidden');
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

    // Store state setters (for crash recovery restore)
    elements.setWindsEnabled = (enabled) => {
        windsEnabled = enabled;
        if (enabled) {
            elements.enableWindsToggle.classList.add('checked');
            elements.windInputs.classList.remove('hidden');
        } else {
            elements.enableWindsToggle.classList.remove('checked');
            elements.windInputs.classList.add('hidden');
        }
    };
    elements.setFuelEnabled = (enabled) => {
        fuelEnabled = enabled;
        if (enabled) {
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
            const parsed = parseRouteString(query);
            if (parsed) {
                setRouteInputs(parsed.departure, parsed.routeMiddle, parsed.destination);
            } else {
                // Fallback: put everything in routeInput
                setRouteInputs('', query, '');
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

    // Determine if this is a contextual suggestion (airway) or direct replacement
    // Procedure transitions should REPLACE, not add (WYNDE3 → KAYYS.WYNDE3)
    const isProcedureTransition = result.waypointType === 'procedure_transition';
    const isContextualAirway = result.contextHint && (
        result.contextHint.includes('via') ||
        result.contextHint.includes('Contains') ||
        result.contextHint.includes('Exit point') ||
        result.contextHint.includes('Airway')
    );

    let newBefore;
    const words = beforeCursor.split(/\s+/).filter(w => w.length > 0);

    if (isContextualAirway && !isProcedureTransition) {
        // ADD after the current complete word (don't replace it)
        // This handles: "PAYGE" + select "Q822" → "PAYGE Q822"
        newBefore = words.join(' ') + ' ' + result.code;
    } else {
        // REPLACE the current partial word
        // This handles: "KO" + select "KORD" → "KORD"
        // Also handles: "WYNDE3" + select "KAYYS.WYNDE3" → "KAYYS.WYNDE3"
        words[words.length - 1] = result.code;
        newBefore = words.join(' ');
    }

    // Also remove any partial word after the cursor (prevent residual characters)
    // Find the next space or end of string after cursor position
    const nextSpaceMatch = afterCursor.match(/^[^\s]*/);
    const partialAfter = nextSpaceMatch ? nextSpaceMatch[0] : '';
    const cleanAfter = afterCursor.substring(partialAfter.length);

    elements.routeInput.value = newBefore + ' ' + cleanAfter;
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

// Store current hazard data for terrain/weather analysis updates
let _currentHazardData = {
    fuelStatus: null,
    windMetadata: null,
    options: {},
    terrainStatus: null,
    weatherStatus: null,  // Weather hazards (async)
    windAnalysis: null,   // Wind hazards analysis
    returnFuel: null,     // Return fuel analysis
    legs: null,           // Route legs for wind/fuel analysis
    waypoints: null       // Route waypoints for weather analysis
};

/**
 * Build hazard summary HTML for insertion into route summary
 * Hazards are grouped by type with multiple detail lines per type
 * @param {Object} fuelStatus - Fuel calculation results
 * @param {Object} windMetadata - Wind data metadata
 * @param {Object} options - Route calculation options
 * @param {Object} terrainStatus - Terrain clearance status (updated async)
 * @param {Object} weatherStatus - Weather hazards (updated async)
 * @param {Object} windAnalysis - Wind analysis results
 * @param {Object} returnFuel - Return fuel calculation results
 * @returns {string} HTML string for hazard summary
 */
function buildHazardSummaryHTML(fuelStatus, windMetadata, options, terrainStatus = null, weatherStatus = null, windAnalysis = null, returnFuel = null) {
    // Hazards grouped by type, each type has array of details sorted by waypoint order
    const hazardGroups = {};

    // Helper to add simple hazard (non-weather)
    function addHazard(type, severity, icon, detail) {
        if (!hazardGroups[type]) {
            hazardGroups[type] = { severity, icon, details: [] };
        }
        if (severity === 'critical') {
            hazardGroups[type].severity = 'critical';
            hazardGroups[type].icon = '✗';
        } else if (severity === 'warning' && hazardGroups[type].severity !== 'critical') {
            hazardGroups[type].severity = 'warning';
        }
        // Simple detail object
        if (!hazardGroups[type].details.some(d => d.text === detail)) {
            hazardGroups[type].details.push({ text: detail, firstWaypointIndex: 999, isWeather: false });
        }
    }

    // Helper to add weather hazard with separate time/waypoint parts for coloring
    // Stores raw affectedWaypoints array for later merging of overlapping entries
    // For wind hazards, pass preformattedStr to bypass merging
    function addWeatherHazard(type, severity, icon, description, timeStr, affectedWaypoints, preformattedStr = null, firstIdx = 999) {
        if (!hazardGroups[type]) {
            hazardGroups[type] = { severity, icon, details: [] };
        }
        if (severity === 'critical') {
            hazardGroups[type].severity = 'critical';
            hazardGroups[type].icon = '✗';
        } else if (severity === 'warning' && hazardGroups[type].severity !== 'critical') {
            hazardGroups[type].severity = 'warning';
        }
        // Store raw waypoint data for merging later
        // preformattedStr bypasses merging (used for wind hazards with leg ranges)
        hazardGroups[type].details.push({
            description,
            timeStr,
            affectedWaypoints: Array.isArray(affectedWaypoints) ? affectedWaypoints : [],
            waypointsStr: preformattedStr,
            firstWaypointIndex: firstIdx,
            isWeather: true
        });
    }

    // Merge overlapping weather hazard details within a group
    // Entries covering overlapping waypoint ranges are combined
    // Entries with pre-formatted waypointsStr (e.g., wind hazards) are not merged
    function mergeOverlappingWeatherHazards(details) {
        // Separate: mergeable (weather with waypoint arrays), non-mergeable (preformatted or non-weather)
        const mergeableDetails = details.filter(d => d.isWeather && d.affectedWaypoints?.length > 0 && !d.waypointsStr);
        const nonMergeableDetails = details.filter(d => !d.isWeather || !d.affectedWaypoints?.length || d.waypointsStr);

        if (mergeableDetails.length <= 1) {
            return details;
        }

        // Sort by first waypoint index
        mergeableDetails.sort((a, b) =>
            (a.affectedWaypoints[0]?.index || 999) - (b.affectedWaypoints[0]?.index || 999)
        );

        // Merge only truly overlapping entries (must share at least one waypoint)
        // This prevents cascade merging of adjacent but non-overlapping segments
        const merged = [];
        let current = { ...mergeableDetails[0] };

        for (let i = 1; i < mergeableDetails.length; i++) {
            const next = mergeableDetails[i];

            const currLast = current.affectedWaypoints[current.affectedWaypoints.length - 1]?.index || 0;
            const nextFirst = next.affectedWaypoints[0]?.index || 0;

            // Only merge if actually overlapping (nextFirst <= currLast means they share waypoint(s))
            // NOT merging adjacent entries (e.g., [1,2,3] and [4,5,6] stay separate)
            if (nextFirst <= currLast) {
                // Merge waypoints
                const allWaypoints = [...current.affectedWaypoints];
                for (const wp of next.affectedWaypoints) {
                    if (!allWaypoints.some(w => w.index === wp.index)) {
                        allWaypoints.push(wp);
                    }
                }
                allWaypoints.sort((a, b) => a.index - b.index);

                // Combine unique descriptions
                const descSet = new Set([current.description, next.description].filter(Boolean));
                const combinedDesc = descSet.size > 1 ? [...descSet].join('; ') : (current.description || next.description);

                current = {
                    description: combinedDesc,
                    timeStr: current.timeStr || next.timeStr,
                    affectedWaypoints: allWaypoints,
                    isWeather: true
                };
            } else {
                merged.push(current);
                current = { ...next };
            }
        }
        merged.push(current);

        return [...nonMergeableDetails, ...merged];
    }

    // Check fuel hazards - insufficient for outbound
    if (fuelStatus && !fuelStatus.isSufficient) {
        const deficit = (fuelStatus.requiredReserve - fuelStatus.finalFob).toFixed(1);
        addHazard('FUEL', 'critical', '✗', `Insufficient - ${deficit} GAL below reserve`);
    }

    // Check return fuel hazard - can we make it back without refueling?
    // Need: final FOB >= taxi burn + return flight burn + reserve
    if (returnFuel && fuelStatus && fuelStatus.isSufficient) {
        const taxiFuel = fuelStatus.taxiFuel || 0;
        const fuelForReturn = taxiFuel + returnFuel.returnFuel + fuelStatus.requiredReserve;
        if (fuelStatus.finalFob < fuelForReturn) {
            const deficit = (fuelForReturn - fuelStatus.finalFob).toFixed(1);
            addHazard('FUEL', 'warning', '⚠', `Cannot return without refuel (${deficit} GAL short)`);
        }
    }

    // Check terrain hazards
    if (terrainStatus) {
        if (terrainStatus.status === 'UNSAFE') {
            // Different message for MORA vs raw terrain data
            // MORA already includes 1000'/2000' buffer, raw terrain does not
            const dataLabel = terrainStatus.isMORA ? 'MORA' : 'terrain';
            const bufferNote = terrainStatus.isMORA ? '' : ', add buffer';
            addHazard('TERRAIN', 'critical', '✗', `${terrainStatus.deficit?.toLocaleString()}' below ${dataLabel} (${terrainStatus.maxMORA?.toLocaleString()}'${bufferNote})`);
        }
    } else if (options.altitude) {
        addHazard('TERRAIN', 'info', '...', 'Analyzing...');
    }

    // Check wind data freshness
    if (options.enableWinds && windMetadata) {
        const isWithinWindow = Utils.isWithinUseWindow(windMetadata.useWindow);
        const dataAge = Date.now() - windMetadata.parsedAt;
        const forecastPeriod = options.forecastPeriod || '06';
        const maxAge = (forecastPeriod === '24' || forecastPeriod === '12') ? 12 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000;

        if (!isWithinWindow) {
            addHazard('WINDS', 'warning', '⚠', 'Outside valid window');
        } else if (dataAge > maxAge) {
            addHazard('WINDS', 'warning', '⚠', `Data is ${Math.floor(dataAge / (60 * 60 * 1000))}h old`);
        }
    }

    // Check high wind hazards - split into separate entries for each non-consecutive range
    // Wind components (headwind/crosswind) apply to LEGS, not waypoints, because only legs have headings
    // Each range gets its own line with max wind for that range
    if (windAnalysis && windAnalysis.hasHazard) {
        // Helper to split legs into consecutive ranges and compute max for each range
        const splitIntoRanges = (legs) => {
            if (!legs || legs.length === 0) return [];
            const sorted = [...legs].sort((a, b) => a.fromIndex - b.fromIndex);
            const ranges = [];
            let rangeLegs = [sorted[0]];

            for (let i = 1; i < sorted.length; i++) {
                const current = sorted[i];
                const prev = rangeLegs[rangeLegs.length - 1];
                // Consecutive if this leg starts where previous leg ends
                if (current.fromIndex === prev.toIndex) {
                    rangeLegs.push(current);
                } else {
                    ranges.push(rangeLegs);
                    rangeLegs = [current];
                }
            }
            ranges.push(rangeLegs);
            return ranges;
        };

        // Helper to get CSS class for waypoint type coloring (with reporting point support)
        const getColorClass = (type, isReporting = false) => {
            switch (type) {
                case 'airport': return 'text-airport';
                case 'navaid': return 'text-navaid';
                case 'fix':
                    return isReporting ? 'text-reporting' : 'text-fix';
                default: return 'text-fix';
            }
        };

        // Helper to format a single range with colors and brackets
        const formatRange = (legs) => {
            const first = legs[0];
            const last = legs[legs.length - 1];
            const fromClass = getColorClass(first.fromType, first.fromIsReporting);
            const toClass = getColorClass(last.toType, last.toIsReporting);
            return `<span class="${fromClass}">${first.from}[${first.fromIndex}]</span>-<span class="${toClass}">${last.to}[${last.toIndex}]</span>`;
        };

        if (windAnalysis.headwindWarning && windAnalysis.headwindWarning.affectedLegs) {
            const ranges = splitIntoRanges(windAnalysis.headwindWarning.affectedLegs);
            for (const rangeLegs of ranges) {
                const maxVal = Math.max(...rangeLegs.map(l => l.value));
                const legRangeStr = formatRange(rangeLegs);
                const firstIdx = rangeLegs[0].fromIndex || 999;
                addWeatherHazard('HEADWIND', 'warning', '⚠', `${maxVal}KT`, null, [], legRangeStr, firstIdx);
            }
        }
        if (windAnalysis.crosswindWarning && windAnalysis.crosswindWarning.affectedLegs) {
            const ranges = splitIntoRanges(windAnalysis.crosswindWarning.affectedLegs);
            for (const rangeLegs of ranges) {
                const maxVal = Math.max(...rangeLegs.map(l => l.value));
                const legRangeStr = formatRange(rangeLegs);
                const firstIdx = rangeLegs[0].fromIndex || 999;
                addWeatherHazard('XWIND', 'warning', '⚠', `${maxVal}KT`, null, [], legRangeStr, firstIdx);
            }
        }
    }

    // Check weather hazards
    if (weatherStatus) {
        // Airport weather (IFR/LIFR at DEP/DEST)
        for (const apt of (weatherStatus.airportWx || [])) {
            const severity = apt.flightCategory === 'LIFR' ? 'critical' : 'warning';
            const icon = apt.flightCategory === 'LIFR' ? '✗' : '⚠';
            const loc = apt.type === 'DEPARTURE' ? 'DEP' : 'DEST';
            addHazard(apt.flightCategory, severity, icon, `${apt.icao} (${loc})`);
        }

        // SIGMET hazards - pass raw waypoints for merging
        for (const sigmet of (weatherStatus.sigmets || [])) {
            const hazardType = sigmet.label || sigmet.hazard || 'SIGMET';
            const timeStr = sigmet.timeRange?.formattedRange || '';
            addWeatherHazard(hazardType, 'critical', '✗', null, timeStr, sigmet.affectedWaypoints || []);
        }

        // G-AIRMET hazards - pass raw waypoints for merging
        for (const gairmet of (weatherStatus.gairmets || [])) {
            const hazardType = gairmet.label || gairmet.hazard || 'G-AIRMET';
            const timeStr = gairmet.timeRange?.formattedRange || '';
            addWeatherHazard(hazardType, 'warning', '⚠', gairmet.dueTo || null, timeStr, gairmet.affectedWaypoints || []);
        }

        // PIREP hazards - group by type, one combined table per type
        // Map PIREP type codes to display labels
        const pirepTypeLabels = {
            'TURB': 'PIREP TB',
            'ICE': 'PIREP IC',
            'TS': 'PIREP TS',
            'WX': 'PIREP WX',
            'WS': 'PIREP WS',
            'VA': 'PIREP VA',
            'SK': 'PIREP SK',
            'OTHER': 'PIREP'
        };
        const pirepsByType = {};
        for (const pirep of (weatherStatus.pireps || [])) {
            const typeLabel = pirepTypeLabels[pirep.type] || `PIREP ${pirep.type}`;
            if (!pirepsByType[typeLabel]) {
                pirepsByType[typeLabel] = [];
            }
            pirepsByType[typeLabel].push(pirep);
        }

        // Add one hazard entry per PIREP type with combined table
        for (const [typeLabel, pireps] of Object.entries(pirepsByType)) {
            if (pireps.length === 0) continue;

            // Sort: urgent first, then by waypoint index
            pireps.sort((a, b) => {
                if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
                return (a.nearestWpIndex || 999) - (b.nearestWpIndex || 999);
            });

            // Find worst severity in group (NEG reports are info-level)
            const hasUrgent = pireps.some(p => p.isUrgent);
            const hasSevere = pireps.some(p => !p.isNegative && (p.intensity === 'SEV' || p.intensity === 'EXTRM'));
            const allNegative = pireps.every(p => p.isNegative);
            const severity = hasUrgent || hasSevere ? 'critical' : (allNegative ? 'info' : 'warning');
            const icon = hasUrgent || hasSevere ? '✗' : (allNegative ? '✓' : '⚠');

            // Check for type-specific extra columns
            const hasIceType = pireps.some(p => p.iceType);
            const hasWxType = pireps.some(p => p.wxType);
            const hasSkySummary = pireps.some(p => p.skySummary);
            const hasTemp = pireps.some(p => p.tempC !== null && p.tempC !== undefined);
            const hasAircraftType = pireps.some(p => p.aircraftType);

            // Format all PIREPs as table rows - only show waypoint label when it changes
            let lastWpKey = null;
            const pirepRows = pireps.map(pirep => {
                // UUA label for urgent PIREPs (no label for regular UA)
                const urgentCell = pirep.isUrgent
                    ? `<td class="text-error font-bold" style="width:28px;white-space:nowrap">UUA</td>`
                    : `<td style="width:28px"></td>`;

                // Intensity with color coding (NEG = green/info)
                let intColor = 'text-secondary';
                if (pirep.isNegative) {
                    intColor = 'text-metric'; // green for negative reports
                } else if (pirep.intensity === 'SEV' || pirep.intensity === 'EXTRM') {
                    intColor = 'text-error';
                } else if (pirep.intensity === 'MOD' || pirep.intensity === 'LGT') {
                    intColor = 'text-warning';
                }
                const intensityCell = `<td class="${intColor} font-bold" style="width:40px;white-space:nowrap">${pirep.intensity || ''}</td>`;

                // Type-specific info column (ice type, weather type, sky condition)
                let typeCell = '';
                if (hasIceType) {
                    typeCell = `<td class="text-secondary" style="width:36px;white-space:nowrap">${pirep.iceType || ''}</td>`;
                } else if (hasWxType) {
                    typeCell = `<td class="text-secondary" style="width:48px;white-space:nowrap">${pirep.wxType || ''}</td>`;
                } else if (hasSkySummary) {
                    typeCell = `<td class="text-secondary" style="width:72px;white-space:nowrap">${pirep.skySummary || ''}</td>`;
                }

                // Altitude - monospace for numbers
                const altStr = pirep.altitude ? `FL${Math.round(pirep.altitude / 100).toString().padStart(3, '0')}` : '';
                const altCell = `<td class="text-airport" style="width:48px;white-space:nowrap;font-family:monospace">${altStr}</td>`;

                // Temperature (if available in group)
                let tempCell = '';
                if (hasTemp) {
                    const tempStr = pirep.tempC !== null && pirep.tempC !== undefined ? `${pirep.tempC}°` : '';
                    tempCell = `<td class="text-secondary" style="width:32px;white-space:nowrap;font-family:monospace">${tempStr}</td>`;
                }

                // Aircraft type (if available in group)
                let acftCell = '';
                if (hasAircraftType) {
                    acftCell = `<td class="text-secondary" style="width:40px;white-space:nowrap;opacity:0.7">${pirep.aircraftType || ''}</td>`;
                }

                // Age - right-aligned
                let ageStr = '';
                if (pirep.obsTime) {
                    const ageMin = Math.round((Date.now() / 1000 - pirep.obsTime) / 60);
                    ageStr = ageMin < 60 ? `${ageMin}m` : `${Math.round(ageMin / 60)}h`;
                }
                const ageCell = `<td class="text-secondary" style="width:28px;white-space:nowrap;text-align:right;opacity:0.7">${ageStr}</td>`;

                // Distance from waypoint (right-aligned)
                const distStr = pirep.distanceNm > 0 ? `${pirep.distanceNm}NM` : '';
                const distCell = `<td class="text-secondary" style="width:36px;white-space:nowrap;text-align:right">${distStr}</td>`;

                // Direction from waypoint (right-aligned)
                const dirStr = pirep.distanceNm > 0 ? (pirep.direction || '') : '';
                const dirCell = `<td class="text-secondary" style="width:24px;white-space:nowrap;text-align:right;padding-left:2px">${dirStr}</td>`;

                // Waypoint reference - only show if different from previous row
                // Use waypoint type for coloring (airport=blue, navaid=magenta, fix=white/cyan, reporting=amber)
                const wpKey = `${pirep.nearestWpIdent}-${pirep.nearestWpIndex}`;
                const showWp = wpKey !== lastWpKey;
                lastWpKey = wpKey;
                const wpIdent = pirep.nearestWpIdent || `WP${pirep.nearestWpIndex}`;
                let wpColorClass = 'text-fix';
                if (pirep.nearestWpType === 'airport') {
                    wpColorClass = 'text-airport';
                } else if (pirep.nearestWpType === 'navaid') {
                    wpColorClass = 'text-navaid';
                } else if (pirep.nearestWpIsReporting) {
                    wpColorClass = 'text-reporting';
                }
                const wpCell = showWp
                    ? `<td class="${wpColorClass} font-bold" style="padding-left:8px;white-space:nowrap;text-align:right">${wpIdent}[${pirep.nearestWpIndex || '?'}]</td>`
                    : `<td style="padding-left:8px"></td>`;

                return `<tr>${urgentCell}${intensityCell}${typeCell}${altCell}${tempCell}${acftCell}${ageCell}${distCell}${dirCell}${wpCell}</tr>`;
            });

            // Single table for all PIREPs of this type
            const tableHtml = `<table style="border-collapse:collapse;line-height:1.3">${pirepRows.join('')}</table>`;

            // Pass null for waypointsStr since waypoint is in each row
            addWeatherHazard(typeLabel, severity, icon, tableHtml, null, [], null, pireps[0].nearestWpIndex || 999);
        }

        // Density altitude
        if (weatherStatus.densityAlt && weatherStatus.densityAlt.difference > 1000) {
            addHazard('DA', 'warning', '⚠', `+${Math.round(weatherStatus.densityAlt.difference)}' at ${weatherStatus.densityAlt.airport}`);
        }
    } else if (options.enableWinds && !weatherStatus) {
        addHazard('WX', 'info', '...', 'Checking...');
    }

    // Merge overlapping weather hazards within each type, then format and sort
    for (const type of Object.keys(hazardGroups)) {
        // Merge overlapping entries
        hazardGroups[type].details = mergeOverlappingWeatherHazards(hazardGroups[type].details);

        // Format waypoint strings after merging (skip if pre-formatted string exists)
        for (const d of hazardGroups[type].details) {
            if (d.isWeather && !d.waypointsStr && d.affectedWaypoints?.length > 0) {
                d.waypointsStr = window.Weather?.formatAffectedWaypointsRange(d.affectedWaypoints) || '';
                d.firstWaypointIndex = d.affectedWaypoints[0]?.index || 999;
            } else if (d.isWeather && !d.waypointsStr) {
                d.waypointsStr = '';
            }
        }

        // Sort by waypoint order
        hazardGroups[type].details.sort((a, b) =>
            (a.firstWaypointIndex || 999) - (b.firstWaypointIndex || 999)
        );
    }

    // Build HTML
    const types = Object.keys(hazardGroups);

    // Helper to get color class based on hazard type and severity
    function getHazardColor(type, severity) {
        if (severity === 'critical') return 'text-error';
        // All non-critical hazards use yellow for consistency
        return 'text-warning';
    }

    let html = `
        <div class="summary-item" style="border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
            <span class="summary-label text-secondary text-sm">HAZARDS</span>
            <span class="summary-value">`;

    if (types.length === 0) {
        html += `<span class="text-metric font-bold">✓ NONE DETECTED</span>`;
    } else {
        // Summary line: list each type with count if >1
        const items = types.map(type => {
            const g = hazardGroups[type];
            const color = getHazardColor(type, g.severity);
            const countStr = g.details.length > 1 ? ` (${g.details.length})` : '';
            return `<span class="${color}">${g.icon} ${type}${countStr}</span>`;
        });
        html += items.join(' ');
    }

    html += `</span></div>`;

    // Detail rows: grouped by type, sorted by waypoint order within each type
    for (const type of types) {
        const g = hazardGroups[type];
        const color = getHazardColor(type, g.severity);
        const bgStyle = g.severity === 'critical' ? 'background: rgba(255,0,0,0.1);' : '';

        // Each detail line for this type (sorted by waypoint order)
        for (let i = 0; i < g.details.length; i++) {
            const d = g.details[i];
            const showLabel = i === 0; // Only show type label on first row

            if (d.isWeather) {
                // Weather hazard with separate coloring for description, time, and waypoints
                let valueHtml = '';

                // Description in muted color
                if (d.description) {
                    valueHtml += `<span class="text-secondary">${d.description}</span> `;
                }

                // Time in dim color (no brackets)
                if (d.timeStr) {
                    valueHtml += `<span class="text-secondary" style="opacity: 0.7;">${d.timeStr}</span> `;
                }

                // Waypoints (colored by type from formatAffectedWaypointsRange)
                if (d.waypointsStr) {
                    valueHtml += `<span class="font-bold">${d.waypointsStr}</span>`;
                }

                if (!valueHtml) {
                    valueHtml = `<span class="${color}">Route affected</span>`;
                }

                html += `
        <div class="summary-item" style="${bgStyle}">
            <span class="summary-label ${color} text-sm">${showLabel ? `${g.icon} ${type}` : ''}</span>
            <span class="summary-value">${valueHtml}</span>
        </div>`;
            } else {
                // Simple hazard with text detail
                html += `
        <div class="summary-item" style="${bgStyle}">
            <span class="summary-label ${color} text-sm">${showLabel ? `${g.icon} ${type}` : ''}</span>
            <span class="summary-value ${color}">${d.text}</span>
        </div>`;
            }
        }
    }

    return html;
}

/**
 * Update hazard summary with terrain status
 * Called after async terrain analysis completes
 * @param {Object} terrainStatus - Terrain clearance check result
 */
function updateHazardSummaryTerrain(terrainStatus) {
    _currentHazardData.terrainStatus = terrainStatus;
    // Re-render the full route summary with updated terrain status
    refreshHazardDisplay();
}

/**
 * Update hazard summary with weather status
 * Called after async weather analysis completes
 * @param {Object} weatherStatus - Weather hazard analysis result
 */
function updateHazardSummaryWeather(weatherStatus) {
    _currentHazardData.weatherStatus = weatherStatus;
    // Re-render the full route summary with updated weather status
    refreshHazardDisplay();
}

/**
 * Trigger async weather hazard analysis
 * Called after route is calculated if weather checking is enabled
 */
async function analyzeWeatherHazards() {
    const { waypoints, legs, options } = _currentHazardData;

    if (!waypoints || waypoints.length < 2) {
        return;
    }

    // Only analyze if we have an altitude (for SIGMET filtering)
    const filedAltitude = options.altitude || null;

    try {
        // Use WeatherService if available (v3 architecture)
        if (window.App?.weatherService?.analyzeWeatherHazards) {
            const hazards = await window.App.weatherService.analyzeWeatherHazards(
                waypoints,
                legs,
                filedAltitude,
                getDepartureTime()  // Use user-selected departure time
            );
            updateHazardSummaryWeather(hazards);
        } else if (window.WeatherAPI) {
            // Fallback: Direct API call for basic weather checks
            const departure = waypoints[0];
            const destination = waypoints[waypoints.length - 1];
            const depIcao = departure.icao || departure.ident;
            const destIcao = destination.icao || destination.ident;

            const hazards = {
                sigmets: [],
                gairmets: [],
                airportWx: [],
                densityAlt: null
            };

            // Fetch departure and destination METARs
            const [depMetar, destMetar] = await Promise.allSettled([
                depIcao ? window.WeatherAPI.fetchMETAR(depIcao) : Promise.resolve(null),
                destIcao ? window.WeatherAPI.fetchMETAR(destIcao) : Promise.resolve(null)
            ]);

            // Check departure weather
            if (depMetar.status === 'fulfilled' && depMetar.value) {
                const flightCat = window.WeatherAPI.getFlightCategoryFromMETAR(depMetar.value);
                if (flightCat === 'IFR' || flightCat === 'LIFR') {
                    hazards.airportWx.push({
                        icao: depIcao,
                        type: 'DEPARTURE',
                        flightCategory: flightCat
                    });
                }

                // Check density altitude at departure
                if (departure.elevation !== undefined && depMetar.value.temp !== undefined) {
                    const altimeter = depMetar.value.altim || 29.92;
                    const densityAlt = window.Weather?.calculateDensityAltitude(departure.elevation, depMetar.value.temp, altimeter);
                    if (densityAlt && (densityAlt - departure.elevation) > 1000) {
                        hazards.densityAlt = {
                            airport: depIcao,
                            fieldElev: departure.elevation,
                            densityAlt: densityAlt,
                            difference: densityAlt - departure.elevation
                        };
                    }
                }
            }

            // Check destination weather
            if (destMetar.status === 'fulfilled' && destMetar.value) {
                const flightCat = window.WeatherAPI.getFlightCategoryFromMETAR(destMetar.value);
                if (flightCat === 'IFR' || flightCat === 'LIFR') {
                    hazards.airportWx.push({
                        icao: destIcao,
                        type: 'DESTINATION',
                        flightCategory: flightCat
                    });
                }
            }

            updateHazardSummaryWeather(hazards);
        }
    } catch (error) {
        console.error('[UIController] Weather hazard analysis error:', error);
        // Still update to remove "Checking..." indicator
        updateHazardSummaryWeather({ error: true });
    }
}

/**
 * Refresh the hazard display portion of route summary
 */
function refreshHazardDisplay() {
    const hazardContainer = document.getElementById('hazardSummaryInline');
    if (hazardContainer) {
        hazardContainer.innerHTML = buildHazardSummaryHTML(
            _currentHazardData.fuelStatus,
            _currentHazardData.windMetadata,
            _currentHazardData.options,
            _currentHazardData.terrainStatus,
            _currentHazardData.weatherStatus,
            _currentHazardData.windAnalysis,
            _currentHazardData.returnFuel
        );
    }
}

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

    // Add planned altitude if available
    if (options.altitude) {
        summaryHTML += `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">PLANNED ALTITUDE</span>
            <span class="summary-value text-metric font-bold">${options.altitude} FT</span>
        </div>
        `;
    }

    // Add planned speed (TAS) if available
    if (options.tas) {
        summaryHTML += `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">PLANNED SPEED</span>
            <span class="summary-value text-metric font-bold">${options.tas} KT</span>
        </div>
        `;
    }

    // Add total time if available
    if (totalTime !== null && options.enableTime) {
        const totalMinutes = Math.round(totalTime);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        summaryHTML += `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">TIME</span>
            <span class="summary-value text-navaid font-bold">${hours}H ${minutes}M</span>
        </div>
        `;
    }

    // Calculate wind hazards if wind data is available
    let windAnalysis = null;
    if (options.enableWinds && legs && legs.length > 0) {
        windAnalysis = window.Navigation?.analyzeWindHazards(legs, { headwind: 25, crosswind: 15 });
    }

    // Calculate return fuel if fuel planning is enabled
    let returnFuel = null;
    if (options.enableFuel && options.tas && fuelStatus?.burnRate && legs && legs.length > 0) {
        returnFuel = window.Navigation?.calculateReturnFuel(legs, fuelStatus.burnRate, options.tas);
    }

    // Add hazard summary (inline, updatable container for async terrain/weather updates)
    summaryHTML += `<div id="hazardSummaryInline">${buildHazardSummaryHTML(fuelStatus, options.windMetadata, options, null, null, windAnalysis, returnFuel)}</div>`;

    // Add wind data validity if available
    if (options.windMetadata && options.enableWinds) {
        const metadata = options.windMetadata;
        const isWithinWindow = Utils.isWithinUseWindow(metadata.useWindow);
        const validityColor = isWithinWindow ? 'text-metric' : 'text-warning';
        const validityIcon = isWithinWindow ? '✓' : '⚠';

        // Calculate issue age (when AWC created the forecast)
        // metadata.dataBasedOn is like "230000Z" (DDHHMMZ format)
        const issueAge = calculateZuluAge(metadata.dataBasedOn);
        const issueAgeText = Utils.getDataAge(Date.now() - issueAge);

        // Calculate fetch age (when we downloaded it from API)
        const fetchAgeText = Utils.getDataAge(metadata.parsedAt);

        // Determine max age based on forecast period
        const forecastPeriod = metadata.forecastPeriod || '06';
        let maxAge;
        if (forecastPeriod === '24' || forecastPeriod === '12') {
            maxAge = 12 * 60 * 60 * 1000; // 12 hours for 12hr/24hr forecasts
        } else {
            maxAge = 6 * 60 * 60 * 1000; // 6 hours for 6hr forecasts
        }

        const isStale = issueAge > maxAge;
        const ageColor = isStale ? 'text-warning' : 'text-secondary';

        summaryHTML += `
        <div class="summary-item" style="border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
            <span class="summary-label text-secondary text-sm">WINDS DATA (${forecastPeriod}HR)</span>
            <span class="summary-value ${validityColor}">${validityIcon} ${isWithinWindow ? 'CURRENT' : 'OUTSIDE VALID WINDOW'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">VALID FOR</span>
            <span class="summary-value text-secondary">${Utils.formatUseWindow(metadata.useWindow)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">ISSUED</span>
            <span class="summary-value ${ageColor}">${Utils.formatZuluTime(metadata.dataBasedOn)} <span class="text-xs">(${issueAgeText})</span></span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">FETCHED</span>
            <span class="summary-value text-secondary text-xs">${fetchAgeText}</span>
        </div>
        `;
    }

    // Add fuel status if available
    if (fuelStatus) {
        const fuelColor = fuelStatus.isSufficient ? 'text-metric' : 'text-error';
        const fuelIcon = fuelStatus.isSufficient ? '✓' : '!';
        // Calculate trip fuel burn (usable - taxi - finalFob)
        const tripFuelBurn = fuelStatus.usableFuel - fuelStatus.taxiFuel - fuelStatus.finalFob;
        // Always add separator before fuel section (whether or not wind data is present)
        summaryHTML += `
        <div class="summary-item" style="border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
            <span class="summary-label text-secondary text-sm">FUEL STATUS</span>
            <span class="summary-value ${fuelColor} font-bold">${fuelIcon} ${fuelStatus.isSufficient ? 'SUFFICIENT' : 'INSUFFICIENT'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">FUEL BURN</span>
            <span class="summary-value text-secondary">${tripFuelBurn.toFixed(1)} GAL</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">FINAL FOB</span>
            <span class="summary-value ${fuelColor} font-bold">${fuelStatus.finalFob.toFixed(1)} GAL (${Utils.formatDecimalHours(fuelStatus.finalFob / fuelStatus.burnRate)})</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">FUEL RESERVE REQ</span>
            <span class="summary-value text-secondary">${fuelStatus.requiredReserve.toFixed(1)} GAL (${fuelStatus.vfrReserve} MIN)</span>
        </div>
        `;

        // Add return fuel info if available
        if (returnFuel) {
            const returnTimeHrs = Math.floor(returnFuel.returnTime / 60);
            const returnTimeMins = returnFuel.returnTime % 60;

            // Calculate FOB after return trip = finalFob - taxi - return fuel
            const taxiFuel = fuelStatus.taxiFuel || 0;
            const fobAfterReturn = fuelStatus.finalFob - taxiFuel - returnFuel.returnFuel;
            const fobAfterReturnSufficient = fobAfterReturn >= fuelStatus.requiredReserve;
            const fobAfterReturnColor = fobAfterReturnSufficient ? 'text-metric' : 'text-error';

            // Format fuel difference string
            let fuelDiffStr;
            if (Math.abs(returnFuel.fuelDifference) < 0.1) {
                fuelDiffStr = 'same as out';
            } else if (returnFuel.fuelDifference > 0) {
                fuelDiffStr = `+${returnFuel.fuelDifference.toFixed(1)} GAL more`;
            } else {
                fuelDiffStr = `${Math.abs(returnFuel.fuelDifference).toFixed(1)} GAL less`;
            }

            // Format time difference string
            let timeDiffStr;
            if (Math.abs(returnFuel.timeDifference) < 1) {
                timeDiffStr = 'same as out';
            } else if (returnFuel.timeDifference > 0) {
                timeDiffStr = `+${returnFuel.timeDifference}M longer`;
            } else {
                timeDiffStr = `${Math.abs(returnFuel.timeDifference)}M shorter`;
            }

            summaryHTML += `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">RETURN FUEL</span>
            <span class="summary-value text-secondary">${returnFuel.returnFuel.toFixed(1)} GAL (${fuelDiffStr})</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">RETURN TIME</span>
            <span class="summary-value text-secondary">${returnTimeHrs}H ${returnTimeMins}M (${timeDiffStr})</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">FOB AFTER RETURN</span>
            <span class="summary-value ${fobAfterReturnColor} font-bold">${fobAfterReturn.toFixed(1)} GAL (${Utils.formatDecimalHours(fobAfterReturn / fuelStatus.burnRate)})</span>
        </div>
            `;
        }
    }

    elements.routeSummary.innerHTML = summaryHTML;

    // Store hazard data for async terrain/weather updates
    _currentHazardData = {
        fuelStatus,
        windMetadata: options.windMetadata,
        options,
        terrainStatus: null,
        weatherStatus: null,
        windAnalysis,
        returnFuel,
        legs,
        waypoints
    };

    // Trigger async weather hazard analysis (if online)
    if (navigator.onLine) {
        analyzeWeatherHazards();
    }

    // Display wind altitude table if wind correction enabled
    if (options.enableWinds && legs.some(leg => leg.windsAtAltitudes)) {
        displayWindAltitudeTable(legs, options.altitude);
    } else {
        elements.windAltitudeTable.style.display = 'none';
    }

    // Display terrain profile (async - will populate when data is ready)
    displayNavlogTerrainProfile(waypoints, legs, options.altitude);

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
                        `<span class="text-metric text-xs"><strong>${type}</strong> ${freqs.join('/')}</span>`
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
        let airspaceClassHTML = '';
        let airspaceHoursHTML = '';
        if (waypoint.waypointType === 'airport') {
            const arptCode = waypoint.icao || waypoint.ident;
            const airspace = DataManager.getAirspaceClass(arptCode);
            if (airspace) {
                let airspaceText = `CLASS ${airspace.class}`;
                airspaceClassHTML = `<div class="text-reporting text-xs">${airspaceText}</div>`;
                // Add hours/supplement info for right column
                if (airspace.hours) {
                    airspaceHoursHTML = `<div class="text-reporting text-xs">${airspace.hours}</div>`;
                }
            }
        }

        // Fuel types for airports
        let fuelTypesHTML = '';
        if (waypoint.waypointType === 'airport' && waypoint.fuelTypes) {
            fuelTypesHTML = `<div class="text-warning text-xs">FUEL ${waypoint.fuelTypes}</div>`;
        }

        // Charts button for airports (hidden in print, only if charts available)
        let chartsButtonHTML = '';
        if (waypoint.waypointType === 'airport') {
            const icao = code;
            const charts = DataManager.getCharts(icao);
            if (charts && charts.length > 0) {
                const airportName = waypoint.name || code;
                chartsButtonHTML = `<div style="margin-top: 0.25rem;"><button class="btn btn-secondary btn-sm no-print" onclick="ChartsController.showChartsForAirport('${icao}', '${airportName.replace(/'/g, "\\'")}')">CHARTS</button></div>`;
            }
        }

        // Waypoint row
        tableHTML += `
            <tr class="wpt-row">
                <td class="wpt-num text-primary font-bold">${waypointNumber}</td>
                <td class="wpt-info-cell">
                    <div class="${colorClass} wpt-code">${waypoint.waypointType === 'airport' ? `<a href="https://www.airnav.com/airport/${code}" target="_blank" rel="noopener noreferrer" class="airport-link">${code}</a>` : code}</div>
                    <div class="text-xs text-secondary">${typeDisplay}</div>
                    ${airspaceClassHTML}
                    ${chartsButtonHTML}
                </td>
                <td colspan="2">
                    <div class="text-secondary text-xs">${pos}</div>
                    ${elevMagLine}
                    ${airspaceHoursHTML}
                    ${fuelTypesHTML}
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
                const totalMinutes = Math.round(leg.legTime);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
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
                const totalMinutes = Math.round(cumulativeTime);
                const cumHours = Math.floor(totalMinutes / 60);
                const cumMinutes = totalMinutes % 60;
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
                        <span class="leg-secondary">• FOB <span class="${fobColor} font-bold">${leg.fobGal.toFixed(1)}GAL (${Utils.formatDecimalHours(leg.fobTime)})</span></span>
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
// NAVLOG TERRAIN PROFILE
// ============================================

/**
 * Analyze terrain for route and update hazard summary
 * Note: Profile plot removed - only provides hazard analysis
 * @param {Array} waypoints - Route waypoints
 * @param {Array} legs - Route legs
 * @param {number|null} plannedAltitude - Planned cruise altitude in feet
 */
async function displayNavlogTerrainProfile(waypoints, legs, plannedAltitude) {
    // Need at least 2 waypoints for terrain analysis
    if (!waypoints || waypoints.length < 2) {
        updateHazardSummaryTerrain({ status: 'UNKNOWN' });
        return;
    }

    try {
        // Ensure TerrainAnalyzer is available
        if (!window.TerrainAnalyzer) {
            updateHazardSummaryTerrain({ status: 'UNKNOWN' });
            return;
        }

        // Load MORA data if not already loaded
        if (!window.TerrainAnalyzer.isMORADataLoaded()) {
            await window.TerrainAnalyzer.loadMORAData();
        }

        // Analyze terrain for the route
        const analysis = await window.TerrainAnalyzer.analyzeRouteTerrain(waypoints, legs);

        if (analysis.error) {
            updateHazardSummaryTerrain({ status: 'UNKNOWN' });
            return;
        }

        // Get data source from analysis (offline_mora or elevation_api)
        const dataSource = analysis.statistics?.dataSource || 'unknown';
        const isMORA = dataSource === 'offline_mora';

        // Update hazard summary with terrain status
        if (plannedAltitude) {
            const profile = analysis.terrainProfile || [];
            let maxMORA = 0;
            let hasConflict = false;

            for (const point of profile) {
                // Use MORA value directly - it already includes terrain + obstacle + clearance buffer
                const mora = point.mora || 0;
                if (mora > maxMORA) maxMORA = mora;
                if (plannedAltitude < mora) hasConflict = true;
            }

            // MORA already includes 1000'/2000' clearance buffer - compare altitude directly
            const terrainStatus = hasConflict
                ? { status: 'UNSAFE', deficit: maxMORA - plannedAltitude, maxMORA, isMORA }
                : { status: 'OK', margin: plannedAltitude - maxMORA, maxMORA, isMORA };

            updateHazardSummaryTerrain(terrainStatus);
        } else {
            // No altitude specified - clear terrain hazard
            updateHazardSummaryTerrain({ status: 'UNKNOWN' });
        }

    } catch (error) {
        console.error('[UIController] Terrain analysis error:', error);
        updateHazardSummaryTerrain({ status: 'UNKNOWN' });
    }
}

/**
 * Update terrain status (legacy function - now unused)
 * Status display removed along with terrain profile plot
 */
function updateNavlogTerrainStatus(statusEl, analysis, plannedAltitude) {
    if (!statusEl) return;

    const profile = analysis.terrainProfile || [];

    // Find the max MORA along the route (MORA already includes clearance buffer)
    let maxMORA = 0;
    for (const point of profile) {
        const mora = point.mora || 0;
        if (mora > maxMORA) {
            maxMORA = mora;
        }
    }

    if (!plannedAltitude) {
        statusEl.textContent = `MAX MORA: ${maxMORA || '—'}' | Enter altitude to check clearance`;
        statusEl.className = 'terrain-status';
        return;
    }

    // Check altitude against MORA at each point along the route
    // MORA already includes terrain + obstacle + clearance buffer
    let hasConflict = false;
    let maxConflict = 0;

    for (const point of profile) {
        const mora = point.mora || 0;
        if (plannedAltitude < mora) {
            hasConflict = true;
            if (mora > maxConflict) {
                maxConflict = mora;
            }
        }
    }

    if (!hasConflict) {
        const margin = plannedAltitude - maxMORA;
        statusEl.textContent = `✓ CLEAR: ${margin}' above MORA`;
        statusEl.className = 'terrain-status ok';
    } else {
        const deficit = maxConflict - plannedAltitude;
        statusEl.textContent = `✗ TERRAIN: ${deficit}' below! MORA: ${maxConflict}'`;
        statusEl.className = 'terrain-status unsafe';
    }
}

// ============================================
// NAVLOG RESTORE
// ============================================

function restoreNavlog(navlogData) {
    const { routeString, waypoints, legs, totalDistance, totalTime, fuelStatus, options, windMetadata } = navlogData;

    // Restore ICAO-style route inputs (departure/route/destination)
    if (navlogData.departure && navlogData.destination) {
        // New format: restore to separate fields
        setRouteInputs(navlogData.departure, navlogData.routeMiddle, navlogData.destination);
    } else {
        // Legacy format: parse routeString to extract departure and destination
        const parsed = parseRouteString(routeString);
        if (parsed) {
            setRouteInputs(parsed.departure, parsed.routeMiddle, parsed.destination);
        } else {
            // Fallback: put everything in routeInput for backward compatibility
            setRouteInputs('', routeString, '');
        }
    }

    // Restore optional feature settings using setters (updates both UI and internal state)
    if (options.enableWinds && elements.setWindsEnabled) {
        elements.setWindsEnabled(true);
        if (options.altitude) elements.altitudeInput.value = options.altitude;
        if (options.tas) elements.tasInput.value = options.tas;
        setRadioSelection('.radio-btn[data-period]', 'period', options.forecastPeriod);
    }

    if (options.enableFuel && elements.setFuelEnabled) {
        elements.setFuelEnabled(true);
        if (options.usableFuel) elements.usableFuelInput.value = options.usableFuel;
        if (options.taxiFuel) elements.taxiFuelInput.value = options.taxiFuel;
        if (options.burnRate) elements.burnRateInput.value = options.burnRate;
        setRadioSelection('.radio-btn[data-reserve]', 'reserve', options.vfrReserve);
    }

    // Display results - include windMetadata in options if available
    const displayOptions = { ...options };
    if (windMetadata) {
        displayOptions.windMetadata = windMetadata;
    }
    displayResults(waypoints, legs, totalDistance, totalTime, fuelStatus, displayOptions);

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

    // Network status
    isOnline: () => navigator.onLine,

    // Status
    updateStatus,
    showDataInfo,
    populateInspection,
    updateDatabaseStatus,
    showDataWarning,
    hideDataWarning,

    // Input controls
    enableRouteInput,
    disableRouteInput,
    clearRoute,

    // Departure time
    getDepartureTime,
    updateDepartureTimeDisplay,
    handleDepartureTimeChange,

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

    // Hazard updates (async)
    updateHazardSummaryTerrain,
    updateHazardSummaryWeather,
    analyzeWeatherHazards,

    // History
    displayQueryHistory
};
