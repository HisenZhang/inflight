// Data Manager Module - Orchestrates NASR (primary) and OurAirports (fallback) data

// Database configuration
const DB_NAME = 'FlightPlanningDB';
const DB_VERSION = 7; // Updated for airways, STARs, and DPs
const STORE_NAME = 'flightdata';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

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
let airwaysData = new Map();         // Airways (NASR only)
let starsData = new Map();           // STARs (NASR only)
let dpsData = new Map();             // DPs (NASR only)
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

function saveToCache() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Serialize Maps to arrays for storage
        const data = {
            id: 'flightdata_cache_v7',
            airports: Array.from(airportsData.entries()),
            iataToIcao: Array.from(iataToIcao.entries()),
            navaids: Array.from(navaidsData.entries()),
            fixes: Array.from(fixesData.entries()),
            frequencies: Array.from(frequenciesData.entries()),
            runways: Array.from(runwaysData.entries()),
            airways: Array.from(airwaysData.entries()),
            stars: Array.from(starsData.entries()),
            dps: Array.from(dpsData.entries()),
            dataSources: dataSources,
            timestamp: Date.now(),
            version: 7
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
        const request = store.get('flightdata_cache_v7');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function clearCacheDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        // Clear all cache versions
        const requests = [
            store.delete('flightdata_cache'),
            store.delete('flightdata_cache_v4'),
            store.delete('flightdata_cache_v5'),
            store.delete('flightdata_cache_v6'),
            store.delete('flightdata_cache_v7')
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
        // Load NASR and OurAirports in parallel for better performance
        onStatusUpdate('[...] LOADING DATA SOURCES IN PARALLEL', 'loading');

        const results = await Promise.allSettled([
            window.NASRAdapter.loadNASRData(onStatusUpdate),
            window.OurAirportsAdapter.loadOurAirportsData(onStatusUpdate)
        ]);

        if (results[0].status === 'fulfilled') {
            nasrData = results[0].value;
            dataSources.push('NASR');
        } else {
            console.warn('NASR loading failed:', results[0].reason);
            onStatusUpdate('[!] NASR UNAVAILABLE - USING FALLBACK', 'warning');
        }

        if (results[1].status === 'fulfilled') {
            ourairportsData = results[1].value;
            dataSources.push('OurAirports');
        } else {
            console.warn('OurAirports loading failed:', results[1].reason);
            if (!nasrData) {
                throw new Error('Both NASR and OurAirports failed to load');
            }
            onStatusUpdate('[!] OURAIRPORTS UNAVAILABLE', 'warning');
        }

        // Merge data sources
        onStatusUpdate('[...] MERGING WORLDWIDE DATABASE', 'loading');
        mergeDataSources(nasrData, ourairportsData, onStatusUpdate);

        // Cache the indexed data (not raw CSV - saves re-indexing on reload)
        onStatusUpdate('[...] CACHING INDEXED DATABASE', 'loading');
        await saveToCache();

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

function mergeDataSources(nasrData, ourairportsData, onStatusUpdate = null) {
    // Clear existing data
    airportsData.clear();
    iataToIcao.clear();
    navaidsData.clear();
    fixesData.clear();
    frequenciesData.clear();
    runwaysData.clear();
    airwaysData.clear();
    starsData.clear();
    dpsData.clear();
    dataSources = [];

    // Add NASR data first (priority)
    if (nasrData) {
        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NASR AIRPORTS', 'loading');
        for (const [code, airport] of nasrData.data.airports) {
            airportsData.set(code, airport);
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NASR NAVAIDS', 'loading');
        for (const [ident, navaid] of nasrData.data.navaids) {
            navaidsData.set(ident, navaid);
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NASR FIXES', 'loading');
        for (const [ident, fix] of nasrData.data.fixes) {
            fixesData.set(ident, fix);
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NASR RUNWAYS', 'loading');
        for (const [code, runways] of nasrData.data.runways) {
            runwaysData.set(code, runways);
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NASR FREQUENCIES', 'loading');
        for (const [code, freqs] of nasrData.data.frequencies) {
            frequenciesData.set(code, freqs);
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NASR AIRWAYS', 'loading');
        for (const [id, airway] of nasrData.data.airways) {
            airwaysData.set(id, airway);
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NASR STARS', 'loading');
        for (const [id, star] of nasrData.data.stars) {
            starsData.set(id, star);
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NASR DPS', 'loading');
        for (const [id, dp] of nasrData.data.dps) {
            dpsData.set(id, dp);
        }

        // Initialize RouteExpander with data
        if (typeof window.RouteExpander !== 'undefined') {
            if (onStatusUpdate) onStatusUpdate('[...] INITIALIZING ROUTE EXPANDER', 'loading');
            window.RouteExpander.setAirwaysData(airwaysData);
            window.RouteExpander.setStarsData(starsData);
            window.RouteExpander.setDpsData(dpsData);
        }
    }

    // Add OurAirports data (fills gaps, doesn't override NASR)
    if (ourairportsData) {
        if (onStatusUpdate) onStatusUpdate('[...] BUILDING AIRPORT INDEX', 'loading');
        // Build reverse lookup: airport ID -> code (for O(1) frequency/runway mapping)
        const idToCode = new Map();

        // OurAirports Airports (only add if not already present)
        for (const [code, airport] of ourairportsData.data.airports) {
            if (airport.id) {
                idToCode.set(airport.id, code);
            }
            if (!airportsData.has(code)) {
                airportsData.set(code, airport);
            }
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING IATA CODES', 'loading');
        // Build IATA lookup
        for (const [iata, icao] of ourairportsData.data.iataToIcao) {
            if (!iataToIcao.has(iata)) {
                iataToIcao.set(iata, icao);
            }
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NAVAIDS', 'loading');
        // OurAirports Navaids (only add if not already present)
        for (const [ident, navaid] of ourairportsData.data.navaids) {
            if (!navaidsData.has(ident)) {
                navaidsData.set(ident, navaid);
            }
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING FREQUENCIES', 'loading');
        // OurAirports Frequencies (use O(1) lookup instead of O(n) search)
        for (const [id, freqs] of ourairportsData.data.frequencies) {
            const code = idToCode.get(id);
            if (code && !frequenciesData.has(code)) {
                frequenciesData.set(code, freqs);
            }
        }

        if (onStatusUpdate) onStatusUpdate('[...] INDEXING RUNWAYS', 'loading');
        // OurAirports Runways (use O(1) lookup instead of O(n) search)
        for (const [id, runways] of ourairportsData.data.runways) {
            const code = idToCode.get(id);
            if (code && !runwaysData.has(code)) {
                runwaysData.set(code, runways);
            }
        }
    }
}

async function checkCachedData() {
    try {
        const cachedData = await loadFromCacheDB();
        if (cachedData && cachedData.version === 7 && cachedData.timestamp) {
            const age = Date.now() - cachedData.timestamp;
            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));

            // Load from indexed cache (fast - no re-indexing needed)
            loadFromCache(cachedData);

            // Determine cache status (conservative: use 7-day expiry)
            const cacheExpired = age >= CACHE_DURATION;

            if (cacheExpired) {
                return {
                    loaded: true,
                    status: `[!] DATABASE LOADED (${daysOld}D OLD - UPDATE RECOMMENDED)`,
                    type: 'warning'
                };
            } else {
                const sources = dataSources.join(' + ');
                return {
                    loaded: true,
                    status: `[OK] INDEXED DATABASE LOADED (${daysOld}D OLD - ${sources})`,
                    type: 'success'
                };
            }
        }
    } catch (error) {
        console.error('Error loading cached data:', error);
    }
    return { loaded: false };
}

function loadFromCache(cachedData) {
    // Deserialize arrays back to Maps (instant - no parsing/indexing needed!)
    airportsData = new Map(cachedData.airports || []);
    iataToIcao = new Map(cachedData.iataToIcao || []);
    navaidsData = new Map(cachedData.navaids || []);
    fixesData = new Map(cachedData.fixes || []);
    frequenciesData = new Map(cachedData.frequencies || []);
    runwaysData = new Map(cachedData.runways || []);
    airwaysData = new Map(cachedData.airways || []);
    starsData = new Map(cachedData.stars || []);
    dpsData = new Map(cachedData.dps || []);
    dataSources = cachedData.dataSources || [];
    dataTimestamp = cachedData.timestamp;

    // Initialize RouteExpander with data
    if (typeof window.RouteExpander !== 'undefined') {
        window.RouteExpander.setAirwaysData(airwaysData);
        window.RouteExpander.setStarsData(starsData);
        window.RouteExpander.setDpsData(dpsData);
    }
}

async function clearCache() {
    await clearCacheDB();
    airportsData.clear();
    iataToIcao.clear();
    navaidsData.clear();
    fixesData.clear();
    frequenciesData.clear();
    runwaysData.clear();
    airwaysData.clear();
    starsData.clear();
    dpsData.clear();
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
