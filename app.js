// Flight Planning Tool - Main Application

const AIRPORTS_CSV_URL = 'https://cors.hisenz.com/?url=https://davidmegginson.github.io/ourairports-data/airports.csv';
const NAVAIDS_CSV_URL = 'https://cors.hisenz.com/?url=https://davidmegginson.github.io/ourairports-data/navaids.csv';
const FREQUENCIES_CSV_URL = 'https://cors.hisenz.com/?url=https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv';
const DB_NAME = 'FlightPlanningDB';
const DB_VERSION = 2;
const STORE_NAME = 'flightdata';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

let airportsData = new Map(); // Map of airport code -> airport object
let navaidsData = new Map(); // Map of navaid ident -> navaid object
let frequenciesData = new Map(); // Map of airport_id -> frequencies array
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
const routeLegs = document.getElementById('routeLegs');

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
function saveToCache(airportsCSV, navaidsCSV, frequenciesCSV) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const data = {
            id: 'flightdata_cache',
            airportsCSV: airportsCSV,
            navaidsCSV: navaidsCSV,
            frequenciesCSV: frequenciesCSV,
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

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await checkCachedData();
        setupEventListeners();
    } catch (error) {
        console.error('Failed to initialize database:', error);
        updateStatus('⚠️ Failed to initialize storage. Please reload the page.', 'error');
    }
});

function setupEventListeners() {
    loadDataBtn.addEventListener('click', loadAirportData);
    clearCacheBtn.addEventListener('click', clearCache);
    calculateBtn.addEventListener('click', calculateRoute);
    clearRouteBtn.addEventListener('click', clearRoute);

    // Allow Enter key to trigger calculation
    routeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !calculateBtn.disabled) {
            calculateRoute();
        }
    });
}

// Check if we have cached data
async function checkCachedData() {
    try {
        const cachedData = await loadFromCacheDB();

        if (cachedData && cachedData.airportsCSV && cachedData.timestamp) {
            const age = Date.now() - cachedData.timestamp;
            if (age < CACHE_DURATION) {
                loadFromCache(cachedData.airportsCSV, cachedData.navaidsCSV, cachedData.frequenciesCSV, cachedData.timestamp);
                const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
                updateStatus(`✅ Data loaded from cache (${daysOld} day${daysOld !== 1 ? 's' : ''} old)`, 'success');
                showDataInfo();
                return;
            } else {
                updateStatus('⚠️ Cached data expired. Please reload.', 'warning');
            }
        }
    } catch (error) {
        console.error('Error loading cached data:', error);
        // No cached data or error, user will need to load data
    }
}

// Load airport data from API
async function loadAirportData() {
    updateStatus('⏳ Loading airports data...', 'loading');
    loadDataBtn.disabled = true;

    try {
        // Fetch airports
        updateStatus('⏳ Loading airports data...', 'loading');
        const airportsResponse = await fetch(AIRPORTS_CSV_URL);
        if (!airportsResponse.ok) {
            throw new Error(`Airports HTTP error! status: ${airportsResponse.status}`);
        }
        const airportsCSV = await airportsResponse.text();

        // Fetch navaids
        updateStatus('⏳ Loading navaids data...', 'loading');
        const navaidsResponse = await fetch(NAVAIDS_CSV_URL);
        if (!navaidsResponse.ok) {
            throw new Error(`Navaids HTTP error! status: ${navaidsResponse.status}`);
        }
        const navaidsCSV = await navaidsResponse.text();

        // Fetch frequencies
        updateStatus('⏳ Loading frequencies data...', 'loading');
        const frequenciesResponse = await fetch(FREQUENCIES_CSV_URL);
        if (!frequenciesResponse.ok) {
            throw new Error(`Frequencies HTTP error! status: ${frequenciesResponse.status}`);
        }
        const frequenciesCSV = await frequenciesResponse.text();

        // Parse all data
        updateStatus('⏳ Parsing data...', 'loading');
        const timestamp = Date.now();
        parseAirportData(airportsCSV);
        parseNavaidData(navaidsCSV);
        parseFrequencyData(frequenciesCSV);
        dataTimestamp = timestamp;

        // Cache the data in IndexedDB
        updateStatus('⏳ Saving to cache...', 'loading');
        await saveToCache(airportsCSV, navaidsCSV, frequenciesCSV);

        updateStatus('✅ All data loaded successfully!', 'success');
        showDataInfo();
        enableRouteInput();
    } catch (error) {
        updateStatus(`❌ Error loading data: ${error.message}`, 'error');
        console.error('Error loading data:', error);
        loadDataBtn.disabled = false;
    }
}

// Load data from IndexedDB cache
function loadFromCache(airportsCSV, navaidsCSV, frequenciesCSV, timestamp) {
    parseAirportData(airportsCSV);
    parseNavaidData(navaidsCSV);
    parseFrequencyData(frequenciesCSV);
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

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = parseCSVLine(lines[i]);

        const airport = {
            id: values[idIdx],
            icao: values[identIdx],
            type: values[typeIdx],
            name: values[nameIdx],
            lat: parseFloat(values[latIdx]),
            lon: parseFloat(values[lonIdx]),
            elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
            iata: values[iataIdx],
            municipality: values[municipalityIdx],
            country: values[isoCountryIdx],
            waypointType: 'airport'
        };

        // Only store airports with valid coordinates
        if (!isNaN(airport.lat) && !isNaN(airport.lon)) {
            // Store by ICAO code
            if (airport.icao) {
                airportsData.set(airport.icao.toUpperCase(), airport);
            }
            // Also store by IATA code if available
            if (airport.iata) {
                airportsData.set(airport.iata.toUpperCase(), airport);
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
            ident: values[identIdx],
            name: values[nameIdx],
            type: values[typeIdx],
            frequency: values[freqIdx] ? parseFloat(values[freqIdx]) : null,
            lat: parseFloat(values[latIdx]),
            lon: parseFloat(values[lonIdx]),
            elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
            country: values[isoCountryIdx],
            waypointType: 'navaid'
        };

        // Only store navaids with valid coordinates
        if (!isNaN(navaid.lat) && !isNaN(navaid.lon) && navaid.ident) {
            navaidsData.set(navaid.ident.toUpperCase(), navaid);
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
    const route = routeInput.value.trim().toUpperCase().split(/\s+/);

    if (route.length < 2) {
        alert('Please enter at least 2 waypoints (airports or navaids)');
        return;
    }

    // Find all waypoints (airports or navaids)
    const waypoints = [];
    const notFound = [];

    for (const code of route) {
        // Try to find in airports first
        let waypoint = airportsData.get(code);

        // If not found in airports, try navaids
        if (!waypoint) {
            waypoint = navaidsData.get(code);
        }

        if (waypoint) {
            waypoints.push(waypoint);
        } else {
            notFound.push(code);
        }
    }

    if (notFound.length > 0) {
        alert(`Waypoint(s) not found: ${notFound.join(', ')}\n\nPlease check the codes and try again.`);
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
    const routeCodes = waypoints.map(w => getWaypointCode(w)).join(' → ');
    routeSummary.innerHTML = `
        <div class="summary-card">
            <h3>Route: ${routeCodes}</h3>
            <p><strong>Total Distance:</strong> ${totalDistance.toFixed(1)} NM (${(totalDistance * 1.852).toFixed(1)} km)</p>
            <p><strong>Waypoints:</strong> ${waypoints.length}</p>
            <p><strong>Legs:</strong> ${legs.length}</p>
        </div>
    `;

    // Individual legs
    let legsHTML = '<div class="legs-container">';

    legs.forEach((leg, index) => {
        const fromCode = getWaypointCode(leg.from);
        const toCode = getWaypointCode(leg.to);

        legsHTML += `
            <div class="leg-card">
                <div class="leg-header">
                    <h4>Leg ${index + 1}: ${fromCode} → ${toCode}</h4>
                </div>
                <div class="leg-details">
                    ${formatWaypointInfo(leg.from, 'From')}
                    ${formatWaypointInfo(leg.to, 'To')}
                    <div class="leg-metrics">
                        <div class="metric">
                            <span class="metric-label">Distance</span>
                            <span class="metric-value">${leg.distance.toFixed(1)} NM</span>
                            <span class="metric-sub">${(leg.distance * 1.852).toFixed(1)} km</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Bearing</span>
                            <span class="metric-value">${Math.round(leg.bearing)}°</span>
                            <span class="metric-sub">${getCardinalDirection(leg.bearing)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    legsHTML += '</div>';
    routeLegs.innerHTML = legsHTML;

    resultsSection.style.display = 'block';
}

// Get waypoint code
function getWaypointCode(waypoint) {
    if (waypoint.waypointType === 'airport') {
        return waypoint.iata || waypoint.icao;
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
    html += `<span class="coordinates">${formatCoordinate(waypoint.lat, 'lat')}, ${formatCoordinate(waypoint.lon, 'lon')}</span><br>`;

    // Elevation
    if (waypoint.elevation !== null && !isNaN(waypoint.elevation)) {
        html += `<span class="elevation">Elevation: ${Math.round(waypoint.elevation)} ft (${Math.round(waypoint.elevation * 0.3048)} m)</span><br>`;
    }

    // Navaid frequency
    if (waypoint.waypointType === 'navaid' && waypoint.frequency) {
        html += `<span class="frequency">Frequency: ${formatNavaidFrequency(waypoint.frequency, waypoint.type)}</span><br>`;
    }

    // Airport frequencies
    if (waypoint.waypointType === 'airport' && waypoint.id) {
        const frequencies = frequenciesData.get(waypoint.id);
        if (frequencies && frequencies.length > 0) {
            html += `<div class="frequencies-list">`;
            html += `<strong>Frequencies:</strong><br>`;
            frequencies.slice(0, 5).forEach(freq => {
                html += `<span class="freq-item">${freq.type}: ${freq.frequency.toFixed(3)} MHz</span><br>`;
            });
            if (frequencies.length > 5) {
                html += `<span class="freq-more">+${frequencies.length - 5} more</span>`;
            }
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
}

// Clear cache
async function clearCache() {
    if (confirm('Are you sure you want to clear the cached airport data?')) {
        try {
            await clearCacheDB();
            airportsData.clear();
            updateStatus('⚠️ Cache cleared. Please reload airport data.', 'warning');
            dataInfo.innerHTML = '';
            routeInput.disabled = true;
            calculateBtn.disabled = true;
            loadDataBtn.disabled = false;
            loadDataBtn.style.display = 'inline-block';
            clearCacheBtn.style.display = 'none';
            resultsSection.style.display = 'none';
        } catch (error) {
            console.error('Error clearing cache:', error);
            alert('Failed to clear cache. Please try again.');
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
        timestampText = `<p><strong>Last Updated:</strong> ${date.toLocaleDateString()} ${date.toLocaleTimeString()} (${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago)</p>`;
    }

    dataInfo.innerHTML = `
        <p><strong>${totalAirports.toLocaleString()}</strong> airports and <strong>${totalNavaids.toLocaleString()}</strong> navaids loaded and ready for route planning</p>
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
