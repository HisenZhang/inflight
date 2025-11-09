// UI Controller Module - Handles all UI updates and interactions

// DOM elements (initialized in init())
let elements = {};

// Autocomplete state
let selectedAutocompleteIndex = -1;
let autocompleteResults = [];

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
        inspectDbBtn: document.getElementById('inspectDbBtn'),
        reindexCacheBtn: document.getElementById('reindexCacheBtn'),
        clearDataBtn: document.getElementById('clearDataBtn'),
        dataInspection: document.getElementById('dataInspection'),
        inspectionContent: document.getElementById('inspectionContent'),

        // Input elements
        routeInput: document.getElementById('routeInput'),
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

        // Results elements
        resultsSection: document.getElementById('resultsSection'),
        routeSummary: document.getElementById('routeSummary'),
        windAltitudeTable: document.getElementById('windAltitudeTable'),
        navlogTable: document.getElementById('navlogTable'),

        // Tactical display elements
        tacticalDisplay: document.getElementById('tacticalDisplay'),
        tacticalMap: document.getElementById('tacticalMap'),
        tacticalRouteInfo: document.querySelector('.tactical-route-info'),
        selectedPointInfo: document.getElementById('selectedPointInfo'),
        currentInstruction: document.getElementById('currentInstruction'),
        generateBriefingBtn: document.getElementById('generateBriefingBtn'),

        // Autocomplete elements
        autocompleteDropdown: document.getElementById('autocompleteDropdown'),

        // History elements
        queryHistoryDiv: document.getElementById('queryHistory'),
        historyList: document.getElementById('historyList')
    };
}

// ============================================
// STATUS & DATA INFO
// ============================================

function updateStatus(message, type) {
    elements.statusText.textContent = message;
    elements.statusBox.className = 'status-box status-' + type;

    if (type === 'success') {
        elements.loadDataBtn.style.display = 'none';
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
        timestampText = `<p><strong>DB UPDATE:</strong> ${dateStr} ${timeStr} UTC (${daysAgo}D AGO)</p>`;
    }

    elements.dataInfo.innerHTML = `
        <p><strong>AIRPORTS:</strong> ${totalAirports.toLocaleString()} | <strong>NAVAIDS:</strong> ${totalNavaids.toLocaleString()} | <strong>FIXES:</strong> ${totalFixes.toLocaleString()} | <strong>STATUS:</strong> READY</p>
        ${timestampText}
    `;

    // Show inspect button
    elements.inspectDbBtn.style.display = 'inline-block';

    // Setup inspect button toggle
    elements.inspectDbBtn.addEventListener('click', toggleInspection);
}

function toggleInspection() {
    const isHidden = elements.dataInspection.classList.contains('hidden');

    if (isHidden) {
        // Show inspection panel
        elements.dataInspection.classList.remove('hidden');
        elements.inspectDbBtn.textContent = 'CLOSE';
        populateInspection();
    } else {
        // Hide inspection panel
        elements.dataInspection.classList.add('hidden');
        elements.inspectDbBtn.textContent = 'INSPECT';
    }
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

    elements.inspectionContent.innerHTML = `
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
            <div><span class="inspection-label">Winds Aloft API:</span><span class="text-warning">⚠ Requires internet</span></div>
        </div>
    `;
}

// ============================================
// INPUT CONTROLS
// ============================================

function enableRouteInput() {
    elements.routeInput.disabled = false;
    elements.calculateBtn.disabled = false;

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
    elements.routeInput.value = '';
    elements.resultsSection.style.display = 'none';
    hideAutocomplete();
}

// ============================================
// FEATURE TOGGLES
// ============================================

function setupFeatureToggles() {
    let windsEnabled = false;
    let fuelEnabled = false;

    // Wind correction & time toggle (merged)
    elements.enableWindsToggle.addEventListener('click', () => {
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

    // Fuel planning toggle
    elements.enableFuelToggle.addEventListener('click', () => {
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
}

// ============================================
// QUERY HISTORY
// ============================================

function displayQueryHistory() {
    const history = DataManager.loadQueryHistory();

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
            elements.routeInput.value = query;
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
    const words = beforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1].toUpperCase();

    if (currentWord.length < 2) {
        hideAutocomplete();
        return;
    }

    // Search for matches
    const results = DataManager.searchWaypoints(currentWord);
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
        let colorClass = 'type-navaid';
        if (result.waypointType === 'airport') colorClass = 'type-airport';
        else if (result.waypointType === 'fix') colorClass = 'type-fix';

        html += `
            <div class="autocomplete-item ${colorClass}" data-index="${index}">
                <span class="code">${result.code}</span>
                <span class="name">${result.type} - ${result.name}</span>
                <span class="location">${result.location || ''}</span>
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

function selectAutocompleteItem(index) {
    const result = autocompleteResults[index];
    if (!result) return;

    const value = elements.routeInput.value;
    const cursorPos = elements.routeInput.selectionStart;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);

    const words = beforeCursor.split(/\s+/);
    words[words.length - 1] = result.fullCode;
    const newBefore = words.join(' ');

    elements.routeInput.value = newBefore + ' ' + afterCursor;
    const newPos = newBefore.length + 1;
    elements.routeInput.setSelectionRange(newPos, newPos);
    elements.routeInput.focus();

    hideAutocomplete();
}

// ============================================
// RESULTS DISPLAY
// ============================================

function displayResults(waypoints, legs, totalDistance, totalTime = null, fuelStatus = null, options = {}) {
    // Route summary
    const routeCodes = waypoints.map(w => RouteCalculator.getWaypointCode(w)).join(' ');

    let summaryHTML = `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">ROUTE</span>
            <span class="summary-value text-navaid font-bold">${routeCodes}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">TOTAL DISTANCE</span>
            <span class="summary-value text-navaid font-bold">${totalDistance.toFixed(1)} NM</span>
        </div>
    `;

    // Add total time if available
    if (totalTime !== null && options.enableTime) {
        const hours = Math.floor(totalTime / 60);
        const minutes = Math.round(totalTime % 60);
        summaryHTML += `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">TOTAL TIME</span>
            <span class="summary-value text-navaid font-bold">${hours}H ${minutes}M</span>
        </div>
        `;
    }

    summaryHTML += `
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">WAYPOINTS</span>
            <span class="summary-value text-navaid font-bold">${waypoints.length}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label text-secondary text-sm">LEGS</span>
            <span class="summary-value text-navaid font-bold">${legs.length}</span>
        </div>
    `;

    // Add fuel status if available
    if (fuelStatus) {
        const fuelColor = fuelStatus.isSufficient ? 'text-metric' : 'text-error';
        const fuelIcon = fuelStatus.isSufficient ? '✓' : '⚠';
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
        const colorClass = waypoint.waypointType === 'airport' ? 'text-navaid' : 'text-navaid';
        const waypointNumber = index + 1;

        // Position
        const pos = `${RouteCalculator.formatCoordinate(waypoint.lat, 'lat')} ${RouteCalculator.formatCoordinate(waypoint.lon, 'lon')}`;

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
            const formattedFreq = RouteCalculator.formatNavaidFrequency(waypoint.frequency, waypoint.type);
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

        const typeDisplay = waypoint.waypointType === 'airport' ? 'AIRPORT' : waypoint.type;

        // Build elevation and magnetic variation line
        let elevMagLine = '';
        if (elev) {
            elevMagLine = `<div class="text-airport text-xs">ELEV ${elev} | ${magVarDisplay}</div>`;
        } else {
            elevMagLine = `<div class="text-airport text-xs">${magVarDisplay}</div>`;
        }

        // Waypoint row
        tableHTML += `
            <tr class="wpt-row">
                <td class="wpt-num text-primary font-bold">${waypointNumber}</td>
                <td class="wpt-info-cell">
                    <div class="${colorClass} wpt-code">${code}</div>
                    <div class="text-xs text-secondary">${typeDisplay}</div>
                </td>
                <td colspan="2">
                    <div class="text-secondary text-xs">${pos}</div>
                    ${elevMagLine}
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
            const cardinal = RouteCalculator.getCardinalDirection(leg.trueCourse);

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

                windSection = '<div class="leg-section">';
                windSection += `<span class="leg-secondary">WIND <span class="text-airport">${windDir}°/${windSpd}KT</span></span>`;
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
        <h2 class="font-bold text-primary">WINDS ALOFT AT ALTITUDE</h2>
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

    // Add row for each leg
    legs.forEach((leg, index) => {
        const from = RouteCalculator.getWaypointCode(leg.from);
        const to = RouteCalculator.getWaypointCode(leg.to);

        tableHTML += `<tr>`;
        tableHTML += `<td class="leg-col"><span class="font-bold">LEG ${index + 1}</span><br><span class="text-xs text-secondary">${from}→${to}</span></td>`;

        altitudes.forEach(alt => {
            const isFiledAlt = alt === filedAltitude;

            if (leg.windsAtAltitudes && leg.windsAtAltitudes[alt]) {
                const wind = leg.windsAtAltitudes[alt];
                const dir = String(Math.round(wind.direction)).padStart(3, '0');
                const spd = Math.round(wind.speed);
                const cellClass = isFiledAlt ? 'filed-altitude text-metric font-bold' : 'text-secondary';
                tableHTML += `<td class="wind-cell ${cellClass}">${dir}°/${spd}KT</td>`;
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
// TACTICAL NAVIGATION DISPLAY
// ============================================

function displayTacticalNavigation(waypoints, legs, options = {}) {
    if (waypoints.length < 2) {
        elements.tacticalDisplay.style.display = 'none';
        return;
    }

    // Show tactical display
    elements.tacticalDisplay.style.display = 'block';

    // Update route info
    const routeCodes = waypoints.map(w => RouteCalculator.getWaypointCode(w)).join(' ');
    elements.tacticalRouteInfo.textContent = `Route: ${routeCodes} (${waypoints.length} waypoints)`;

    // Generate SVG map
    generateTacticalMap(waypoints, legs);

    // Update current instruction (first leg)
    if (legs.length > 0) {
        updateCurrentInstruction(legs[0], options);
    }
}

function generateTacticalMap(waypoints, legs) {
    // Calculate bounds for projection
    const lats = waypoints.map(w => w.lat);
    const lons = waypoints.map(w => w.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Add padding
    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;
    const padding = 0.15; // 15% padding

    const bounds = {
        minLat: minLat - latRange * padding,
        maxLat: maxLat + latRange * padding,
        minLon: minLon - lonRange * padding,
        maxLon: maxLon + lonRange * padding
    };

    // SVG dimensions
    const width = 1000;
    const height = 500;

    // Project lat/lon to SVG coordinates
    const project = (lat, lon) => {
        const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
        const y = height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
        return { x, y };
    };

    // Start SVG
    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Add scale reference in top right
    svg += `<text x="${width - 10}" y="20" text-anchor="end" fill="#cccccc" font-size="10" font-family="Roboto Mono">20 KT</text>`;

    // Draw route lines
    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const from = project(leg.from.lat, leg.from.lon);
        const to = project(leg.to.lat, leg.to.lon);

        // Determine if this is a direct route or reference line
        const isDashed = i > 0; // First leg is solid, rest can be dashed for visual effect
        const lineClass = isDashed ? 'route-line route-line-dashed' : 'route-line';

        svg += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${lineClass}"/>`;
    }

    // Draw waypoints
    waypoints.forEach((waypoint, index) => {
        const pos = project(waypoint.lat, waypoint.lon);
        const code = RouteCalculator.getWaypointCode(waypoint);
        const isAirport = waypoint.waypointType === 'airport';
        const color = isAirport ? '#00ffff' : (waypoint.waypointType === 'fix' ? '#ffffff' : '#ff00ff');

        // Waypoint circle
        svg += `<g class="map-waypoint" data-index="${index}">`;
        svg += `<circle class="waypoint-circle" cx="${pos.x}" cy="${pos.y}" r="5" fill="${color}" stroke="${color}" stroke-width="2"/>`;

        // Label positioning (above the waypoint)
        const labelY = pos.y - 12;
        svg += `<text class="waypoint-label" x="${pos.x}" y="${labelY}" text-anchor="middle" fill="${color}">${code}</text>`;
        svg += `</g>`;
    });

    svg += `</svg>`;

    // Insert SVG
    elements.tacticalMap.innerHTML = svg;

    // Add click handlers to waypoints
    const waypointElements = elements.tacticalMap.querySelectorAll('.map-waypoint');
    waypointElements.forEach(el => {
        el.addEventListener('click', () => {
            const index = parseInt(el.getAttribute('data-index'));
            showPointInfo(waypoints[index], legs, index);
        });
    });
}

function showPointInfo(waypoint, legs, index) {
    const code = RouteCalculator.getWaypointCode(waypoint);
    const pos = `${RouteCalculator.formatCoordinate(waypoint.lat, 'lat')} ${RouteCalculator.formatCoordinate(waypoint.lon, 'lon')}`;

    let infoHTML = `
        <div class="info-row">
            <span class="info-label">IDENTIFIER:</span>
            <span class="info-value">${code}</span>
        </div>
        <div class="info-row">
            <span class="info-label">TYPE:</span>
            <span class="info-value">${waypoint.waypointType.toUpperCase()}</span>
        </div>
        <div class="info-row">
            <span class="info-label">POSITION:</span>
            <span class="info-value">${pos}</span>
        </div>
    `;

    if (waypoint.elevation !== null && !isNaN(waypoint.elevation)) {
        infoHTML += `
            <div class="info-row">
                <span class="info-label">ELEVATION:</span>
                <span class="info-value">${Math.round(waypoint.elevation)} FT</span>
            </div>
        `;
    }

    if (waypoint.magVar !== null && waypoint.magVar !== undefined) {
        const magVarValue = Math.abs(waypoint.magVar).toFixed(1);
        const magVarDir = waypoint.magVar >= 0 ? 'E' : 'W';
        infoHTML += `
            <div class="info-row">
                <span class="info-label">MAG VAR:</span>
                <span class="info-value">${magVarValue}° ${magVarDir}</span>
            </div>
        `;
    }

    // Show leg info if this is not the last waypoint
    if (index < legs.length) {
        const leg = legs[index];
        infoHTML += `
            <div class="info-row">
                <span class="info-label">NEXT LEG:</span>
                <span class="info-value">${leg.distance.toFixed(1)} NM @ ${Math.round(leg.trueCourse)}° TRUE</span>
            </div>
        `;
        if (leg.magHeading !== null) {
            infoHTML += `
                <div class="info-row">
                    <span class="info-label">MAG HEADING:</span>
                    <span class="info-value">${Math.round(leg.magHeading)}°</span>
                </div>
            `;
        }
    }

    // Show frequencies for airports
    if (waypoint.waypointType === 'airport') {
        const frequencies = DataManager.getFrequencies(waypoint.icao || waypoint.ident);
        if (frequencies.length > 0) {
            const freqList = frequencies.slice(0, 3).map(f => `${f.type} ${f.frequency.toFixed(3)}`).join(', ');
            infoHTML += `
                <div class="info-row">
                    <span class="info-label">FREQUENCIES:</span>
                    <span class="info-value">${freqList}</span>
                </div>
            `;
        }
    }

    // Update UI
    document.querySelector('.info-placeholder').style.display = 'none';
    document.querySelector('.info-content').style.display = 'block';
    document.querySelector('.info-content').innerHTML = infoHTML;
}

function updateCurrentInstruction(firstLeg, options) {
    const fromCode = RouteCalculator.getWaypointCode(firstLeg.from);
    const toCode = RouteCalculator.getWaypointCode(firstLeg.to);

    // Instruction text
    const instructionText = `PROCEED DIRECT TO ${toCode}`;
    elements.currentInstruction.querySelector('.instruction-text').textContent = instructionText;

    // Details
    elements.currentInstruction.querySelector('.next-wp').textContent = toCode;

    const heading = firstLeg.magHeading !== null ? Math.round(firstLeg.magHeading) : Math.round(firstLeg.trueCourse);
    elements.currentInstruction.querySelector('.req-hdg').textContent = String(heading).padStart(3, '0') + '°';

    elements.currentInstruction.querySelector('.dist-nm').textContent = firstLeg.distance.toFixed(1);

    // ETA
    if (firstLeg.legTime !== undefined) {
        const now = new Date();
        const etaMs = now.getTime() + firstLeg.legTime * 60 * 1000;
        const eta = new Date(etaMs);
        const hours = String(eta.getHours()).padStart(2, '0');
        const minutes = String(eta.getMinutes()).padStart(2, '0');
        elements.currentInstruction.querySelector('.eta-time').textContent = `${hours}:${minutes}`;
    } else {
        elements.currentInstruction.querySelector('.eta-time').textContent = '--:--';
    }

    // Secondary info
    if (options.tas) {
        elements.currentInstruction.querySelector('.tas-value').textContent = Math.round(options.tas);
    } else {
        elements.currentInstruction.querySelector('.tas-value').textContent = '--';
    }

    if (firstLeg.groundSpeed !== undefined) {
        elements.currentInstruction.querySelector('.gs-value').textContent = Math.round(firstLeg.groundSpeed);
    } else {
        elements.currentInstruction.querySelector('.gs-value').textContent = '--';
    }

    if (firstLeg.windDir !== undefined && firstLeg.windSpd !== undefined) {
        const windDir = String(Math.round(firstLeg.windDir)).padStart(3, '0');
        const windSpd = Math.round(firstLeg.windSpd);
        elements.currentInstruction.querySelector('.wind-vector').textContent = `${windDir}° / ${windSpd} KT`;
    } else {
        elements.currentInstruction.querySelector('.wind-vector').textContent = '---° / -- KT';
    }
}

// ============================================
// EXPORTS
// ============================================

window.UIController = {
    // Initialization
    init,
    setupFeatureToggles,

    // Elements access
    getElements: () => elements,

    // Status
    updateStatus,
    showDataInfo,

    // Input controls
    enableRouteInput,
    disableRouteInput,
    clearRoute,

    // Autocomplete
    handleAutocompleteInput,
    handleAutocompleteKeydown,
    hideAutocomplete,

    // Results
    displayResults,
    displayTacticalNavigation,

    // History
    displayQueryHistory
};
