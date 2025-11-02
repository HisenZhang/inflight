/**
 * Winds Aloft Module
 * Fetches, parses, and interpolates winds aloft data from Aviation Weather
 *
 * Features:
 * - Fetch winds from Aviation Weather API (6hr, 12hr, 24hr forecasts)
 * - Parse DDSSTT format (direction/speed/temperature)
 * - Handle edge cases (empty data, high altitude temps, light winds)
 * - Find nearest wind stations
 * - Interpolate wind for specific altitude and location
 * - Calculate headwind/crosswind components
 * - Calculate ground speed and leg times
 */

// Standard wind levels in feet MSL
const WIND_LEVELS = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

// Winds aloft cache (expires after 3 hours)
let windsCache = {
    data: null,
    timestamp: null,
    forecastPeriod: null
};

const CACHE_EXPIRY = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Fetch winds aloft from Aviation Weather API
 * @param {string} forecastPeriod - '06', '12', or '24' for hours ahead
 * @returns {Promise<Object>} - Parsed winds data by station
 */
async function fetchWindsAloft(forecastPeriod = '06') {
    // Check cache
    if (windsCache.data &&
        windsCache.forecastPeriod === forecastPeriod &&
        windsCache.timestamp &&
        (Date.now() - windsCache.timestamp) < CACHE_EXPIRY) {
        console.log('[Winds Aloft] Using cached data');
        return windsCache.data;
    }

    const url = `https://cors.hisenz.com/?url=https://aviationweather.gov/api/data/windtemp?region=us&level=low&fcst=${forecastPeriod}`;

    try {
        console.log(`[Winds Aloft] Fetching ${forecastPeriod}hr forecast...`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        const windsData = parseWindsAloft(text);

        // Cache the result
        windsCache = {
            data: windsData,
            timestamp: Date.now(),
            forecastPeriod: forecastPeriod
        };

        console.log(`[Winds Aloft] Fetched data for ${Object.keys(windsData).length} stations`);
        return windsData;

    } catch (error) {
        console.error('[Winds Aloft] Fetch error:', error);
        throw error;
    }
}

/**
 * Parse winds aloft text format
 * Format: DDSSTT where DD=direction, SS=speed (knots), TT=temperature (°C)
 *
 * Edge cases handled:
 * - Empty data: stations may have no data for some levels
 * - High altitude: temp minus sign omitted (e.g., "342520" means 340° 25kt -20°C)
 * - Light winds: "9900" means light and variable
 * - Missing levels: some stations don't report all altitudes
 *
 * @param {string} text - Raw winds aloft text
 * @returns {Object} - Winds data by station {station: {altitude: {dir, spd, temp}}}
 */
function parseWindsAloft(text) {
    const lines = text.split('\n');
    const windsData = {};

    let altitudes = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Look for FT line (altitude levels)
        // Example: "FT  3000    6000    9000   12000   18000   24000  30000  34000  39000"
        if (line.startsWith('FT ')) {
            const parts = line.substring(3).trim().split(/\s+/);
            altitudes = parts.map(p => parseInt(p)).filter(a => !isNaN(a));
            continue;
        }

        // Look for station lines (3-letter code followed by wind data)
        // Example: "ALB 2922 3032-03 2931-02 2733-08 2651-20 2663-31 269447 259752 258451"
        const match = line.match(/^([A-Z0-9]{3})\s+(.+)$/);
        if (match) {
            const station = match[1];
            const dataStr = match[2].trim();

            // Split wind data (space or multiple spaces separated)
            const windCodes = dataStr.split(/\s+/);

            windsData[station] = {};

            for (let j = 0; j < windCodes.length && j < altitudes.length; j++) {
                const code = windCodes[j];
                const altitude = altitudes[j];

                // Parse wind code (handle empty/invalid data)
                const wind = parseWindCode(code, altitude);
                if (wind) {
                    windsData[station][altitude] = wind;
                }
            }
        }
    }

    return windsData;
}

/**
 * Parse individual wind code (DDSSTT format)
 *
 * Handles multiple formats:
 * - "DDSS" - Direction and speed only (no temp)
 * - "DDSS+TT" or "DDSS-TT" - With explicit temperature sign
 * - "DDSSTT" - High altitude format (minus sign omitted, temp is negative)
 * - "9900" - Light and variable
 *
 * @param {string} code - Wind code (e.g., "3425-20", "342520", "9900")
 * @param {number} altitude - Altitude in feet (helps determine format)
 * @returns {Object|null} - {dir, spd, temp} or null if invalid
 */
function parseWindCode(code, altitude) {
    if (!code || code === '' || code.length < 4) {
        return null;
    }

    // Light and variable
    if (code.startsWith('99')) {
        return {dir: 0, spd: 0, temp: null};
    }

    let dir, spd, temp;

    if (code.length === 4) {
        // DDSS format (no temperature)
        dir = parseInt(code.substring(0, 2)) * 10;
        spd = parseInt(code.substring(2, 4));
        temp = null;
    } else if (code.includes('+') || code.includes('-')) {
        // Format with explicit sign: DDSS+TT or DDSS-TT
        const signIdx = Math.max(code.indexOf('+'), code.indexOf('-'));
        dir = parseInt(code.substring(0, 2)) * 10;
        spd = parseInt(code.substring(2, signIdx));
        temp = parseInt(code.substring(signIdx)); // Includes sign
    } else if (code.length === 6) {
        // DDSSTT format (high altitude >= 24000ft, minus sign omitted)
        dir = parseInt(code.substring(0, 2)) * 10;
        spd = parseInt(code.substring(2, 4));
        const tempVal = parseInt(code.substring(4, 6));
        // At high altitude, temperature is always negative
        temp = -Math.abs(tempVal);
    } else {
        // Unknown format - log and skip
        console.warn(`[Winds Aloft] Unknown wind code format: ${code} at ${altitude}ft`);
        return null;
    }

    // Validate parsed values
    if (isNaN(dir) || isNaN(spd)) {
        return null;
    }

    return {dir, spd, temp};
}

/**
 * Find nearest wind stations to a location
 * Uses simple Haversine distance for station selection
 *
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} count - Number of nearest stations to return (default 3)
 * @returns {Array} - Array of {code, distance, station} sorted by distance
 */
function findNearestStations(lat, lon, count = 3) {
    if (!window.WIND_STATIONS) {
        console.error('[Winds Aloft] WIND_STATIONS not loaded');
        return [];
    }

    const distances = [];

    for (const [code, station] of Object.entries(window.WIND_STATIONS)) {
        // Haversine distance
        const dLat = (station.lat - lat) * Math.PI / 180;
        const dLon = (station.lon - lon) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat * Math.PI / 180) * Math.cos(station.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = 3440.065 * c; // Earth radius in nautical miles

        distances.push({code, distance, station});
    }

    // Sort by distance and return top N
    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, count);
}

/**
 * Interpolate wind data for a specific altitude at a location
 *
 * Process:
 * 1. Find nearest 3-4 stations
 * 2. For each station, interpolate between altitude levels
 * 3. Weight by inverse distance
 * 4. Average direction using vector math (handles wraparound)
 *
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} altitude - Altitude in feet MSL
 * @param {Object} windsData - Winds data from fetchWindsAloft
 * @returns {Object|null} - {dir, spd, temp} or null if unavailable
 */
function interpolateWind(lat, lon, altitude, windsData) {
    // Find nearest stations with data
    const nearStations = findNearestStations(lat, lon, 4);

    console.log(`[Winds] Interpolating for (${lat.toFixed(2)}, ${lon.toFixed(2)}) at ${altitude}ft`);
    console.log(`[Winds] Nearest stations:`, nearStations.map(s => `${s.code} (${s.distance.toFixed(1)}nm)`).join(', '));
    console.log(`[Winds] Available wind data stations:`, Object.keys(windsData).slice(0, 10).join(', '), `... (${Object.keys(windsData).length} total)`);

    // Collect wind data from nearby stations
    const stationWinds = [];
    for (const {code, distance, station} of nearStations) {
        const stationData = windsData[code];
        if (!stationData) {
            console.log(`[Winds] No data for station ${code}`);
            continue;
        }

        // Interpolate altitude for this station
        const wind = interpolateAltitude(altitude, stationData);
        if (wind) {
            stationWinds.push({...wind, distance});
            console.log(`[Winds] Station ${code}: Wind ${wind.dir}°/${wind.spd}kt at ${altitude}ft`);
        }
    }

    if (stationWinds.length === 0) {
        console.warn(`[Winds] No wind data found for any nearby stations`);
        return null;
    }

    // Weight by inverse distance
    let totalWeight = 0;
    let weightedDir = {x: 0, y: 0};
    let weightedSpd = 0;
    let weightedTemp = 0;
    let tempCount = 0;

    for (const wind of stationWinds) {
        const weight = 1 / Math.max(wind.distance, 1); // Avoid division by zero
        totalWeight += weight;

        // Convert wind direction to vector for averaging (handles wraparound)
        const dirRad = wind.dir * Math.PI / 180;
        weightedDir.x += Math.sin(dirRad) * wind.spd * weight;
        weightedDir.y += Math.cos(dirRad) * wind.spd * weight;

        weightedSpd += wind.spd * weight;

        if (wind.temp !== null) {
            weightedTemp += wind.temp * weight;
            tempCount += weight;
        }
    }

    // Calculate averaged direction from vector
    const avgDir = (Math.atan2(weightedDir.x, weightedDir.y) * 180 / Math.PI + 360) % 360;
    const avgSpd = weightedSpd / totalWeight;
    const avgTemp = tempCount > 0 ? weightedTemp / tempCount : null;

    return {
        direction: Math.round(avgDir),
        speed: Math.round(avgSpd),
        temperature: avgTemp !== null ? Math.round(avgTemp) : null
    };
}

/**
 * Interpolate wind between altitude levels
 *
 * @param {number} targetAlt - Target altitude
 * @param {Object} stationData - Station data {altitude: {dir, spd, temp}}
 * @returns {Object|null} - Interpolated wind or null
 */
function interpolateAltitude(targetAlt, stationData) {
    const altitudes = Object.keys(stationData).map(a => parseInt(a)).sort((a, b) => a - b);

    if (altitudes.length === 0) {
        return null;
    }

    // Find bounding altitudes
    let lower = null, upper = null;
    for (let i = 0; i < altitudes.length; i++) {
        if (altitudes[i] <= targetAlt) {
            lower = altitudes[i];
        }
        if (altitudes[i] >= targetAlt && upper === null) {
            upper = altitudes[i];
        }
    }

    // Exact match
    if (lower === targetAlt && stationData[lower]) {
        return stationData[lower];
    }

    // Extrapolate from closest
    if (!lower && upper) {
        return stationData[upper];
    }
    if (lower && !upper) {
        return stationData[lower];
    }
    if (!lower && !upper) {
        return null;
    }

    // Interpolate between lower and upper
    const lowerWind = stationData[lower];
    const upperWind = stationData[upper];

    if (!lowerWind || !upperWind) {
        return lowerWind || upperWind;
    }

    const ratio = (targetAlt - lower) / (upper - lower);

    // Linear interpolation for speed and temp
    const spd = lowerWind.spd + (upperWind.spd - lowerWind.spd) * ratio;
    const temp = (lowerWind.temp !== null && upperWind.temp !== null)
        ? lowerWind.temp + (upperWind.temp - lowerWind.temp) * ratio
        : (lowerWind.temp || upperWind.temp);

    // Circular interpolation for direction (handles wraparound)
    let dir1 = lowerWind.dir;
    let dir2 = upperWind.dir;

    // Handle wraparound (e.g., 350° to 10°)
    if (Math.abs(dir2 - dir1) > 180) {
        if (dir2 > dir1) {
            dir1 += 360;
        } else {
            dir2 += 360;
        }
    }

    let dir = dir1 + (dir2 - dir1) * ratio;
    dir = (dir + 360) % 360;

    return {
        dir: Math.round(dir),
        spd: Math.round(spd),
        temp: temp !== null ? Math.round(temp) : null
    };
}

/**
 * Calculate wind components for a given track
 *
 * @param {number} windDir - Wind direction (degrees, direction FROM which wind blows)
 * @param {number} windSpd - Wind speed (knots)
 * @param {number} track - True track (degrees)
 * @returns {Object} - {headwind, crosswind} in knots
 *                     headwind: positive = tailwind, negative = headwind
 *                     crosswind: positive = from right, negative = from left
 */
function calculateWindComponents(windDir, windSpd, track) {
    // Wind angle relative to track
    const angle = (windDir - track) * Math.PI / 180;

    // Headwind component (positive = helping/tailwind, negative = hindering/headwind)
    const headwind = windSpd * Math.cos(angle);

    // Crosswind component (positive = from right, negative = from left)
    const crosswind = windSpd * Math.sin(angle);

    return {
        headwind: Math.round(headwind),
        crosswind: Math.round(crosswind)
    };
}

/**
 * Calculate ground speed and time for a leg
 *
 * @param {number} distance - Distance in nautical miles
 * @param {number} tas - True airspeed in knots
 * @param {number} headwind - Headwind component in knots (positive = tailwind)
 * @returns {Object} - {groundSpeed, timeHours, timeMinutes}
 */
function calculateGroundSpeedAndTime(distance, tas, headwind) {
    const groundSpeed = tas + headwind;
    const timeHours = distance / groundSpeed;

    return {
        groundSpeed: Math.round(groundSpeed),
        timeHours: timeHours,
        timeMinutes: Math.round(timeHours * 60)
    };
}

/**
 * Get forecast period based on departure time
 *
 * @param {string} departureTime - Departure time in HH:MM format (optional)
 * @returns {string} - '06', '12', or '24'
 */
function getForecastPeriod(departureTime) {
    if (!departureTime) {
        return '06'; // Default to 6-hour forecast
    }

    // Parse departure time
    const [hours, minutes] = departureTime.split(':').map(n => parseInt(n));
    const depTime = hours * 60 + minutes;

    // Get current time
    const now = new Date();
    const nowTime = now.getHours() * 60 + now.getMinutes();

    // Calculate hours until departure
    let hoursUntilDep = (depTime - nowTime) / 60;
    if (hoursUntilDep < 0) {
        hoursUntilDep += 24; // Next day
    }

    // Select appropriate forecast
    if (hoursUntilDep <= 6) {
        return '06';
    } else if (hoursUntilDep <= 12) {
        return '12';
    } else {
        return '24';
    }
}

// Export functions for browser
if (typeof window !== 'undefined') {
    window.WindsAloft = {
        fetchWindsAloft,
        parseWindsAloft,
        parseWindCode,
        findNearestStations,
        interpolateWind,
        interpolateAltitude,
        calculateWindComponents,
        calculateGroundSpeedAndTime,
        getForecastPeriod,
        WIND_LEVELS
    };
}
