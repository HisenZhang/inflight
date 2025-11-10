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
let tokenTypeMap = new Map();        // Fast lookup: token -> type (AIRPORT/NAVAID/FIX/AIRWAY/PROCEDURE)
let fileMetadata = new Map();        // Track individual file load times and validity
let rawCSVData = {};                 // Raw CSV data for reindexing
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
            id: 'flightdata_cache_v9',
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
            version: 9,
            // Track individual file metadata
            fileMetadata: Object.fromEntries(fileMetadata),
            // Store raw CSV data for reindexing
            rawCSV: rawCSVData
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
        const request = store.get('flightdata_cache_v9');
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
            store.delete('flightdata_cache_v7'),
            store.delete('flightdata_cache_v8'),
            store.delete('flightdata_cache_v9')
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

    // File loading callback
    const onFileLoaded = (metadata) => {
        fileMetadata.set(metadata.id, metadata);
        console.log(`[DataManager] Loaded file: ${metadata.id} (${metadata.recordCount} records, ${(metadata.sizeBytes / 1024).toFixed(1)}KB)`);
    };

    try {
        // Load NASR and OurAirports in parallel for better performance
        onStatusUpdate('[...] LOADING DATA SOURCES IN PARALLEL', 'loading');

        const results = await Promise.allSettled([
            window.NASRAdapter.loadNASRData(onStatusUpdate, onFileLoaded),
            window.OurAirportsAdapter.loadOurAirportsData(onStatusUpdate, onFileLoaded)
        ]);

        if (results[0].status === 'fulfilled') {
            nasrData = results[0].value;
            dataSources.push('NASR');

            // Merge NASR file metadata
            if (nasrData.fileMetadata) {
                for (const [id, metadata] of nasrData.fileMetadata) {
                    fileMetadata.set(id, metadata);
                }
            }

            // Store raw CSV data for reindexing
            if (nasrData.rawCSV) {
                rawCSVData = { ...rawCSVData, ...nasrData.rawCSV };
            }
        } else {
            console.warn('NASR loading failed:', results[0].reason);
            onStatusUpdate('[!] NASR UNAVAILABLE - USING FALLBACK', 'warning');
        }

        if (results[1].status === 'fulfilled') {
            ourairportsData = results[1].value;
            dataSources.push('OurAirports');

            // Merge OurAirports file metadata
            if (ourairportsData.fileMetadata) {
                for (const [id, metadata] of ourairportsData.fileMetadata) {
                    fileMetadata.set(id, metadata);
                }
            }

            // Store raw CSV data for reindexing
            if (ourairportsData.rawCSV) {
                rawCSVData = { ...rawCSVData, ...ourairportsData.rawCSV };
            }
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

// Re-parse data from cached raw CSV files
async function reparseFromRawCSV(onStatusUpdate) {
    // Create mock data objects with parsed data from raw CSV
    const nasrData = { data: {} };
    const ourairportsData = { data: {} };

    // Parse NASR data if available
    if (rawCSVData.airportsCSV) {
        onStatusUpdate('[...] PARSING NASR AIRPORTS', 'loading');
        nasrData.data.airports = window.NASRAdapter.parseNASRAirports(rawCSVData.airportsCSV);
    }
    if (rawCSVData.runwaysCSV) {
        onStatusUpdate('[...] PARSING NASR RUNWAYS', 'loading');
        nasrData.data.runways = window.NASRAdapter.parseNASRRunways(rawCSVData.runwaysCSV);
    }
    if (rawCSVData.navaidsCSV) {
        onStatusUpdate('[...] PARSING NASR NAVAIDS', 'loading');
        nasrData.data.navaids = window.NASRAdapter.parseNASRNavaids(rawCSVData.navaidsCSV);
    }
    if (rawCSVData.fixesCSV) {
        onStatusUpdate('[...] PARSING NASR FIXES', 'loading');
        nasrData.data.fixes = window.NASRAdapter.parseNASRFixes(rawCSVData.fixesCSV);
    }
    if (rawCSVData.frequenciesCSV) {
        onStatusUpdate('[...] PARSING NASR FREQUENCIES', 'loading');
        nasrData.data.frequencies = window.NASRAdapter.parseNASRFrequencies(rawCSVData.frequenciesCSV);
    }
    if (rawCSVData.airwaysCSV) {
        onStatusUpdate('[...] PARSING NASR AIRWAYS', 'loading');
        nasrData.data.airways = window.NASRAdapter.parseNASRAirways(rawCSVData.airwaysCSV);
    }
    if (rawCSVData.starsCSV) {
        onStatusUpdate('[...] PARSING NASR STARS', 'loading');
        nasrData.data.stars = window.NASRAdapter.parseNASRSTARs(rawCSVData.starsCSV);
    }
    if (rawCSVData.dpsCSV) {
        onStatusUpdate('[...] PARSING NASR DPS', 'loading');
        nasrData.data.dps = window.NASRAdapter.parseNASRDPs(rawCSVData.dpsCSV);
    }

    // Parse OurAirports data if available
    if (rawCSVData.oa_airportsCSV) {
        onStatusUpdate('[...] PARSING OURAIRPORTS AIRPORTS', 'loading');
        ourairportsData.data.airports = window.OurAirportsAdapter.parseOurAirportsAirports(rawCSVData.oa_airportsCSV);
    }
    if (rawCSVData.oa_frequenciesCSV) {
        onStatusUpdate('[...] PARSING OURAIRPORTS FREQUENCIES', 'loading');
        ourairportsData.data.frequencies = window.OurAirportsAdapter.parseOurAirportsFrequencies(rawCSVData.oa_frequenciesCSV);
    }
    if (rawCSVData.oa_runwaysCSV) {
        onStatusUpdate('[...] PARSING OURAIRPORTS RUNWAYS', 'loading');
        ourairportsData.data.runways = window.OurAirportsAdapter.parseOurAirportsRunways(rawCSVData.oa_runwaysCSV);
    }
    if (rawCSVData.oa_navaidsCSV) {
        onStatusUpdate('[...] PARSING OURAIRPORTS NAVAIDS', 'loading');
        ourairportsData.data.navaids = window.OurAirportsAdapter.parseOurAirportsNavaids(rawCSVData.oa_navaidsCSV);
    }
    if (rawCSVData.oa_iataCodesCSV) {
        onStatusUpdate('[...] PARSING IATA CODES', 'loading');
        ourairportsData.data.iataToIcao = window.OurAirportsAdapter.parseIATACodes(rawCSVData.oa_iataCodesCSV);
    }

    // Merge the reparsed data
    onStatusUpdate('[...] MERGING REPARSED DATA', 'loading');
    mergeDataSources(
        Object.keys(nasrData.data).length > 0 ? nasrData : null,
        Object.keys(ourairportsData.data).length > 0 ? ourairportsData : null,
        onStatusUpdate
    );
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

        dataSources.push('NASR');
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

        dataSources.push('OurAirports');
    }

    // Build token type lookup map
    if (onStatusUpdate) onStatusUpdate('[...] BUILDING TOKEN TYPE MAP', 'loading');
    buildTokenTypeMap();

    // Initialize QueryEngine with data references
    if (typeof window.QueryEngine !== 'undefined') {
        if (onStatusUpdate) onStatusUpdate('[...] INITIALIZING QUERY ENGINE', 'loading');
        window.QueryEngine.init(airportsData, navaidsData, fixesData, airwaysData, tokenTypeMap);
    }

    // Initialize RouteExpander with data
    if (typeof window.RouteExpander !== 'undefined') {
        if (onStatusUpdate) onStatusUpdate('[...] INITIALIZING ROUTE EXPANDER', 'loading');
        window.RouteExpander.setAirwaysData(airwaysData);
        window.RouteExpander.setStarsData(starsData);
        window.RouteExpander.setDpsData(dpsData);
    }
}

async function checkCachedData() {
    try {
        const cachedData = await loadFromCacheDB();
        if (cachedData && (cachedData.version === 9 || cachedData.version === 8 || cachedData.version === 7) && cachedData.timestamp) {
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

async function loadFromCache(onStatusUpdate) {
    // If called with cachedData object directly (old behavior from checkCachedData)
    if (onStatusUpdate && typeof onStatusUpdate === 'object' && !onStatusUpdate.call) {
        const cachedData = onStatusUpdate;
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

        // Restore file metadata if available
        if (cachedData.fileMetadata) {
            fileMetadata = new Map(Object.entries(cachedData.fileMetadata));
        }

        // Restore raw CSV data for reindexing
        if (cachedData.rawCSV) {
            rawCSVData = cachedData.rawCSV;
        }

        // Build token type lookup map
        buildTokenTypeMap();

        // Initialize QueryEngine with data references
        if (typeof window.QueryEngine !== 'undefined') {
            window.QueryEngine.init(airportsData, navaidsData, fixesData, airwaysData, tokenTypeMap);
        }

        // Initialize RouteExpander with data
        if (typeof window.RouteExpander !== 'undefined') {
            window.RouteExpander.setAirwaysData(airwaysData);
            window.RouteExpander.setStarsData(starsData);
            window.RouteExpander.setDpsData(dpsData);
        }
        return;
    }

    // New behavior: Load from IndexedDB and reparse from raw CSV
    if (!onStatusUpdate) {
        onStatusUpdate = (msg, type) => console.log(`[DataManager] ${msg}`);
    }

    try {
        onStatusUpdate('[...] LOADING CACHED DATA FROM DATABASE', 'loading');
        const cachedData = await loadFromCacheDB();

        if (!cachedData) {
            throw new Error('No cached data found');
        }

        // Check if raw CSV data is available for reindexing
        if (!cachedData.rawCSV || Object.keys(cachedData.rawCSV).length === 0) {
            throw new Error('No raw CSV data found in cache - please reload data from internet');
        }

        // Restore raw CSV data
        rawCSVData = cachedData.rawCSV;
        dataSources = cachedData.dataSources || [];
        dataTimestamp = cachedData.timestamp;

        // Restore file metadata if available
        if (cachedData.fileMetadata) {
            fileMetadata = new Map(Object.entries(cachedData.fileMetadata));
        }

        // Re-parse from raw CSV with current parser code
        onStatusUpdate('[...] REPARSING RAW DATA WITH UPDATED PARSERS', 'loading');
        await reparseFromRawCSV(onStatusUpdate);

        // Build token type lookup map with updated parser logic
        onStatusUpdate('[...] REBUILDING TOKEN TYPE MAP', 'loading');
        buildTokenTypeMap();

        // Initialize QueryEngine with data references
        if (typeof window.QueryEngine !== 'undefined') {
            onStatusUpdate('[...] INITIALIZING QUERY ENGINE', 'loading');
            window.QueryEngine.init(airportsData, navaidsData, fixesData, airwaysData, tokenTypeMap);
        }

        // Initialize RouteExpander with data
        if (typeof window.RouteExpander !== 'undefined') {
            onStatusUpdate('[...] INITIALIZING ROUTE EXPANDER', 'loading');
            window.RouteExpander.setAirwaysData(airwaysData);
            window.RouteExpander.setStarsData(starsData);
            window.RouteExpander.setDpsData(dpsData);
        }

        // Save reparsed data back to cache
        onStatusUpdate('[...] SAVING REPARSED DATA TO CACHE', 'loading');
        await saveToCache();

        const stats = getDataStats();
        const sourceStr = dataSources.join(' + ');
        onStatusUpdate(
            `[OK] ${stats.airports} AIRPORTS | ${stats.navaids} NAVAIDS | ${stats.fixes} FIXES (${sourceStr})`,
            'success'
        );
    } catch (error) {
        onStatusUpdate(`[ERR] Failed to load from cache: ${error.message}`, 'error');
        throw error;
    }
}

// Build unified token type lookup map (NO IATA codes to avoid confusion)
function buildTokenTypeMap() {
    tokenTypeMap.clear();

    // Index airports by ICAO code ONLY (NO IATA 3-letter codes to avoid confusion)
    for (const [code, airport] of airportsData) {
        if (code.length >= 4) {  // ICAO codes are 4+ characters
            tokenTypeMap.set(code, 'AIRPORT');
        }
    }

    // Index navaids
    for (const [ident, navaid] of navaidsData) {
        if (!tokenTypeMap.has(ident)) {
            tokenTypeMap.set(ident, 'NAVAID');
        }
    }

    // Index fixes/waypoints
    for (const [ident, fix] of fixesData) {
        if (!tokenTypeMap.has(ident)) {
            tokenTypeMap.set(ident, 'FIX');
        }
    }

    // Index airways
    for (const [id, airway] of airwaysData) {
        if (!tokenTypeMap.has(id)) {
            tokenTypeMap.set(id, 'AIRWAY');
        }
    }

    // Index STARs and DPs (both full name and short suffix)
    // STARs and DPs can be either arrays or objects with {body, transitions}
    // Index STARs - now using standardized structure with { name, computerCode, type, body, transitions }
    try {
        const starsIndexed = new Set();
        for (const [id, star] of starsData) {
            // Index by key (both procName and computerCode)
            if (!tokenTypeMap.has(id)) {
                tokenTypeMap.set(id, 'PROCEDURE');
            }

            // If value is an object (new structure), index by name property
            if (star && typeof star === 'object' && star.name) {
                if (!tokenTypeMap.has(star.name)) {
                    tokenTypeMap.set(star.name, 'PROCEDURE');
                    starsIndexed.add(star.name);
                }
            }
        }
        console.log(`[DataManager] Indexed ${starsIndexed.size} unique STAR procedures`);
    } catch (error) {
        console.error('[DataManager] Error indexing STARs:', error);
    }

    // Index DPs - now using standardized structure with { name, computerCode, type, body, transitions }
    try {
        const dpsIndexed = new Set();
        const hideyKeys = [];

        for (const [id, dp] of dpsData) {
            // Track all keys that contain HIDEY for debugging
            if (id.includes('HIDEY')) {
                hideyKeys.push(id);
            }

            // Index by key (both procName and computerCode)
            if (!tokenTypeMap.has(id)) {
                tokenTypeMap.set(id, 'PROCEDURE');
            }

            // If value is an object (new structure), index by name property
            if (dp && typeof dp === 'object' && dp.name) {
                if (!tokenTypeMap.has(dp.name)) {
                    tokenTypeMap.set(dp.name, 'PROCEDURE');
                    dpsIndexed.add(dp.name);
                }
            }
        }

        console.log(`[DataManager] Indexed ${dpsIndexed.size} unique DP procedures:`, Array.from(dpsIndexed).slice(0, 10).join(', '));
        console.log(`[DataManager] Total DP keys in database: ${dpsData.size}`);

        if (hideyKeys.length > 0) {
            console.log(`[DataManager] Found ${hideyKeys.length} HIDEY-related keys:`, hideyKeys.slice(0, 5));
        }

        // Check if HIDEY1 was indexed
        if (tokenTypeMap.has('HIDEY1')) {
            console.log(`[DataManager] ✓ HIDEY1 indexed as: ${tokenTypeMap.get('HIDEY1')}`);
        } else {
            console.warn(`[DataManager] ✗ HIDEY1 NOT indexed in token type map`);
        }
    } catch (error) {
        console.error('[DataManager] Error indexing DPs:', error);
    }

    console.log(`[DataManager] Token type map built: ${tokenTypeMap.size} entries`);
}

async function rebuildTokenTypeMap() {
    try {
        console.log('[DataManager] Rebuilding token type map...');
        buildTokenTypeMap();
        console.log('[DataManager] Token type map rebuilt successfully');
    } catch (error) {
        console.error('[DataManager] Error rebuilding token type map:', error);
        throw error;
    }
}

function getFileStatus() {
    const now = Date.now();
    const status = [];

    // Define expected files and their sources
    const files = [
        { id: 'nasr_airports', name: 'NASR Airports', source: 'NASR' },
        { id: 'nasr_runways', name: 'NASR Runways', source: 'NASR' },
        { id: 'nasr_navaids', name: 'NASR Navaids', source: 'NASR' },
        { id: 'nasr_fixes', name: 'NASR Fixes', source: 'NASR' },
        { id: 'nasr_airways', name: 'NASR Airways', source: 'NASR' },
        { id: 'nasr_stars', name: 'NASR STARs', source: 'NASR' },
        { id: 'nasr_dps', name: 'NASR DPs', source: 'NASR' },
        { id: 'oa_airports', name: 'OurAirports Airports', source: 'OurAirports' },
        { id: 'oa_frequencies', name: 'OurAirports Frequencies', source: 'OurAirports' },
        { id: 'oa_runways', name: 'OurAirports Runways', source: 'OurAirports' },
        { id: 'oa_navaids', name: 'OurAirports Navaids', source: 'OurAirports' }
    ];

    for (const file of files) {
        const metadata = fileMetadata.get(file.id);
        if (metadata) {
            const age = now - metadata.timestamp;
            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
            const expired = age >= CACHE_DURATION;

            status.push({
                ...file,
                loaded: true,
                timestamp: metadata.timestamp,
                daysOld,
                expired,
                recordCount: metadata.recordCount || 0
            });
        } else {
            status.push({
                ...file,
                loaded: false,
                timestamp: null,
                daysOld: null,
                expired: false,
                recordCount: 0
            });
        }
    }

    return status;
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
    tokenTypeMap.clear();
    fileMetadata.clear();
    dataTimestamp = null;
    dataSources = [];
}

// Clear in-memory data structures only (keeps IndexedDB cache for reindexing)
function clearInMemoryData() {
    console.log('[DataManager] Clearing in-memory data structures...');
    airportsData.clear();
    iataToIcao.clear();
    navaidsData.clear();
    fixesData.clear();
    frequenciesData.clear();
    runwaysData.clear();
    airwaysData.clear();
    starsData.clear();
    dpsData.clear();
    tokenTypeMap.clear();
    fileMetadata.clear();
    dataTimestamp = null;
    dataSources = [];
    // Note: rawCSVData is NOT cleared - it's needed for reindexing
    console.log('[DataManager] In-memory data cleared (rawCSV preserved)');
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

function getFixCoordinates(ident) {
    // Try fixes first
    const fix = fixesData.get(ident);
    if (fix && fix.lat !== undefined && fix.lon !== undefined) {
        return { lat: fix.lat, lon: fix.lon };
    }

    // Try navaids
    const navaid = navaidsData.get(ident);
    if (navaid && navaid.lat !== undefined && navaid.lon !== undefined) {
        return { lat: navaid.lat, lon: navaid.lon };
    }

    // Try airports
    const airport = airportsData.get(ident);
    if (airport && airport.lat !== undefined && airport.lon !== undefined) {
        return { lat: airport.lat, lon: airport.lon };
    }

    return null;
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
        airways: airwaysData.size,
        stars: starsData.size,
        dps: dpsData.size,
        tokenTypes: tokenTypeMap.size,
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

// Get token type for route parsing
function getTokenType(token) {
    return tokenTypeMap.get(token) || null;
}

// ============================================
// NAVLOG SAVE/RESTORE FOR CRASH RECOVERY
// ============================================

const NAVLOG_KEY = 'saved_navlog';

// Save computed navlog to localStorage for crash recovery
function saveNavlog(navlogData) {
    try {
        const saveData = {
            timestamp: Date.now(),
            routeString: navlogData.routeString,
            waypoints: navlogData.waypoints,
            legs: navlogData.legs,
            totalDistance: navlogData.totalDistance,
            totalTime: navlogData.totalTime,
            fuelStatus: navlogData.fuelStatus,
            options: navlogData.options
        };

        localStorage.setItem(NAVLOG_KEY, JSON.stringify(saveData));
        console.log('[DataManager] Navlog saved for crash recovery');
        return true;
    } catch (error) {
        console.error('[DataManager] Failed to save navlog:', error);
        return false;
    }
}

// Load saved navlog from localStorage
function loadSavedNavlog() {
    try {
        const saved = localStorage.getItem(NAVLOG_KEY);
        if (!saved) return null;

        const navlogData = JSON.parse(saved);

        // Check if saved data is less than 24 hours old
        const ageHours = (Date.now() - navlogData.timestamp) / (1000 * 60 * 60);
        if (ageHours > 24) {
            console.log('[DataManager] Saved navlog expired (>24h old), discarding');
            clearSavedNavlog();
            return null;
        }

        console.log('[DataManager] Loaded saved navlog from', new Date(navlogData.timestamp).toLocaleString());
        return navlogData;
    } catch (error) {
        console.error('[DataManager] Failed to load saved navlog:', error);
        return null;
    }
}

// Clear saved navlog
function clearSavedNavlog() {
    try {
        localStorage.removeItem(NAVLOG_KEY);
        console.log('[DataManager] Saved navlog cleared');
        return true;
    } catch (error) {
        console.error('[DataManager] Failed to clear saved navlog:', error);
        return false;
    }
}

// Export navlog as JSON file for download
function exportNavlog(navlogData) {
    try {
        const exportData = {
            version: '1.0',
            exportTimestamp: Date.now(),
            exportDate: new Date().toISOString(),
            routeString: navlogData.routeString,
            waypoints: navlogData.waypoints,
            legs: navlogData.legs,
            totalDistance: navlogData.totalDistance,
            totalTime: navlogData.totalTime,
            fuelStatus: navlogData.fuelStatus,
            options: navlogData.options
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const filename = `navlog_${navlogData.routeString.replace(/\s+/g, '_')}_${Date.now()}.json`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
        console.log('[DataManager] Navlog exported:', filename);
        return true;
    } catch (error) {
        console.error('[DataManager] Failed to export navlog:', error);
        return false;
    }
}

// Import navlog from JSON file
function importNavlog(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const navlogData = JSON.parse(e.target.result);

                // Validate structure
                if (!navlogData.routeString || !navlogData.waypoints || !navlogData.legs) {
                    throw new Error('Invalid navlog file structure');
                }

                console.log('[DataManager] Navlog imported from file');
                resolve(navlogData);
            } catch (error) {
                console.error('[DataManager] Failed to parse navlog file:', error);
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

// ============================================
// SPATIAL QUERIES
// ============================================

// Get points within specified distance (nm) of route legs
function getPointsNearRoute(legs, distanceNM = 45) {
    const result = {
        airports: [],
        navaids: []
    };

    // Helper function to check if airport has tower frequencies
    const isToweredAirport = (code) => {
        const freqs = frequenciesData.get(code);
        if (!freqs || freqs.length === 0) return false;

        // Check for tower-related frequency types
        return freqs.some(f => {
            const type = (f.type || f.description || '').toUpperCase();
            return type.includes('TWR') || type.includes('TOWER') ||
                   type.includes('GND') || type.includes('GROUND') ||
                   type.includes('ATCT');
        });
    };

    // Helper to calculate distance from point to line segment
    const distanceToSegment = (px, py, x1, y1, x2, y2) => {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Use RouteCalculator for distance calculations
    const calculateDistance = window.RouteCalculator.calculateDistance;

    // Check each airport
    for (const [code, airport] of airportsData) {
        if (!isToweredAirport(code)) continue;

        let minDistance = Infinity;

        // Check distance to each leg
        for (const leg of legs) {
            // Simple approximation: check distance to both endpoints and a midpoint
            const distToFrom = calculateDistance(airport.lat, airport.lon, leg.from.lat, leg.from.lon);
            const distToTo = calculateDistance(airport.lat, airport.lon, leg.to.lat, leg.to.lon);

            // Calculate midpoint
            const midLat = (leg.from.lat + leg.to.lat) / 2;
            const midLon = (leg.from.lon + leg.to.lon) / 2;
            const distToMid = calculateDistance(airport.lat, airport.lon, midLat, midLon);

            minDistance = Math.min(minDistance, distToFrom, distToTo, distToMid);
        }

        if (minDistance <= distanceNM) {
            result.airports.push({ code, ...airport });
        }
    }

    // Check each navaid
    for (const [ident, navaid] of navaidsData) {
        let minDistance = Infinity;

        // Check distance to each leg
        for (const leg of legs) {
            const distToFrom = calculateDistance(navaid.lat, navaid.lon, leg.from.lat, leg.from.lon);
            const distToTo = calculateDistance(navaid.lat, navaid.lon, leg.to.lat, leg.to.lon);

            const midLat = (leg.from.lat + leg.to.lat) / 2;
            const midLon = (leg.from.lon + leg.to.lon) / 2;
            const distToMid = calculateDistance(navaid.lat, navaid.lon, midLat, midLon);

            minDistance = Math.min(minDistance, distToFrom, distToTo, distToMid);
        }

        if (minDistance <= distanceNM) {
            result.navaids.push({ ident, ...navaid });
        }
    }

    return result;
}

// Legacy function - kept for compatibility but now uses route-based logic if legs provided
function getPointsInBounds(bounds, legs = null) {
    // If legs provided, use route-based logic instead
    if (legs) {
        return getPointsNearRoute(legs, 45);
    }

    const result = {
        airports: [],
        navaids: []
    };

    // Helper function to check if airport has tower frequencies
    const isToweredAirport = (code) => {
        const freqs = frequenciesData.get(code);
        if (!freqs || freqs.length === 0) return false;

        // Check for tower-related frequency types
        return freqs.some(f => {
            const type = (f.type || f.description || '').toUpperCase();
            return type.includes('TWR') || type.includes('TOWER') ||
                   type.includes('GND') || type.includes('GROUND') ||
                   type.includes('ATCT');
        });
    };

    // Get towered airports within bounds only
    for (const [code, airport] of airportsData) {
        if (airport.lat >= bounds.minLat && airport.lat <= bounds.maxLat &&
            airport.lon >= bounds.minLon && airport.lon <= bounds.maxLon &&
            isToweredAirport(code)) {
            result.airports.push({ code, ...airport });
        }
    }

    // Get navaids within bounds
    for (const [ident, navaid] of navaidsData) {
        if (navaid.lat >= bounds.minLat && navaid.lat <= bounds.maxLat &&
            navaid.lon >= bounds.minLon && navaid.lon <= bounds.maxLon) {
            result.navaids.push({ ident, ...navaid });
        }
    }

    return result;
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
    clearInMemoryData,
    loadFromCache,
    rebuildTokenTypeMap,
    getFileStatus,

    // Data access (CRUD only)
    getAirport,
    getAirportByIATA,
    getNavaid,
    getFix,
    getFixCoordinates,
    getFrequencies,
    getRunways,
    getDataStats,
    getDpsData: () => dpsData,
    getStarsData: () => starsData,

    // DEPRECATED: Use QueryEngine instead
    searchWaypoints: (query) => {
        console.warn('[DataManager] searchWaypoints is deprecated. Use QueryEngine.searchWaypoints instead.');
        return window.QueryEngine ? window.QueryEngine.searchWaypoints(query) : [];
    },
    getTokenType: (token) => {
        console.warn('[DataManager] getTokenType is deprecated. Use QueryEngine.getTokenType instead.');
        return window.QueryEngine ? window.QueryEngine.getTokenType(token) : null;
    },
    getPointsInBounds: (bounds, legs) => {
        console.warn('[DataManager] getPointsInBounds is deprecated. Use QueryEngine.getPointsInBounds instead.');
        return window.QueryEngine ? window.QueryEngine.getPointsInBounds(bounds, legs) : { airports: [], navaids: [] };
    },
    getPointsNearRoute: (legs, distanceNM) => {
        console.warn('[DataManager] getPointsNearRoute is deprecated. Use QueryEngine.getPointsNearRoute instead.');
        return window.QueryEngine ? window.QueryEngine.getPointsNearRoute(legs, distanceNM) : { airports: [], navaids: [] };
    },

    // DEPRECATED: Use FlightState instead
    saveQueryHistory: (route) => {
        console.warn('[DataManager] saveQueryHistory is deprecated. Use FlightState.saveToHistory instead.');
        if (window.FlightState) window.FlightState.saveToHistory(route);
    },
    loadQueryHistory: () => {
        console.warn('[DataManager] loadQueryHistory is deprecated. Use FlightState.loadHistory instead.');
        return window.FlightState ? window.FlightState.loadHistory() : [];
    },
    saveNavlog: (data) => {
        console.warn('[DataManager] saveNavlog is deprecated. Use FlightState.saveToStorage instead.');
        if (window.FlightState) {
            window.FlightState.updateFlightPlan(data);
            return window.FlightState.saveToStorage();
        }
        return false;
    },
    loadSavedNavlog: () => {
        console.warn('[DataManager] loadSavedNavlog is deprecated. Use FlightState.loadFromStorage instead.');
        return window.FlightState ? window.FlightState.loadFromStorage() : null;
    },
    clearSavedNavlog: () => {
        console.warn('[DataManager] clearSavedNavlog is deprecated. Use FlightState.clearStorage instead.');
        return window.FlightState ? window.FlightState.clearStorage() : false;
    },
    exportNavlog: (data) => {
        console.warn('[DataManager] exportNavlog is deprecated. Use FlightState.exportAsFile instead.');
        if (window.FlightState) {
            window.FlightState.updateFlightPlan(data);
            return window.FlightState.exportAsFile();
        }
        return false;
    },
    importNavlog: (file) => {
        console.warn('[DataManager] importNavlog is deprecated. Use FlightState.importFromFile instead.');
        return window.FlightState ? window.FlightState.importFromFile(file) : Promise.reject('FlightState not available');
    }
};
