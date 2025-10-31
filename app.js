// Flight Planning Tool - Main Application

const AIRPORTS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const CACHE_KEY = 'airports_data';
const CACHE_TIMESTAMP_KEY = 'airports_data_timestamp';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

let airportsData = new Map(); // Map of airport code -> airport object

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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkCachedData();
    setupEventListeners();
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
function checkCachedData() {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cachedData && cacheTimestamp) {
        const age = Date.now() - parseInt(cacheTimestamp);
        if (age < CACHE_DURATION) {
            loadFromCache(cachedData);
            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
            updateStatus(`✅ Airport data loaded from cache (${daysOld} days old)`, 'success');
            showDataInfo();
            return;
        } else {
            updateStatus('⚠️ Cached data expired. Please reload.', 'warning');
        }
    }
}

// Load airport data from API
async function loadAirportData() {
    updateStatus('⏳ Loading airport data...', 'loading');
    loadDataBtn.disabled = true;

    try {
        const response = await fetch(AIRPORTS_CSV_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        parseAirportData(csvText);

        // Cache the data
        localStorage.setItem(CACHE_KEY, csvText);
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());

        updateStatus('✅ Airport data loaded successfully!', 'success');
        showDataInfo();
        enableRouteInput();
    } catch (error) {
        updateStatus(`❌ Error loading data: ${error.message}`, 'error');
        console.error('Error loading airport data:', error);
        loadDataBtn.disabled = false;
    }
}

// Load data from localStorage cache
function loadFromCache(csvText) {
    parseAirportData(csvText);
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
            iata: values[iataIdx],
            municipality: values[municipalityIdx],
            country: values[isoCountryIdx]
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
        alert('Please enter at least 2 airport codes');
        return;
    }

    // Find all airports
    const airports = [];
    const notFound = [];

    for (const code of route) {
        const airport = airportsData.get(code);
        if (airport) {
            airports.push(airport);
        } else {
            notFound.push(code);
        }
    }

    if (notFound.length > 0) {
        alert(`Airport(s) not found: ${notFound.join(', ')}\n\nPlease check the codes and try again.`);
        return;
    }

    // Calculate legs
    const legs = [];
    let totalDistance = 0;

    for (let i = 0; i < airports.length - 1; i++) {
        const from = airports[i];
        const to = airports[i + 1];

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

    displayResults(airports, legs, totalDistance);
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
function displayResults(airports, legs, totalDistance) {
    // Route summary
    const routeCodes = airports.map(a => a.iata || a.icao).join(' → ');
    routeSummary.innerHTML = `
        <div class="summary-card">
            <h3>Route: ${routeCodes}</h3>
            <p><strong>Total Distance:</strong> ${totalDistance.toFixed(1)} NM (${(totalDistance * 1.852).toFixed(1)} km)</p>
            <p><strong>Waypoints:</strong> ${airports.length}</p>
            <p><strong>Legs:</strong> ${legs.length}</p>
        </div>
    `;

    // Individual legs
    let legsHTML = '<div class="legs-container">';

    legs.forEach((leg, index) => {
        const fromCode = leg.from.iata || leg.from.icao;
        const toCode = leg.to.iata || leg.to.icao;

        legsHTML += `
            <div class="leg-card">
                <div class="leg-header">
                    <h4>Leg ${index + 1}: ${fromCode} → ${toCode}</h4>
                </div>
                <div class="leg-details">
                    <div class="leg-airport">
                        <strong>From:</strong> ${leg.from.name}<br>
                        <span class="airport-location">${leg.from.municipality}, ${leg.from.country}</span><br>
                        <span class="coordinates">${formatCoordinate(leg.from.lat, 'lat')}, ${formatCoordinate(leg.from.lon, 'lon')}</span>
                    </div>
                    <div class="leg-airport">
                        <strong>To:</strong> ${leg.to.name}<br>
                        <span class="airport-location">${leg.to.municipality}, ${leg.to.country}</span><br>
                        <span class="coordinates">${formatCoordinate(leg.to.lat, 'lat')}, ${formatCoordinate(leg.to.lon, 'lon')}</span>
                    </div>
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
function clearCache() {
    if (confirm('Are you sure you want to clear the cached airport data?')) {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        airportsData.clear();
        updateStatus('⚠️ Cache cleared. Please reload airport data.', 'warning');
        dataInfo.innerHTML = '';
        routeInput.disabled = true;
        calculateBtn.disabled = true;
        loadDataBtn.disabled = false;
        loadDataBtn.style.display = 'inline-block';
        clearCacheBtn.style.display = 'none';
        resultsSection.style.display = 'none';
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
    dataInfo.innerHTML = `
        <p><strong>${totalAirports.toLocaleString()}</strong> airport codes loaded and ready for route planning</p>
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
