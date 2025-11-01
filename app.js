// Flight Planning Tool - Main Application

const AIRPORTS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airports.csv';
const NAVAIDS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/navaids.csv';
const FREQUENCIES_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airport-frequencies.csv';
const RUNWAYS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/runways.csv';
const DB_NAME = 'FlightPlanningDB';
const DB_VERSION = 3;
const STORE_NAME = 'flightdata';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

let airportsData = new Map(); // Map of ICAO code -> airport object (primary storage)
let iataToIcao = new Map(); // Map of IATA code -> ICAO code (for lookups)
let navaidsData = new Map(); // Map of navaid ident -> navaid object
let frequenciesData = new Map(); // Map of airport_id -> frequencies array
let runwaysData = new Map(); // Map of airport_id -> runways array
let db = null; // IndexedDB database
let dataTimestamp = null; // Last update timestamp

// DOM Elements
const loadDataBtn = document.getElementById('loadDataBtn');
const clearCacheBtn = document.getElementById('clearCacheBtn');
const statusText = document.getElementById('statusText');
const dataInfo = document.getElementById('dataInfo');
const routeInput = document.getElementById('routeInput');
const calculateBtn = document.getElementById('calculateBtn');
const clearRouteBtn = document.getElementById('clearRouteBtn');
const resultsSection = document.getElementById('resultsSection');
const routeSummary = document.getElementById('routeSummary');
const navlogTable = document.getElementById('navlogTable');
const autocompleteDropdown = document.getElementById('autocompleteDropdown');
const queryHistoryDiv = document.getElementById('queryHistory');
const historyList = document.getElementById('historyList');

// Autocomplete state
let selectedAutocompleteIndex = -1;
let autocompleteResults = [];

// Query history settings
const HISTORY_KEY = 'flightplan_query_history';
const MAX_HISTORY = 5;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

// Save data to IndexedDB
function saveToCache(airportsCSV, navaidsCSV, frequenciesCSV, runwaysCSV) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const data = {
            id: 'flightdata_cache',
            airportsCSV: airportsCSV,
            navaidsCSV: navaidsCSV,
            frequenciesCSV: frequenciesCSV,
            runwaysCSV: runwaysCSV,
            timestamp: Date.now()
        };

        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Load data from IndexedDB
function loadFromCacheDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('flightdata_cache');

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Clear IndexedDB cache
function clearCacheDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete('flightdata_cache');

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Query History Functions
function saveQueryHistory(query) {
    try {
        let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

        // Remove if already exists (to move to top)
        history = history.filter(item => item !== query);

        // Add to beginning
        history.unshift(query);

        // Keep only last MAX_HISTORY items
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        displayQueryHistory();
    } catch (error) {
        console.error('Error saving query history:', error);
    }
}

function loadQueryHistory() {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        return history;
    } catch (error) {
        console.error('Error loading query history:', error);
        return [];
    }
}

function displayQueryHistory() {
    const history = loadQueryHistory();

    if (history.length === 0) {
        queryHistoryDiv.style.display = 'none';
        return;
    }

    queryHistoryDiv.style.display = 'block';
    historyList.innerHTML = '';

    history.forEach(query => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = query;
        item.addEventListener('click', () => {
            routeInput.value = query;
            routeInput.focus();
        });
        historyList.appendChild(item);
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await checkCachedData();
        setupEventListeners();
        displayQueryHistory();
    } catch (error) {
        console.error('Failed to initialize database:', error);
        updateStatus('[ERR] INDEXEDDB INITIALIZATION FAILED', 'error');
    }
});

function setupEventListeners() {
    loadDataBtn.addEventListener('click', loadAirportData);
    clearCacheBtn.addEventListener('click', clearCache);
    calculateBtn.addEventListener('click', calculateRoute);
    clearRouteBtn.addEventListener('click', clearRoute);

    // Autocomplete events
    routeInput.addEventListener('input', handleAutocompleteInput);
    routeInput.addEventListener('keydown', handleAutocompleteKeydown);
    routeInput.addEventListener('blur', () => {
        // Delay to allow click on dropdown item
        setTimeout(() => hideAutocomplete(), 200);
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!routeInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
            hideAutocomplete();
        }
    });
}

// Check if we have cached data
async function checkCachedData() {
    try {
        const cachedData = await loadFromCacheDB();

        if (cachedData && cachedData.airportsCSV && cachedData.timestamp) {
            const age = Date.now() - cachedData.timestamp;
            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));

            // Always load from cache (never expire)
            loadFromCache(cachedData.airportsCSV, cachedData.navaidsCSV, cachedData.frequenciesCSV, cachedData.runwaysCSV, cachedData.timestamp);

            // Show warning if > 7 days old
            if (age >= CACHE_DURATION) {
                updateStatus(`[!] DATABASE LOADED (${daysOld}D OLD - UPDATE RECOMMENDED)`, 'warning');
            } else {
                updateStatus(`[OK] DATABASE LOADED FROM CACHE (${daysOld}D OLD)`, 'success');
            }

            showDataInfo();
            return;
        }
    } catch (error) {
        console.error('Error loading cached data:', error);
        // No cached data or error, user will need to load data
    }
}

// Load airport data from API
async function loadAirportData() {
    updateStatus('[...] LOADING AIRPORTS DATABASE', 'loading');
    loadDataBtn.disabled = true;

    try {
        // Fetch airports
        updateStatus('[...] DOWNLOADING AIRPORTS DATA', 'loading');
        const airportsResponse = await fetch(AIRPORTS_CSV_URL);
        if (!airportsResponse.ok) {
            throw new Error(`HTTP ${airportsResponse.status}`);
        }
        const airportsCSV = await airportsResponse.text();

        // Fetch navaids
        updateStatus('[...] DOWNLOADING NAVAIDS DATA', 'loading');
        const navaidsResponse = await fetch(NAVAIDS_CSV_URL);
        if (!navaidsResponse.ok) {
            throw new Error(`HTTP ${navaidsResponse.status}`);
        }
        const navaidsCSV = await navaidsResponse.text();

        // Fetch frequencies
        updateStatus('[...] DOWNLOADING FREQUENCIES DATA', 'loading');
        const frequenciesResponse = await fetch(FREQUENCIES_CSV_URL);
        if (!frequenciesResponse.ok) {
            throw new Error(`HTTP ${frequenciesResponse.status}`);
        }
        const frequenciesCSV = await frequenciesResponse.text();

        // Fetch runways
        updateStatus('[...] DOWNLOADING RUNWAYS DATA', 'loading');
        const runwaysResponse = await fetch(RUNWAYS_CSV_URL);
        if (!runwaysResponse.ok) {
            throw new Error(`HTTP ${runwaysResponse.status}`);
        }
        const runwaysCSV = await runwaysResponse.text();

        // Parse all data
        updateStatus('[...] PARSING DATABASE', 'loading');
        const timestamp = Date.now();
        parseAirportData(airportsCSV);
        parseNavaidData(navaidsCSV);
        parseFrequencyData(frequenciesCSV);
        parseRunwayData(runwaysCSV);
        dataTimestamp = timestamp;

        // Cache the data in IndexedDB
        updateStatus('[...] CACHING TO INDEXEDDB', 'loading');
        await saveToCache(airportsCSV, navaidsCSV, frequenciesCSV, runwaysCSV);

        updateStatus('[OK] DATABASE READY - ALL SYSTEMS OPERATIONAL', 'success');
        showDataInfo();
        enableRouteInput();
    } catch (error) {
        updateStatus(`[ERR] ${error.message}`, 'error');
        console.error('Error loading data:', error);
        loadDataBtn.disabled = false;
    }
}

// Load data from IndexedDB cache
function loadFromCache(airportsCSV, navaidsCSV, frequenciesCSV, runwaysCSV, timestamp) {
    parseAirportData(airportsCSV);
    parseNavaidData(navaidsCSV);
    parseFrequencyData(frequenciesCSV);
    parseRunwayData(runwaysCSV);
    dataTimestamp = timestamp;
    enableRouteInput();
}

// Parse CSV data
function parseAirportData(csvText) {
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);

    // Find column indices
    const idIdx = headers.indexOf('id');
    const identIdx = headers.indexOf('ident');
    const typeIdx = headers.indexOf('type');
    const nameIdx = headers.indexOf('name');
    const latIdx = headers.indexOf('latitude_deg');
    const lonIdx = headers.indexOf('longitude_deg');
    const elevIdx = headers.indexOf('elevation_ft');
    const iataIdx = headers.indexOf('iata_code');
    const municipalityIdx = headers.indexOf('municipality');
    const isoCountryIdx = headers.indexOf('iso_country');

    airportsData.clear();
    iataToIcao.clear();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = parseCSVLine(lines[i]);

        const airport = {
            id: values[idIdx],
            icao: values[identIdx]?.toUpperCase(), // Store ICAO in uppercase
            type: values[typeIdx],
            name: values[nameIdx],
            lat: parseFloat(values[latIdx]),
            lon: parseFloat(values[lonIdx]),
            elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
            iata: values[iataIdx]?.toUpperCase(), // Store IATA in uppercase
            municipality: values[municipalityIdx],
            country: values[isoCountryIdx],
            waypointType: 'airport'
        };

        // Only store airports with valid coordinates and ICAO code
        if (!isNaN(airport.lat) && !isNaN(airport.lon) && airport.icao) {
            // Store by ICAO code (primary storage - only once per airport)
            airportsData.set(airport.icao, airport);

            // If IATA code exists, create a mapping for lookup
            if (airport.iata && airport.iata.trim()) {
                iataToIcao.set(airport.iata, airport.icao);
            }
        }
    }
}

// Parse navaid data
function parseNavaidData(csvText) {
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);

    // Find column indices
    const idIdx = headers.indexOf('id');
    const identIdx = headers.indexOf('ident');
    const nameIdx = headers.indexOf('name');
    const typeIdx = headers.indexOf('type');
    const freqIdx = headers.indexOf('frequency_khz');
    const latIdx = headers.indexOf('latitude_deg');
    const lonIdx = headers.indexOf('longitude_deg');
    const elevIdx = headers.indexOf('elevation_ft');
    const isoCountryIdx = headers.indexOf('iso_country');

    navaidsData.clear();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = parseCSVLine(lines[i]);

        const navaid = {
            id: values[idIdx],
            ident: values[identIdx]?.toUpperCase(), // Store ident in uppercase
            name: values[nameIdx],
            type: values[typeIdx],
            frequency: values[freqIdx] ? parseFloat(values[freqIdx]) : null,
            lat: parseFloat(values[latIdx]),
            lon: parseFloat(values[lonIdx]),
            elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
            country: values[isoCountryIdx],
            waypointType: 'navaid'
        };

        // Only store navaids with valid coordinates and ident
        if (!isNaN(navaid.lat) && !isNaN(navaid.lon) && navaid.ident) {
            navaidsData.set(navaid.ident, navaid); // Key and ident are both uppercase now
        }
    }
}

// Parse frequency data
function parseFrequencyData(csvText) {
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);

    // Find column indices
    const airportIdIdx = headers.indexOf('airport_ref');
    const typeIdx = headers.indexOf('type');
    const descIdx = headers.indexOf('description');
    const freqIdx = headers.indexOf('frequency_mhz');

    frequenciesData.clear();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = parseCSVLine(lines[i]);
        const airportId = values[airportIdIdx];

        if (!airportId) continue;

        const frequency = {
            type: values[typeIdx],
            description: values[descIdx],
            frequency: parseFloat(values[freqIdx])
        };

        if (!frequenciesData.has(airportId)) {
            frequenciesData.set(airportId, []);
        }
        frequenciesData.get(airportId).push(frequency);
    }
}

// Parse runway data
function parseRunwayData(csvText) {
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);

    // Find column indices
    const airportIdIdx = headers.indexOf('airport_ref');
    const lengthIdx = headers.indexOf('length_ft');
    const widthIdx = headers.indexOf('width_ft');
    const surfaceIdx = headers.indexOf('surface');
    const leIdentIdx = headers.indexOf('le_ident');
    const heIdentIdx = headers.indexOf('he_ident');

    runwaysData.clear();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = parseCSVLine(lines[i]);
        const airportId = values[airportIdIdx];

        if (!airportId) continue;

        const runway = {
            length: values[lengthIdx] ? parseInt(values[lengthIdx]) : null,
            width: values[widthIdx] ? parseInt(values[widthIdx]) : null,
            surface: values[surfaceIdx],
            leIdent: values[leIdentIdx],
            heIdent: values[heIdentIdx]
        };

        if (!runwaysData.has(airportId)) {
            runwaysData.set(airportId, []);
        }
        runwaysData.get(airportId).push(runway);
    }
}

// Simple CSV parser (handles quoted fields)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result.map(val => val.trim());
}

// Calculate route
function calculateRoute() {
    const route = routeInput.value.trim().toUpperCase().split(/\s+/).filter(w => w.length > 0);

    if (route.length < 1) {
        alert('ERROR: ENTER AT LEAST ONE WAYPOINT');
        return;
    }

    // Find all waypoints (airports or navaids)
    const waypoints = [];
    const notFound = [];

    for (const code of route) {
        let waypoint = null;

        // Prioritize by code length and type to avoid IATA/navaid conflicts:
        // 1. If 4+ letters, try ICAO first (most specific)
        // 2. Try as navaid
        // 3. If 3 letters, try IATA (least specific, may conflict with navaids)

        if (code.length >= 4) {
            // Likely ICAO code - check airports first
            waypoint = airportsData.get(code);
        }

        // If not found, try navaids
        if (!waypoint) {
            waypoint = navaidsData.get(code);
        }

        // If still not found and 3 letters, try IATA lookup
        if (!waypoint && code.length === 3) {
            const icaoCode = iataToIcao.get(code);
            if (icaoCode) {
                waypoint = airportsData.get(icaoCode);
            }
        }

        if (waypoint) {
            waypoints.push(waypoint);
        } else {
            notFound.push(code);
        }
    }

    if (notFound.length > 0) {
        alert(`ERROR: WAYPOINT(S) NOT IN DATABASE\n\n${notFound.join(', ')}\n\nVERIFY WAYPOINT IDENTIFIERS`);
        return;
    }

    // Calculate legs
    const legs = [];
    let totalDistance = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to = waypoints[i + 1];

        const distance = calculateDistance(from.lat, from.lon, to.lat, to.lon);
        const bearing = calculateBearing(from.lat, from.lon, to.lat, to.lon);

        legs.push({
            from,
            to,
            distance,
            bearing
        });

        totalDistance += distance;
    }

    displayResults(waypoints, legs, totalDistance);

    // Save to query history
    saveQueryHistory(routeInput.value.trim().toUpperCase());
}

// Calculate distance using Haversine formula (in nautical miles)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth's radius in nautical miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
}

// Calculate bearing (initial heading) between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
    const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
              Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);

    let bearing = Math.atan2(y, x);
    bearing = toDegrees(bearing);
    bearing = (bearing + 360) % 360; // Normalize to 0-360

    return bearing;
}

// Display results
function displayResults(waypoints, legs, totalDistance) {
    // Route summary
    const routeCodes = waypoints.map(w => getWaypointCode(w)).join(' '); // Space-separated, no dashes
    routeSummary.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">ROUTE</span>
            <span class="summary-value">${routeCodes}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">TOTAL DISTANCE</span>
            <span class="summary-value">${totalDistance.toFixed(1)} NM</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">WAYPOINTS</span>
            <span class="summary-value">${waypoints.length}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">LEGS</span>
            <span class="summary-value">${legs.length}</span>
        </div>
    `;

    // Build navlog table
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>WPT</th>
                    <th>IDENT / TYPE</th>
                    <th colspan="2">POSITION / ELEVATION / FREQUENCIES</th>
                </tr>
            </thead>
            <tbody>
    `;

    let cumulativeDistance = 0;

    waypoints.forEach((waypoint, index) => {
        const code = getWaypointCode(waypoint);
        const colorClass = waypoint.waypointType === 'airport' ? 'airport' : 'navaid';
        const waypointNumber = index + 1;

        // Position
        const pos = `${formatCoordinate(waypoint.lat, 'lat')} ${formatCoordinate(waypoint.lon, 'lon')}`;

        // Elevation
        const elev = waypoint.elevation !== null && !isNaN(waypoint.elevation)
            ? `${Math.round(waypoint.elevation)} FT`
            : 'N/A';

        // Get frequencies (grouped by type for airports)
        let freqHTML = '';
        if (waypoint.waypointType === 'airport') {
            if (waypoint.id) {
                const frequencies = frequenciesData.get(waypoint.id);
                if (frequencies && frequencies.length > 0) {
                    // Group frequencies by type
                    const grouped = {};
                    frequencies.forEach(f => {
                        const type = f.type.toUpperCase();
                        if (!grouped[type]) {
                            grouped[type] = [];
                        }
                        grouped[type].push(f.frequency.toFixed(3));
                    });

                    // Format as "TYPE freq1/freq2/freq3"
                    const freqItems = Object.entries(grouped).map(([type, freqs]) =>
                        `<span class="wpt-freq-item">${type} ${freqs.join('/')}</span>`
                    );
                    freqHTML = freqItems.join(' ');
                } else {
                    // Airport exists but no frequencies in database
                    freqHTML = `<span class="wpt-freq-item wpt-freq-none">NO FREQ DATA</span>`;
                }
            } else {
                // Airport has no ID (shouldn't happen, but handle it)
                freqHTML = `<span class="wpt-freq-item wpt-freq-none">NO FREQ DATA</span>`;
            }
        } else if (waypoint.waypointType === 'navaid' && waypoint.frequency) {
            freqHTML = `<span class="wpt-freq-item">${formatNavaidFrequency(waypoint.frequency, waypoint.type)}</span>`;
        }

        // Get runway information for airports
        let runwayHTML = '';
        if (waypoint.waypointType === 'airport') {
            if (waypoint.id) {
                const runways = runwaysData.get(waypoint.id);
                if (runways && runways.length > 0) {
                    const runwayInfo = runways.map(r => {
                        const idents = r.leIdent && r.heIdent ? `${r.leIdent}/${r.heIdent}` : (r.leIdent || r.heIdent || 'N/A');
                        const length = r.length ? `${r.length}FT` : '';
                        const surface = r.surface || '';
                        return `<strong>${idents}</strong> ${length} ${surface}`.trim();
                    }).join(', ');
                    runwayHTML = `<div class="wpt-info">RWY ${runwayInfo}</div>`;
                } else {
                    // Airport exists but no runway data in database
                    runwayHTML = `<div class="wpt-info wpt-info-none">RWY NO DATA</div>`;
                }
            } else {
                // Airport has no ID (shouldn't happen, but handle it)
                runwayHTML = `<div class="wpt-info wpt-info-none">RWY NO DATA</div>`;
            }
        }

        // Simplify type display: just "AIRPORT" for all airports, navaid type for navaids
        const typeDisplay = waypoint.waypointType === 'airport' ? 'AIRPORT' : waypoint.type;

        // Waypoint row
        tableHTML += `
            <tr class="wpt-row">
                <td class="wpt-num"><span class="metric-value">${waypointNumber}</span></td>
                <td>
                    <div class="wpt-ident ${colorClass}">${code}</div>
                    <div class="wpt-type">${typeDisplay}</div>
                </td>
                <td colspan="2">
                    <div class="wpt-info">${pos}</div>
                    <div class="wpt-info wpt-elevation">ELEV ${elev}</div>
                    ${runwayHTML}
                    ${freqHTML ? `<div class="wpt-freqs">${freqHTML}</div>` : ''}
                </td>
            </tr>
        `;

        // Add distance/track row between waypoints (if not last waypoint)
        if (index < waypoints.length - 1) {
            const leg = legs[index];
            cumulativeDistance += leg.distance;
            const legDist = leg.distance.toFixed(1);
            const track = String(Math.round(leg.bearing)).padStart(3, '0');
            const cardinal = getCardinalDirection(leg.bearing);

            tableHTML += `
                <tr class="leg-row">
                    <td></td>
                    <td colspan="3" class="leg-info">
                        <span class="leg-item">LEG: <span class="metric-value">${legDist}</span> NM</span>
                        <span class="leg-item">TRK: <span class="metric-value">${track}°</span> ${cardinal}</span>
                        <span class="leg-item">SUM: <span class="metric-value">${cumulativeDistance.toFixed(1)}</span> NM</span>
                    </td>
                </tr>
            `;
        }
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    navlogTable.innerHTML = tableHTML;
    resultsSection.style.display = 'block';
}

// Get waypoint code
function getWaypointCode(waypoint) {
    if (waypoint.waypointType === 'airport') {
        return waypoint.icao; // Always use ICAO for airports
    } else {
        return waypoint.ident;
    }
}

// Format waypoint information
function formatWaypointInfo(waypoint, label) {
    let html = `<div class="waypoint-info">`;
    html += `<strong>${label}:</strong> ${waypoint.name}`;

    // Add waypoint type badge
    if (waypoint.waypointType === 'navaid') {
        html += ` <span class="navaid-badge">${waypoint.type}</span>`;
    } else if (waypoint.type) {
        html += ` <span class="airport-type">${waypoint.type}</span>`;
    }

    html += `<br>`;

    // Location info
    if (waypoint.municipality) {
        html += `<span class="waypoint-location">${waypoint.municipality}, ${waypoint.country}</span><br>`;
    } else {
        html += `<span class="waypoint-location">${waypoint.country}</span><br>`;
    }

    // Coordinates
    html += `<span class="coordinates">POS ${formatCoordinate(waypoint.lat, 'lat')} ${formatCoordinate(waypoint.lon, 'lon')}</span><br>`;

    // Elevation
    if (waypoint.elevation !== null && !isNaN(waypoint.elevation)) {
        html += `<span class="elevation">ELEV ${Math.round(waypoint.elevation)}FT / ${Math.round(waypoint.elevation * 0.3048)}M</span><br>`;
    }

    // Navaid frequency
    if (waypoint.waypointType === 'navaid' && waypoint.frequency) {
        html += `<span class="frequency">FREQ ${formatNavaidFrequency(waypoint.frequency, waypoint.type)}</span><br>`;
    }

    // Airport frequencies
    if (waypoint.waypointType === 'airport' && waypoint.id) {
        const frequencies = frequenciesData.get(waypoint.id);
        if (frequencies && frequencies.length > 0) {
            html += `<div class="frequencies-list">`;
            html += `<strong>FREQ:</strong><br>`;
            frequencies.forEach(freq => {
                const freqType = freq.type.toUpperCase().padEnd(8);
                html += `<span class="freq-item">${freqType} ${freq.frequency.toFixed(3)}</span><br>`;
            });
            html += `</div>`;
        }
    }

    html += `</div>`;
    return html;
}

// Format navaid frequency
function formatNavaidFrequency(freqKhz, type) {
    if (type === 'VOR' || type === 'VOR-DME' || type === 'VORTAC') {
        // VOR frequencies are in VHF band (108-118 MHz)
        const freqMhz = freqKhz / 1000;
        return `${freqMhz.toFixed(2)} MHz`;
    } else if (type === 'NDB' || type === 'NDB-DME') {
        // NDB frequencies are in kHz (190-1750 kHz)
        return `${freqKhz} kHz`;
    } else {
        // Default to kHz
        return `${freqKhz} kHz`;
    }
}

// Format coordinates
function formatCoordinate(value, type) {
    const abs = Math.abs(value);
    const degrees = Math.floor(abs);
    const minutes = ((abs - degrees) * 60).toFixed(3);
    const direction = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${degrees}°${minutes}'${direction}`;
}

// Get cardinal direction from bearing
function getCardinalDirection(bearing) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
}

// Clear route
function clearRoute() {
    routeInput.value = '';
    resultsSection.style.display = 'none';
    hideAutocomplete();
}

// Autocomplete: Handle input
function handleAutocompleteInput(e) {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    // Get the current word being typed
    const beforeCursor = value.substring(0, cursorPos);
    const words = beforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1].toUpperCase();

    if (currentWord.length < 2) {
        hideAutocomplete();
        return;
    }

    // Search for matches
    searchWaypoints(currentWord);
}

// Autocomplete: Search waypoints
function searchWaypoints(query) {
    const exactAirports = [];
    const exactNavaids = [];
    const partialAirports = [];
    const partialNavaids = [];
    const nameAirports = [];
    const nameNavaids = [];

    // Search airports
    for (const [code, airport] of airportsData) {
        const icao = airport.icao || ''; // Already uppercase
        const iata = airport.iata || ''; // Already uppercase
        const name = airport.name?.toUpperCase() || '';

        const result = {
            code: icao, // Always display ICAO for airports
            fullCode: icao,
            type: 'AIRPORT',
            waypointType: 'airport',
            name: airport.name,
            location: `${airport.municipality || ''}, ${airport.country}`.trim(),
            data: airport
        };

        // Exact match on code
        if (icao === query || iata === query) {
            exactAirports.push(result);
        }
        // Partial match on code (starts with or contains)
        else if (icao.startsWith(query) || iata.startsWith(query) || icao.includes(query) || iata.includes(query)) {
            partialAirports.push(result);
        }
        // Name match
        else if (name.includes(query)) {
            nameAirports.push(result);
        }
    }

    // Search navaids
    for (const [ident, navaid] of navaidsData) {
        const identUpper = ident; // Already uppercase
        const name = navaid.name?.toUpperCase() || '';

        const result = {
            code: navaid.ident,
            fullCode: navaid.ident,
            type: navaid.type,
            waypointType: 'navaid',
            name: navaid.name,
            location: navaid.country,
            data: navaid
        };

        // Exact match on ident
        if (identUpper === query) {
            exactNavaids.push(result);
        }
        // Partial match on ident
        else if (identUpper.startsWith(query) || identUpper.includes(query)) {
            partialNavaids.push(result);
        }
        // Name match
        else if (name.includes(query)) {
            nameNavaids.push(result);
        }
    }

    // Combine results in priority order: exact (airports then navaids), partial (airports then navaids), name (airports then navaids)
    const results = [
        ...exactAirports,
        ...exactNavaids,
        ...partialAirports,
        ...partialNavaids,
        ...nameAirports,
        ...nameNavaids
    ].slice(0, 10); // Limit to 10 results

    autocompleteResults = results;
    displayAutocomplete(results);
}

// Autocomplete: Display results
function displayAutocomplete(results) {
    if (results.length === 0) {
        autocompleteDropdown.innerHTML = '<div class="autocomplete-empty">No results found</div>';
        autocompleteDropdown.classList.add('show');
        return;
    }

    let html = '';
    results.forEach((result, index) => {
        const colorClass = result.waypointType === 'airport' ? 'airport' : 'navaid';
        html += `
            <div class="autocomplete-item" data-index="${index}">
                <span class="autocomplete-code ${colorClass}">${result.code}</span>
                <span class="autocomplete-type">${result.type}</span>
                <span class="autocomplete-name">${result.name}</span>
                <span class="autocomplete-location">${result.location}</span>
            </div>
        `;
    });

    autocompleteDropdown.innerHTML = html;
    autocompleteDropdown.classList.add('show');
    selectedAutocompleteIndex = -1;

    // Add click handlers
    autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            selectAutocompleteItem(index);
        });
    });
}

// Autocomplete: Hide dropdown
function hideAutocomplete() {
    autocompleteDropdown.classList.remove('show');
    autocompleteDropdown.innerHTML = '';
    selectedAutocompleteIndex = -1;
    autocompleteResults = [];
}

// Autocomplete: Handle keyboard navigation
function handleAutocompleteKeydown(e) {
    if (!autocompleteDropdown.classList.contains('show')) {
        if (e.key === 'Enter' && !calculateBtn.disabled) {
            calculateRoute();
        }
        return;
    }

    const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');

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

// Autocomplete: Update selection highlight
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

// Autocomplete: Select item
function selectAutocompleteItem(index) {
    const result = autocompleteResults[index];
    if (!result) return;

    const value = routeInput.value;
    const cursorPos = routeInput.selectionStart;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);

    // Replace the current word with selected code
    const words = beforeCursor.split(/\s+/);
    words[words.length - 1] = result.fullCode;
    const newBefore = words.join(' ');

    routeInput.value = newBefore + ' ' + afterCursor;
    const newPos = newBefore.length + 1;
    routeInput.setSelectionRange(newPos, newPos);
    routeInput.focus();

    hideAutocomplete();
}

// Clear cache
async function clearCache() {
    if (confirm('CONFIRM: CLEAR ALL CACHED DATA?')) {
        try {
            await clearCacheDB();
            airportsData.clear();
            updateStatus('[!] CACHE CLEARED - RELOAD DATABASE', 'warning');
            dataInfo.innerHTML = '';
            routeInput.disabled = true;
            calculateBtn.disabled = true;
            loadDataBtn.disabled = false;
            loadDataBtn.style.display = 'inline-block';
            clearCacheBtn.style.display = 'none';
            resultsSection.style.display = 'none';
        } catch (error) {
            console.error('Error clearing cache:', error);
            alert('ERROR: CACHE CLEAR OPERATION FAILED');
        }
    }
}

// Update status display
function updateStatus(message, type) {
    statusText.textContent = message;
    const statusBox = document.getElementById('dataStatus');
    statusBox.className = 'status-box status-' + type;

    if (type === 'success') {
        loadDataBtn.style.display = 'none';
        clearCacheBtn.style.display = 'inline-block';
    }
}

// Show data information
function showDataInfo() {
    const totalAirports = airportsData.size;
    const totalNavaids = navaidsData.size;

    let timestampText = '';
    if (dataTimestamp) {
        const date = new Date(dataTimestamp);
        const daysAgo = Math.floor((Date.now() - dataTimestamp) / (24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0];
        timestampText = `<p><strong>DB UPDATE:</strong> ${dateStr} ${timeStr} UTC (${daysAgo}D AGO)</p>`;
    }

    dataInfo.innerHTML = `
        <p><strong>AIRPORTS:</strong> ${totalAirports.toLocaleString()} | <strong>NAVAIDS:</strong> ${totalNavaids.toLocaleString()} | <strong>STATUS:</strong> READY</p>
        ${timestampText}
    `;
}

// Enable route input
function enableRouteInput() {
    routeInput.disabled = false;
    calculateBtn.disabled = false;
}

// Helper functions
function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

// Register Service Worker for offline support
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
