// Terrain Analyzer Module - MORA (Minimum Off-Route Altitude) analysis for route planning
// Uses global MORA data: FAA CIFP for US, terrain-derived for worldwide coverage
// Caches elevation data in IndexedDB for offline use

// API configuration for Open Topo Data (free, no API key required)
// Use CORS proxy for browser requests
const ELEVATION_API_BASE = 'https://api.opentopodata.org/v1/srtm30m';
const TERRAIN_CORS_PROXY = 'https://cors.hisenz.com/?url=';

// Global MORA data from NASR API (1° x 1° grid, FAA + terrain-derived)
const NASR_MORA_URL = 'https://nasr.hisenz.com/files/MORA.csv';

/**
 * Build proxied API URL with location parameters
 * @param {string} locations - Pipe-separated lat,lon pairs
 * @returns {string} Full proxied URL
 */
function buildElevationUrl(locations) {
    const fullUrl = `${ELEVATION_API_BASE}?locations=${locations}`;
    const proxiedUrl = TERRAIN_CORS_PROXY + encodeURIComponent(fullUrl);
    console.log('[TerrainAnalyzer] API URL:', proxiedUrl);
    return proxiedUrl;
}
const ELEVATION_BATCH_SIZE = 100; // Max locations per API request
const ELEVATION_SAMPLE_INTERVAL_NM = 5; // Sample terrain every 5nm along route
const MIN_TERRAIN_CLEARANCE_FT = 1000; // Standard IFR clearance (2000ft in mountainous)
const MOUNTAINOUS_THRESHOLD_FT = 5000; // Above this, consider terrain "mountainous"
const MOUNTAINOUS_CLEARANCE_FT = 2000; // Required clearance in mountainous terrain

// IndexedDB configuration for persistent elevation cache
const TERRAIN_DB_NAME = 'TerrainElevationDB';
const TERRAIN_DB_VERSION = 4; // Bumped for MORA store (was OROCA)
const TERRAIN_STORE_NAME = 'elevations';
const MORA_STORE_NAME = 'mora_grid'; // Global MORA data store (1° grid)
const CACHE_GRID_RESOLUTION = 0.01; // Grid resolution in degrees (~1.1km or ~0.6nm)

// MORA grid size: 1 degree (matches FAA CIFP Grid MORA)
const MORA_GRID_SIZE_DEG = 1.0;

// In-memory cache (populated from IndexedDB on init)
let terrainCache = new Map(); // Key: lat,lon (grid), Value: elevation in feet
let moraCache = new Map(); // Key: "lat,lon" (grid SW corner), Value: {mora, source}
let terrainDB = null;
let dbInitialized = false;
let moraDataLoaded = false;
let lastAnalysis = null;

// ============================================
// INDEXEDDB PERSISTENT CACHE
// ============================================

/**
 * Initialize the terrain elevation IndexedDB
 * @returns {Promise<boolean>} True if initialized successfully
 */
async function initTerrainDB() {
    if (dbInitialized) return true;

    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(TERRAIN_DB_NAME, TERRAIN_DB_VERSION);

            request.onerror = () => {
                console.warn('[TerrainAnalyzer] IndexedDB not available, using memory cache only');
                dbInitialized = true;
                resolve(false);
            };

            request.onsuccess = () => {
                terrainDB = request.result;
                dbInitialized = true;
                console.log('[TerrainAnalyzer] IndexedDB cache initialized');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(TERRAIN_STORE_NAME)) {
                    // Store elevations with grid key as primary key
                    const store = db.createObjectStore(TERRAIN_STORE_NAME, { keyPath: 'key' });
                    // Index by region for bulk queries (rounded to 1 degree)
                    store.createIndex('region', 'region', { unique: false });
                    console.log('[TerrainAnalyzer] Created elevation cache store');
                }
                // Delete old MEF store if it exists
                if (db.objectStoreNames.contains('mef_quadrangles')) {
                    db.deleteObjectStore('mef_quadrangles');
                    console.log('[TerrainAnalyzer] Deleted old MEF store');
                }
                // Delete old OROCA store if it exists (replaced by MORA)
                if (db.objectStoreNames.contains('oroca_grid')) {
                    db.deleteObjectStore('oroca_grid');
                    console.log('[TerrainAnalyzer] Deleted old OROCA store');
                }
                if (!db.objectStoreNames.contains(MORA_STORE_NAME)) {
                    // Store global MORA data with grid key as primary key
                    db.createObjectStore(MORA_STORE_NAME, { keyPath: 'key' });
                    console.log('[TerrainAnalyzer] Created MORA grid store');
                }
            };
        } catch (error) {
            console.warn('[TerrainAnalyzer] IndexedDB error:', error);
            dbInitialized = true;
            resolve(false);
        }
    });
}

/**
 * Convert lat/lon to grid key (for consistent caching)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} Grid key
 */
function toGridKey(lat, lon) {
    const gridLat = Math.round(lat / CACHE_GRID_RESOLUTION) * CACHE_GRID_RESOLUTION;
    const gridLon = Math.round(lon / CACHE_GRID_RESOLUTION) * CACHE_GRID_RESOLUTION;
    return `${gridLat.toFixed(2)},${gridLon.toFixed(2)}`;
}

/**
 * Get region key (1 degree grid) for indexing
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} Region key
 */
function toRegionKey(lat, lon) {
    return `${Math.floor(lat)},${Math.floor(lon)}`;
}

/**
 * Load elevation from IndexedDB cache
 * @param {string} key - Grid key
 * @returns {Promise<number|null>} Elevation or null
 */
async function loadFromDB(key) {
    if (!terrainDB) return null;

    return new Promise((resolve) => {
        try {
            const tx = terrainDB.transaction(TERRAIN_STORE_NAME, 'readonly');
            const store = tx.objectStore(TERRAIN_STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.elevation : null);
            };
            request.onerror = () => resolve(null);
        } catch (error) {
            resolve(null);
        }
    });
}

/**
 * Save elevation to IndexedDB cache
 * @param {string} key - Grid key
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} elevation - Elevation in feet
 */
async function saveToDB(key, lat, lon, elevation) {
    if (!terrainDB) return;

    try {
        const tx = terrainDB.transaction(TERRAIN_STORE_NAME, 'readwrite');
        const store = tx.objectStore(TERRAIN_STORE_NAME);
        store.put({
            key,
            lat,
            lon,
            elevation,
            region: toRegionKey(lat, lon),
            timestamp: Date.now()
        });
    } catch (error) {
        // Silently fail - memory cache still works
    }
}

/**
 * Batch save multiple elevations to IndexedDB
 * @param {Array<{key: string, lat: number, lon: number, elevation: number}>} entries
 */
async function batchSaveToDB(entries) {
    if (!terrainDB || entries.length === 0) return;

    try {
        const tx = terrainDB.transaction(TERRAIN_STORE_NAME, 'readwrite');
        const store = tx.objectStore(TERRAIN_STORE_NAME);
        const timestamp = Date.now();

        entries.forEach(entry => {
            store.put({
                key: entry.key,
                lat: entry.lat,
                lon: entry.lon,
                elevation: entry.elevation,
                region: toRegionKey(entry.lat, entry.lon),
                timestamp
            });
        });
    } catch (error) {
        console.warn('[TerrainAnalyzer] Batch save error:', error);
    }
}

/**
 * Load all cached elevations for a region (preload)
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} radiusDeg - Radius in degrees to load
 * @returns {Promise<number>} Number of entries loaded
 */
async function preloadRegion(lat, lon, radiusDeg = 2) {
    if (!terrainDB) return 0;

    const minLat = Math.floor(lat - radiusDeg);
    const maxLat = Math.ceil(lat + radiusDeg);
    const minLon = Math.floor(lon - radiusDeg);
    const maxLon = Math.ceil(lon + radiusDeg);

    let loadedCount = 0;

    return new Promise((resolve) => {
        try {
            const tx = terrainDB.transaction(TERRAIN_STORE_NAME, 'readonly');
            const store = tx.objectStore(TERRAIN_STORE_NAME);
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const entry = cursor.value;
                    if (entry.lat >= minLat && entry.lat <= maxLat &&
                        entry.lon >= minLon && entry.lon <= maxLon) {
                        terrainCache.set(entry.key, entry.elevation);
                        loadedCount++;
                    }
                    cursor.continue();
                } else {
                    if (loadedCount > 0) {
                        console.log(`[TerrainAnalyzer] Preloaded ${loadedCount} cached elevations`);
                    }
                    resolve(loadedCount);
                }
            };
            request.onerror = () => resolve(0);
        } catch (error) {
            resolve(0);
        }
    });
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache stats
 */
async function getCacheStats() {
    const memoryEntries = terrainCache.size;
    let dbEntries = 0;
    let dbSizeEstimate = 0;

    if (terrainDB) {
        try {
            const tx = terrainDB.transaction(TERRAIN_STORE_NAME, 'readonly');
            const store = tx.objectStore(TERRAIN_STORE_NAME);
            const countRequest = store.count();

            await new Promise((resolve) => {
                countRequest.onsuccess = () => {
                    dbEntries = countRequest.result;
                    // Estimate ~50 bytes per entry
                    dbSizeEstimate = dbEntries * 50;
                    resolve();
                };
                countRequest.onerror = () => resolve();
            });
        } catch (error) {
            // Ignore
        }
    }

    return {
        memoryEntries,
        dbEntries,
        dbSizeKB: Math.round(dbSizeEstimate / 1024),
        gridResolution: CACHE_GRID_RESOLUTION
    };
}

// ============================================
// GLOBAL MORA DATA (from NASR API)
// ============================================

/**
 * Load global MORA data from NASR API
 * Format: lat,lon,mora_ft,source (one row per 1°×1° grid, center coordinates at x.5)
 * Source: FAA (official CIFP) or TERRAIN (computed from ETOPO)
 * @returns {Promise<boolean>} True if loaded successfully
 */
async function loadMORAData() {
    if (moraDataLoaded && moraCache.size > 0) {
        console.log(`[TerrainAnalyzer] MORA data already loaded (${moraCache.size} grid cells)`);
        return true;
    }

    await initTerrainDB();

    // Try to load from IndexedDB first
    if (terrainDB) {
        try {
            const loaded = await loadMORAFromDB();
            if (loaded > 0) {
                moraDataLoaded = true;
                console.log(`[TerrainAnalyzer] Loaded ${loaded} MORA grid cells from IndexedDB`);
                return true;
            }
        } catch (error) {
            console.warn('[TerrainAnalyzer] Error loading MORA from IndexedDB:', error);
        }
    }

    // Fetch from NASR API
    console.log('[TerrainAnalyzer] Fetching global MORA data from NASR API...');
    try {
        const response = await fetch(NASR_MORA_URL);
        if (!response.ok) {
            console.error(`[TerrainAnalyzer] MORA fetch failed: ${response.status}`);
            return false;
        }

        const csvText = await response.text();
        const lines = csvText.trim().split('\n');

        // Skip header row (lat,lon,mora_ft,source)
        const dataLines = lines.slice(1);
        const moraEntries = [];

        for (const line of dataLines) {
            const parts = line.split(',');
            if (parts.length >= 3) {
                // CSV contains center coordinates at x.5 (e.g., 49.5, -124.5)
                const centerLat = parseFloat(parts[0]);
                const centerLon = parseFloat(parts[1]);
                const mora = parseInt(parts[2], 10);
                const source = parts[3] || 'TERRAIN'; // FAA or TERRAIN

                if (!isNaN(centerLat) && !isNaN(centerLon) && !isNaN(mora)) {
                    // Convert center to SW corner (subtract half grid size = 0.5)
                    const swLat = centerLat - MORA_GRID_SIZE_DEG / 2;
                    const swLon = centerLon - MORA_GRID_SIZE_DEG / 2;
                    // Key uses SW corner as integer for 1° grid alignment
                    const key = `${Math.round(swLat)},${Math.round(swLon)}`;
                    const entry = { key, lat: swLat, lon: swLon, mora, source };
                    moraCache.set(key, entry);
                    moraEntries.push(entry);
                }
            }
        }

        console.log(`[TerrainAnalyzer] Parsed ${moraCache.size} MORA grid cells (global coverage)`);

        // Save to IndexedDB for offline use
        if (terrainDB && moraEntries.length > 0) {
            await saveMORAToDB(moraEntries);
        }

        moraDataLoaded = true;
        return true;
    } catch (error) {
        console.error('[TerrainAnalyzer] Error loading MORA data:', error);
        return false;
    }
}

/**
 * Load MORA data from IndexedDB
 * @returns {Promise<number>} Number of entries loaded
 */
async function loadMORAFromDB() {
    if (!terrainDB) return 0;

    return new Promise((resolve) => {
        try {
            const tx = terrainDB.transaction(MORA_STORE_NAME, 'readonly');
            const store = tx.objectStore(MORA_STORE_NAME);
            const request = store.openCursor();
            let count = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const entry = cursor.value;
                    moraCache.set(entry.key, entry);
                    count++;
                    cursor.continue();
                } else {
                    resolve(count);
                }
            };
            request.onerror = () => resolve(0);
        } catch (error) {
            resolve(0);
        }
    });
}

/**
 * Save MORA data to IndexedDB
 * @param {Array} entries - MORA entries to save
 */
async function saveMORAToDB(entries) {
    if (!terrainDB || entries.length === 0) return;

    try {
        const tx = terrainDB.transaction(MORA_STORE_NAME, 'readwrite');
        const store = tx.objectStore(MORA_STORE_NAME);

        // Clear existing data first
        store.clear();

        // Add all entries
        for (const entry of entries) {
            store.put(entry);
        }

        console.log(`[TerrainAnalyzer] Saved ${entries.length} MORA entries to IndexedDB`);
    } catch (error) {
        console.warn('[TerrainAnalyzer] Error saving MORA to IndexedDB:', error);
    }
}

/**
 * Get MORA for a specific grid cell by lat/lon
 * @param {number} lat - Latitude (will be snapped to 1° grid SW corner)
 * @param {number} lon - Longitude (will be snapped to 1° grid SW corner)
 * @returns {Object|null} MORA data {mora, source, lat, lon, key} or null
 */
function getMORAForGrid(lat, lon) {
    // Snap to 1 degree grid - SW corner of grid cell
    const latGrid = Math.floor(lat);
    const lonGrid = Math.floor(lon);
    const key = `${latGrid},${lonGrid}`;

    return moraCache.get(key) || null;
}

/**
 * Get all MORA grid cells that intersect with bounds
 * @param {Object} bounds - {minLat, maxLat, minLon, maxLon}
 * @returns {Array} MORA entries that intersect bounds
 */
function getMORAInBounds(bounds) {
    const results = [];

    for (const [key, entry] of moraCache) {
        // entry.lat/lon is SW corner, calculate NE corner (1° grid)
        const neLat = entry.lat + MORA_GRID_SIZE_DEG;
        const neLon = entry.lon + MORA_GRID_SIZE_DEG;

        // Check if grid cell intersects bounds (not just if SW corner is inside)
        // Grid cell intersects if it's not completely outside on any side
        const intersects = !(
            neLat < bounds.minLat ||  // Grid cell is completely below bounds
            entry.lat > bounds.maxLat ||  // Grid cell is completely above bounds
            neLon < bounds.minLon ||  // Grid cell is completely left of bounds
            entry.lon > bounds.maxLon     // Grid cell is completely right of bounds
        );

        if (intersects) {
            results.push(entry);
        }
    }

    return results;
}

/**
 * Check if MORA data is loaded
 * @returns {boolean}
 */
function isMORADataLoaded() {
    return moraDataLoaded && moraCache.size > 0;
}

// ============================================
// ELEVATION API QUERIES
// ============================================

/**
 * Query elevation for a single point (with cache)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<number|null>} Elevation in feet MSL, or null if unavailable
 */
async function getElevationAtPoint(lat, lon) {
    await initTerrainDB();

    const cacheKey = toGridKey(lat, lon);

    // Check memory cache first
    if (terrainCache.has(cacheKey)) {
        return terrainCache.get(cacheKey);
    }

    // Check IndexedDB cache
    const dbElevation = await loadFromDB(cacheKey);
    if (dbElevation !== null) {
        terrainCache.set(cacheKey, dbElevation);
        return dbElevation;
    }

    // Fetch from API
    try {
        const apiUrl = buildElevationUrl(`${lat},${lon}`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            console.warn(`[TerrainAnalyzer] Elevation API error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
            const elevMeters = data.results[0].elevation;
            if (elevMeters !== null) {
                const elevFeet = Math.round(elevMeters * 3.28084);
                terrainCache.set(cacheKey, elevFeet);
                await saveToDB(cacheKey, lat, lon, elevFeet);
                return elevFeet;
            }
        }
        return null;
    } catch (error) {
        console.error('[TerrainAnalyzer] Elevation fetch error:', error);
        return null;
    }
}

/**
 * Query elevation for multiple points in batch (more efficient)
 * Uses memory cache -> IndexedDB cache -> API fallback
 * @param {Array<{lat: number, lon: number}>} points - Array of coordinates
 * @returns {Promise<Array<number|null>>} Array of elevations in feet
 */
async function getElevationsForPoints(points) {
    if (points.length === 0) return [];

    await initTerrainDB();

    // Check memory cache and IndexedDB cache
    const results = new Array(points.length).fill(null);
    const uncachedIndices = [];
    const uncachedPoints = [];
    const dbCheckPromises = [];

    // First pass: check memory cache
    points.forEach((point, index) => {
        const cacheKey = toGridKey(point.lat, point.lon);
        if (terrainCache.has(cacheKey)) {
            results[index] = terrainCache.get(cacheKey);
        } else {
            // Queue for IndexedDB check
            dbCheckPromises.push(
                loadFromDB(cacheKey).then(elevation => ({ index, cacheKey, point, elevation }))
            );
        }
    });

    // Second pass: check IndexedDB for remaining points
    if (dbCheckPromises.length > 0) {
        const dbResults = await Promise.all(dbCheckPromises);
        dbResults.forEach(({ index, cacheKey, point, elevation }) => {
            if (elevation !== null) {
                terrainCache.set(cacheKey, elevation);
                results[index] = elevation;
            } else {
                uncachedIndices.push(index);
                uncachedPoints.push({ ...point, cacheKey });
            }
        });
    }

    const cachedCount = points.length - uncachedPoints.length;
    if (cachedCount > 0) {
        console.log(`[TerrainAnalyzer] ${cachedCount} elevations from cache`);
    }

    if (uncachedPoints.length === 0) {
        return results;
    }

    // Batch API requests for uncached points
    const batches = [];
    for (let i = 0; i < uncachedPoints.length; i += ELEVATION_BATCH_SIZE) {
        batches.push(uncachedPoints.slice(i, i + ELEVATION_BATCH_SIZE));
    }

    console.log(`[TerrainAnalyzer] Fetching ${uncachedPoints.length} elevations in ${batches.length} batch(es)...`);

    const dbEntriesToSave = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const locationsStr = batch.map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|');

        try {
            const apiUrl = buildElevationUrl(locationsStr);
            console.log(`[TerrainAnalyzer] Fetching batch ${batchIndex + 1}/${batches.length}...`);
            const response = await fetch(apiUrl);
            console.log(`[TerrainAnalyzer] Batch ${batchIndex + 1} response status: ${response.status}`);
            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`[TerrainAnalyzer] Batch ${batchIndex + 1} API error: ${response.status}`, errorText);
                continue;
            }

            const data = await response.json();
            console.log(`[TerrainAnalyzer] Batch ${batchIndex + 1} data:`, data.status, data.results?.length || 0, 'results');
            if (data.status === 'OK' && data.results) {
                data.results.forEach((result, i) => {
                    const globalIndex = batchIndex * ELEVATION_BATCH_SIZE + i;
                    const originalIndex = uncachedIndices[globalIndex];
                    const point = uncachedPoints[globalIndex];

                    if (result.elevation !== null) {
                        const elevFeet = Math.round(result.elevation * 3.28084);
                        terrainCache.set(point.cacheKey, elevFeet);
                        results[originalIndex] = elevFeet;

                        // Queue for IndexedDB save
                        dbEntriesToSave.push({
                            key: point.cacheKey,
                            lat: point.lat,
                            lon: point.lon,
                            elevation: elevFeet
                        });
                    }
                });
            }
        } catch (error) {
            console.error(`[TerrainAnalyzer] Batch ${batchIndex + 1} fetch error:`, error);
        }

        // Rate limiting: wait 100ms between batches
        if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Batch save to IndexedDB (non-blocking)
    if (dbEntriesToSave.length > 0) {
        batchSaveToDB(dbEntriesToSave).then(() => {
            console.log(`[TerrainAnalyzer] Saved ${dbEntriesToSave.length} elevations to cache`);
        });
    }

    return results;
}

// ============================================
// ROUTE TERRAIN ANALYSIS
// ============================================

/**
 * Generate sample points along a great circle route between two waypoints
 * @param {Object} from - Start waypoint {lat, lon}
 * @param {Object} to - End waypoint {lat, lon}
 * @param {number} intervalNM - Sample interval in nautical miles
 * @returns {Array<{lat: number, lon: number, distanceNM: number}>} Sample points
 */
function generateSamplePoints(from, to, intervalNM = ELEVATION_SAMPLE_INTERVAL_NM) {
    const points = [];

    // Calculate total distance using Vincenty formula
    let totalDistanceNM;
    if (typeof Geodesy !== 'undefined' && Geodesy.vincentyDistance) {
        totalDistanceNM = Geodesy.vincentyDistance(from.lat, from.lon, to.lat, to.lon);
    } else {
        // Fallback to haversine approximation
        const R = 3440.065; // Earth radius in NM
        const dLat = (to.lat - from.lat) * Math.PI / 180;
        const dLon = (to.lon - from.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;
        totalDistanceNM = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const numSamples = Math.max(2, Math.ceil(totalDistanceNM / intervalNM) + 1);

    for (let i = 0; i < numSamples; i++) {
        const fraction = i / (numSamples - 1);
        const distanceNM = fraction * totalDistanceNM;

        // Interpolate position along great circle
        let lat, lon;
        if (typeof Geodesy !== 'undefined' && Geodesy.intermediatePoint) {
            const pos = Geodesy.intermediatePoint(from.lat, from.lon, to.lat, to.lon, fraction);
            lat = pos.lat;
            lon = pos.lon;
        } else {
            // Linear interpolation fallback (less accurate for long distances)
            lat = from.lat + fraction * (to.lat - from.lat);
            lon = from.lon + fraction * (to.lon - from.lon);
        }

        points.push({ lat, lon, distanceNM });
    }

    return points;
}

/**
 * Analyze terrain along entire route using offline OROCA data
 * Uses pre-computed OROCA grid cells that the route passes through
 * @param {Array} waypoints - Array of waypoint objects with lat, lon
 * @param {Array} legs - Array of leg objects (optional, for distance reference)
 * @returns {Promise<Object>} Terrain analysis results
 */
async function analyzeRouteTerrain(waypoints, legs = []) {
    console.log('[TerrainAnalyzer] analyzeRouteTerrain called with:', waypoints?.length, 'waypoints');

    if (!waypoints || waypoints.length < 2) {
        return { error: 'Need at least 2 waypoints for terrain analysis' };
    }

    console.log(`[TerrainAnalyzer] Analyzing terrain for ${waypoints.length} waypoints...`);

    // Generate sample points along entire route
    const allPoints = [];
    let cumulativeDistanceNM = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to = waypoints[i + 1];
        const legPoints = generateSamplePoints(from, to);

        // Adjust distances to be cumulative
        legPoints.forEach((point, index) => {
            // Skip first point of subsequent legs (it's the same as last point of previous leg)
            if (i > 0 && index === 0) return;

            allPoints.push({
                ...point,
                distanceNM: cumulativeDistanceNM + point.distanceNM,
                legIndex: i
            });
        });

        // Update cumulative distance
        const legDistance = legPoints[legPoints.length - 1].distanceNM;
        cumulativeDistanceNM += legDistance;
    }

    console.log(`[TerrainAnalyzer] Generated ${allPoints.length} sample points over ${cumulativeDistanceNM.toFixed(1)}nm`);

    // Use offline MORA data if available
    if (moraDataLoaded && moraCache.size > 0) {
        console.log('[TerrainAnalyzer] Using offline MORA data for terrain analysis');
        return analyzeRouteWithMORA(waypoints, allPoints, cumulativeDistanceNM);
    }

    // Fallback to API-based elevation lookup
    console.log('[TerrainAnalyzer] MORA data not available, using elevation API...');
    return analyzeRouteWithAPI(waypoints, allPoints, cumulativeDistanceNM);
}

/**
 * Analyze route terrain using offline global MORA data
 * Shows only grid cells that the route passes through
 */
function analyzeRouteWithMORA(waypoints, allPoints, totalDistanceNM) {
    // Find unique MORA grid cells along the route
    const routeGridCells = new Map(); // key -> {mora, firstDistance, lastDistance}

    allPoints.forEach(point => {
        const moraData = getMORAForGrid(point.lat, point.lon);
        if (moraData) {
            const existing = routeGridCells.get(moraData.key);
            if (existing) {
                existing.lastDistance = point.distanceNM;
            } else {
                routeGridCells.set(moraData.key, {
                    ...moraData,
                    firstDistance: point.distanceNM,
                    lastDistance: point.distanceNM,
                    legIndex: point.legIndex
                });
            }
        }
    });

    console.log(`[TerrainAnalyzer] Route passes through ${routeGridCells.size} MORA grid cells`);

    // Build terrain profile from MORA data
    // MORA already includes obstacle clearance
    const terrainProfile = allPoints.map(point => {
        const moraData = getMORAForGrid(point.lat, point.lon);
        // MORA is a safe altitude, estimate terrain as MORA - 1000 (standard clearance)
        const estimatedTerrain = moraData ? Math.max(0, moraData.mora - 1000) : null;
        return {
            lat: point.lat,
            lon: point.lon,
            distanceNM: point.distanceNM,
            legIndex: point.legIndex,
            elevationFt: estimatedTerrain,
            mora: moraData ? moraData.mora : null,
            source: moraData ? moraData.source : null
        };
    });

    // Calculate statistics from MORA values
    const moraValues = Array.from(routeGridCells.values()).map(g => g.mora);
    const maxMORA = moraValues.length > 0 ? Math.max(...moraValues) : null;
    const minMORA = moraValues.length > 0 ? Math.min(...moraValues) : null;

    // Estimate max terrain (MORA - standard clearance)
    const maxElevation = maxMORA ? Math.max(0, maxMORA - 1000) : null;
    const minElevation = minMORA ? Math.max(0, minMORA - 1000) : null;
    const avgElevation = moraValues.length > 0
        ? Math.round(moraValues.reduce((a, b) => a + b, 0) / moraValues.length) - 1000
        : null;

    const isMountainous = maxElevation !== null && maxElevation >= MOUNTAINOUS_THRESHOLD_FT;
    const requiredClearance = isMountainous ? MOUNTAINOUS_CLEARANCE_FT : MIN_TERRAIN_CLEARANCE_FT;

    // Per-leg analysis
    const legAnalysis = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const legCells = Array.from(routeGridCells.values()).filter(g => g.legIndex === i);
        const legMORAs = legCells.map(g => g.mora);

        if (legMORAs.length > 0) {
            const legMaxMORA = Math.max(...legMORAs);
            const legMaxTerrain = Math.max(0, legMaxMORA - 1000);
            const legIsMountainous = legMaxTerrain >= MOUNTAINOUS_THRESHOLD_FT;

            legAnalysis.push({
                legIndex: i,
                from: waypoints[i].ident || waypoints[i].icao || `WPT${i + 1}`,
                to: waypoints[i + 1].ident || waypoints[i + 1].icao || `WPT${i + 2}`,
                maxElevation: legMaxTerrain,
                mora: legMaxMORA,
                isMountainous: legIsMountainous,
                requiredClearance: legIsMountainous ? MOUNTAINOUS_CLEARANCE_FT : MIN_TERRAIN_CLEARANCE_FT,
                gridCellCount: legCells.length
            });
        }
    }

    // Store analysis results
    lastAnalysis = {
        timestamp: Date.now(),
        terrainProfile,
        totalDistanceNM,
        statistics: {
            maxElevation,
            minElevation,
            avgElevation,
            isMountainous,
            requiredClearance,
            mora: maxMORA,
            sampleCount: allPoints.length,
            validSamples: terrainProfile.filter(p => p.mora !== null).length,
            gridCellCount: routeGridCells.size,
            dataSource: 'offline_mora'
        },
        legAnalysis,
        routeGridCells: Array.from(routeGridCells.values()),
        waypoints: waypoints.map(w => ({
            ident: w.ident || w.icao,
            lat: w.lat,
            lon: w.lon,
            elevation: w.elevation
        }))
    };

    console.log(`[TerrainAnalyzer] Offline analysis complete. Max MORA: ${maxMORA}ft, Est. terrain: ${maxElevation}ft`);

    return lastAnalysis;
}

/**
 * Analyze route terrain using elevation API (fallback)
 */
async function analyzeRouteWithAPI(waypoints, allPoints, totalDistanceNM) {
    // Fetch elevations for all sample points
    console.log('[TerrainAnalyzer] Calling getElevationsForPoints...');
    const elevations = await getElevationsForPoints(allPoints);
    console.log('[TerrainAnalyzer] Got elevations:', elevations?.length, 'results, valid:', elevations?.filter(e => e !== null).length);

    // Build terrain profile
    const terrainProfile = allPoints.map((point, index) => ({
        lat: point.lat,
        lon: point.lon,
        distanceNM: point.distanceNM,
        legIndex: point.legIndex,
        elevationFt: elevations[index]
    }));

    // Calculate statistics
    const validElevations = elevations.filter(e => e !== null);
    const maxElevation = validElevations.length > 0 ? Math.max(...validElevations) : null;
    const minElevation = validElevations.length > 0 ? Math.min(...validElevations) : null;
    const avgElevation = validElevations.length > 0
        ? Math.round(validElevations.reduce((a, b) => a + b, 0) / validElevations.length)
        : null;

    // Determine if terrain is mountainous
    const isMountainous = maxElevation !== null && maxElevation >= MOUNTAINOUS_THRESHOLD_FT;
    const requiredClearance = isMountainous ? MOUNTAINOUS_CLEARANCE_FT : MIN_TERRAIN_CLEARANCE_FT;

    // Calculate MEF (Maximum Elevation Figure) - highest terrain + required clearance, rounded up to 100ft
    const mef = maxElevation !== null
        ? Math.ceil((maxElevation + requiredClearance) / 100) * 100
        : null;

    // Per-leg analysis
    const legAnalysis = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const legPoints = terrainProfile.filter(p => p.legIndex === i);
        const legElevations = legPoints.map(p => p.elevationFt).filter(e => e !== null);

        if (legElevations.length > 0) {
            const legMax = Math.max(...legElevations);
            const legIsMountainous = legMax >= MOUNTAINOUS_THRESHOLD_FT;
            const legClearance = legIsMountainous ? MOUNTAINOUS_CLEARANCE_FT : MIN_TERRAIN_CLEARANCE_FT;
            const legMEF = Math.ceil((legMax + legClearance) / 100) * 100;

            legAnalysis.push({
                legIndex: i,
                from: waypoints[i].ident || waypoints[i].icao || `WPT${i + 1}`,
                to: waypoints[i + 1].ident || waypoints[i + 1].icao || `WPT${i + 2}`,
                maxElevation: legMax,
                mef: legMEF,
                isMountainous: legIsMountainous,
                requiredClearance: legClearance,
                sampleCount: legPoints.length
            });
        }
    }

    // Store analysis results
    lastAnalysis = {
        timestamp: Date.now(),
        terrainProfile,
        totalDistanceNM,
        statistics: {
            maxElevation,
            minElevation,
            avgElevation,
            isMountainous,
            requiredClearance,
            mef,
            sampleCount: allPoints.length,
            validSamples: validElevations.length,
            dataSource: 'elevation_api'
        },
        legAnalysis,
        waypoints: waypoints.map(w => ({
            ident: w.ident || w.icao,
            lat: w.lat,
            lon: w.lon,
            elevation: w.elevation
        }))
    };

    console.log(`[TerrainAnalyzer] API analysis complete. Max terrain: ${maxElevation}ft, MEF: ${mef}ft`);

    return lastAnalysis;
}

/**
 * Check if a given cruise altitude provides adequate terrain clearance
 * @param {number} cruiseAltitude - Filed altitude in feet
 * @param {Object} analysis - Terrain analysis from analyzeRouteTerrain()
 * @returns {Object} Clearance check results
 */
function checkTerrainClearance(cruiseAltitude, analysis = lastAnalysis) {
    if (!analysis || !analysis.statistics) {
        return { status: 'UNKNOWN', message: 'No terrain analysis available' };
    }

    const { maxElevation, mef, isMountainous, requiredClearance } = analysis.statistics;

    if (maxElevation === null || mef === null) {
        return { status: 'UNKNOWN', message: 'Terrain data unavailable' };
    }

    const actualClearance = cruiseAltitude - maxElevation;
    const clearanceDeficit = requiredClearance - actualClearance;

    // Check per-leg clearance
    const legWarnings = [];
    if (analysis.legAnalysis) {
        analysis.legAnalysis.forEach(leg => {
            const legClearance = cruiseAltitude - leg.maxElevation;
            if (legClearance < leg.requiredClearance) {
                legWarnings.push({
                    leg: `${leg.from} → ${leg.to}`,
                    terrain: leg.maxElevation,
                    clearance: legClearance,
                    required: leg.requiredClearance,
                    deficit: leg.requiredClearance - legClearance,
                    isMountainous: leg.isMountainous
                });
            }
        });
    }

    if (cruiseAltitude >= mef) {
        return {
            status: 'OK',
            message: `Adequate clearance: ${actualClearance}ft above highest terrain`,
            cruiseAltitude,
            maxTerrain: maxElevation,
            mef,
            actualClearance,
            requiredClearance,
            isMountainous,
            legWarnings
        };
    } else if (actualClearance >= requiredClearance) {
        return {
            status: 'MARGINAL',
            message: `Clearance OK but below MEF. Actual: ${actualClearance}ft, MEF recommends: ${mef}ft`,
            cruiseAltitude,
            maxTerrain: maxElevation,
            mef,
            actualClearance,
            requiredClearance,
            isMountainous,
            legWarnings
        };
    } else {
        return {
            status: 'UNSAFE',
            message: `INSUFFICIENT CLEARANCE! Only ${actualClearance}ft above terrain. Need ${requiredClearance}ft minimum.`,
            cruiseAltitude,
            maxTerrain: maxElevation,
            mef,
            actualClearance,
            requiredClearance,
            clearanceDeficit,
            recommendedAltitude: mef,
            isMountainous,
            legWarnings
        };
    }
}

/**
 * Get minimum safe altitude for route
 * @param {Object} analysis - Terrain analysis from analyzeRouteTerrain()
 * @returns {number|null} Minimum safe altitude in feet
 */
function getMinimumSafeAltitude(analysis = lastAnalysis) {
    if (!analysis || !analysis.statistics || analysis.statistics.mef === null) {
        return null;
    }
    return analysis.statistics.mef;
}

/**
 * Get terrain profile for visualization
 * @returns {Array|null} Terrain profile array
 */
function getTerrainProfile() {
    return lastAnalysis ? lastAnalysis.terrainProfile : null;
}

/**
 * Get leg-by-leg terrain analysis
 * @returns {Array|null} Leg analysis array
 */
function getLegAnalysis() {
    return lastAnalysis ? lastAnalysis.legAnalysis : null;
}

/**
 * Clear terrain cache (call when route changes significantly)
 */
function clearTerrainCache() {
    terrainCache.clear();
    lastAnalysis = null;
    console.log('[TerrainAnalyzer] Cache cleared');
}

/**
 * Get last analysis results
 * @returns {Object|null} Last analysis or null
 */
function getLastAnalysis() {
    return lastAnalysis;
}

/**
 * Clear all cached terrain data (memory + IndexedDB)
 */
async function clearAllCache() {
    terrainCache.clear();
    lastAnalysis = null;

    if (terrainDB) {
        try {
            const tx = terrainDB.transaction(TERRAIN_STORE_NAME, 'readwrite');
            const store = tx.objectStore(TERRAIN_STORE_NAME);
            store.clear();
            console.log('[TerrainAnalyzer] All cache cleared');
        } catch (error) {
            console.warn('[TerrainAnalyzer] Error clearing IndexedDB:', error);
        }
    }
}

// ============================================
// MORA GRID HELPER FUNCTIONS
// ============================================

/**
 * Calculate grid cell key for a lat/lon (1° MORA grid)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} Grid cell key "latGrid,lonGrid"
 */
function getGridCellKey(lat, lon) {
    const latGrid = Math.floor(lat);
    const lonGrid = Math.floor(lon);
    return `${latGrid},${lonGrid}`;
}

/**
 * Get grid cell center coordinates (1° MORA grid)
 * @param {string} cellKey - Grid cell key "latGrid,lonGrid"
 * @returns {{lat: number, lon: number}} Center coordinates
 */
function getGridCellCenter(cellKey) {
    const [latGrid, lonGrid] = cellKey.split(',').map(Number);
    return {
        lat: latGrid + MORA_GRID_SIZE_DEG / 2,
        lon: lonGrid + MORA_GRID_SIZE_DEG / 2
    };
}

/**
 * Get grid cell bounds (1° MORA grid)
 * @param {string} cellKey - Grid cell key
 * @returns {{minLat: number, maxLat: number, minLon: number, maxLon: number}}
 */
function getGridCellBounds(cellKey) {
    const [latGrid, lonGrid] = cellKey.split(',').map(Number);
    return {
        minLat: latGrid,
        maxLat: latGrid + MORA_GRID_SIZE_DEG,
        minLon: lonGrid,
        maxLon: lonGrid + MORA_GRID_SIZE_DEG
    };
}

/**
 * Get MORA grid data for the visible map bounds
 * Uses pre-computed global MORA data from NASR API (offline capable)
 * @param {Object} bounds - Optional {minLat, maxLat, minLon, maxLon} - if not provided, uses last analysis
 * @returns {Array|null} Grid MORA array [{cellKey, center, bounds, mora, source}, ...]
 */
async function getGridMORAData(bounds = null) {
    // If MORA data is loaded, use pre-computed data
    if (moraDataLoaded && moraCache.size > 0) {
        if (!bounds && lastAnalysis) {
            // Calculate bounds from terrain profile
            const profile = lastAnalysis.terrainProfile;
            if (profile && profile.length > 0) {
                const lats = profile.map(p => p.lat);
                const lons = profile.map(p => p.lon);
                bounds = {
                    minLat: Math.min(...lats) - 1.0,
                    maxLat: Math.max(...lats) + 1.0,
                    minLon: Math.min(...lons) - 1.0,
                    maxLon: Math.max(...lons) + 1.0
                };
            }
        }

        if (bounds) {
            const moraEntries = getMORAInBounds(bounds);
            return moraEntries.map(entry => ({
                cellKey: entry.key,
                center: {
                    lat: entry.lat + MORA_GRID_SIZE_DEG / 2,
                    lon: entry.lon + MORA_GRID_SIZE_DEG / 2
                },
                bounds: {
                    minLat: entry.lat,
                    maxLat: entry.lat + MORA_GRID_SIZE_DEG,
                    minLon: entry.lon,
                    maxLon: entry.lon + MORA_GRID_SIZE_DEG
                },
                mora: entry.mora,
                source: entry.source,
                // Estimate terrain as MORA - 1000ft (standard clearance)
                maxTerrain: Math.max(0, entry.mora - 1000),
                isMountainous: (entry.mora - 1000) >= MOUNTAINOUS_THRESHOLD_FT
            }));
        }
    }

    return null;
}

// Export module
window.TerrainAnalyzer = {
    // Core analysis functions
    analyzeRouteTerrain,
    checkTerrainClearance,
    getMinimumSafeAltitude,
    getTerrainProfile,
    getLegAnalysis,
    getLastAnalysis,

    // MORA grid data (global coverage)
    getGridMORAData,

    // Pre-computed MORA data (NASR API)
    loadMORAData,
    getMORAForGrid,
    getMORAInBounds,
    isMORADataLoaded,

    // Elevation queries
    getElevationAtPoint,
    getElevationsForPoints,

    // Cache management
    initTerrainDB,
    preloadRegion,
    getCacheStats,
    clearTerrainCache,
    clearAllCache,

    // Constants exposed for UI
    MIN_TERRAIN_CLEARANCE_FT,
    MOUNTAINOUS_THRESHOLD_FT,
    MOUNTAINOUS_CLEARANCE_FT,
    CACHE_GRID_RESOLUTION,
    MORA_GRID_SIZE_DEG
};

console.log('[TerrainAnalyzer] Module loaded, window.TerrainAnalyzer =', !!window.TerrainAnalyzer);
