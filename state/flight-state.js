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
    windData: null,
    windMetadata: null
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
 * @param {object} data - Flight plan data {routeString, departure, destination, routeMiddle, waypoints, legs, totalDistance, totalTime, fuelStatus, options, altitude, tas, windData, windMetadata}
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
    flightPlan.windMetadata = data.windMetadata || null;
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
    flightPlan.windMetadata = null;
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
            windData: flightPlan.windData,
            windMetadata: flightPlan.windMetadata
        };

        localStorage.setItem(NAVLOG_STORAGE_KEY, JSON.stringify(saveData));
        console.log('[FlightState] Flight plan saved to storage (including wind data and metadata)');
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
            windData: flightPlan.windData,
            windMetadata: flightPlan.windMetadata
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
 * Export flight plan as Garmin-compatible .fpl (Garmin XML) file for download
 * Format: Garmin FlightPlan v1 XML (Full Specification)
 * Compatible with: ForeFlight, Garmin Pilot, G1000, GTN 650/750, GNS 430W/530W
 * @param {object} options - Export options
 * @param {string} options.author - Author name (optional)
 * @param {string} options.description - File description (optional)
 * @returns {boolean} True if exported successfully
 */
function exportToForeFlightFPL(options = {}) {
    if (!isFlightPlanValid()) {
        console.error('[FlightState] No valid flight plan to export');
        return false;
    }

    try {
        // Build created timestamp in ISO 8601 format
        const now = new Date();
        const created = now.toISOString();

        // Get departure time (ETD) - use first waypoint time or current time
        const etd = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        // Get altitude (default to 5000 if not set)
        const altitude = flightPlan.altitude || 5000;

        // Get aircraft tailnumber from options (default to N00000)
        const tailnumber = flightPlan.options?.tailnumber || 'N00000';

        // Build route name from departure and destination
        const depIcao = flightPlan.departure?.icao || flightPlan.waypoints[0]?.icao || flightPlan.waypoints[0]?.ident || 'DEP';
        const destIcao = flightPlan.destination?.icao || flightPlan.waypoints[flightPlan.waypoints.length - 1]?.icao || flightPlan.waypoints[flightPlan.waypoints.length - 1]?.ident || 'DEST';
        const routeName = `${depIcao} TO ${destIcao}`;

        // Build waypoint table and route points
        const waypointEntries = [];
        const routePoints = [];

        flightPlan.waypoints.forEach((waypoint, index) => {
            // Determine identifier and type
            let identifier = '';
            let wpType = 'USER WAYPOINT';
            let countryCode = '';

            if (waypoint.waypointType === 'airport') {
                identifier = waypoint.icao || waypoint.ident || `WPT${index + 1}`;
                wpType = 'AIRPORT';
                // Extract country code from ICAO (first 1-2 chars for most countries)
                countryCode = getCountryCodeFromIcao(identifier);
            } else if (waypoint.waypointType === 'vor' || (waypoint.type && (waypoint.type.includes('VOR') || waypoint.type === 'VORTAC' || waypoint.type === 'TACAN' || waypoint.type === 'DME'))) {
                // VOR-type navaids: VOR, VOR-DME, VORTAC, TACAN, DME all export as Garmin type "VOR"
                identifier = waypoint.ident || waypoint.icao || `WPT${index + 1}`;
                wpType = 'VOR';
                countryCode = waypoint.countryCode || getCountryCodeFromRegion(waypoint);
            } else if (waypoint.waypointType === 'ndb' || waypoint.type === 'NDB') {
                identifier = waypoint.ident || waypoint.icao || `WPT${index + 1}`;
                wpType = 'NDB';
                countryCode = waypoint.countryCode || getCountryCodeFromRegion(waypoint);
            } else if (waypoint.waypointType === 'fix' || waypoint.type === 'FIX' || waypoint.type === 'INT') {
                identifier = waypoint.ident || waypoint.icao || `WPT${index + 1}`;
                wpType = 'INT';
                countryCode = waypoint.countryCode || getCountryCodeFromRegion(waypoint);
            } else if (waypoint.waypointType === 'vrp' || waypoint.type === 'VRP') {
                identifier = waypoint.ident || waypoint.icao || `WPT${index + 1}`;
                wpType = 'INT-VRP';
                countryCode = waypoint.countryCode || getCountryCodeFromRegion(waypoint);
            } else {
                // User waypoint - no country code
                identifier = waypoint.ident || waypoint.icao || `WPT${index + 1}`;
                wpType = 'USER WAYPOINT';
                countryCode = ''; // Country code must be empty for user waypoints
            }

            // Ensure identifier is uppercase and max 12 chars
            identifier = identifier.toUpperCase().substring(0, 12);

            // Build comment (max 25 chars, alphanumeric/space/slash only)
            let comment = '';
            if (waypoint.name) {
                comment = waypoint.name.substring(0, 25).replace(/[^a-zA-Z0-9 /]/g, '');
            }

            // Get elevation in feet (convert from meters if needed)
            let elevationFt = '';
            if (waypoint.elevation !== undefined && waypoint.elevation !== null) {
                elevationFt = Math.round(waypoint.elevation);
            } else if (waypoint.alt !== undefined && waypoint.alt !== null) {
                elevationFt = Math.round(waypoint.alt);
            }

            // Build waypoint description
            let waypointDesc = '';
            if (waypoint.name) {
                waypointDesc = `${identifier} - ${waypoint.name}`.substring(0, 50);
            }

            // Build waypoint entry with all fields
            let waypointXml = `    <waypoint>
        <identifier>${escapeXml(identifier)}</identifier>
        <type>${wpType}</type>
        <country-code>${escapeXml(countryCode)}</country-code>
        <lat>${waypoint.lat.toFixed(6)}</lat>
        <lon>${waypoint.lon.toFixed(6)}</lon>`;

            if (comment) {
                waypointXml += `\n        <comment>${escapeXml(comment)}</comment>`;
            }
            if (elevationFt !== '') {
                waypointXml += `\n        <elevation>${elevationFt}</elevation>`;
            }
            if (waypointDesc) {
                waypointXml += `\n        <waypoint-description>${escapeXml(waypointDesc)}</waypoint-description>`;
            }

            waypointXml += `\n    </waypoint>`;
            waypointEntries.push(waypointXml);

            // Build route point with country code
            let routePointXml = `    <route-point>
        <waypoint-identifier>${escapeXml(identifier)}</waypoint-identifier>
        <waypoint-type>${wpType}</waypoint-type>`;

            if (countryCode) {
                routePointXml += `\n        <waypoint-country-code>${escapeXml(countryCode)}</waypoint-country-code>`;
            }

            routePointXml += `\n    </route-point>`;
            routePoints.push(routePointXml);
        });

        // Build file description
        const fileDesc = options.description || `Flight plan from ${depIcao} to ${destIcao}`;

        // Build author section
        const authorName = options.author || 'IN-FLIGHT';

        // Build complete FPL XML document (Full Garmin FlightPlan v1 spec)
        const fplContent = `<?xml version="1.0" encoding="utf-8"?>
<flight-plan xmlns="http://www8.garmin.com/xmlschemas/FlightPlan/v1">
  <file-description>${escapeXml(fileDesc)}</file-description>
  <author>
    <author-name>${escapeXml(authorName)}</author-name>
  </author>
  <created>${created}</created>
  <waypoint-table>
${waypointEntries.join('\n')}
  </waypoint-table>
  <route>
    <route-name>${escapeXml(routeName)}</route-name>
    <route-description>${escapeXml(fileDesc)}</route-description>
    <flight-plan-index>1</flight-plan-index>
${routePoints.join('\n')}
  </route>
</flight-plan>`;

        // Create blob and download
        const blob = new Blob([fplContent], { type: 'application/xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Build filename: DEPARTURE_DESTINATION.fpl (Garmin convention)
        const filename = `${depIcao}_${destIcao}.fpl`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
        console.log('[FlightState] Garmin FPL exported:', filename, `(${waypointEntries.length} waypoints)`);
        return true;
    } catch (error) {
        console.error('[FlightState] Failed to export Garmin FPL:', error);
        return false;
    }
}

/**
 * Get country code from ICAO airport code
 * @param {string} icao - ICAO airport code (e.g., KJFK, EGLL, LFPG)
 * @returns {string} Two-letter country code or empty string
 */
function getCountryCodeFromIcao(icao) {
    if (!icao || icao.length < 2) return '';

    // ICAO prefix to country code mapping
    const icaoToCountry = {
        'K': 'US',   // United States (contiguous)
        'PA': 'US',  // Alaska
        'PH': 'US',  // Hawaii
        'PG': 'US',  // Guam
        'C': 'CA',   // Canada
        'E': '',     // Northern Europe (varies)
        'EG': 'GB',  // United Kingdom
        'EI': 'IE',  // Ireland
        'EH': 'NL',  // Netherlands
        'ED': 'DE',  // Germany (civil)
        'ET': 'DE',  // Germany (military)
        'LF': 'FR',  // France
        'LE': 'ES',  // Spain
        'LI': 'IT',  // Italy
        'LP': 'PT',  // Portugal
        'LO': 'AT',  // Austria
        'LS': 'CH',  // Switzerland
        'LZ': 'SK',  // Slovakia
        'LK': 'CZ',  // Czech Republic
        'EP': 'PL',  // Poland
        'EE': 'EE',  // Estonia
        'EV': 'LV',  // Latvia
        'EY': 'LT',  // Lithuania
        'EF': 'FI',  // Finland
        'ES': 'SE',  // Sweden
        'EN': 'NO',  // Norway
        'BI': 'IS',  // Iceland
        'EK': 'DK',  // Denmark
        'LH': 'HU',  // Hungary
        'LR': 'RO',  // Romania
        'LB': 'BG',  // Bulgaria
        'LG': 'GR',  // Greece
        'LT': 'TR',  // Turkey
        'LL': 'IL',  // Israel
        'OJ': 'JO',  // Jordan
        'OE': 'SA',  // Saudi Arabia
        'OM': 'AE',  // UAE
        'OO': 'OM',  // Oman
        'OB': 'BH',  // Bahrain
        'OK': 'KW',  // Kuwait
        'OI': 'IR',  // Iran
        'OP': 'PK',  // Pakistan
        'VI': 'IN',  // India (North)
        'VO': 'IN',  // India (South)
        'VA': 'IN',  // India (West)
        'VE': 'IN',  // India (East)
        'VT': 'TH',  // Thailand
        'VV': 'VN',  // Vietnam
        'VL': 'LA',  // Laos
        'VY': 'MM',  // Myanmar
        'WS': 'SG',  // Singapore
        'WM': 'MY',  // Malaysia (West)
        'WB': 'MY',  // Malaysia (East)
        'WI': 'ID',  // Indonesia
        'RP': 'PH',  // Philippines
        'RJ': 'JP',  // Japan (civil)
        'RO': 'JP',  // Japan (military)
        'RK': 'KR',  // South Korea
        'ZK': 'KP',  // North Korea
        'Z': 'CN',   // China
        'ZB': 'CN',  // China
        'ZG': 'CN',  // China
        'ZH': 'CN',  // China
        'ZJ': 'CN',  // China
        'ZL': 'CN',  // China
        'ZP': 'CN',  // China
        'ZS': 'CN',  // China
        'ZU': 'CN',  // China
        'ZW': 'CN',  // China
        'ZY': 'CN',  // China
        'VH': 'HK',  // Hong Kong
        'VM': 'MO',  // Macau
        'RC': 'TW',  // Taiwan
        'U': 'RU',   // Russia
        'Y': 'AU',   // Australia
        'NZ': 'NZ',  // New Zealand
        'S': '',     // South America (varies)
        'SA': 'AR',  // Argentina
        'SB': 'BR',  // Brazil
        'SC': 'CL',  // Chile
        'SE': 'EC',  // Ecuador
        'SK': 'CO',  // Colombia
        'SP': 'PE',  // Peru
        'SV': 'VE',  // Venezuela
        'SU': 'UY',  // Uruguay
        'SG': 'PY',  // Paraguay
        'SL': 'BO',  // Bolivia
        'M': '',     // Central America/Caribbean (varies)
        'MM': 'MX',  // Mexico
        'MU': 'CU',  // Cuba
        'MK': 'JM',  // Jamaica
        'TJ': 'PR',  // Puerto Rico
        'T': '',     // Caribbean (varies)
        'TF': 'FR',  // French Caribbean
        'TN': '',    // Caribbean Netherlands
        'F': '',     // Africa (varies)
        'FA': 'ZA',  // South Africa
        'H': '',     // Africa (varies)
        'HA': 'ET',  // Ethiopia
        'HE': 'EG',  // Egypt
        'DT': 'TN',  // Tunisia
        'DA': 'DZ',  // Algeria
        'GM': 'MA',  // Morocco
    };

    // Try two-letter prefix first, then single letter
    const twoChar = icao.substring(0, 2).toUpperCase();
    if (icaoToCountry[twoChar] !== undefined) {
        return icaoToCountry[twoChar];
    }

    const oneChar = icao.substring(0, 1).toUpperCase();
    if (icaoToCountry[oneChar] !== undefined) {
        return icaoToCountry[oneChar];
    }

    return '';
}

/**
 * Get country code from waypoint region/country data
 * @param {object} waypoint - Waypoint object with potential region/country info
 * @returns {string} Two-letter country code or empty string
 */
function getCountryCodeFromRegion(waypoint) {
    // Check for explicit country code
    if (waypoint.countryCode) return waypoint.countryCode;
    if (waypoint.country) {
        // If it's already a 2-letter code, use it
        if (waypoint.country.length === 2) return waypoint.country.toUpperCase();
    }

    // Try to infer from region or location
    if (waypoint.region) {
        // Common region to country mappings
        const regionToCountry = {
            'K1': 'US', 'K2': 'US', 'K3': 'US', 'K4': 'US', 'K5': 'US', 'K6': 'US', 'K7': 'US',
            'US': 'US', 'USA': 'US',
            'CA': 'CA', 'CAN': 'CA',
            'UK': 'GB', 'GB': 'GB',
            'EU': '', // Europe varies
        };
        if (regionToCountry[waypoint.region]) {
            return regionToCountry[waypoint.region];
        }
    }

    // For navaids, try to determine from lat/lon (rough US detection)
    if (waypoint.lat !== undefined && waypoint.lon !== undefined) {
        // Very rough US bounds check (contiguous US)
        if (waypoint.lat >= 24 && waypoint.lat <= 50 &&
            waypoint.lon >= -125 && waypoint.lon <= -66) {
            return 'US';
        }
    }

    return '';
}

/**
 * Escape special XML characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Import flight plan from Garmin .fpl (Garmin XML) file
 * Supports full Garmin FlightPlan v1 specification
 * @param {File} file - File object from file input
 * @returns {Promise<object>} Parsed navlog data
 */
function importFromForeFlightFPL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const xmlString = e.target.result;
                const navlogData = parseFplXml(xmlString);
                console.log('[FlightState] Garmin FPL imported:', navlogData.routeString);
                resolve(navlogData);
            } catch (error) {
                console.error('[FlightState] Failed to parse Garmin FPL:', error);
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Parse FPL XML string into navlog data structure
 * Exported for testing purposes
 * @param {string} xmlString - FPL XML content
 * @returns {object} Parsed navlog data
 */
function parseFplXml(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parse errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        throw new Error('Invalid XML format');
    }

    // Extract flight plan data
    const flightPlanEl = xmlDoc.querySelector('flight-plan');
    if (!flightPlanEl) {
        throw new Error('No flight-plan element found');
    }

    // Get file metadata
    const fileDescEl = xmlDoc.querySelector('file-description');
    const fileDescription = fileDescEl ? fileDescEl.textContent.trim() : '';

    const authorNameEl = xmlDoc.querySelector('author > author-name');
    const authorName = authorNameEl ? authorNameEl.textContent.trim() : '';

    const createdEl = xmlDoc.querySelector('created');
    const created = createdEl ? createdEl.textContent.trim() : '';

    // Get altitude (check multiple locations)
    let altitude = 5000; // default
    const altitudeEl = xmlDoc.querySelector('flight-data > altitude-ft');
    if (altitudeEl && altitudeEl.textContent.trim()) {
        altitude = parseInt(altitudeEl.textContent, 10) || 5000;
    }

    // Get tailnumber
    const tailnumberEl = xmlDoc.querySelector('aircraft > aircraft-tailnumber');
    const tailnumber = tailnumberEl ? tailnumberEl.textContent.trim() : '';

    // Get route name and description
    const routeNameEl = xmlDoc.querySelector('route > route-name');
    const routeName = routeNameEl ? routeNameEl.textContent.trim() : '';

    const routeDescEl = xmlDoc.querySelector('route > route-description');
    const routeDescription = routeDescEl ? routeDescEl.textContent.trim() : '';

    // Get flight plan index
    const fplIndexEl = xmlDoc.querySelector('route > flight-plan-index');
    const flightPlanIndex = fplIndexEl ? parseInt(fplIndexEl.textContent, 10) || 1 : 1;

    // Parse waypoint table with full spec support
    const waypointEls = xmlDoc.querySelectorAll('waypoint-table > waypoint');
    const waypointMap = new Map();

    waypointEls.forEach(wpEl => {
        const identifier = wpEl.querySelector('identifier')?.textContent?.trim() || '';
        const type = wpEl.querySelector('type')?.textContent?.trim() || 'USER WAYPOINT';
        const countryCode = wpEl.querySelector('country-code')?.textContent?.trim() || '';
        const lat = parseFloat(wpEl.querySelector('lat')?.textContent || 0);
        const lon = parseFloat(wpEl.querySelector('lon')?.textContent || 0);

        // Parse optional fields
        const commentEl = wpEl.querySelector('comment');
        const comment = commentEl ? commentEl.textContent.trim() : '';

        const elevationEl = wpEl.querySelector('elevation');
        const elevation = elevationEl && elevationEl.textContent.trim() ?
            parseInt(elevationEl.textContent, 10) : null;

        const altFtEl = wpEl.querySelector('altitude-ft');
        const altitudeFt = altFtEl && altFtEl.textContent.trim() ?
            parseInt(altFtEl.textContent, 10) : null;

        const waypointDescEl = wpEl.querySelector('waypoint-description');
        const waypointDescription = waypointDescEl ? waypointDescEl.textContent.trim() : '';

        if (identifier && !isNaN(lat) && !isNaN(lon)) {
            // Create unique key for waypoints (identifier + type + country)
            const key = `${identifier}|${type}|${countryCode}`;

            const waypoint = {
                ident: identifier,
                lat,
                lon,
                type: type,
                waypointType: mapFplTypeToWaypointType(type),
                countryCode: countryCode,
                comment: comment,
                elevation: elevation,
                altitude: altitudeFt,
                description: waypointDescription,
                // Extract name from comment or description
                name: comment || (waypointDescription ? waypointDescription.replace(`${identifier} - `, '') : '')
            };

            // Store with both simple key and full key for flexible lookup
            waypointMap.set(identifier, waypoint);
            waypointMap.set(key, waypoint);
        }
    });

    // Parse route to get ordered waypoints
    const routePointEls = xmlDoc.querySelectorAll('route > route-point');
    const waypoints = [];
    const routeParts = [];

    routePointEls.forEach(rpEl => {
        const identifier = rpEl.querySelector('waypoint-identifier')?.textContent?.trim() || '';
        const rpType = rpEl.querySelector('waypoint-type')?.textContent?.trim() || '';
        const rpCountryCode = rpEl.querySelector('waypoint-country-code')?.textContent?.trim() || '';

        // Try to find waypoint by full key first, then by identifier
        const fullKey = `${identifier}|${rpType}|${rpCountryCode}`;
        let wp = waypointMap.get(fullKey);

        if (!wp) {
            wp = waypointMap.get(identifier);
        }

        if (identifier && wp) {
            // Clone to avoid modifying the map entry
            const waypointCopy = { ...wp };

            // Set icao for airports
            if (waypointCopy.waypointType === 'airport') {
                waypointCopy.icao = identifier;
            }

            waypoints.push(waypointCopy);
            routeParts.push(identifier);
        }
    });

    if (waypoints.length < 2) {
        throw new Error('Flight plan must have at least 2 waypoints');
    }

    // Build route string
    const routeString = routeParts.join(' ');

    // Extract departure and destination
    const departure = waypoints[0];
    const destination = waypoints[waypoints.length - 1];

    // Build legs with calculated distances and bearings from waypoint coordinates
    const legs = [];
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to = waypoints[i + 1];

        // Calculate distance, bearing, and magnetic heading from coordinates
        // Use RouteCalculator functions (available globally at runtime)
        let distance = 0;
        let trueCourse = 0;
        let magHeading = null;

        if (window.RouteCalculator && from.lat && from.lon && to.lat && to.lon) {
            distance = window.RouteCalculator.calculateDistance(from.lat, from.lon, to.lat, to.lon);
            trueCourse = window.RouteCalculator.calculateBearing(from.lat, from.lon, to.lat, to.lon);

            // Calculate magnetic heading (trueCourse - magnetic variation)
            // No wind correction applied - that requires full route calculation
            const magVar = window.RouteCalculator.getMagneticDeclination(from.lat, from.lon);
            if (magVar !== null) {
                magHeading = trueCourse - magVar;
                // Normalize to 0-360
                if (magHeading < 0) magHeading += 360;
                if (magHeading >= 360) magHeading -= 360;
            }
        }

        totalDistance += distance;

        legs.push({
            from,
            to,
            distance,
            trueCourse,
            bearing: trueCourse, // Alias for compatibility
            magHeading // Will be null if mag var unavailable
        });
    }

    // Build route middle (everything except departure and destination)
    const routeMiddle = routeParts.length > 2 ? routeParts.slice(1, -1).join(' ') : '';

    return {
        routeString,
        departure,
        destination,
        routeMiddle,
        waypoints,
        legs,
        totalDistance,
        totalTime: 0,
        fuelStatus: null,
        options: {
            tailnumber,
            importedFrom: 'Garmin FPL',
            fileDescription,
            authorName,
            created,
            routeName,
            routeDescription,
            flightPlanIndex
        },
        altitude,
        tas: null,
        windData: null,
        windMetadata: null
    };
}

/**
 * Map FPL waypoint type to IN-FLIGHT waypointType
 * @param {string} fplType - FPL type (AIRPORT, VOR, NDB, INT, INT-VRP, USER WAYPOINT)
 * @returns {string} IN-FLIGHT waypointType
 */
function mapFplTypeToWaypointType(fplType) {
    const typeMap = {
        'AIRPORT': 'airport',
        'VOR': 'vor',
        'NDB': 'ndb',
        'INT': 'fix',
        'INT-VRP': 'vrp',
        'USER WAYPOINT': 'fix'
    };
    return typeMap[fplType] || 'fix';
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
// CLIPBOARD OPERATIONS
// ============================================

/**
 * Copy flight plan to clipboard as JSON
 * @returns {Promise<boolean>} True if copied successfully
 */
async function copyToClipboard() {
    if (!isFlightPlanValid()) {
        console.error('[FlightState] No valid flight plan to copy');
        return false;
    }

    try {
        const exportData = {
            version: '1.0',
            format: 'inflight-navlog',
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
            windData: flightPlan.windData,
            windMetadata: flightPlan.windMetadata
        };

        const json = JSON.stringify(exportData, null, 2);
        await navigator.clipboard.writeText(json);

        console.log('[FlightState] Flight plan copied to clipboard');
        return true;
    } catch (error) {
        console.error('[FlightState] Failed to copy to clipboard:', error);
        return false;
    }
}

/**
 * Paste flight plan from clipboard (JSON format)
 * @returns {Promise<object>} Parsed navlog data
 */
async function pasteFromClipboard() {
    try {
        const clipboardText = await navigator.clipboard.readText();

        if (!clipboardText || !clipboardText.trim()) {
            throw new Error('Clipboard is empty');
        }

        // Try to parse as JSON
        let navlogData;
        try {
            navlogData = JSON.parse(clipboardText);
        } catch (parseError) {
            throw new Error('Clipboard does not contain valid JSON');
        }

        // Validate structure - must have routeString, waypoints, and legs
        if (!navlogData.routeString || !navlogData.waypoints || !navlogData.legs) {
            throw new Error('Invalid navlog format - missing required fields');
        }

        // Validate waypoints array
        if (!Array.isArray(navlogData.waypoints) || navlogData.waypoints.length < 2) {
            throw new Error('Invalid navlog format - must have at least 2 waypoints');
        }

        console.log('[FlightState] Flight plan pasted from clipboard:', navlogData.routeString);
        return navlogData;
    } catch (error) {
        console.error('[FlightState] Failed to paste from clipboard:', error);
        throw error;
    }
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
    exportToForeFlightFPL,
    importFromFile,
    importFromForeFlightFPL,

    // FPL utilities (exported for testing)
    parseFplXml,
    getCountryCodeFromIcao,
    getCountryCodeFromRegion,
    mapFplTypeToWaypointType,

    // Clipboard
    copyToClipboard,
    pasteFromClipboard,

    // Route history
    saveToHistory,
    loadHistory
};
