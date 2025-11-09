// Flight State Management - Centralized State for Planning and Navigation
// Manages flight plan (pre-flight) and navigation (in-flight) state

// ============================================
// STATE OBJECTS
// ============================================

const NAVLOG_STORAGE_KEY = 'saved_navlog';
const HISTORY_STORAGE_KEY = 'route_history';

/**
 * Flight Plan State (Planning Phase - Pre-Flight)
 */
const flightPlan = {
    routeString: null,
    waypoints: [],
    legs: [],
    totalDistance: 0,
    totalTime: 0,
    fuelStatus: null,
    options: {},
    timestamp: null
};

/**
 * Navigation State (In-Flight Phase - GPS Tracking)
 */
const navigation = {
    isActive: false,
    currentPosition: null,      // {lat, lon, heading, speed, accuracy, altitudeAccuracy, altitude}
    activeLegIndex: 0,
    startTime: null,

    // Real-time calculated values
    distanceToNext: null,
    headingToNext: null,
    etaNext: null,
    etaDest: null,
    groundSpeed: null
};

// ============================================
// FLIGHT PLAN MANAGEMENT
// ============================================

/**
 * Update flight plan with new data
 * @param {object} data - Flight plan data {routeString, waypoints, legs, totalDistance, totalTime, fuelStatus, options}
 */
function updateFlightPlan(data) {
    flightPlan.routeString = data.routeString || null;
    flightPlan.waypoints = data.waypoints || [];
    flightPlan.legs = data.legs || [];
    flightPlan.totalDistance = data.totalDistance || 0;
    flightPlan.totalTime = data.totalTime || 0;
    flightPlan.fuelStatus = data.fuelStatus || null;
    flightPlan.options = data.options || {};
    flightPlan.timestamp = Date.now();

    console.log('[FlightState] Flight plan updated:', flightPlan.routeString);
}

/**
 * Clear flight plan
 */
function clearFlightPlan() {
    flightPlan.routeString = null;
    flightPlan.waypoints = [];
    flightPlan.legs = [];
    flightPlan.totalDistance = 0;
    flightPlan.totalTime = 0;
    flightPlan.fuelStatus = null;
    flightPlan.options = {};
    flightPlan.timestamp = null;

    console.log('[FlightState] Flight plan cleared');
}

/**
 * Check if flight plan is valid
 * @returns {boolean} True if flight plan has waypoints
 */
function isFlightPlanValid() {
    return flightPlan.waypoints && flightPlan.waypoints.length > 0;
}

/**
 * Get current flight plan
 * @returns {object} Flight plan object
 */
function getFlightPlan() {
    return { ...flightPlan };
}

// ============================================
// NAVIGATION MANAGEMENT
// ============================================

/**
 * Start navigation (GPS tracking)
 */
function startNavigation() {
    if (!isFlightPlanValid()) {
        console.error('[FlightState] Cannot start navigation without valid flight plan');
        return false;
    }

    navigation.isActive = true;
    navigation.activeLegIndex = 0;
    navigation.startTime = Date.now();

    console.log('[FlightState] Navigation started');
    return true;
}

/**
 * Stop navigation
 */
function stopNavigation() {
    navigation.isActive = false;
    navigation.currentPosition = null;
    navigation.activeLegIndex = 0;
    navigation.startTime = null;
    navigation.distanceToNext = null;
    navigation.headingToNext = null;
    navigation.etaNext = null;
    navigation.etaDest = null;
    navigation.groundSpeed = null;

    console.log('[FlightState] Navigation stopped');
}

/**
 * Update navigation state with new GPS data or calculated values
 * @param {object} data - Navigation data to update
 */
function updateNavigation(data) {
    if (data.currentPosition !== undefined) navigation.currentPosition = data.currentPosition;
    if (data.activeLegIndex !== undefined) navigation.activeLegIndex = data.activeLegIndex;
    if (data.distanceToNext !== undefined) navigation.distanceToNext = data.distanceToNext;
    if (data.headingToNext !== undefined) navigation.headingToNext = data.headingToNext;
    if (data.etaNext !== undefined) navigation.etaNext = data.etaNext;
    if (data.etaDest !== undefined) navigation.etaDest = data.etaDest;
    if (data.groundSpeed !== undefined) navigation.groundSpeed = data.groundSpeed;
}

/**
 * Advance to next leg (waypoint reached)
 * @returns {boolean} True if advanced, false if already at last leg
 */
function advanceLeg() {
    if (navigation.activeLegIndex < flightPlan.legs.length - 1) {
        navigation.activeLegIndex++;
        console.log(`[FlightState] Advanced to leg ${navigation.activeLegIndex + 1}/${flightPlan.legs.length}`);
        return true;
    }
    return false;
}

/**
 * Get current navigation state
 * @returns {object} Navigation state object
 */
function getNavigationState() {
    return { ...navigation };
}

/**
 * Check if navigation is active
 * @returns {boolean} True if navigation is active
 */
function isNavigationActive() {
    return navigation.isActive;
}

// ============================================
// PERSISTENCE (LocalStorage)
// ============================================

/**
 * Save flight plan to localStorage for crash recovery
 * @returns {boolean} True if saved successfully
 */
function saveToStorage() {
    if (!isFlightPlanValid()) {
        console.warn('[FlightState] No valid flight plan to save');
        return false;
    }

    try {
        const saveData = {
            timestamp: flightPlan.timestamp || Date.now(),
            routeString: flightPlan.routeString,
            waypoints: flightPlan.waypoints,
            legs: flightPlan.legs,
            totalDistance: flightPlan.totalDistance,
            totalTime: flightPlan.totalTime,
            fuelStatus: flightPlan.fuelStatus,
            options: flightPlan.options
        };

        localStorage.setItem(NAVLOG_STORAGE_KEY, JSON.stringify(saveData));
        console.log('[FlightState] Flight plan saved to storage');
        return true;
    } catch (error) {
        console.error('[FlightState] Failed to save to storage:', error);
        return false;
    }
}

/**
 * Load flight plan from localStorage (crash recovery)
 * @returns {object|null} Saved flight plan or null
 */
function loadFromStorage() {
    try {
        const saved = localStorage.getItem(NAVLOG_STORAGE_KEY);
        if (!saved) return null;

        const navlogData = JSON.parse(saved);

        // Check if saved data is less than 24 hours old
        const ageHours = (Date.now() - navlogData.timestamp) / (1000 * 60 * 60);
        if (ageHours > 24) {
            console.log('[FlightState] Saved data expired (>24h old), discarding');
            clearStorage();
            return null;
        }

        console.log('[FlightState] Loaded saved data from', new Date(navlogData.timestamp).toLocaleString());
        return navlogData;
    } catch (error) {
        console.error('[FlightState] Failed to load from storage:', error);
        return null;
    }
}

/**
 * Clear saved flight plan from localStorage
 * @returns {boolean} True if cleared successfully
 */
function clearStorage() {
    try {
        localStorage.removeItem(NAVLOG_STORAGE_KEY);
        console.log('[FlightState] Storage cleared');
        return true;
    } catch (error) {
        console.error('[FlightState] Failed to clear storage:', error);
        return false;
    }
}

/**
 * Restore flight plan from saved data
 * @param {object} navlogData - Saved navlog data
 */
function restoreFlightPlan(navlogData) {
    updateFlightPlan(navlogData);
    console.log('[FlightState] Flight plan restored:', navlogData.routeString);
}

// ============================================
// IMPORT/EXPORT (File Operations)
// ============================================

/**
 * Export flight plan as JSON file for download
 * @returns {boolean} True if exported successfully
 */
function exportAsFile() {
    if (!isFlightPlanValid()) {
        console.error('[FlightState] No valid flight plan to export');
        return false;
    }

    try {
        const exportData = {
            version: '1.0',
            exportTimestamp: Date.now(),
            exportDate: new Date().toISOString(),
            routeString: flightPlan.routeString,
            waypoints: flightPlan.waypoints,
            legs: flightPlan.legs,
            totalDistance: flightPlan.totalDistance,
            totalTime: flightPlan.totalTime,
            fuelStatus: flightPlan.fuelStatus,
            options: flightPlan.options
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const filename = `navlog_${flightPlan.routeString.replace(/\s+/g, '_')}_${Date.now()}.json`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
        console.log('[FlightState] Flight plan exported:', filename);
        return true;
    } catch (error) {
        console.error('[FlightState] Failed to export:', error);
        return false;
    }
}

/**
 * Import flight plan from JSON file
 * @param {File} file - File object from file input
 * @returns {Promise<object>} Parsed navlog data
 */
function importFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const navlogData = JSON.parse(e.target.result);

                // Validate structure
                if (!navlogData.routeString || !navlogData.waypoints || !navlogData.legs) {
                    throw new Error('Invalid navlog file structure');
                }

                console.log('[FlightState] Navlog imported from file');
                resolve(navlogData);
            } catch (error) {
                console.error('[FlightState] Failed to parse navlog file:', error);
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
// ROUTE HISTORY
// ============================================

/**
 * Save route string to history
 * @param {string} routeString - Route string to save
 */
function saveToHistory(routeString) {
    try {
        let history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');

        // Remove if already exists (to move to front)
        history = history.filter(r => r !== routeString);

        // Add to front
        history.unshift(routeString);

        // Keep only last 10
        history = history.slice(0, 10);

        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        console.log('[FlightState] Route saved to history:', routeString);
    } catch (error) {
        console.error('[FlightState] Failed to save to history:', error);
    }
}

/**
 * Load route history
 * @returns {Array} Array of recent route strings
 */
function loadHistory() {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
        return history;
    } catch (error) {
        console.error('[FlightState] Failed to load history:', error);
        return [];
    }
}

// ============================================
// EXPORTS
// ============================================

window.FlightState = {
    // Flight plan management
    updateFlightPlan,
    clearFlightPlan,
    isFlightPlanValid,
    getFlightPlan,
    restoreFlightPlan,

    // Navigation management
    startNavigation,
    stopNavigation,
    updateNavigation,
    advanceLeg,
    getNavigationState,
    isNavigationActive,

    // Persistence
    saveToStorage,
    loadFromStorage,
    clearStorage,

    // Import/Export
    exportAsFile,
    importFromFile,

    // Route history
    saveToHistory,
    loadHistory
};
