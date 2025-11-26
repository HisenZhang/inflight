// Terrain Analyzer Module - MEF (Maximum Elevation Figure) analysis for route planning
// Calculates terrain elevation along route and checks for altitude clearance
// Caches elevation data in IndexedDB for offline use

// API configuration for Open Topo Data (free, no API key required)
// Use CORS proxy for browser requests
const ELEVATION_API_BASE = 'https://api.opentopodata.org/v1/srtm30m';
const CORS_PROXY = 'https://cors.hisenz.com/?url=';

/**
 * Build proxied API URL with location parameters
 * @param {string} locations - Pipe-separated lat,lon pairs
 * @returns {string} Full proxied URL
 */
function buildElevationUrl(locations) {
    const fullUrl = `${ELEVATION_API_BASE}?locations=${locations}`;
    const proxiedUrl = CORS_PROXY + encodeURIComponent(fullUrl);
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
const TERRAIN_DB_VERSION = 1;
const TERRAIN_STORE_NAME = 'elevations';
const CACHE_GRID_RESOLUTION = 0.01; // Grid resolution in degrees (~1.1km or ~0.6nm)

// In-memory cache (populated from IndexedDB on init)
let terrainCache = new Map(); // Key: lat,lon (grid), Value: elevation in feet
let terrainDB = null;
let dbInitialized = false;
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
            const response = await fetch(apiUrl);
            if (!response.ok) {
                console.warn(`[TerrainAnalyzer] Batch ${batchIndex + 1} API error: ${response.status}`);
                continue;
            }

            const data = await response.json();
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
 * Analyze terrain along entire route
 * @param {Array} waypoints - Array of waypoint objects with lat, lon
 * @param {Array} legs - Array of leg objects (optional, for distance reference)
 * @returns {Promise<Object>} Terrain analysis results
 */
async function analyzeRouteTerrain(waypoints, legs = []) {
    if (!waypoints || waypoints.length < 2) {
        return { error: 'Need at least 2 waypoints for terrain analysis' };
    }

    console.log(`[TerrainAnalyzer] Analyzing terrain for ${waypoints.length} waypoints...`);

    // Generate sample points along entire route
    const allPoints = [];
    const legBoundaries = [0]; // Track where each leg starts in the points array
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
        legBoundaries.push(allPoints.length);
    }

    console.log(`[TerrainAnalyzer] Generated ${allPoints.length} sample points over ${cumulativeDistanceNM.toFixed(1)}nm`);

    // Fetch elevations for all sample points
    const elevations = await getElevationsForPoints(allPoints);

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
        totalDistanceNM: cumulativeDistanceNM,
        statistics: {
            maxElevation,
            minElevation,
            avgElevation,
            isMountainous,
            requiredClearance,
            mef,
            sampleCount: allPoints.length,
            validSamples: validElevations.length
        },
        legAnalysis,
        waypoints: waypoints.map(w => ({
            ident: w.ident || w.icao,
            lat: w.lat,
            lon: w.lon,
            elevation: w.elevation
        }))
    };

    console.log(`[TerrainAnalyzer] Analysis complete. Max terrain: ${maxElevation}ft, MEF: ${mef}ft`);

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

// Export module
window.TerrainAnalyzer = {
    // Core analysis functions
    analyzeRouteTerrain,
    checkTerrainClearance,
    getMinimumSafeAltitude,
    getTerrainProfile,
    getLegAnalysis,
    getLastAnalysis,

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
    CACHE_GRID_RESOLUTION
};
