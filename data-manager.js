// Data Manager Module - Handles all data loading, caching, and storage

// Data URLs
const AIRPORTS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airports.csv';
const NAVAIDS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/navaids.csv';
const FREQUENCIES_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airport-frequencies.csv';
const RUNWAYS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/runways.csv';

// Database configuration
const DB_NAME = 'FlightPlanningDB';
const DB_VERSION = 3;
const STORE_NAME = 'flightdata';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Query history
const HISTORY_KEY = 'flightplan_query_history';
const MAX_HISTORY = 5;

// Data storage
let airportsData = new Map();
let iataToIcao = new Map();
let navaidsData = new Map();
let frequenciesData = new Map();
let runwaysData = new Map();
let db = null;
let dataTimestamp = null;

// ============================================
// INDEXEDDB OPERATIONS
// ============================================

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

function saveToCache(airportsCSV, navaidsCSV, frequenciesCSV, runwaysCSV) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const data = {
            id: 'flightdata_cache',
            airportsCSV,
            navaidsCSV,
            frequenciesCSV,
            runwaysCSV,
            timestamp: Date.now()
        };
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function loadFromCacheDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('flightdata_cache');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function clearCacheDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete('flightdata_cache');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ============================================
// DATA LOADING
// ============================================

async function loadData(onStatusUpdate) {
    onStatusUpdate('[...] LOADING AIRPORTS DATABASE', 'loading');

    try {
        // Fetch airports
        onStatusUpdate('[...] DOWNLOADING AIRPORTS DATA', 'loading');
        const airportsResponse = await fetch(AIRPORTS_CSV_URL);
        if (!airportsResponse.ok) throw new Error(`HTTP ${airportsResponse.status}`);
        const airportsCSV = await airportsResponse.text();

        // Fetch navaids
        onStatusUpdate('[...] DOWNLOADING NAVAIDS DATA', 'loading');
        const navaidsResponse = await fetch(NAVAIDS_CSV_URL);
        if (!navaidsResponse.ok) throw new Error(`HTTP ${navaidsResponse.status}`);
        const navaidsCSV = await navaidsResponse.text();

        // Fetch frequencies
        onStatusUpdate('[...] DOWNLOADING FREQUENCIES DATA', 'loading');
        const frequenciesResponse = await fetch(FREQUENCIES_CSV_URL);
        if (!frequenciesResponse.ok) throw new Error(`HTTP ${frequenciesResponse.status}`);
        const frequenciesCSV = await frequenciesResponse.text();

        // Fetch runways
        onStatusUpdate('[...] DOWNLOADING RUNWAYS DATA', 'loading');
        const runwaysResponse = await fetch(RUNWAYS_CSV_URL);
        if (!runwaysResponse.ok) throw new Error(`HTTP ${runwaysResponse.status}`);
        const runwaysCSV = await runwaysResponse.text();

        // Parse all data
        onStatusUpdate('[...] PARSING DATABASE', 'loading');
        const timestamp = Date.now();
        parseAirportData(airportsCSV);
        parseNavaidData(navaidsCSV);
        parseFrequencyData(frequenciesCSV);
        parseRunwayData(runwaysCSV);
        dataTimestamp = timestamp;

        // Cache the data
        onStatusUpdate('[...] CACHING TO INDEXEDDB', 'loading');
        await saveToCache(airportsCSV, navaidsCSV, frequenciesCSV, runwaysCSV);

        onStatusUpdate('[OK] DATABASE READY - ALL SYSTEMS OPERATIONAL', 'success');
        return { success: true };
    } catch (error) {
        onStatusUpdate(`[ERR] ${error.message}`, 'error');
        throw error;
    }
}

async function checkCachedData() {
    try {
        const cachedData = await loadFromCacheDB();
        if (cachedData && cachedData.airportsCSV && cachedData.timestamp) {
            const age = Date.now() - cachedData.timestamp;
            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));

            // Load from cache
            loadFromCache(cachedData.airportsCSV, cachedData.navaidsCSV,
                         cachedData.frequenciesCSV, cachedData.runwaysCSV,
                         cachedData.timestamp);

            // Return status
            if (age >= CACHE_DURATION) {
                return {
                    loaded: true,
                    status: `[!] DATABASE LOADED (${daysOld}D OLD - UPDATE RECOMMENDED)`,
                    type: 'warning'
                };
            } else {
                return {
                    loaded: true,
                    status: `[OK] DATABASE LOADED FROM CACHE (${daysOld}D OLD)`,
                    type: 'success'
                };
            }
        }
    } catch (error) {
        console.error('Error loading cached data:', error);
    }
    return { loaded: false };
}

function loadFromCache(airportsCSV, navaidsCSV, frequenciesCSV, runwaysCSV, timestamp) {
    parseAirportData(airportsCSV);
    parseNavaidData(navaidsCSV);
    parseFrequencyData(frequenciesCSV);
    parseRunwayData(runwaysCSV);
    dataTimestamp = timestamp;
}

async function clearCache() {
    await clearCacheDB();
    airportsData.clear();
    iataToIcao.clear();
    navaidsData.clear();
    frequenciesData.clear();
    runwaysData.clear();
    dataTimestamp = null;
}

// ============================================
// DATA PARSING
// ============================================

function parseAirportData(csvText) {
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);

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
            icao: values[identIdx]?.toUpperCase(),
            type: values[typeIdx],
            name: values[nameIdx],
            lat: parseFloat(values[latIdx]),
            lon: parseFloat(values[lonIdx]),
            elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
            iata: values[iataIdx]?.toUpperCase(),
            municipality: values[municipalityIdx],
            country: values[isoCountryIdx],
            waypointType: 'airport'
        };

        if (!isNaN(airport.lat) && !isNaN(airport.lon) && airport.icao) {
            airportsData.set(airport.icao, airport);
            if (airport.iata && airport.iata.trim()) {
                iataToIcao.set(airport.iata, airport.icao);
            }
        }
    }
}

function parseNavaidData(csvText) {
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);

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
            ident: values[identIdx]?.toUpperCase(),
            name: values[nameIdx],
            type: values[typeIdx],
            frequency: values[freqIdx] ? parseFloat(values[freqIdx]) : null,
            lat: parseFloat(values[latIdx]),
            lon: parseFloat(values[lonIdx]),
            elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
            country: values[isoCountryIdx],
            waypointType: 'navaid'
        };

        if (!isNaN(navaid.lat) && !isNaN(navaid.lon) && navaid.ident) {
            navaidsData.set(navaid.ident, navaid);
        }
    }
}

function parseFrequencyData(csvText) {
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);

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

function parseRunwayData(csvText) {
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);

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

// ============================================
// QUERY HISTORY
// ============================================

function saveQueryHistory(query) {
    try {
        let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        history = history.filter(item => item !== query);
        history.unshift(query);
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
        console.error('Error saving query history:', error);
    }
}

function loadQueryHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (error) {
        console.error('Error loading query history:', error);
        return [];
    }
}

// ============================================
// DATA ACCESS
// ============================================

function getAirport(code) {
    return airportsData.get(code);
}

function getAirportByIATA(iataCode) {
    const icao = iataToIcao.get(iataCode);
    return icao ? airportsData.get(icao) : null;
}

function getNavaid(ident) {
    return navaidsData.get(ident);
}

function getFrequencies(airportId) {
    return frequenciesData.get(airportId) || [];
}

function getRunways(airportId) {
    return runwaysData.get(airportId) || [];
}

function getDataStats() {
    return {
        airports: airportsData.size,
        navaids: navaidsData.size,
        timestamp: dataTimestamp
    };
}

function searchWaypoints(query) {
    const exactAirports = [];
    const exactNavaids = [];
    const partialAirports = [];
    const partialNavaids = [];
    const nameAirports = [];
    const nameNavaids = [];

    // Search airports
    for (const [code, airport] of airportsData) {
        const icao = airport.icao || '';
        const iata = airport.iata || '';
        const name = airport.name?.toUpperCase() || '';

        const result = {
            code: icao,
            fullCode: icao,
            type: 'AIRPORT',
            waypointType: 'airport',
            name: airport.name,
            location: `${airport.municipality || ''}, ${airport.country}`.trim(),
            data: airport
        };

        if (icao === query || iata === query) {
            exactAirports.push(result);
        } else if (icao.startsWith(query) || iata.startsWith(query) || icao.includes(query) || iata.includes(query)) {
            partialAirports.push(result);
        } else if (name.includes(query)) {
            nameAirports.push(result);
        }
    }

    // Search navaids
    for (const [ident, navaid] of navaidsData) {
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

        if (ident === query) {
            exactNavaids.push(result);
        } else if (ident.startsWith(query) || ident.includes(query)) {
            partialNavaids.push(result);
        } else if (name.includes(query)) {
            nameNavaids.push(result);
        }
    }

    return [
        ...exactAirports,
        ...exactNavaids,
        ...partialAirports,
        ...partialNavaids,
        ...nameAirports,
        ...nameNavaids
    ].slice(0, 10);
}

// ============================================
// EXPORTS
// ============================================

window.DataManager = {
    // Initialization
    initDB,
    checkCachedData,

    // Data loading
    loadData,
    clearCache,

    // Data access
    getAirport,
    getAirportByIATA,
    getNavaid,
    getFrequencies,
    getRunways,
    getDataStats,
    searchWaypoints,

    // Query history
    saveQueryHistory,
    loadQueryHistory
};
