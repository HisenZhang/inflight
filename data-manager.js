// Data Manager Module - Orchestrates NASR (primary) and OurAirports (fallback) data

// Database configuration
const DB_NAME = 'FlightPlanningDB';
const DB_VERSION = 4; // Updated for multi-source support
const STORE_NAME = 'flightdata';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days for OurAirports
const NASR_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days for NASR

// Query history
const HISTORY_KEY = 'flightplan_query_history';
const MAX_HISTORY = 5;

// Data storage - unified worldwide database
let airportsData = new Map();        // Merged airports (NASR + OurAirports)
let iataToIcao = new Map();          // IATA code lookup
let navaidsData = new Map();         // Merged navaids
let fixesData = new Map();           // Waypoints/fixes (NASR only)
let frequenciesData = new Map();     // Frequencies by airport ID
let runwaysData = new Map();         // Runways by airport ID/code
let db = null;
let dataTimestamp = null;
let dataSources = [];                // Track which sources were loaded

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

function saveToCache(nasrData, ourairportsData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const data = {
            id: 'flightdata_cache_v4',
            nasr: nasrData,
            ourairports: ourairportsData,
            timestamp: Date.now(),
            version: 4
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
        const request = store.get('flightdata_cache_v4');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function clearCacheDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        // Clear all old cache versions
        const requests = [
            store.delete('flightdata_cache'),
            store.delete('flightdata_cache_v4')
        ];
        Promise.all(requests.map(r => new Promise((res) => {
            r.onsuccess = () => res();
            r.onerror = () => res();
        }))).then(resolve).catch(reject);
    });
}

// ============================================
// DATA LOADING - Multi-Source Strategy
// ============================================

async function loadData(onStatusUpdate) {
    onStatusUpdate('[...] INITIALIZING WORLDWIDE DATABASE', 'loading');

    let nasrData = null;
    let ourairportsData = null;

    try {
        // Try NASR first (primary source for US data + fixes)
        onStatusUpdate('[...] ATTEMPTING NASR DATA LOAD', 'loading');
        try {
            nasrData = await window.NASRAdapter.loadNASRData(onStatusUpdate);
            dataSources.push('NASR');
        } catch (nasrError) {
            console.warn('NASR loading failed:', nasrError);
            onStatusUpdate('[!] NASR UNAVAILABLE - USING FALLBACK', 'warning');
        }

        // Load OurAirports (international + fallback)
        onStatusUpdate('[...] LOADING OURAIRPORTS DATA', 'loading');
        try {
            ourairportsData = await window.OurAirportsAdapter.loadOurAirportsData(onStatusUpdate);
            dataSources.push('OurAirports');
        } catch (oaError) {
            console.warn('OurAirports loading failed:', oaError);
            if (!nasrData) {
                throw new Error('Both NASR and OurAirports failed to load');
            }
            onStatusUpdate('[!] OURAIRPORTS UNAVAILABLE', 'warning');
        }

        // Merge data sources
        onStatusUpdate('[...] MERGING WORLDWIDE DATABASE', 'loading');
        mergeDataSources(nasrData, ourairportsData);

        // Cache the data
        onStatusUpdate('[...] CACHING TO INDEXEDDB', 'loading');
        await saveToCache(
            nasrData ? nasrData.rawCSV : null,
            ourairportsData ? ourairportsData.rawCSV : null
        );

        const stats = getDataStats();
        const sourceStr = dataSources.join(' + ');
        onStatusUpdate(
            `[OK] ${stats.airports} AIRPORTS | ${stats.navaids} NAVAIDS | ${stats.fixes} FIXES (${sourceStr})`,
            'success'
        );

        dataTimestamp = Date.now();
        return { success: true };

    } catch (error) {
        onStatusUpdate(`[ERR] ${error.message}`, 'error');
        throw error;
    }
}

function mergeDataSources(nasrData, ourairportsData) {
    // Clear existing data
    airportsData.clear();
    iataToIcao.clear();
    navaidsData.clear();
    fixesData.clear();
    frequenciesData.clear();
    runwaysData.clear();
    dataSources = [];

    // Add NASR data first (priority)
    if (nasrData) {
        // NASR Airports
        for (const [code, airport] of nasrData.data.airports) {
            airportsData.set(code, airport);
        }

        // NASR Navaids
        for (const [ident, navaid] of nasrData.data.navaids) {
            navaidsData.set(ident, navaid);
        }

        // NASR Fixes (unique to NASR)
        for (const [ident, fix] of nasrData.data.fixes) {
            fixesData.set(ident, fix);
        }

        // NASR Runways (indexed by airport code)
        for (const [code, runways] of nasrData.data.runways) {
            runwaysData.set(code, runways);
        }

        // NASR Frequencies (indexed by airport code)
        for (const [code, freqs] of nasrData.data.frequencies) {
            frequenciesData.set(code, freqs);
        }
    }

    // Add OurAirports data (fills gaps, doesn't override NASR)
    if (ourairportsData) {
        // OurAirports Airports (only add if not already present)
        for (const [code, airport] of ourairportsData.data.airports) {
            if (!airportsData.has(code)) {
                airportsData.set(code, airport);
            }
        }

        // Build IATA lookup
        for (const [iata, icao] of ourairportsData.data.iataToIcao) {
            if (!iataToIcao.has(iata)) {
                iataToIcao.set(iata, icao);
            }
        }

        // OurAirports Navaids (only add if not already present)
        for (const [ident, navaid] of ourairportsData.data.navaids) {
            if (!navaidsData.has(ident)) {
                navaidsData.set(ident, navaid);
            }
        }

        // OurAirports Frequencies (indexed by airport internal ID)
        for (const [id, freqs] of ourairportsData.data.frequencies) {
            // Find the airport by ID and index by code
            for (const [code, airport] of airportsData) {
                if (airport.id === id && !frequenciesData.has(code)) {
                    frequenciesData.set(code, freqs);
                    break;
                }
            }
        }

        // OurAirports Runways (indexed by airport internal ID)
        for (const [id, runways] of ourairportsData.data.runways) {
            // Find the airport by ID and index by code
            for (const [code, airport] of airportsData) {
                if (airport.id === id && !runwaysData.has(code)) {
                    runwaysData.set(code, runways);
                    break;
                }
            }
        }
    }
}

async function checkCachedData() {
    try {
        const cachedData = await loadFromCacheDB();
        if (cachedData && cachedData.version === 4 && cachedData.timestamp) {
            const age = Date.now() - cachedData.timestamp;
            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));

            // Load from cache
            loadFromCache(cachedData.nasr, cachedData.ourairports);

            // Determine cache status
            const nasrAge = cachedData.nasr ? age : null;
            const nasrExpired = nasrAge && nasrAge >= NASR_CACHE_DURATION;
            const oaExpired = age >= CACHE_DURATION;

            if (nasrExpired || oaExpired) {
                return {
                    loaded: true,
                    status: `[!] DATABASE LOADED (${daysOld}D OLD - UPDATE RECOMMENDED)`,
                    type: 'warning'
                };
            } else {
                const sources = dataSources.join(' + ');
                return {
                    loaded: true,
                    status: `[OK] DATABASE LOADED FROM CACHE (${daysOld}D OLD - ${sources})`,
                    type: 'success'
                };
            }
        }
    } catch (error) {
        console.error('Error loading cached data:', error);
    }
    return { loaded: false };
}

function loadFromCache(nasrRawCSV, ourairportsRawCSV) {
    dataSources = [];

    let nasrData = null;
    let ourairportsData = null;

    // Parse NASR cache
    if (nasrRawCSV) {
        try {
            nasrData = {
                data: {
                    airports: window.NASRAdapter.parseNASRAirports(nasrRawCSV.airportsCSV),
                    runways: window.NASRAdapter.parseNASRRunways(nasrRawCSV.runwaysCSV),
                    navaids: window.NASRAdapter.parseNASRNavaids(nasrRawCSV.navaidsCSV),
                    fixes: window.NASRAdapter.parseNASRFixes(nasrRawCSV.fixesCSV),
                    frequencies: window.NASRAdapter.parseNASRFrequencies(nasrRawCSV.frequenciesCSV)
                }
            };
            dataSources.push('NASR');
        } catch (error) {
            console.error('Error parsing cached NASR data:', error);
        }
    }

    // Parse OurAirports cache
    if (ourairportsRawCSV) {
        try {
            const { airports, iataToIcao } = window.OurAirportsAdapter.parseOAAirports(ourairportsRawCSV.airportsCSV);
            ourairportsData = {
                data: {
                    airports,
                    iataToIcao,
                    navaids: window.OurAirportsAdapter.parseOANavaids(ourairportsRawCSV.navaidsCSV),
                    frequencies: window.OurAirportsAdapter.parseOAFrequencies(ourairportsRawCSV.frequenciesCSV),
                    runways: window.OurAirportsAdapter.parseOARunways(ourairportsRawCSV.runwaysCSV)
                }
            };
            dataSources.push('OurAirports');
        } catch (error) {
            console.error('Error parsing cached OurAirports data:', error);
        }
    }

    // Merge
    mergeDataSources(nasrData, ourairportsData);
}

async function clearCache() {
    await clearCacheDB();
    airportsData.clear();
    iataToIcao.clear();
    navaidsData.clear();
    fixesData.clear();
    frequenciesData.clear();
    runwaysData.clear();
    dataTimestamp = null;
    dataSources = [];
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

function getFix(ident) {
    return fixesData.get(ident);
}

function getFrequencies(airportCode) {
    return frequenciesData.get(airportCode) || [];
}

function getRunways(airportCode) {
    return runwaysData.get(airportCode) || [];
}

function getDataStats() {
    return {
        airports: airportsData.size,
        navaids: navaidsData.size,
        fixes: fixesData.size,
        sources: dataSources.join(' + '),
        timestamp: dataTimestamp
    };
}

function searchWaypoints(query) {
    const exactAirports = [];
    const exactNavaids = [];
    const exactFixes = [];
    const partialAirports = [];
    const partialNavaids = [];
    const partialFixes = [];
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
            source: airport.source || 'unknown',
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
            source: navaid.source || 'unknown',
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

    // Search fixes/waypoints
    for (const [ident, fix] of fixesData) {
        const result = {
            code: fix.ident,
            fullCode: fix.ident,
            type: 'FIX',
            waypointType: 'fix',
            name: fix.ident,
            location: `${fix.state || ''} ${fix.country}`.trim(),
            source: fix.source || 'nasr',
            data: fix
        };

        if (ident === query) {
            exactFixes.push(result);
        } else if (ident.startsWith(query) || ident.includes(query)) {
            partialFixes.push(result);
        }
    }

    // Return prioritized results: exact matches first, then partial, then name matches
    return [
        ...exactAirports,
        ...exactNavaids,
        ...exactFixes,
        ...partialAirports,
        ...partialNavaids,
        ...partialFixes,
        ...nameAirports,
        ...nameNavaids
    ].slice(0, 20); // Increased limit for more comprehensive results
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
    getFix,
    getFrequencies,
    getRunways,
    getDataStats,
    searchWaypoints,

    // Query history
    saveQueryHistory,
    loadQueryHistory
};
