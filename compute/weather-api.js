/**
 * Weather API Module
 * Fetches and parses aviation weather data from Aviation Weather Center
 *
 * Features:
 * - TAF (Terminal Aerodrome Forecast)
 * - METAR (Meteorological Aerodrome Report)
 * - PIREP (Pilot Reports)
 * - SIGMET/AIRMET (Significant Weather)
 * - Flight category determination (VFR/MVFR/IFR/LIFR)
 * - Caching with IndexedDB
 */

// Cache configuration
const WEATHER_CACHE_DURATION = {
    metar: 5 * 60 * 1000,      // 5 minutes
    taf: 30 * 60 * 1000,       // 30 minutes
    pirep: 10 * 60 * 1000,     // 10 minutes
    sigmet: 15 * 60 * 1000,    // 15 minutes
    airport: 24 * 60 * 60 * 1000  // 24 hours
};

// CORS proxy configuration (reuse existing)
const CORS_PROXY = 'https://cors.hisenz.com/?url=';
const AWC_BASE_URL = 'https://aviationweather.gov/api/data';

/**
 * Weather data cache (in-memory for fast access)
 */
const weatherCache = {
    metar: new Map(),
    taf: new Map(),
    pirep: new Map(),
    sigmet: null,
    gairmet: null,
    airport: new Map()
};

/**
 * Fetch METAR data for an airport
 * @param {string} icao - 4-letter ICAO code
 * @returns {Promise<Object>} METAR data
 */
async function fetchMETAR(icao) {
    console.log(`[WeatherAPI] Fetching METAR for ${icao}`);

    // Check cache first
    const cached = getCachedWeather('metar', icao);
    if (cached) {
        console.log(`[WeatherAPI] Using cached METAR for ${icao}`);
        return cached;
    }

    try {
        const apiUrl = `${AWC_BASE_URL}/metar?ids=${icao}&format=json`;
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(apiUrl)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const jsonData = await response.json();

        if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
            throw new Error('No METAR data available');
        }

        const metarData = jsonData[0];

        // Cache the result
        cacheWeather('metar', icao, metarData);

        console.log(`[WeatherAPI] METAR fetched for ${icao}:`, metarData);
        return metarData;

    } catch (error) {
        console.error(`[WeatherAPI] METAR fetch error for ${icao}:`, error);
        throw error;
    }
}

/**
 * Fetch TAF data for an airport
 * @param {string} icao - 4-letter ICAO code
 * @returns {Promise<Object>} TAF data
 */
async function fetchTAF(icao) {
    console.log(`[WeatherAPI] Fetching TAF for ${icao}`);

    // Check cache first
    const cached = getCachedWeather('taf', icao);
    if (cached) {
        console.log(`[WeatherAPI] Using cached TAF for ${icao}`);
        return cached;
    }

    try {
        const apiUrl = `${AWC_BASE_URL}/taf?ids=${icao}&format=json`;
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(apiUrl)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const jsonData = await response.json();

        if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
            throw new Error('No TAF data available');
        }

        const tafData = jsonData[0];

        // Cache the result
        cacheWeather('taf', icao, tafData);

        console.log(`[WeatherAPI] TAF fetched for ${icao}:`, tafData);
        return tafData;

    } catch (error) {
        console.error(`[WeatherAPI] TAF fetch error for ${icao}:`, error);
        throw error;
    }
}

/**
 * Fetch PIREP data near an airport or location
 * @param {string} icao - 4-letter ICAO code (center point)
 * @param {number} radiusNM - Search radius in nautical miles (default: 100)
 * @param {number} ageHours - Maximum age in hours (default: 6)
 * @returns {Promise<Array>} Array of PIREP objects
 */
async function fetchPIREPs(icao, radiusNM = 100, ageHours = 6) {
    console.log(`[WeatherAPI] Fetching PIREPs for ${icao} (${radiusNM}NM, ${ageHours}hr)`);

    // Check cache first
    const cacheKey = `${icao}_${radiusNM}_${ageHours}`;
    const cached = getCachedWeather('pirep', cacheKey);
    if (cached) {
        console.log(`[WeatherAPI] Using cached PIREPs for ${icao}`);
        return cached;
    }

    try {
        // Convert NM to statute miles (AWC API uses statute miles)
        const radiusSM = Math.round(radiusNM * 1.15078);

        const apiUrl = `${AWC_BASE_URL}/pirep?id=${icao}&distance=${radiusSM}&age=${ageHours}&format=json`;
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(apiUrl)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();

        // Handle empty response
        if (!text || text.trim() === '') {
            console.log(`[WeatherAPI] No PIREPs available for ${icao}`);
            cacheWeather('pirep', cacheKey, []);
            return [];
        }

        const jsonData = JSON.parse(text);

        if (!jsonData || !Array.isArray(jsonData)) {
            cacheWeather('pirep', cacheKey, []);
            return [];
        }

        // Cache the result
        cacheWeather('pirep', cacheKey, jsonData);

        console.log(`[WeatherAPI] ${jsonData.length} PIREPs fetched for ${icao}`);
        return jsonData;

    } catch (error) {
        if (error instanceof SyntaxError) {
            // JSON parse error - no PIREPs available
            console.log(`[WeatherAPI] No PIREPs available for ${icao}`);
            return [];
        }
        console.error(`[WeatherAPI] PIREP fetch error for ${icao}:`, error);
        throw error;
    }
}

/**
 * Fetch SIGMET/AIRMET data (US)
 * @returns {Promise<Array>} Array of SIGMET/AIRMET objects
 */
async function fetchSIGMETs() {
    console.log('[WeatherAPI] Fetching SIGMETs');

    // Check cache first
    if (weatherCache.sigmet && (Date.now() - weatherCache.sigmet.timestamp < WEATHER_CACHE_DURATION.sigmet)) {
        console.log('[WeatherAPI] Using cached SIGMETs');
        return weatherCache.sigmet.data;
    }

    try {
        const apiUrl = `${AWC_BASE_URL}/airsigmet?format=json`;
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(apiUrl)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const jsonData = await response.json();
        const data = Array.isArray(jsonData) ? jsonData : [];

        // Cache the result
        weatherCache.sigmet = {
            data: data,
            timestamp: Date.now()
        };

        console.log(`[WeatherAPI] ${data.length} SIGMETs fetched`);
        return data;

    } catch (error) {
        console.error('[WeatherAPI] SIGMET fetch error:', error);
        throw error;
    }
}

/**
 * Fetch G-AIRMET data (US)
 * @returns {Promise<Array>} Array of G-AIRMET objects
 */
async function fetchGAIRMETs() {
    console.log('[WeatherAPI] Fetching G-AIRMETs');

    // Check cache first
    if (weatherCache.gairmet && (Date.now() - weatherCache.gairmet.timestamp < WEATHER_CACHE_DURATION.sigmet)) {
        console.log('[WeatherAPI] Using cached G-AIRMETs');
        return weatherCache.gairmet.data;
    }

    try {
        const apiUrl = `${AWC_BASE_URL}/gairmet?format=json`;
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(apiUrl)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const jsonData = await response.json();
        const data = Array.isArray(jsonData) ? jsonData : [];

        // Cache the result
        weatherCache.gairmet = {
            data: data,
            timestamp: Date.now()
        };

        console.log(`[WeatherAPI] ${data.length} G-AIRMETs fetched`);
        return data;

    } catch (error) {
        console.error('[WeatherAPI] G-AIRMET fetch error:', error);
        throw error;
    }
}

/**
 * Fetch airport information
 * @param {string} icao - 4-letter ICAO code
 * @returns {Promise<Object|null>} Airport data or null
 */
async function fetchAirportInfo(icao) {
    console.log(`[WeatherAPI] Fetching airport info for ${icao}`);

    // Check cache first
    const cached = getCachedWeather('airport', icao);
    if (cached) {
        console.log(`[WeatherAPI] Using cached airport info for ${icao}`);
        return cached;
    }

    try {
        const apiUrl = `${AWC_BASE_URL}/airport?ids=${icao}&format=json`;
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(apiUrl)}`);

        if (!response.ok) {
            return null;
        }

        const jsonData = await response.json();

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
            return null;
        }

        const airportData = jsonData[0];

        // Cache the result
        cacheWeather('airport', icao, airportData);

        console.log(`[WeatherAPI] Airport info fetched for ${icao}`);
        return airportData;

    } catch (error) {
        console.warn(`[WeatherAPI] Airport info fetch error for ${icao}:`, error);
        return null;
    }
}

/**
 * Determine flight category from visibility and ceiling
 * VFR:  Ceiling > 3000 ft AND Visibility > 5 SM
 * MVFR: Ceiling 1000-3000 ft OR Visibility 3-5 SM
 * IFR:  Ceiling 500-1000 ft OR Visibility 1-3 SM
 * LIFR: Ceiling < 500 ft OR Visibility < 1 SM
 *
 * @param {number|string} visibility - Visibility in statute miles
 * @param {number|string} ceiling - Ceiling in feet (or 'CLR'/'UNK')
 * @returns {string} Flight category: 'VFR', 'MVFR', 'IFR', 'LIFR', or 'UNK'
 */
function determineFlightCategory(visibility, ceiling) {
    // Handle unknown values
    if (visibility === 'UNK' || ceiling === 'UNK' ||
        visibility === null || visibility === undefined ||
        ceiling === null || ceiling === undefined) {
        return 'UNK';
    }

    // Parse visibility (handle "6+" format)
    const visNum = parseFloat(String(visibility).replace('+', '')) || 0;

    // Parse ceiling (handle 'CLR' as unlimited)
    const ceilNum = (ceiling === 'CLR' || ceiling === 'SKC') ? 10000 : parseInt(ceiling) || 0;

    // Determine category
    if (ceilNum < 500 || visNum < 1) return 'LIFR';
    if (ceilNum < 1000 || visNum < 3) return 'IFR';
    if (ceilNum < 3000 || visNum <= 5) return 'MVFR';
    return 'VFR';
}

/**
 * Extract flight category from METAR data
 * @param {Object} metarData - METAR object from API
 * @returns {string} Flight category
 */
function getFlightCategoryFromMETAR(metarData) {
    if (!metarData) return 'UNK';

    // Get visibility
    const visibility = metarData.visib || 'UNK';

    // Get ceiling from cloud layers
    let ceiling = 'CLR';
    if (metarData.clouds && Array.isArray(metarData.clouds)) {
        // Look for BKN or OVC layers (these define ceiling)
        for (const cloud of metarData.clouds) {
            if (cloud && cloud.cover && (cloud.cover === 'BKN' || cloud.cover === 'OVC')) {
                if (cloud.base !== null && cloud.base !== undefined) {
                    ceiling = cloud.base.toString();
                    break;
                }
            }
        }
    }

    return determineFlightCategory(visibility, ceiling);
}

/**
 * Parse PIREP for hazards (icing, turbulence)
 * @param {Object} pirep - PIREP object from API
 * @returns {Object} Parsed hazard information
 */
function parsePIREPHazards(pirep) {
    if (!pirep || !pirep.rawOb) {
        return { hasIcing: false, hasTurbulence: false, severity: null };
    }

    const raw = pirep.rawOb.toUpperCase();

    // Check for icing (ICE, ICG, or /IC format in PIREPs)
    const hasIcing = /\bICE\b|\bICG\b|\/IC\b/.test(raw);

    // Check for turbulence (TURB, TB, or /TB format in PIREPs)
    const hasTurbulence = /\bTURB\b|\/TB\b/.test(raw);

    // Determine severity
    let severity = null;
    if (/\bSVR\b|\bSEVERE\b/.test(raw)) {
        severity = 'SEVERE';
    } else if (/\bMOD\b|\bMODERATE\b/.test(raw)) {
        severity = 'MODERATE';
    } else if (/\bLGT\b|\bLIGHT\b/.test(raw)) {
        severity = 'LIGHT';
    }

    return {
        hasIcing,
        hasTurbulence,
        severity,
        raw: pirep.rawOb
    };
}

/**
 * Calculate wind components for a runway
 * @param {number} runwayHeading - Runway magnetic heading (degrees)
 * @param {number} windDirection - Wind direction (degrees)
 * @param {number} windSpeed - Wind speed (knots)
 * @returns {Object} {headwind, crosswind} in knots
 */
function calculateRunwayWindComponents(runwayHeading, windDirection, windSpeed) {
    // Handle variable winds
    if (windDirection === 0 || windSpeed === 0) {
        return { headwind: 0, crosswind: 0 };
    }

    // Calculate angle between wind and runway
    const angle = (windDirection - runwayHeading) * Math.PI / 180;

    // Headwind component (positive = headwind, negative = tailwind)
    const headwind = windSpeed * Math.cos(angle);

    // Crosswind component (positive = from right, negative = from left)
    const crosswind = windSpeed * Math.sin(angle);

    return {
        headwind: Math.round(headwind),
        crosswind: Math.round(crosswind)
    };
}

/**
 * Cache weather data
 * @param {string} type - Weather type (metar, taf, pirep, airport)
 * @param {string} key - Cache key (usually ICAO)
 * @param {*} data - Data to cache
 */
function cacheWeather(type, key, data) {
    weatherCache[type].set(key, {
        data: data,
        timestamp: Date.now()
    });
}

/**
 * Get cached weather data if still valid
 * @param {string} type - Weather type
 * @param {string} key - Cache key
 * @returns {*|null} Cached data or null if expired
 */
function getCachedWeather(type, key) {
    const cached = weatherCache[type].get(key);

    if (!cached) return null;

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    const maxAge = WEATHER_CACHE_DURATION[type];

    if (age > maxAge) {
        // Cache expired
        weatherCache[type].delete(key);
        return null;
    }

    return cached.data;
}

/**
 * Clear all weather caches
 */
function clearWeatherCache() {
    weatherCache.metar.clear();
    weatherCache.taf.clear();
    weatherCache.pirep.clear();
    weatherCache.airport.clear();
    weatherCache.sigmet = null;
    weatherCache.gairmet = null;
    console.log('[WeatherAPI] All caches cleared');
}

/**
 * Get weather summary for an airport (METAR + TAF)
 * @param {string} icao - 4-letter ICAO code
 * @returns {Promise<Object>} Combined weather summary
 */
async function getWeatherSummary(icao) {
    console.log(`[WeatherAPI] Fetching weather summary for ${icao}`);

    try {
        // Fetch METAR and TAF in parallel
        const [metar, taf] = await Promise.allSettled([
            fetchMETAR(icao),
            fetchTAF(icao)
        ]);

        const summary = {
            icao: icao,
            metar: metar.status === 'fulfilled' ? metar.value : null,
            taf: taf.status === 'fulfilled' ? taf.value : null,
            flightCategory: 'UNK',
            timestamp: Date.now()
        };

        // Determine flight category from METAR
        if (summary.metar) {
            summary.flightCategory = getFlightCategoryFromMETAR(summary.metar);
        }

        return summary;

    } catch (error) {
        console.error(`[WeatherAPI] Weather summary error for ${icao}:`, error);
        throw error;
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.WeatherAPI = {
        // Core API functions
        fetchMETAR,
        fetchTAF,
        fetchPIREPs,
        fetchSIGMETs,
        fetchGAIRMETs,
        fetchAirportInfo,

        // Combined functions
        getWeatherSummary,

        // Utility functions
        determineFlightCategory,
        getFlightCategoryFromMETAR,
        parsePIREPHazards,
        calculateRunwayWindComponents,

        // Cache management
        clearWeatherCache,

        // Constants
        WEATHER_CACHE_DURATION
    };
}
