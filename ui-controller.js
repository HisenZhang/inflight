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

        // Input elements
        routeInput: document.getElementById('routeInput'),
        calculateBtn: document.getElementById('calculateBtn'),
        clearRouteBtn: document.getElementById('clearRouteBtn'),

        // Optional feature elements
        enableWinds: document.getElementById('enableWinds'),
        windInputs: document.getElementById('windInputs'),
        altitudeInput: document.getElementById('altitudeInput'),
        departureInput: document.getElementById('departureInput'),

        enableTime: document.getElementById('enableTime'),
        timeInputs: document.getElementById('timeInputs'),
        tasInput: document.getElementById('tasInput'),

        // Results elements
        resultsSection: document.getElementById('resultsSection'),
        routeSummary: document.getElementById('routeSummary'),
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

    let timestampText = '';
    if (stats.timestamp) {
        const date = new Date(stats.timestamp);
        const daysAgo = Math.floor((Date.now() - stats.timestamp) / (24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0];
        timestampText = `<p><strong>DB UPDATE:</strong> ${dateStr} ${timeStr} UTC (${daysAgo}D AGO)</p>`;
    }

    elements.dataInfo.innerHTML = `
        <p><strong>AIRPORTS:</strong> ${totalAirports.toLocaleString()} | <strong>NAVAIDS:</strong> ${totalNavaids.toLocaleString()} | <strong>STATUS:</strong> READY</p>
        ${timestampText}
    `;
}

// ============================================
// INPUT CONTROLS
// ============================================

function enableRouteInput() {
    elements.routeInput.disabled = false;
    elements.calculateBtn.disabled = false;

    // Enable inputs based on feature toggles
    if (elements.enableWinds.checked) {
        elements.altitudeInput.disabled = false;
        elements.departureInput.disabled = false;
    }

    if (elements.enableTime.checked) {
        elements.tasInput.disabled = false;
    }
}

function disableRouteInput() {
    elements.routeInput.disabled = true;
    elements.altitudeInput.disabled = true;
    elements.tasInput.disabled = true;
    elements.departureInput.disabled = true;
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
    // Wind correction toggle
    elements.enableWinds.addEventListener('change', () => {
        if (elements.enableWinds.checked) {
            elements.windInputs.classList.remove('hidden');
            if (!elements.routeInput.disabled) {
                elements.altitudeInput.disabled = false;
                elements.departureInput.disabled = false;
            }
        } else {
            elements.windInputs.classList.add('hidden');
            elements.altitudeInput.disabled = true;
            elements.departureInput.disabled = true;
        }
    });

    // Time estimation toggle
    elements.enableTime.addEventListener('change', () => {
        if (elements.enableTime.checked) {
            elements.timeInputs.classList.remove('hidden');
            if (!elements.routeInput.disabled) {
                elements.tasInput.disabled = false;
            }
        } else {
            elements.timeInputs.classList.add('hidden');
            elements.tasInput.disabled = true;
        }
    });
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
        const colorClass = result.waypointType === 'airport' ? 'type-airport' : 'type-navaid';
        html += `
            <div class="autocomplete-item ${colorClass}" data-index="${index}">
                <span class="code">${result.code}</span>
                <span class="name">${result.type} - ${result.name}</span>
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

function displayResults(waypoints, legs, totalDistance, totalTime = null, options = {}) {
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

    elements.routeSummary.innerHTML = summaryHTML;

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
                <td>
                    <div class="${colorClass} font-bold">${code}</div>
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
            const trueTrack = String(Math.round(leg.trueBearing)).padStart(3, '0');
            const cardinal = RouteCalculator.getCardinalDirection(leg.trueBearing);
            const magTrackDisplay = leg.magBearing !== null
                ? String(Math.round(leg.magBearing)).padStart(3, '0') + '°'
                : '-';

            // Build leg info line
            let legInfoHTML = `
                <span class="leg-item">LEG: <span class="text-navaid font-bold">${legDist}</span> NM</span>
                <span class="leg-item">TRUE: <span class="text-navaid font-bold">${trueTrack}°</span> ${cardinal}</span>
                <span class="leg-item">MAG: <span class="text-airport font-bold">${magTrackDisplay}</span></span>
            `;

            // Add wind data if available
            if (leg.windDir !== undefined && leg.windSpd !== undefined) {
                const windDir = String(Math.round(leg.windDir)).padStart(3, '0');
                const windSpd = Math.round(leg.windSpd);
                const headwind = leg.headwind ? Math.round(leg.headwind) : 0;
                const crosswind = leg.crosswind ? Math.round(Math.abs(leg.crosswind)) : 0;
                const crosswindDir = leg.crosswind > 0 ? 'R' : 'L';

                legInfoHTML += `
                <span class="leg-item">WIND: <span class="text-metric font-bold">${windDir}°/${windSpd}</span> KT</span>
                <span class="leg-item">HW: <span class="text-metric font-bold">${headwind >= 0 ? '+' : ''}${headwind}</span> | XW: <span class="text-metric font-bold">${crosswind}${crosswindDir}</span></span>
                `;
            }

            // Add ground speed and time if available
            if (leg.groundSpeed !== undefined && leg.legTime !== undefined) {
                const gs = Math.round(leg.groundSpeed);
                const hours = Math.floor(leg.legTime / 60);
                const minutes = Math.round(leg.legTime % 60);
                const timeDisplay = hours > 0 ? `${hours}H ${minutes}M` : `${minutes}M`;

                legInfoHTML += `
                <span class="leg-item">GS: <span class="text-metric font-bold">${gs}</span> KT</span>
                <span class="leg-item">TIME: <span class="text-metric font-bold">${timeDisplay}</span></span>
                `;
            }

            legInfoHTML += `
                <span class="leg-item">CUM: <span class="text-navaid font-bold">${cumulativeDistance.toFixed(1)}</span> NM</span>
            `;

            tableHTML += `
                <tr class="leg-row">
                    <td colspan="4" class="leg-info text-xs">
                        ${legInfoHTML}
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
