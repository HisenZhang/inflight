// Shared Utility Functions - Formatters and Validators
// Pure functions with no dependencies on other modules

// ============================================
// COORDINATE FORMATTING
// ============================================

/**
 * Format coordinate in degrees-minutes-seconds with hemisphere
 * @param {number} value - Coordinate value (latitude or longitude)
 * @param {string} type - 'lat' or 'lon'
 * @returns {string} Formatted coordinate string
 */
function formatCoordinate(value, type) {
    if (value === null || value === undefined || isNaN(value)) {
        return type === 'lat' ? 'N/A' : 'N/A';
    }

    const isNegative = value < 0;
    const absValue = Math.abs(value);
    const degrees = Math.floor(absValue);
    const minutesDecimal = (absValue - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);

    let hemisphere;
    if (type === 'lat') {
        hemisphere = isNegative ? 'S' : 'N';
    } else {
        hemisphere = isNegative ? 'W' : 'E';
    }

    return `${degrees}°${minutes}'${seconds}"${hemisphere}`;
}

// ============================================
// FREQUENCY FORMATTING
// ============================================

/**
 * Format navaid frequency based on type
 * @param {number} freq - Frequency in appropriate units
 * @param {string} navaidType - Type of navaid (VOR, NDB, etc.)
 * @returns {string} Formatted frequency string
 */
function formatNavaidFrequency(freq, navaidType = null) {
    if (!freq) return 'N/A';

    // NDB frequencies are in kHz (200-1750), others in MHz
    if (navaidType === 'NDB' || (freq >= 200 && freq < 2000)) {
        // NDB frequency in kHz
        return `${freq.toFixed(0)} KHZ`;
    } else {
        // VOR/DME/VORTAC frequency in MHz
        return `${freq.toFixed(2)} MHZ`;
    }
}

/**
 * Format airport communication frequency
 * @param {number} freq - Frequency in MHz
 * @returns {string} Formatted frequency string
 */
function formatAirportFrequency(freq) {
    if (!freq) return 'N/A';
    return freq.toFixed(3);
}

// ============================================
// DISTANCE & ALTITUDE FORMATTING
// ============================================

/**
 * Format distance in nautical miles
 * @param {number} nm - Distance in nautical miles
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted distance string
 */
function formatDistance(nm, decimals = 1) {
    if (nm === null || nm === undefined || isNaN(nm)) {
        return 'N/A';
    }
    return `${nm.toFixed(decimals)}NM`;
}

/**
 * Format altitude in feet
 * @param {number} feet - Altitude in feet
 * @returns {string} Formatted altitude string
 */
function formatAltitude(feet) {
    if (feet === null || feet === undefined || isNaN(feet)) {
        return 'N/A';
    }
    return `${Math.round(feet)}FT`;
}

/**
 * Format elevation in feet MSL
 * @param {number} feet - Elevation in feet
 * @returns {string} Formatted elevation string
 */
function formatElevation(feet) {
    if (feet === null || feet === undefined || isNaN(feet)) {
        return 'N/A';
    }
    return `${Math.round(feet)}FT MSL`;
}

// ============================================
// TIME FORMATTING
// ============================================

/**
 * Format duration in minutes to hours and minutes
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string (e.g., "2H 15M" or "45M")
 */
function formatDuration(minutes) {
    if (minutes === null || minutes === undefined || isNaN(minutes) || minutes < 0) {
        return '--';
    }

    const totalMinutes = Math.round(minutes);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours > 0) {
        return `${hours}H ${mins}M`;
    } else {
        return `${mins}M`;
    }
}

/**
 * Format decimal hours to hours and minutes
 * @param {number} decimalHours - Duration in decimal hours (e.g., 2.5)
 * @returns {string} Formatted duration string (e.g., "2H 30M" or "30M")
 */
function formatDecimalHours(decimalHours) {
    if (decimalHours === null || decimalHours === undefined || isNaN(decimalHours) || decimalHours < 0) {
        return '--';
    }

    const hours = Math.floor(decimalHours);
    const mins = Math.round((decimalHours - hours) * 60);

    if (hours > 0 && mins > 0) {
        return `${hours}H ${mins}M`;
    } else if (hours > 0) {
        return `${hours}H`;
    } else {
        return `${mins}M`;
    }
}

/**
 * Format time to HH:MM format
 * @param {Date|number} time - Date object or timestamp
 * @returns {string} Formatted time string (e.g., "14:30")
 */
function formatTime(time) {
    if (!time) return '--:--';

    const date = time instanceof Date ? time : new Date(time);
    if (isNaN(date.getTime())) return '--:--';

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Format ETA (Estimated Time of Arrival)
 * @param {Date|number} time - Date object or timestamp
 * @returns {string} Formatted ETA string
 */
function formatETA(time) {
    return formatTime(time);
}

/**
 * Parse Zulu time string to human readable format
 * @param {string} zuluTime - Zulu time string (e.g., "230000Z" or "230600Z")
 * @returns {string} Formatted time string (e.g., "Nov 23 00:00Z" or "06:00Z")
 */
function formatZuluTime(zuluTime) {
    if (!zuluTime || typeof zuluTime !== 'string') {
        return '--';
    }

    // Extract day, hour, minute from DDHHMMZ format
    const match = zuluTime.match(/^(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) {
        return zuluTime; // Return original if format doesn't match
    }

    const day = parseInt(match[1]);
    const hour = match[2];
    const minute = match[3];

    // Get current month/year for context
    const now = new Date();
    const currentDay = now.getUTCDate();

    // If day matches current day, just show time
    if (day === currentDay) {
        return `${hour}:${minute}Z`;
    }

    // Otherwise show day and time
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let monthIndex = now.getUTCMonth();

    // If the day in the timestamp is greater than current day, it's from previous month
    // (e.g., current is Dec 1, timestamp day is 30 -> must be Nov 30)
    if (day > currentDay) {
        monthIndex = (monthIndex - 1 + 12) % 12;
    }

    const month = months[monthIndex];
    return `${month} ${day} ${hour}:${minute}Z`;
}

/**
 * Parse use window string to human readable format
 * @param {string} useWindow - Use window string (e.g., "0200-0900Z")
 * @returns {string} Formatted window (e.g., "02:00-09:00Z")
 */
function formatUseWindow(useWindow) {
    if (!useWindow || typeof useWindow !== 'string') {
        return '--';
    }

    const match = useWindow.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})Z$/);
    if (!match) {
        return useWindow; // Return original if format doesn't match
    }

    return `${match[1]}:${match[2]}-${match[3]}:${match[4]}Z`;
}

/**
 * Check if current UTC time is within a use window
 * @param {string} useWindow - Use window string (e.g., "0200-0900Z" or "2000-0300Z")
 * @returns {boolean} True if current time is within window
 */
function isWithinUseWindow(useWindow) {
    if (!useWindow) return false;

    const match = useWindow.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})Z$/);
    if (!match) return false;

    const now = new Date();
    const currentUTC = now.getUTCHours() * 100 + now.getUTCMinutes();

    const startTime = parseInt(match[1] + match[2]);
    const endTime = parseInt(match[3] + match[4]);

    // Handle windows that cross midnight (e.g., 2000-0300Z)
    if (endTime < startTime) {
        // Window crosses midnight: check if we're after start OR before end
        return currentUTC >= startTime || currentUTC <= endTime;
    } else {
        // Normal window: check if we're between start and end
        return currentUTC >= startTime && currentUTC <= endTime;
    }
}

/**
 * Get age of data in human readable format
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} Age string (e.g., "2m ago", "1h ago")
 */
function getDataAge(timestamp) {
    if (!timestamp) return '--';

    const ageMs = Date.now() - timestamp;
    const ageMinutes = Math.floor(ageMs / 60000);

    if (ageMinutes < 1) {
        // Show seconds for very recent data
        const ageSeconds = Math.floor(ageMs / 1000);
        return `${ageSeconds}s ago`;
    } else if (ageMinutes < 60) {
        return `${ageMinutes}m ago`;
    } else {
        const ageHours = Math.floor(ageMinutes / 60);
        const remainingMinutes = ageMinutes % 60;
        if (ageHours < 24) {
            return remainingMinutes > 0 ? `${ageHours}h ${remainingMinutes}m ago` : `${ageHours}h ago`;
        } else {
            const ageDays = Math.floor(ageHours / 24);
            return `${ageDays}d ago`;
        }
    }
}

// ============================================
// SPEED FORMATTING
// ============================================

/**
 * Format speed in knots
 * @param {number} knots - Speed in knots
 * @returns {string} Formatted speed string
 */
function formatSpeed(knots) {
    if (knots === null || knots === undefined || isNaN(knots)) {
        return '--';
    }
    return `${Math.round(knots)}KT`;
}

// ============================================
// HEADING/BEARING FORMATTING
// ============================================

/**
 * Format heading or bearing in degrees
 * @param {number} degrees - Heading/bearing in degrees
 * @param {boolean} padded - Whether to pad to 3 digits (default: true)
 * @returns {string} Formatted heading string
 */
function formatHeading(degrees, padded = true) {
    if (degrees === null || degrees === undefined || isNaN(degrees)) {
        return padded ? '---°' : '--°';
    }

    const normalized = ((degrees % 360) + 360) % 360; // Normalize to 0-359
    const rounded = Math.round(normalized);

    if (padded) {
        return `${String(rounded).padStart(3, '0')}°`;
    } else {
        return `${rounded}°`;
    }
}

/**
 * Get cardinal direction from bearing
 * @param {number} bearing - Bearing in degrees
 * @returns {string} Cardinal direction (N, NE, E, SE, S, SW, W, NW)
 */
function getCardinalDirection(bearing) {
    if (bearing === null || bearing === undefined || isNaN(bearing)) {
        return 'N/A';
    }

    const normalized = ((bearing % 360) + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(normalized / 45) % 8;
    return directions[index];
}

// ============================================
// MAGNETIC VARIATION FORMATTING
// ============================================

/**
 * Format magnetic variation
 * @param {number} magVar - Magnetic variation in degrees (positive = East, negative = West)
 * @returns {string} Formatted magnetic variation string (e.g., "12.3°E" or "5.1°W")
 */
function formatMagneticVariation(magVar) {
    if (magVar === null || magVar === undefined || isNaN(magVar)) {
        return 'N/A';
    }

    const absValue = Math.abs(magVar);
    const direction = magVar >= 0 ? 'E' : 'W';
    return `${absValue.toFixed(1)}°${direction}`;
}

// ============================================
// FUEL FORMATTING
// ============================================

/**
 * Format fuel quantity in gallons
 * @param {number} gallons - Fuel quantity in gallons
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted fuel string
 */
function formatFuel(gallons, decimals = 1) {
    if (gallons === null || gallons === undefined || isNaN(gallons)) {
        return 'N/A';
    }
    return `${gallons.toFixed(decimals)}GAL`;
}

// ============================================
// RUNWAY FORMATTING
// ============================================

/**
 * Format runway information
 * @param {object} runway - Runway object with leIdent, heIdent, length, surface
 * @returns {string} Formatted runway string
 */
function formatRunway(runway) {
    if (!runway) return 'N/A';

    const idents = runway.leIdent && runway.heIdent
        ? `${runway.leIdent}/${runway.heIdent}`
        : (runway.leIdent || runway.heIdent || 'N/A');

    const length = runway.length ? ` ${runway.length}FT` : '';
    const surface = runway.surface ? ` ${runway.surface}` : '';

    return `${idents}${length}${surface}`;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate latitude value
 * @param {number} lat - Latitude value
 * @returns {boolean} True if valid latitude
 */
function isValidLatitude(lat) {
    return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude value
 * @param {number} lon - Longitude value
 * @returns {boolean} True if valid longitude
 */
function isValidLongitude(lon) {
    return typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180;
}

/**
 * Validate coordinate pair
 * @param {number} lat - Latitude value
 * @param {number} lon - Longitude value
 * @returns {boolean} True if valid coordinate pair
 */
function isValidCoordinate(lat, lon) {
    return isValidLatitude(lat) && isValidLongitude(lon);
}

// ============================================
// EXPORTS
// ============================================

window.Utils = {
    // Coordinate formatting
    formatCoordinate,
    isValidLatitude,
    isValidLongitude,
    isValidCoordinate,

    // Frequency formatting
    formatNavaidFrequency,
    formatAirportFrequency,

    // Distance & altitude
    formatDistance,
    formatAltitude,
    formatElevation,

    // Time formatting
    formatDuration,
    formatDecimalHours,
    formatTime,
    formatETA,
    formatZuluTime,
    formatUseWindow,
    isWithinUseWindow,
    getDataAge,

    // Speed formatting
    formatSpeed,

    // Heading/bearing
    formatHeading,
    getCardinalDirection,

    // Magnetic variation
    formatMagneticVariation,

    // Fuel formatting
    formatFuel,

    // Runway formatting
    formatRunway
};
