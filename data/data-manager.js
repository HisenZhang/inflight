// Data Manager Module - Orchestrates NASR (primary) and OurAirports (fallback) data

// Database configuration
const DB_NAME = 'FlightPlanningDB';
const DB_VERSION = 12; // Updated for checksum validation
const STORE_NAME = 'flightdata';
// Note: NASR cache validity is now based on actual NASR expiry date (30 days from effective date)
// instead of a fixed duration. This ensures cache aligns with source data validity.

// Query history
const HISTORY_KEY = 'flightplan_query_history';
const MAX_HISTORY = 5;

// Token types - reuse constant strings to save memory (70K+ airports = ~1MB saved)
const TOKEN_TYPE_AIRPORT = 'AIRPORT';
const TOKEN_TYPE_NAVAID = 'NAVAID';
const TOKEN_TYPE_FIX = 'FIX';
const TOKEN_TYPE_AIRWAY = 'AIRWAY';
const TOKEN_TYPE_PROCEDURE = 'PROCEDURE';

// Waypoint types - reuse for 85K+ objects (~500KB saved)
const WAYPOINT_TYPE_AIRPORT = 'airport';
const WAYPOINT_TYPE_NAVAID = 'navaid';
const WAYPOINT_TYPE_FIX = 'fix';

// Data sources - reuse for 85K+ objects (~500KB saved)
const SOURCE_NASR = 'nasr';
const SOURCE_OURAIRPORTS = 'ourairports';

// Airport types - reuse for common values
const AIRPORT_TYPE_LARGE = 'large_airport';
const AIRPORT_TYPE_MEDIUM = 'medium_airport';
const AIRPORT_TYPE_SMALL = 'small_airport';
const AIRPORT_TYPE_HELIPORT = 'heliport';
const AIRPORT_TYPE_SEAPLANE = 'seaplane_base';
const AIRPORT_TYPE_CLOSED = 'closed';

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
let airspaceData = new Map();        // Airspace class by airport ID (NASR only)
let chartsData = new Map();          // Charts by airport ICAO code (FAA d-TPP)
let chartsIataMap = new Map();       // IATA to ICAO mapping for charts
let tokenTypeMap = new Map();        // Fast lookup: token -> type (AIRPORT/NAVAID/FIX/AIRWAY/PROCEDURE)
let fileMetadata = new Map();        // Track individual file load times and validity
let rawCSVData = {};                 // Raw CSV data for reindexing
let rawChartsXML = null;             // Raw chart XML data for reindexing
let chartsCycle = null;              // Current TPP cycle (YYMM)
let db = null;
let dataTimestamp = null;
let dataSources = [];                // Track which sources were loaded
let nasrInfo = null;                 // NASR validity info (effectiveDate, expiryDate, daysRemaining)

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

async function saveToCache() {
    try {
        // Compress raw CSV data BEFORE opening transaction
        let rawCSVToStore = null;
        let compressionStats = null;
        let isCompressed = false;

        if (Object.keys(rawCSVData).length > 0) {
            const compressionSupported = window.CompressionUtils.isCompressionSupported();

            if (compressionSupported) {
                console.log('[DataManager] Compressing raw CSV data...');
                rawCSVToStore = await window.CompressionUtils.compressMultiple(rawCSVData);
                compressionStats = window.CompressionUtils.getCompressionStats(rawCSVData, rawCSVToStore);
                console.log(`[DataManager] Compression complete: ${compressionStats.originalSizeMB}MB to ${compressionStats.compressedSizeMB}MB (${compressionStats.ratio} reduction)`);
                isCompressed = true;
            } else {
                console.warn('[DataManager] CompressionStreams API not supported, storing uncompressed');
                rawCSVToStore = rawCSVData;
                isCompressed = false;
            }
        }

        // Calculate checksums for data integrity
        console.log('[DataManager] Calculating checksums for data integrity...');
        const checksums = await window.ChecksumUtils.calculateMultiple({
            airports: airportsData,
            iataToIcao: iataToIcao,
            navaids: navaidsData,
            fixes: fixesData,
            frequencies: frequenciesData,
            runways: runwaysData,
            airways: airwaysData,
            stars: starsData,
            dps: dpsData,
            airspace: airspaceData,
            charts: chartsData,
            chartsIata: chartsIataMap,
            rawCSV: rawCSVToStore // Checksum compressed/raw CSV data
        });
        console.log('[DataManager] Checksums calculated:', window.ChecksumUtils.getStats(checksums));

        // Now open transaction and store (synchronously)
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Serialize Maps to arrays for storage
            const data = {
                id: 'flightdata_cache_v12',
                airports: Array.from(airportsData.entries()),
                iataToIcao: Array.from(iataToIcao.entries()),
                navaids: Array.from(navaidsData.entries()),
                fixes: Array.from(fixesData.entries()),
                frequencies: Array.from(frequenciesData.entries()),
                runways: Array.from(runwaysData.entries()),
                airways: Array.from(airwaysData.entries()),
                stars: Array.from(starsData.entries()),
                dps: Array.from(dpsData.entries()),
                airspace: Array.from(airspaceData.entries()),
                charts: Array.from(chartsData.entries()),
                chartsIataMap: Array.from(chartsIataMap.entries()),
                dataSources: dataSources,
                timestamp: Date.now(),
                version: 12,
                // Track individual file metadata
                fileMetadata: Object.fromEntries(fileMetadata),
                // Store NASR validity info
                nasrInfo: nasrInfo,
                // Store raw CSV data (compressed if supported, uncompressed otherwise)
                rawCSV: rawCSVToStore,
                compressed: isCompressed, // Flag to indicate compression
                compressionStats: compressionStats,
                // Store charts metadata
                rawChartsXML: rawChartsXML,
                chartsCycle: chartsCycle,
                // NEW: Checksums for data integrity verification
                checksums: checksums
            };

            const request = store.put(data);
            request.onsuccess = () => {
                console.log('[DataManager] Cache saved with checksums');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        throw error;
    }
}

function loadFromCacheDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        // Try v12 first (with checksums), fall back to v11
        const requestV12 = store.get('flightdata_cache_v12');

        requestV12.onsuccess = () => {
            if (requestV12.result) {
                resolve(requestV12.result);
            } else {
                // Fall back to v11 (no checksums - for backward compatibility)
                const requestV11 = store.get('flightdata_cache_v11');
                requestV11.onsuccess = () => resolve(requestV11.result);
                requestV11.onerror = () => reject(requestV11.error);
            }
        };

        requestV12.onerror = () => reject(requestV12.error);
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
            store.delete('flightdata_cache_v9'),
            store.delete('flightdata_cache_v10'),
            store.delete('flightdata_cache_v11'),
            store.delete('flightdata_cache_v12')
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
        // Load NASR, OurAirports, and MORA data in parallel for better performance
        onStatusUpdate('[...] LOADING DATA SOURCES IN PARALLEL', 'loading');

        const results = await Promise.allSettled([
            window.NASRAdapter.loadNASRData(onStatusUpdate, onFileLoaded),
            window.OurAirportsAdapter.loadOurAirportsData(onStatusUpdate, onFileLoaded),
            window.TerrainAnalyzer ? window.TerrainAnalyzer.loadMORAData() : Promise.resolve(false)
        ]);

        if (results[0].status === 'fulfilled') {
            nasrData = results[0].value;
            dataSources.push('NASR');

            // Store NASR validity info
            if (nasrData.info) {
                nasrInfo = nasrData.info;
                console.log('[DataManager] NASR validity:', {
                    effectiveDate: nasrInfo.effectiveDate,
                    expiryDate: nasrInfo.expiryDate,
                    daysRemaining: nasrInfo.daysRemaining
                });
            }

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

        // Handle MORA data result
        if (results[2].status === 'fulfilled' && results[2].value === true) {
            dataSources.push('MORA');
            console.log('[DataManager] MORA terrain data loaded successfully');
        } else {
            console.warn('[DataManager] MORA loading skipped or failed');
        }

        // Merge data sources
        onStatusUpdate('[...] MERGING WORLDWIDE DATABASE', 'loading');
        mergeDataSources(nasrData, ourairportsData, onStatusUpdate);

        // Load charts data (non-blocking - charts are optional)
        try {
            console.log('[DataManager] Loading charts data...');
            const chartsResult = await window.ChartsAdapter.loadChartData(onStatusUpdate);
            console.log('[DataManager] Charts result:', {
                success: chartsResult.success,
                hasData: !!chartsResult.data,
                error: chartsResult.error
            });

            if (chartsResult.success && chartsResult.data) {
                chartsData = chartsResult.data.chartsMap;
                chartsIataMap = chartsResult.data.iataToIcaoMap || new Map();
                rawChartsXML = chartsResult.rawXML;
                chartsCycle = chartsResult.data.cycle;
                dataSources.push('Charts');

                console.log('[DataManager] Charts loaded successfully:', {
                    chartsDataSize: chartsData.size,
                    iataMapSize: chartsIataMap.size,
                    chartsCycle: chartsCycle,
                    rawXMLLength: rawChartsXML ? rawChartsXML.length : 0
                });

                // Add charts metadata
                fileMetadata.set('charts', {
                    id: 'charts',
                    name: 'FAA d-TPP Charts',
                    source: 'Charts',
                    loaded: true,
                    timestamp: Date.now(),
                    recordCount: chartsResult.data.totalCharts,
                    sizeBytes: chartsResult.rawXML ? chartsResult.rawXML.length : 0,
                    cycle: chartsResult.data.cycle
                });
            } else {
                console.warn('[DataManager] Charts not loaded:', chartsResult.error || 'Unknown error');
            }
        } catch (error) {
            console.warn('[DataManager] Charts loading failed (non-critical):', error);
            console.warn('[DataManager] Error stack:', error.stack);
            onStatusUpdate('[!] CHARTS UNAVAILABLE (OPTIONAL)', 'warning');
        }

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

    // Parse all CSV files in parallel for better performance
    onStatusUpdate('[...] PARSING ALL CSV FILES IN PARALLEL', 'loading');
    const startTime = performance.now();

    const parsingTasks = [];

    // NASR parsing tasks
    if (rawCSVData.nasr_airportsCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing NASR airports...');
                nasrData.data.airports = window.NASRAdapter.parseNASRAirports(rawCSVData.nasr_airportsCSV);
                console.log('[DataManager] ✓ NASR airports parsed');
            })
        );
    }
    if (rawCSVData.nasr_runwaysCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing NASR runways...');
                nasrData.data.runways = window.NASRAdapter.parseNASRRunways(rawCSVData.nasr_runwaysCSV);
                console.log('[DataManager] ✓ NASR runways parsed');
            })
        );
    }
    if (rawCSVData.nasr_navaidsCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing NASR navaids...');
                nasrData.data.navaids = window.NASRAdapter.parseNASRNavaids(rawCSVData.nasr_navaidsCSV);
                console.log('[DataManager] ✓ NASR navaids parsed');
            })
        );
    }
    if (rawCSVData.nasr_fixesCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing NASR fixes...');
                nasrData.data.fixes = window.NASRAdapter.parseNASRFixes(rawCSVData.nasr_fixesCSV);
                console.log('[DataManager] ✓ NASR fixes parsed');
            })
        );
    }
    if (rawCSVData.nasr_frequenciesCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing NASR frequencies...');
                nasrData.data.frequencies = window.NASRAdapter.parseNASRFrequencies(rawCSVData.nasr_frequenciesCSV);
                console.log('[DataManager] ✓ NASR frequencies parsed');
            })
        );
    }
    if (rawCSVData.nasr_airwaysCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing NASR airways...');
                nasrData.data.airways = window.NASRAdapter.parseNASRAirways(rawCSVData.nasr_airwaysCSV);
                console.log('[DataManager] ✓ NASR airways parsed');
            })
        );
    }
    if (rawCSVData.nasr_starsCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing NASR STARs...');
                nasrData.data.stars = window.NASRAdapter.parseNASRSTARs(rawCSVData.nasr_starsCSV);
                console.log('[DataManager] ✓ NASR STARs parsed');
            })
        );
    }
    if (rawCSVData.nasr_dpsCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing NASR DPs...');
                nasrData.data.dps = window.NASRAdapter.parseNASRDPs(rawCSVData.nasr_dpsCSV);
                console.log('[DataManager] ✓ NASR DPs parsed');
            })
        );
    }
    if (rawCSVData.nasr_airspaceCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing NASR airspace...');
                nasrData.data.airspace = window.NASRAdapter.parseNASRAirspaceClass(rawCSVData.nasr_airspaceCSV);
                console.log('[DataManager] ✓ NASR airspace parsed');
            })
        );
    }

    // OurAirports parsing tasks
    if (rawCSVData.oa_airportsCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing OurAirports airports...');
                const result = window.OurAirportsAdapter.parseOAAirports(rawCSVData.oa_airportsCSV);
                ourairportsData.data.airports = result.airports;
                ourairportsData.data.iataToIcao = result.iataToIcao;
                console.log('[DataManager] ✓ OurAirports airports parsed');
            })
        );
    }
    if (rawCSVData.oa_frequenciesCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing OurAirports frequencies...');
                ourairportsData.data.frequencies = window.OurAirportsAdapter.parseOAFrequencies(rawCSVData.oa_frequenciesCSV);
                console.log('[DataManager] ✓ OurAirports frequencies parsed');
            })
        );
    }
    if (rawCSVData.oa_runwaysCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing OurAirports runways...');
                ourairportsData.data.runways = window.OurAirportsAdapter.parseOARunways(rawCSVData.oa_runwaysCSV);
                console.log('[DataManager] ✓ OurAirports runways parsed');
            })
        );
    }
    if (rawCSVData.oa_navaidsCSV) {
        parsingTasks.push(
            Promise.resolve().then(() => {
                console.log('[DataManager] Parsing OurAirports navaids...');
                ourairportsData.data.navaids = window.OurAirportsAdapter.parseOANavaids(rawCSVData.oa_navaidsCSV);
                console.log('[DataManager] ✓ OurAirports navaids parsed');
            })
        );
    }

    // Wait for all parsing tasks to complete in parallel
    await Promise.all(parsingTasks);

    const parseTime = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`[DataManager] All CSV files parsed in ${parseTime}s`);
    onStatusUpdate(`[...] CSV PARSING COMPLETE (${parseTime}s)`, 'loading');

    // Merge the reparsed data - mergeDataSources will rebuild dataSources array
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
    // Optimized: batch status updates to reduce overhead
    if (nasrData) {
        if (onStatusUpdate) onStatusUpdate('[...] INDEXING NASR DATA', 'loading');

        // Batch all NASR indexing operations without intermediate status updates
        for (const [code, airport] of nasrData.data.airports) {
            airportsData.set(code, airport);
        }
        for (const [ident, navaid] of nasrData.data.navaids) {
            navaidsData.set(ident, navaid);
        }
        for (const [ident, fix] of nasrData.data.fixes) {
            fixesData.set(ident, fix);
        }
        for (const [code, runways] of nasrData.data.runways) {
            runwaysData.set(code, runways);
        }
        for (const [code, freqs] of nasrData.data.frequencies) {
            frequenciesData.set(code, freqs);
        }
        for (const [id, airway] of nasrData.data.airways) {
            airwaysData.set(id, airway);
        }
        for (const [id, star] of nasrData.data.stars) {
            starsData.set(id, star);
        }
        for (const [id, dp] of nasrData.data.dps) {
            dpsData.set(id, dp);
        }
        for (const [arptId, airspace] of nasrData.data.airspace) {
            airspaceData.set(arptId, airspace);
        }

        dataSources.push('NASR');
    }

    // Add OurAirports data (fills gaps, doesn't override NASR)
    // Optimized: batch status updates to reduce overhead
    if (ourairportsData) {
        if (onStatusUpdate) onStatusUpdate('[...] INDEXING OURAIRPORTS DATA', 'loading');

        // Build reverse lookup: airport ID -> code (for O(1) frequency/runway mapping)
        const idToCode = new Map();

        // Batch all OurAirports indexing operations without intermediate status updates
        for (const [code, airport] of ourairportsData.data.airports) {
            if (airport.id) {
                idToCode.set(airport.id, code);
            }
            if (!airportsData.has(code)) {
                airportsData.set(code, airport);
            }
        }
        for (const [iata, icao] of ourairportsData.data.iataToIcao) {
            if (!iataToIcao.has(iata)) {
                iataToIcao.set(iata, icao);
            }
        }
        for (const [ident, navaid] of ourairportsData.data.navaids) {
            if (!navaidsData.has(ident)) {
                navaidsData.set(ident, navaid);
            }
        }
        for (const [id, freqs] of ourairportsData.data.frequencies) {
            const code = idToCode.get(id);
            if (code && !frequenciesData.has(code)) {
                frequenciesData.set(code, freqs);
            }
        }
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
        if (cachedData && (cachedData.version === 12 || cachedData.version === 11 || cachedData.version === 10) && cachedData.timestamp) {
            const age = Date.now() - cachedData.timestamp;
            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));

            // Verify checksums if available (v12+)
            // NOTE: Only verify parsed data structures (not raw CSV) on startup
            // Raw CSV is only verified during reindexing (see loadFromCache)
            if (cachedData.version >= 12 && cachedData.checksums) {
                console.log('[DataManager] Verifying cached data structures...');

                const dataToVerify = {
                    airports: new Map(cachedData.airports),
                    iataToIcao: new Map(cachedData.iataToIcao),
                    navaids: new Map(cachedData.navaids),
                    fixes: new Map(cachedData.fixes),
                    frequencies: new Map(cachedData.frequencies),
                    runways: new Map(cachedData.runways),
                    airways: new Map(cachedData.airways),
                    stars: new Map(cachedData.stars),
                    dps: new Map(cachedData.dps),
                    airspace: new Map(cachedData.airspace)
                    // rawCSV is NOT verified here (only during reindexing)
                };

                const verificationResults = await window.ChecksumUtils.verifyMultiple(
                    dataToVerify,
                    cachedData.checksums
                );

                // Check for any failed verifications
                const failed = Object.entries(verificationResults).filter(([key, valid]) => !valid);

                if (failed.length > 0) {
                    const failedKeys = failed.map(([key]) => key).join(', ');
                    console.error('[DataManager] DATA INTEGRITY FAILURE:', failedKeys);

                    // Clear corrupted cache
                    await clearCacheDB();

                    return {
                        loaded: false,
                        status: `[ERR] DATA CORRUPTED (${failedKeys}) - PLEASE RELOAD`,
                        type: 'error',
                        corrupted: true
                    };
                }

                console.log('[DataManager] ✓ All data structures verified');
            } else {
                console.warn('[DataManager] No checksums found - skipping verification (old cache version)');
            }

            // Load from indexed cache (fast - no re-indexing needed)
            await loadFromCache(cachedData);

            // Check NASR validity if available (use actual expiry date instead of fixed duration)
            let cacheExpired = false;
            let statusMessage = '';

            if (cachedData.nasrInfo && cachedData.nasrInfo.expiryDate) {
                const expiryDate = new Date(cachedData.nasrInfo.expiryDate);
                const daysUntilExpiry = Math.floor((expiryDate - Date.now()) / (24 * 60 * 60 * 1000));
                cacheExpired = daysUntilExpiry <= 0;

                console.log('[DataManager] NASR cache validity:', {
                    effectiveDate: cachedData.nasrInfo.effectiveDate,
                    expiryDate: cachedData.nasrInfo.expiryDate,
                    daysUntilExpiry: daysUntilExpiry,
                    expired: cacheExpired
                });

                if (cacheExpired) {
                    statusMessage = `[!] DATABASE LOADED (NASR EXPIRED ${Math.abs(daysUntilExpiry)}D AGO - UPDATE REQUIRED)`;
                } else if (daysUntilExpiry <= 7) {
                    statusMessage = `[!] DATABASE LOADED (NASR EXPIRES IN ${daysUntilExpiry}D - UPDATE RECOMMENDED)`;
                } else {
                    const sources = dataSources.join(' + ');
                    const checksumStatus = cachedData.checksums ? ' [VERIFIED]' : '';
                    statusMessage = `[OK] INDEXED DATABASE LOADED (${daysOld}D OLD, ${daysUntilExpiry}D VALID - ${sources})${checksumStatus}`;
                }
            } else {
                // Fallback to old behavior if NASR info not available (old cache format)
                const fallbackExpiry = 28 * 24 * 60 * 60 * 1000;
                cacheExpired = age >= fallbackExpiry;
                const sources = dataSources.join(' + ');
                const checksumStatus = cachedData.checksums ? ' [VERIFIED]' : '';

                if (cacheExpired) {
                    statusMessage = `[!] DATABASE LOADED (${daysOld}D OLD - UPDATE RECOMMENDED)`;
                } else {
                    statusMessage = `[OK] INDEXED DATABASE LOADED (${daysOld}D OLD - ${sources})${checksumStatus}`;
                }
            }

            return {
                loaded: true,
                status: statusMessage,
                type: cacheExpired ? 'warning' : 'success'
            };
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
        airspaceData = new Map(cachedData.airspace || []);
        chartsData = new Map(cachedData.charts || []);
        chartsIataMap = new Map(cachedData.chartsIataMap || []);
        dataSources = cachedData.dataSources || [];
        dataTimestamp = cachedData.timestamp;

        // Restore charts metadata
        rawChartsXML = cachedData.rawChartsXML || null;
        chartsCycle = cachedData.chartsCycle || null;

        // Restore file metadata if available
        if (cachedData.fileMetadata) {
            fileMetadata = new Map(Object.entries(cachedData.fileMetadata));
        }

        // Restore NASR validity info if available
        nasrInfo = cachedData.nasrInfo || null;

        // DO NOT decompress raw CSV on fast path - only needed for reindexing
        // Raw CSV stays compressed in memory until explicitly needed
        rawCSVData = {}; // Clear raw CSV (not needed for normal operation)

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

        // Verify raw CSV checksum if available (v12+)
        // This is the ONLY time we verify raw CSV (during reindexing)
        if (cachedData.version >= 12 && cachedData.checksums && cachedData.checksums.rawCSV) {
            onStatusUpdate('[...] VERIFYING RAW CSV INTEGRITY', 'loading');
            console.log('[DataManager] Verifying raw CSV checksum before reindexing...');

            const rawCSVValid = await window.ChecksumUtils.verify(
                cachedData.rawCSV,
                cachedData.checksums.rawCSV
            );

            if (!rawCSVValid) {
                console.error('[DataManager] RAW CSV CHECKSUM FAILURE');
                throw new Error('Raw CSV data corrupted - checksum verification failed. Please reload database from internet.');
            }

            console.log('[DataManager] ✓ Raw CSV verified');
        }

        // Restore raw CSV data (decompress if needed)
        if (cachedData.compressed && window.CompressionUtils && window.CompressionUtils.isCompressionSupported()) {
            onStatusUpdate('[...] DECOMPRESSING RAW CSV DATA', 'loading');
            console.log('[DataManager] Decompressing raw CSV data...');
            rawCSVData = await window.CompressionUtils.decompressMultiple(cachedData.rawCSV);
            console.log('[DataManager] Decompression complete');
        } else {
            rawCSVData = cachedData.rawCSV;
        }
        console.log('[DataManager] Raw CSV keys in cache:', Object.keys(rawCSVData));
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

        // Save reparsed data back to cache (will re-compress raw CSV)
        onStatusUpdate('[...] COMPRESSING AND SAVING TO CACHE', 'loading');
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
// Optimized: pre-compiled regex for faster execution
const DIGIT_REGEX = /\d/;

function buildTokenTypeMap() {
    tokenTypeMap.clear();

    // Index airports by ICAO code and local identifiers
    // ICAO codes are 4+ characters, local identifiers can be 3 characters (alphanumeric like 1B1)
    for (const [code, airport] of airportsData) {
        // Include all codes that are:
        // - 4+ characters (ICAO codes)
        // - 3 characters with numbers (local identifiers like 1B1, 2B2, not IATA codes)
        if (code.length >= 4 || (code.length === 3 && DIGIT_REGEX.test(code))) {
            tokenTypeMap.set(code, TOKEN_TYPE_AIRPORT);
        }
    }

    // Index navaids
    for (const [ident, navaid] of navaidsData) {
        if (!tokenTypeMap.has(ident)) {
            tokenTypeMap.set(ident, TOKEN_TYPE_NAVAID);
        }
    }

    // Index fixes/waypoints
    for (const [ident, fix] of fixesData) {
        if (!tokenTypeMap.has(ident)) {
            tokenTypeMap.set(ident, TOKEN_TYPE_FIX);
        }
    }

    // Index airways
    for (const [id, airway] of airwaysData) {
        if (!tokenTypeMap.has(id)) {
            tokenTypeMap.set(id, TOKEN_TYPE_AIRWAY);
        }
    }

    // Index Procedures (STARs and DPs)
    // Structure: { name, computerCode, type, body: {name, fixes}, transitions: [{name, entryFix, fixes}] }
    // Indexed by both computerCode (e.g., "HIDEY1.HIDEY") and procedure name (e.g., "HIDEY1")
    // Supports both numbered (HIDEY1, CHPPR1) and non-numbered (CHPPR) procedure names

    // Index STARs (Standard Terminal Arrival Routes)
    try {
        const starsIndexed = new Set();
        for (const [id, star] of starsData) {
            // Index by key (computerCode like "GLAND.BLUMS5")
            if (!tokenTypeMap.has(id)) {
                tokenTypeMap.set(id, TOKEN_TYPE_PROCEDURE);
            }

            // Index by procedure name (e.g., "BLUMS5") for autocomplete
            if (star && typeof star === 'object' && star.name) {
                starsIndexed.add(star.name);
                if (!tokenTypeMap.has(star.name)) {
                    tokenTypeMap.set(star.name, TOKEN_TYPE_PROCEDURE);
                }
            }
        }
        console.log(`[DataManager] Indexed ${starsIndexed.size} unique STAR procedures`);
    } catch (error) {
        console.error('[DataManager] Error indexing STARs:', error);
    }

    // Index DPs (Departure Procedures / SIDs)
    try {
        const dpsIndexed = new Set();
        for (const [id, dp] of dpsData) {
            // Index by key (computerCode like "HIDEY1.HIDEY")
            if (!tokenTypeMap.has(id)) {
                tokenTypeMap.set(id, TOKEN_TYPE_PROCEDURE);
            }

            // Index by procedure name (e.g., "HIDEY1") for autocomplete
            if (dp && typeof dp === 'object' && dp.name) {
                dpsIndexed.add(dp.name);
                if (!tokenTypeMap.has(dp.name)) {
                    tokenTypeMap.set(dp.name, TOKEN_TYPE_PROCEDURE);
                }
            }
        }
        console.log(`[DataManager] Indexed ${dpsIndexed.size} unique DP procedures`);
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

            // Determine if expired based on NASR validity if available
            let expired = false;
            if (file.source === 'NASR' && nasrInfo && nasrInfo.expiryDate) {
                const expiryDate = new Date(nasrInfo.expiryDate);
                expired = now >= expiryDate.getTime();
            } else {
                // Fallback: use 28 days for non-NASR files or if NASR info not available
                const fallbackExpiry = 28 * 24 * 60 * 60 * 1000;
                expired = age >= fallbackExpiry;
            }

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

function getAirspaceClass(airportCode) {
    // Try direct lookup first (for 3-letter LID codes like ALB)
    let airspace = airspaceData.get(airportCode);
    if (airspace) return airspace;

    // If not found and code starts with K, try without the K prefix
    // ICAO codes like KALB -> FAA LID ALB
    if (airportCode && airportCode.startsWith('K') && airportCode.length === 4) {
        airspace = airspaceData.get(airportCode.substring(1));
        if (airspace) return airspace;
    }

    return null;
}

function getDataStats() {
    return {
        airports: airportsData.size,
        navaids: navaidsData.size,
        fixes: fixesData.size,
        airways: airwaysData.size,
        stars: starsData.size,
        dps: dpsData.size,
        airspace: airspaceData.size,
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
            type: TOKEN_TYPE_AIRPORT,
            waypointType: WAYPOINT_TYPE_AIRPORT,
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
            type: TOKEN_TYPE_FIX,
            waypointType: WAYPOINT_TYPE_FIX,
            name: fix.ident,
            location: `${fix.state || ''} ${fix.country}`.trim(),
            source: fix.source || SOURCE_NASR,
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
    // Token type constants (for memory efficiency across modules)
    TOKEN_TYPE_AIRPORT,
    TOKEN_TYPE_NAVAID,
    TOKEN_TYPE_FIX,
    TOKEN_TYPE_AIRWAY,
    TOKEN_TYPE_PROCEDURE,

    // Waypoint type constants (for object property memory efficiency)
    WAYPOINT_TYPE_AIRPORT,
    WAYPOINT_TYPE_NAVAID,
    WAYPOINT_TYPE_FIX,

    // Source constants (for object property memory efficiency)
    SOURCE_NASR,
    SOURCE_OURAIRPORTS,

    // Airport type constants (for object property memory efficiency)
    AIRPORT_TYPE_LARGE,
    AIRPORT_TYPE_MEDIUM,
    AIRPORT_TYPE_SMALL,
    AIRPORT_TYPE_HELIPORT,
    AIRPORT_TYPE_SEAPLANE,
    AIRPORT_TYPE_CLOSED,

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
    getAirspaceClass,
    getDataStats,
    getDpsData: () => dpsData,
    getStarsData: () => starsData,
    getCharts: (code) => {
        // Try direct ICAO lookup first
        let airportCharts = chartsData.get(code);
        if (airportCharts) {
            return airportCharts.charts;
        }

        // If not found and code is 3 letters, try IATA→ICAO mapping
        if (code && code.length === 3 && /^[A-Z]{3}$/.test(code)) {
            const icao = chartsIataMap.get(code);
            if (icao) {
                airportCharts = chartsData.get(icao);
                return airportCharts ? airportCharts.charts : null;
            }
        }

        return null;
    },
    getChartsCycle: () => chartsCycle,

    // Raw data access (for specialized queries)
    getAirportsData: () => airportsData,
    getNavaidsData: () => navaidsData,
    getFrequenciesData: () => frequenciesData,
    getChartsData: () => chartsData,

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
