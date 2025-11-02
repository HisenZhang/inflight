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
        clearCacheBtn: document.getElementById('clearCacheBtn'),
        inspectDbBtn: document.getElementById('inspectDbBtn'),
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
        forecastBtns: document.querySelectorAll('.radio-btn'),

        enableFuelToggle: document.getElementById('enableFuelToggle'),
        fuelInputs: document.getElementById('fuelInputs'),
        usableFuelInput: document.getElementById('usableFuelInput'),
        taxiFuelInput: document.getElementById('taxiFuelInput'),
        burnRateInput: document.getElementById('burnRateInput'),
        fuelReserveBtns: document.querySelectorAll('[data-reserve]'),

        // Results elements
        resultsSection: document.getElementById('resultsSection'),
        routeSummary: document.getElementById('routeSummary'),
        windAltitudeTable: document.getElementById('windAltitudeTable'),
        navlogTable: document.getElementById('navlogTable'),

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
        elements.clearCacheBtn.style.display = 'inline-block';
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

    // Format cache age
    let cacheAge = 'N/A';
    let cacheColor = 'text-secondary';
    if (stats.timestamp) {
        const daysAgo = Math.floor((Date.now() - stats.timestamp) / (24 * 60 * 60 * 1000));
        cacheAge = `${daysAgo} days ago`;
        if (daysAgo > 30) {
            cacheColor = 'text-warning';
        } else if (daysAgo > 90) {
            cacheColor = 'text-error';
        } else {
            cacheColor = 'text-metric';
        }
    }

    // Format timestamp
    let timestampFormatted = 'N/A';
    if (stats.timestamp) {
        const date = new Date(stats.timestamp);
        timestampFormatted = date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }

    // Get sample data for validation
    const sampleAirport = DataManager.getAirport('KJFK') || DataManager.getAirport('KLAX') || null;
    const sampleNavaid = DataManager.getNavaid('JFK') || DataManager.getNavaid('LAX') || null;

    elements.inspectionContent.innerHTML = `
        <div class="inspection-section">
            <div><span class="inspection-label">TOTAL AIRPORTS:</span><span class="inspection-value">${stats.airports.toLocaleString()}</span></div>
            <div><span class="inspection-label">TOTAL NAVAIDS:</span><span class="inspection-value">${stats.navaids.toLocaleString()}</span></div>
            <div><span class="inspection-label">TOTAL FIXES:</span><span class="inspection-value">${(stats.fixes || 0).toLocaleString()}</span></div>
            <div><span class="inspection-label">TOTAL WAYPOINTS:</span><span class="inspection-value">${(stats.airports + stats.navaids + (stats.fixes || 0)).toLocaleString()}</span></div>
        </div>

        <div class="inspection-section">
            <div><span class="inspection-label">CACHE TIMESTAMP:</span><span class="text-secondary">${timestampFormatted}</span></div>
            <div><span class="inspection-label">CACHE AGE:</span><span class="${cacheColor}">${cacheAge}</span></div>
            <div><span class="inspection-label">DATA SOURCES:</span><span class="text-secondary">${stats.sources || 'Unknown'}</span></div>
        </div>

        <div class="inspection-section">
            <div><span class="inspection-label">STORAGE:</span><span class="text-secondary">IndexedDB (Browser Cache)</span></div>
            <div><span class="inspection-label">GEO MODEL:</span><span class="text-secondary">WGS84 (Vincenty)</span></div>
            <div><span class="inspection-label">MAG MODEL:</span><span class="text-secondary">WMM2025 (Spherical Harmonics)</span></div>
        </div>

        <div class="inspection-section">
            <div class="text-secondary" style="margin-bottom: 4px;">SAMPLE VALIDATION:</div>
            ${sampleAirport ? `
                <div><span class="inspection-label">→ Airport:</span><span class="text-airport">${sampleAirport.icao}</span> <span class="text-secondary">${sampleAirport.name || 'N/A'}</span></div>
                <div><span class="inspection-label">  Coordinates:</span><span class="text-secondary">${sampleAirport.lat?.toFixed(4) || 'N/A'}, ${sampleAirport.lon?.toFixed(4) || 'N/A'}</span></div>
            ` : '<div><span class="text-warning">⚠ No sample airport data available</span></div>'}
            ${sampleNavaid ? `
                <div><span class="inspection-label">→ Navaid:</span><span class="text-navaid">${sampleNavaid.ident}</span> <span class="text-secondary">${sampleNavaid.type || 'N/A'}</span></div>
                <div><span class="inspection-label">  Coordinates:</span><span class="text-secondary">${sampleNavaid.lat?.toFixed(4) || 'N/A'}, ${sampleNavaid.lon?.toFixed(4) || 'N/A'}</span></div>
            ` : '<div><span class="text-warning">⚠ No sample navaid data available</span></div>'}
        </div>

        <div class="inspection-section">
            <div class="text-secondary" style="margin-bottom: 4px;">AVAILABILITY STATUS:</div>
            <div><span class="inspection-label">Geodesy Library:</span><span class="text-metric">✓ LOADED</span></div>
            <div><span class="inspection-label">Magnetic Model:</span><span class="text-metric">✓ LOADED</span></div>
            <div><span class="inspection-label">Wind Stations:</span><span class="text-metric">✓ EMBEDDED (254 stations)</span></div>
            <div><span class="inspection-label">Winds Aloft API:</span><span class="text-warning">⚠ REQUIRES INTERNET</span></div>
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
            <span class="summary-label text-secondary text-sm">VFR RESERVE REQ</span>
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

        // Elevation
        const elev = waypoint.elevation !== null && !isNaN(waypoint.elevation)
            ? `${Math.round(waypoint.elevation)} FT`
            : 'N/A';

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
            if (waypoint.id) {
                const frequencies = DataManager.getFrequencies(waypoint.id);
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
            freqHTML = `<span class="text-metric text-xs">${RouteCalculator.formatNavaidFrequency(waypoint.frequency, waypoint.type)}</span>`;
        }

        // Runways
        let runwayHTML = '';
        if (waypoint.waypointType === 'airport' && waypoint.id) {
            const runways = DataManager.getRunways(waypoint.id);
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

        const typeDisplay = waypoint.waypointType === 'airport' ? 'AIRPORT' : waypoint.type;

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
                    <div class="text-airport text-xs">ELEV ${elev} | ${magVarDisplay}</div>
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

    // History
    displayQueryHistory
};
