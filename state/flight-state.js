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
    departure: null,
    destination: null,
    routeMiddle: null,
    waypoints: [],
    legs: [],
    totalDistance: 0,
    totalTime: 0,
    fuelStatus: null,
    options: {},
    timestamp: null,
    // Flight parameters
    altitude: null,
    tas: null,
    windData: null
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
 * @param {object} data - Flight plan data {routeString, departure, destination, routeMiddle, waypoints, legs, totalDistance, totalTime, fuelStatus, options, altitude, tas, windData}
 */
function updateFlightPlan(data) {
    flightPlan.routeString = data.routeString || null;
    flightPlan.departure = data.departure || null;
    flightPlan.destination = data.destination || null;
    flightPlan.routeMiddle = data.routeMiddle || null;
    flightPlan.waypoints = data.waypoints || [];
    flightPlan.legs = data.legs || [];
    flightPlan.totalDistance = data.totalDistance || 0;
    flightPlan.totalTime = data.totalTime || 0;
    flightPlan.fuelStatus = data.fuelStatus || null;
    flightPlan.options = data.options || {};
    flightPlan.altitude = data.altitude || null;
    flightPlan.tas = data.tas || null;
    flightPlan.windData = data.windData || null;
    flightPlan.timestamp = Date.now();

    console.log('[FlightState] Flight plan updated:', flightPlan.routeString);
}

/**
 * Clear flight plan
 */
function clearFlightPlan() {
    flightPlan.routeString = null;
    flightPlan.departure = null;
    flightPlan.destination = null;
    flightPlan.routeMiddle = null;
    flightPlan.waypoints = [];
    flightPlan.legs = [];
    flightPlan.totalDistance = 0;
    flightPlan.totalTime = 0;
    flightPlan.fuelStatus = null;
    flightPlan.options = {};
    flightPlan.altitude = null;
    flightPlan.tas = null;
    flightPlan.windData = null;
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
            departure: flightPlan.departure,
            destination: flightPlan.destination,
            routeMiddle: flightPlan.routeMiddle,
            waypoints: flightPlan.waypoints,
            legs: flightPlan.legs,
            totalDistance: flightPlan.totalDistance,
            totalTime: flightPlan.totalTime,
            fuelStatus: flightPlan.fuelStatus,
            options: flightPlan.options,
            altitude: flightPlan.altitude,
            tas: flightPlan.tas,
            windData: flightPlan.windData
        };

        localStorage.setItem(NAVLOG_STORAGE_KEY, JSON.stringify(saveData));
        console.log('[FlightState] Flight plan saved to storage (including wind data)');
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
            departure: flightPlan.departure,
            destination: flightPlan.destination,
            routeMiddle: flightPlan.routeMiddle,
            waypoints: flightPlan.waypoints,
            legs: flightPlan.legs,
            totalDistance: flightPlan.totalDistance,
            totalTime: flightPlan.totalTime,
            fuelStatus: flightPlan.fuelStatus,
            options: flightPlan.options,
            altitude: flightPlan.altitude,
            tas: flightPlan.tas,
            windData: flightPlan.windData
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Build filename: IN-FLIGHT_2025-11-20T21-30-45Z_DEPARTURE_DESTINATION.json
        const now = new Date();
        // ISO format (UTC) but replace colons with dashes for filesystem compatibility
        const isoTime = now.toISOString().split('.')[0].replace(/:/g, '-') + 'Z'; // 2025-11-20T21-30-45Z

        // Get departure and destination (fallback to first/last waypoint if not set)
        const departure = flightPlan.departure?.icao || flightPlan.waypoints[0]?.icao || 'DEP';
        const destination = flightPlan.destination?.icao || flightPlan.waypoints[flightPlan.waypoints.length - 1]?.icao || 'DEST';

        const filename = `IN-FLIGHT_${isoTime}_${departure}_${destination}.json`;
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
 * Export waypoints as ForeFlight-compatible CSV file for download
 * Format: WAYPOINT_NAME,Waypoint description,Lat,Lon
 * Rules:
 * - Waypoint names must be ALL CAPS, at least 3 characters, include one letter, no spaces
 * - Lat/Lon in decimal degrees (negative for W longitude)
 * - Filename must be "user_waypoints.csv"
 * @returns {boolean} True if exported successfully
 */
function exportToForeFlightCSV() {
    if (!isFlightPlanValid()) {
        console.error('[FlightState] No valid flight plan to export');
        return false;
    }

    try {
        // Build CSV content
        const csvRows = [];

        // Process each waypoint
        flightPlan.waypoints.forEach((waypoint, index) => {
            // Name: Use same logic as navlog display (RouteCalculator.getWaypointCode)
            // - Airports: use ICAO (e.g., KORD)
            // - Everything else: use ident (e.g., PAYGE, ORD, GIJ)
            let waypointName = '';

            if (waypoint.waypointType === 'airport') {
                waypointName = waypoint.icao ? waypoint.icao.toUpperCase() : '';
            } else {
                waypointName = waypoint.ident ? waypoint.ident.toUpperCase() : '';
            }

            // Fallback if no valid name
            if (!waypointName || waypointName.length < 3) {
                waypointName = `WPT_${index + 1}`;
            }

            // Description: Use waypoint type (e.g., FIX, AIRPORT, VOR)
            let description = waypoint.type ? waypoint.type.toUpperCase() : '';

            // Get lat/lon in decimal degrees
            const lat = waypoint.lat;
            const lon = waypoint.lon;

            // Build CSV row: WAYPOINT_NAME,Description,Lat,Lon
            // Use empty quotes "" if no description
            const descField = description ? `"${description}"` : '""';
            csvRows.push(`${waypointName},${descField},${lat},${lon}`);
        });

        // Create CSV content
        const csvContent = csvRows.join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Filename MUST be "user_waypoints.csv" for ForeFlight to recognize it
        const filename = 'user_waypoints.csv';
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
        console.log('[FlightState] ForeFlight CSV exported:', filename, `(${csvRows.length} waypoints)`);
        return true;
    } catch (error) {
        console.error('[FlightState] Failed to export ForeFlight CSV:', error);
        return false;
    }
}

/**
 * Export waypoints as ForeFlight-compatible KML file for download
 * Format: Google Earth KML with Placemarks for each waypoint
 * KML can be imported via AirDrop, email, or iTunes/Finder
 * Filename must be "user_waypoints.kml"
 * @returns {boolean} True if exported successfully
 */
function exportToForeFlightKML() {
    if (!isFlightPlanValid()) {
        console.error('[FlightState] No valid flight plan to export');
        return false;
    }

    try {
        // Build KML content
        const placemarks = [];

        // Process each waypoint
        flightPlan.waypoints.forEach((waypoint, index) => {
            // Name: Use same logic as navlog display (RouteCalculator.getWaypointCode)
            // - Airports: use ICAO (e.g., KORD)
            // - Everything else: use ident (e.g., PAYGE, ORD, GIJ)
            let waypointName = '';

            if (waypoint.waypointType === 'airport') {
                waypointName = waypoint.icao ? waypoint.icao.toUpperCase() : '';
            } else {
                waypointName = waypoint.ident ? waypoint.ident.toUpperCase() : '';
            }

            // Fallback if no valid name
            if (!waypointName || waypointName.length < 3) {
                waypointName = `WPT_${index + 1}`;
            }

            // Description: Use waypoint type (e.g., FIX, AIRPORT, VOR)
            let description = waypoint.type ? waypoint.type.toUpperCase() : '';

            // Get lat/lon in decimal degrees
            const lat = waypoint.lat;
            const lon = waypoint.lon;

            // Estimate altitude (use flight plan altitude if available, otherwise default to 0)
            const altitude = flightPlan.altitude || 0;

            // Build KML Placemark
            const placemark = `\t<Placemark>
\t\t<name>${waypointName}</name>
\t\t<description>${description || ''}</description>
\t\t<styleUrl>#msn_ylw-pushpin</styleUrl>
\t\t<Point>
\t\t\t<altitudeMode>absolute</altitudeMode>
\t\t\t<coordinates>${lon},${lat},${altitude}</coordinates>
\t\t</Point>
\t</Placemark>`;
            placemarks.push(placemark);
        });

        // Build complete KML document
        const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom">
<Document>
\t<name>user_waypoints.kml</name>
\t<StyleMap id="msn_ylw-pushpin">
\t\t<Pair>
\t\t\t<key>normal</key>
\t\t\t<styleUrl>#sn_ylw-pushpin</styleUrl>
\t\t</Pair>
\t\t<Pair>
\t\t\t<key>highlight</key>
\t\t\t<styleUrl>#sh_ylw-pushpin</styleUrl>
\t\t</Pair>
\t</StyleMap>
\t<Style id="sn_ylw-pushpin">
\t\t<IconStyle>
\t\t\t<scale>1.1</scale>
\t\t\t<Icon>
\t\t\t\t<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
\t\t\t</Icon>
\t\t\t<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>
\t\t</IconStyle>
\t</Style>
\t<Style id="sh_ylw-pushpin">
\t\t<IconStyle>
\t\t\t<scale>1.3</scale>
\t\t\t<Icon>
\t\t\t\t<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
\t\t\t</Icon>
\t\t\t<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>
\t\t</IconStyle>
\t</Style>
\t<Folder>
\t\t<name>IN-FLIGHT Route Waypoints</name>
\t\t<open>1</open>
${placemarks.join('\n')}
\t</Folder>
</Document>
</kml>`;

        // Create blob and download
        const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Filename MUST be "user_waypoints.kml" for ForeFlight to recognize it
        const filename = 'user_waypoints.kml';
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
        console.log('[FlightState] ForeFlight KML exported:', filename, `(${placemarks.length} waypoints)`);
        return true;
    } catch (error) {
        console.error('[FlightState] Failed to export ForeFlight KML:', error);
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
    exportToForeFlightCSV,
    exportToForeFlightKML,
    importFromFile,

    // Route history
    saveToHistory,
    loadHistory
};
