// Vector Map Display Module - GPS moving map navigation
// Shows current position, next waypoint, and navigation data

let currentPosition = null;
let watchId = null;
let routeData = null;
let currentLegIndex = 0;
let diversionWaypoint = null; // Stores the waypoint when in diversion mode (currentLegIndex = -1)
let currentZoomMode = 'full'; // 'full', 'destination', 'surrounding-50', 'surrounding-25'
let currentStatusItem = null; // Track currently visible status bar item
let zoomLevel = 1; // Pinch zoom level (1.0 = default, max based on route bounds)
let initialPinchDistance = null;

// Pan/drag state
let panOffset = { x: 0, y: 0 }; // Pan offset in screen pixels
let isPanning = false;
let panStart = null;
let svgDimensions = { width: 1000, height: 500 }; // Track SVG dimensions for pan limits
let touchStartPositions = null; // Track touch positions for pan and pinch

// Cached DOM elements for navigation display (avoid repeated querySelector calls)
let navElements = null;

function cacheNavElements() {
    if (!navElements) {
        navElements = {
            nextWp: document.querySelector('.next-wp'),
            reqHdg: document.querySelector('.req-hdg'),
            dist: document.querySelector('.dist-nm'),
            ete: document.querySelector('.ete-value'),
            eta: document.querySelector('.eta-time'),
            gs: document.querySelector('.gs-value'),
            horizAcc: document.querySelector('.gps-horiz-acc'),
            vertAcc: document.querySelector('.gps-vert-acc')
        };
    }
    return navElements;
}

// ============================================
// GPS TRACKING
// ============================================

function startGPSTracking() {
    if (!navigator.geolocation) {
        console.warn('[VectorMap] Geolocation not supported');
        return false;
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            currentPosition = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                accuracy: position.coords.accuracy, // horizontal accuracy in meters
                altitudeAccuracy: position.coords.altitudeAccuracy, // vertical accuracy in meters
                altitude: position.coords.altitude, // meters MSL
                heading: position.coords.heading, // true heading in degrees
                speed: position.coords.speed // m/s
            };

            // Feed data to Flight Tracker
            if (window.FlightTracker) {
                const groundSpeedKt = position.coords.speed ? position.coords.speed * 1.94384 : 0;
                window.FlightTracker.updateFlightState(groundSpeedKt);
                window.FlightTracker.recordGPSPoint({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    altitude: position.coords.altitude,
                    speed: groundSpeedKt,
                    heading: position.coords.heading,
                    accuracy: position.coords.accuracy,
                    verticalAccuracy: position.coords.altitudeAccuracy
                });
            }

            // Feed data to IN-FLIGHT Controller
            if (window.InflightController) {
                const groundSpeedKt = position.coords.speed ? position.coords.speed * 1.94384 : 0;
                const altitudeFt = position.coords.altitude ? position.coords.altitude * 3.28084 : null;
                window.InflightController.updatePosition({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    altitude: altitudeFt,
                    speed: groundSpeedKt,
                    heading: position.coords.heading,
                    accuracy: position.coords.accuracy,
                    verticalAccuracy: position.coords.altitudeAccuracy
                });
            }

            updateLiveNavigation();
        },
        (error) => {
            console.error('[VectorMap] GPS error:', error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000
        }
    );

    return true;
}

function stopGPSTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    currentPosition = null;
}

// ============================================
// NAVIGATION CALCULATIONS
// ============================================

function updateLiveNavigation() {
    if (!currentPosition || !routeData) return;

    // Find current leg based on position
    const { waypoints, legs } = routeData;

    // Handle diversion mode differently - calculate to diversion waypoint
    if (currentLegIndex === -1 && diversionWaypoint) {
        const distToNext = window.RouteCalculator.calculateDistance(
            currentPosition.lat,
            currentPosition.lon,
            diversionWaypoint.lat,
            diversionWaypoint.lon
        );

        // True bearing to diversion waypoint
        const trueBearing = window.RouteCalculator.calculateBearing(
            currentPosition.lat,
            currentPosition.lon,
            diversionWaypoint.lat,
            diversionWaypoint.lon
        );

        // Convert to magnetic heading
        const magVariation = window.RouteCalculator.getMagneticDeclination(
            currentPosition.lat,
            currentPosition.lon
        );
        const magHeading = magVariation !== null ? (trueBearing - magVariation + 360) % 360 : null;

        // GPS ground speed in knots
        const gpsGroundSpeed = currentPosition.speed ? currentPosition.speed * 1.94384 : null;

        // Calculate ETE and ETA to diversion waypoint
        let eteNextWP = null;
        let etaNextWP = null;

        if (gpsGroundSpeed && gpsGroundSpeed > 0) {
            eteNextWP = (distToNext / gpsGroundSpeed) * 60;
            const etaNextMs = Date.now() + eteNextWP * 60 * 1000;
            etaNextWP = new Date(etaNextMs);
        }

        // GPS accuracy
        const horizontalAccuracy = currentPosition.accuracy || null;
        const verticalAccuracy = currentPosition.altitudeAccuracy || null;

        // Update display with diversion data
        updateNavigationDisplay({
            nextWaypoint: diversionWaypoint,
            distToNext,
            magHeading,
            eteNextWP,
            etaNextWP,
            etaDestination: etaNextWP, // For diversion, destination is the diversion point
            gpsGroundSpeed,
            horizontalAccuracy,
            verticalAccuracy
        });

        // Redraw map if needed
        if (currentZoomMode === 'destination' || currentZoomMode === 'surrounding-50' || currentZoomMode === 'surrounding-25') {
            generateMap(waypoints, legs);
        }

        return;
    }

    // Normal route navigation
    // Check if we've reached the next waypoint (within 2nm threshold)
    const nextWaypoint = waypoints[currentLegIndex + 1];
    if (!nextWaypoint) return;

    const distToNext = window.RouteCalculator.calculateDistance(
        currentPosition.lat,
        currentPosition.lon,
        nextWaypoint.lat,
        nextWaypoint.lon
    );

    // Auto-advance to next waypoint if within 2nm (waypoint passage)
    const waypointThreshold = 2.0; // nautical miles
    if (distToNext < waypointThreshold && currentLegIndex < legs.length - 1) {
        currentLegIndex++;
        console.log(`[VectorMap] Advanced to leg ${currentLegIndex + 1}/${legs.length}`);

        // Vibrate device to indicate waypoint passage
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]); // Two short pulses
        }

        // Announce waypoint passage with TTS
        if ('speechSynthesis' in window) {
            // Helper function to format waypoint names for speech (spell out each character)
            const formatWaypointForSpeech = (code) => {
                return code.split('').join(' ');
            };

            // Get waypoint information
            const passedWaypoint = waypoints[currentLegIndex];
            const nextWaypoint = waypoints[currentLegIndex + 1];
            const currentLeg = legs[currentLegIndex];

            const passedCode = formatWaypointForSpeech(window.RouteCalculator.getWaypointCode(passedWaypoint));
            const nextCode = formatWaypointForSpeech(window.RouteCalculator.getWaypointCode(nextWaypoint));

            // Calculate magnetic heading
            const magHeading = currentLeg.magVar !== null && currentLeg.magVar !== undefined
                ? Math.round((currentLeg.trueCourse - currentLeg.magVar + 360) % 360)
                : Math.round(currentLeg.trueCourse);

            // Format heading with leading zeros and spell out each digit
            const headingFormatted = String(magHeading).padStart(3, '0').split('').join(' ');

            // Build announcement message
            let message = `Approaching ${passedCode}. Next waypoint ${nextCode}, `;
            message += `heading ${headingFormatted}, `;
            message += `distance ${Math.round(currentLeg.distance)} nautical miles`;

            // Add ETE if available (might not be if user opted out of wind correction)
            if (currentLeg.legTime !== undefined && currentLeg.legTime !== null) {
                const hours = Math.floor(currentLeg.legTime / 60);
                const minutes = Math.round(currentLeg.legTime % 60);
                if (hours > 0) {
                    message += `, E T E ${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
                } else {
                    message += `, E T E ${minutes} minute${minutes !== 1 ? 's' : ''}`;
                }
            }

            // Speak the announcement
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            window.speechSynthesis.speak(utterance);
        }

        // Update button labels for new waypoint
        updateNavButtonLabels();

        // Continue processing with new leg (will calculate GPS-based navigation below)
        return updateLiveNavigation();
    }

    // True bearing to next waypoint
    const trueBearing = window.RouteCalculator.calculateBearing(
        currentPosition.lat,
        currentPosition.lon,
        nextWaypoint.lat,
        nextWaypoint.lon
    );

    // Convert to magnetic heading
    const magVariation = window.RouteCalculator.getMagneticDeclination(
        currentPosition.lat,
        currentPosition.lon
    );
    const magHeading = magVariation !== null ? (trueBearing - magVariation + 360) % 360 : null;

    // GPS ground speed in knots
    const gpsGroundSpeed = currentPosition.speed ? currentPosition.speed * 1.94384 : null;

    // Calculate ETE to next waypoint and ETA to destination based on GPS ground speed
    let eteNextWP = null;
    let etaNextWP = null;
    let etaDestination = null;

    if (gpsGroundSpeed && gpsGroundSpeed > 0) {
        // ETE to next waypoint (minutes)
        eteNextWP = (distToNext / gpsGroundSpeed) * 60;

        // ETA to next waypoint
        const etaNextMs = Date.now() + eteNextWP * 60 * 1000;
        etaNextWP = new Date(etaNextMs);

        // Calculate total distance to destination
        let totalDistRemaining = distToNext;
        for (let i = currentLegIndex + 1; i < legs.length; i++) {
            totalDistRemaining += legs[i].distance;
        }

        // ETA to destination
        const etaDestMs = Date.now() + (totalDistRemaining / gpsGroundSpeed) * 60 * 60 * 1000;
        etaDestination = new Date(etaDestMs);
    }

    // GPS accuracy assessment
    const horizontalAccuracy = currentPosition.accuracy || null;
    const verticalAccuracy = currentPosition.altitudeAccuracy || null;

    // Update display
    updateNavigationDisplay({
        nextWaypoint,
        distToNext,
        magHeading,
        eteNextWP,
        etaNextWP,
        etaDestination,
        gpsGroundSpeed,
        horizontalAccuracy,
        verticalAccuracy
    });

    // Redraw map if in destination or surrounding zoom mode (to update GPS position)
    if (currentZoomMode === 'destination' || currentZoomMode === 'surrounding-50' || currentZoomMode === 'surrounding-25') {
        generateMap(waypoints, legs);
    }
}

// ============================================
// AIRSPACE RENDERING
// ============================================

// Standard airspace radii (nautical miles) - conservative FAA dimensions
const AIRSPACE_RADII = {
    'B': { inner: 10, outer: 30 },    // Class B: inner 10nm, outer 30nm (3 concentric circles: 10/20/30)
    'C': { inner: 5, outer: 10 },     // Class C: inner 5nm surface area, outer 10nm shelf
    'D': { inner: 0, outer: 5 }       // Class D: 5nm radius (conservative estimate)
};

// Draw airspace around airports in the visible area (for avoidance awareness)
function drawAirspace(waypoints, project, strokeWidth, bounds) {
    let svg = '';

    if (!window.DataManager || !window.QueryEngine) return svg;

    // Get all airports in the bounding box (with some padding for airspace that extends beyond)
    const padding = 0.5; // ~30nm padding to catch airspace that extends into view
    const expandedBounds = {
        minLat: bounds.minLat - padding,
        maxLat: bounds.maxLat + padding,
        minLon: bounds.minLon - padding,
        maxLon: bounds.maxLon + padding
    };

    // Query all airports within the expanded bounds
    const nearbyAirports = window.QueryEngine.getPointsInBounds(expandedBounds);

    // Group airports by airspace class to handle blend modes properly
    const airspaceByClass = { B: [], C: [], D: [] };

    for (const airport of nearbyAirports.airports) {
        const airportCode = airport.icao || airport.ident || airport.code;
        if (!airportCode) continue;

        const airspace = window.DataManager.getAirspaceClass(airportCode);
        if (!airspace || !(airspace.class === 'B' || airspace.class === 'C' || airspace.class === 'D')) continue;

        const center = project(airport.lat, airport.lon);
        const radii = AIRSPACE_RADII[airspace.class];
        if (!radii) continue;

        // Calculate radius in pixels
        const nmToDeg = 1 / 60;
        const testLat = airport.lat + (radii.outer * nmToDeg);
        const testPoint = project(testLat, airport.lon);
        const outerRadiusPx = Math.abs(testPoint.y - center.y);

        let innerRadiusPx = 0;
        if (radii.inner > 0) {
            const innerTestLat = airport.lat + (radii.inner * nmToDeg);
            const innerTestPoint = project(innerTestLat, airport.lon);
            innerRadiusPx = Math.abs(innerTestPoint.y - center.y);
        }

        airspaceByClass[airspace.class].push({
            center,
            outerRadiusPx,
            innerRadiusPx,
            airspace
        });
    }

    // Draw each airspace class in two layers:
    // Layer 1: Outer circles in a group with opacity (prevents overlap darkening)
    // Layer 2: Inner circles on top with black fill (creates donut holes)
    for (const [airspaceClass, circles] of Object.entries(airspaceByClass)) {
        if (circles.length === 0) continue;

        let fillColor, strokeColor, groupOpacity, dashArray;

        switch (airspaceClass) {
            case 'B':
                fillColor = '#0000ff';
                strokeColor = '#0000ff';
                groupOpacity = 0.2; // Increased from 0.15
                dashArray = 'none';
                break;
            case 'C':
                fillColor = '#c71585';
                strokeColor = '#c71585';
                groupOpacity = 0.2;
                dashArray = 'none';
                break;
            case 'D':
                fillColor = 'none';
                strokeColor = '#4169e1';
                groupOpacity = 0.6;
                dashArray = '8,4';
                break;
        }

        // Layer 1: Outer circles with group-level opacity
        svg += `<g opacity="${groupOpacity}" class="airspace-group-${airspaceClass}">`;

        for (const circle of circles) {
            // Draw outer circle with NO opacity (solid color)
            if (airspaceClass === 'D') {
                svg += `<circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.outerRadiusPx}" ` +
                       `fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" ` +
                       `stroke-dasharray="${dashArray}" class="airspace-circle airspace-${airspaceClass}"/>`;
            } else {
                svg += `<circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.outerRadiusPx}" ` +
                       `fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth * 0.5}" ` +
                       `class="airspace-circle airspace-${airspaceClass}"/>`;
            }
        }

        svg += `</g>`;

        // Layer 2: Inner circles drawn AFTER group closes (darker shade on top)
        if (airspaceClass === 'B' || airspaceClass === 'C') {
            // Inner circle opacity is 2x the outer circle opacity for darker shade
            const innerOpacity = groupOpacity * 2;

            svg += `<g opacity="${innerOpacity}" class="airspace-group-${airspaceClass}-inner">`;

            for (const circle of circles) {
                if (circle.innerRadiusPx > 0) {
                    // Draw inner circle with same color as outer, but in separate group with higher opacity
                    svg += `<circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.innerRadiusPx}" ` +
                           `fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth * 0.5}" ` +
                           `class="airspace-circle airspace-${airspaceClass}-inner"/>`;
                }
            }

            svg += `</g>`;
        }
    }

    return svg;
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

function displayMap(waypoints, legs, options = {}) {
    if (waypoints.length < 2) {
        hideMap();
        return;
    }

    routeData = { waypoints, legs, options };
    currentLegIndex = 0;
    diversionWaypoint = null; // Clear any previous diversion when loading new route

    showMap();
    generateMap(waypoints, legs);
    updateCurrentInstruction(legs[0], options);
    updateNavButtonLabels();
}

function showMap() {
    // Hide placeholder and show map
    const mapPlaceholder = document.getElementById('mapPlaceholder');
    if (mapPlaceholder) mapPlaceholder.style.display = 'none';

    const display = document.getElementById('mapDisplay');
    if (display) {
        display.style.display = 'block';
    }
}

function hideMap() {
    const display = document.getElementById('mapDisplay');
    if (display) {
        display.style.display = 'none';
    }

    // Show placeholder when hiding map
    const mapPlaceholder = document.getElementById('mapPlaceholder');
    if (mapPlaceholder) mapPlaceholder.style.display = 'block';

    stopGPSTracking();
    routeData = null;
}

function generateMap(waypoints, legs) {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    // Calculate bounds based on zoom mode
    let bounds;

    if ((currentZoomMode === 'surrounding-50' || currentZoomMode === 'surrounding-25') && currentPosition) {
        // Radius around current position (50nm or 25nm)
        const radiusNM = currentZoomMode === 'surrounding-25' ? 25 : 50;
        const radiusDeg = radiusNM / 60; // 1 degree ≈ 60nm

        bounds = {
            minLat: currentPosition.lat - radiusDeg,
            maxLat: currentPosition.lat + radiusDeg,
            minLon: currentPosition.lon - radiusDeg / Math.cos(currentPosition.lat * Math.PI / 180),
            maxLon: currentPosition.lon + radiusDeg / Math.cos(currentPosition.lat * Math.PI / 180)
        };
    } else if (currentZoomMode === 'destination' && currentPosition && waypoints.length > 0) {
        // Zoom to show current position and destination only
        // As you get closer, the view zooms in dynamically
        const destination = waypoints[waypoints.length - 1];
        const lats = [currentPosition.lat, destination.lat];
        const lons = [currentPosition.lon, destination.lon];

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        const latRange = maxLat - minLat;
        const lonRange = maxLon - minLon;

        // Use larger padding for very short distances to avoid extreme zoom
        const minRange = 0.02; // Minimum ~1.2nm range
        const effectiveLatRange = Math.max(latRange, minRange);
        const effectiveLonRange = Math.max(lonRange, minRange);
        const padding = 0.15;

        bounds = {
            minLat: minLat - effectiveLatRange * padding,
            maxLat: maxLat + effectiveLatRange * padding,
            minLon: minLon - effectiveLonRange * padding,
            maxLon: maxLon + effectiveLonRange * padding
        };
    } else {
        // Full route view (default) - show only route waypoints, not current position
        const lats = waypoints.map(w => w.lat);
        const lons = waypoints.map(w => w.lon);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        // 5% padding around route bounds
        const latRange = maxLat - minLat;
        const lonRange = maxLon - minLon;
        const padding = 0.05;

        bounds = {
            minLat: minLat - latRange * padding,
            maxLat: maxLat + latRange * padding,
            minLon: minLon - lonRange * padding,
            maxLon: maxLon + lonRange * padding
        };
    }

    // Calculate responsive sizes based on route aspect ratio
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 1024; // Tablets in portrait (iPad: 768-810px) considered mobile

    const latRange = bounds.maxLat - bounds.minLat;
    const lonRange = bounds.maxLon - bounds.minLon;

    // Convert to approximate physical distance ratio (accounting for latitude)
    const avgLat = (bounds.minLat + bounds.maxLat) / 2;
    const latToLonRatio = Math.cos(avgLat * Math.PI / 180);
    const physicalLonRange = lonRange * latToLonRatio;
    const routeAspectRatio = physicalLonRange / latRange;

    // Determine dimensions based on route orientation
    let width, height;
    const baseSize = 1400; // Use mobile scale for all devices

    if (routeAspectRatio > 1.5) {
        // Wide route (E-W): use landscape orientation
        width = baseSize;
        height = baseSize / 2;
    } else if (routeAspectRatio < 0.67) {
        // Tall route (N-S): use portrait orientation
        width = baseSize / 2;
        height = baseSize;
    } else {
        // Roughly square: use balanced dimensions
        width = baseSize;
        height = baseSize * 0.7;
    }

    // Store dimensions for pan limit calculations
    svgDimensions = { width, height };

    // Scaling factors for SVG elements
    // Desktop: 2x text (96px), 2x shapes (10px radius), 8px stroke
    // Mobile: 4x text (48px), 4x shapes (20px radius), 4px stroke
    const textScaleFactor = isMobile ? 4 : 4; // Desktop: 12 * 8 = 96px, Mobile: 12 * 4 = 48px
    const shapeScaleFactor = isMobile ? 4 : 2; // Desktop: half shape size of mobile
    const waypointLabelSize = 12 * textScaleFactor;
    const waypointRadius = 5 * shapeScaleFactor;
    const strokeWidth = isMobile ? 4 : 4; // Desktop: double line width

    // Calculate projection center (center of visible area)
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLon = (bounds.minLon + bounds.maxLon) / 2;
    const centerLatRad = centerLat * Math.PI / 180;
    const centerLonRad = centerLon * Math.PI / 180;

    console.log(`[VectorMap] Using orthographic projection centered at ${centerLat.toFixed(2)}°, ${centerLon.toFixed(2)}°`);

    // Pre-calculate projection scale by projecting corner points
    const projectToSphere = (lat, lon) => {
        const latRad = lat * Math.PI / 180;
        const lonRad = lon * Math.PI / 180;
        const dLon = lonRad - centerLonRad;

        // Orthographic projection formulas
        const x = Math.cos(latRad) * Math.sin(dLon);
        const y = Math.cos(centerLatRad) * Math.sin(latRad) - Math.sin(centerLatRad) * Math.cos(latRad) * Math.cos(dLon);

        return { x, y };
    };

    // Calculate scale to fit all waypoints in viewport
    const corners = [
        projectToSphere(bounds.minLat, bounds.minLon),
        projectToSphere(bounds.minLat, bounds.maxLon),
        projectToSphere(bounds.maxLat, bounds.minLon),
        projectToSphere(bounds.maxLat, bounds.maxLon)
    ];

    const projectedXs = corners.map(c => c.x);
    const projectedYs = corners.map(c => c.y);
    const minProjX = Math.min(...projectedXs);
    const maxProjX = Math.max(...projectedXs);
    const minProjY = Math.min(...projectedYs);
    const maxProjY = Math.max(...projectedYs);

    const projRangeX = maxProjX - minProjX;
    const projRangeY = maxProjY - minProjY;

    // Scale to fit viewport with 5% padding, apply zoom level
    const padding = 0.05;
    const scaleX = width / (projRangeX * (1 + 2 * padding));
    const scaleY = height / (projRangeY * (1 + 2 * padding));
    const baseScale = Math.min(scaleX, scaleY);
    const scale = baseScale * zoomLevel; // Apply pinch zoom
    const centerX = (minProjX + maxProjX) / 2;
    const centerY = (minProjY + maxProjY) / 2;

    // Optimized projection function (reuses pre-calculated values)
    const project = (lat, lon) => {
        const projected = projectToSphere(lat, lon);
        const screenX = width / 2 + (projected.x - centerX) * scale;
        const screenY = height / 2 - (projected.y - centerY) * scale;
        return { x: screenX, y: screenY };
    };

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Create a transform group for pan offset (applied via CSS transform for performance)
    svg += `<g id="mapContent" transform="translate(${panOffset.x}, ${panOffset.y})">`;

    // Draw airspace (background layer - drawn first so it appears behind everything)
    svg += drawAirspace(waypoints, project, strokeWidth, bounds);

    // Draw route lines
    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const from = project(leg.from.lat, leg.from.lon);
        const to = project(leg.to.lat, leg.to.lon);

        svg += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="route-line"/>`;
    }

    // Draw waypoints with label de-crowding
    const waypointData = waypoints.map((waypoint, index) => {
        const pos = project(waypoint.lat, waypoint.lon);
        const code = window.RouteCalculator.getWaypointCode(waypoint);
        const isAirport = waypoint.waypointType === 'airport';

        // Determine color based on waypoint type
        let color = '#ffffff'; // Default white for unspecified
        if (isAirport) {
            color = '#00ffff'; // Cyan
        } else if (waypoint.waypointType === 'navaid') {
            color = '#ff00ff'; // Magenta
        } else if (waypoint.waypointType === 'fix') {
            // Check if it's a reporting point
            color = waypoint.isReportingPoint ? '#ffbf00' : '#ffffff'; // Amber or White
        }

        // Priority: first/last waypoints (airports usually) > airports > navaids > fixes
        let priority = 0;
        if (index === 0 || index === waypoints.length - 1) {
            priority = 3; // Departure/destination always visible
        } else if (isAirport) {
            priority = 2;
        } else if (waypoint.waypointType === 'navaid') {
            priority = 1;
        }

        // Label offset: radius + half text size + small padding
        const labelOffset = waypointRadius + (waypointLabelSize / 2) + 4;
        return { waypoint, index, pos, code, color, priority, labelY: pos.y - labelOffset };
    });

    // Label collision detection - hide labels that are too close
    const visibleLabels = new Set();

    // Minimum distance for label collision detection
    const minLabelDistance = 100; // pixels
    const sorted = [...waypointData].sort((a, b) => b.priority - a.priority);

    for (const item of sorted) {
        let collision = false;

        for (const visibleIdx of visibleLabels) {
            const visible = waypointData[visibleIdx];
            const dist = Math.sqrt(
                Math.pow(item.pos.x - visible.pos.x, 2) +
                Math.pow(item.pos.y - visible.pos.y, 2)
            );

            if (dist < minLabelDistance) {
                collision = true;
                break;
            }
        }

        if (!collision) {
            visibleLabels.add(item.index);
        }
    }

    // Draw waypoints (all get circles, but only non-colliding get labels)
    waypointData.forEach(({ waypoint, index, pos, code, color, labelY }) => {
        // Check if this is the target waypoint (next waypoint we're heading to)
        const isTargetWaypoint = (currentLegIndex >= 0 && index === currentLegIndex + 1);
        const targetClass = isTargetWaypoint ? ' target-waypoint' : '';

        svg += `<g class="map-waypoint${targetClass}" data-index="${index}">`;
        svg += `<circle class="waypoint-circle" cx="${pos.x}" cy="${pos.y}" r="${waypointRadius}" fill="${color}" stroke="${color}" stroke-width="${strokeWidth}"/>`;

        if (visibleLabels.has(index)) {
            svg += `<text class="waypoint-label" x="${pos.x}" y="${labelY}" text-anchor="middle" fill="${color}" font-size="${waypointLabelSize}" font-family="Roboto Mono" font-weight="700">${code}</text>`;
        }

        svg += `</g>`;
    });

    // Draw current position if available (tall isosceles triangle, classic vector style)
    if (currentPosition) {
        const pos = project(currentPosition.lat, currentPosition.lon);
        const heading = currentPosition.heading || 0; // GPS heading in degrees

        // Tall isosceles triangle (like old vector graphics)
        // Desktop: 4x size (160x80), Mobile: 2x size (80x40)
        const triangleHeight = isMobile ? 80 : 60;
        const triangleBaseWidth = isMobile ? 40 : 30;

        // Triangle vertices in local coordinates (tip points up, unrotated)
        const tipLocalX = 0;
        const tipLocalY = -triangleHeight;
        const baseLeftLocalX = -triangleBaseWidth / 2;
        const baseLeftLocalY = 0;
        const baseRightLocalX = triangleBaseWidth / 2;
        const baseRightLocalY = 0;

        // Draw using CSS transform for smooth rotation (heading - 90 because SVG 0° is East)
        const arrowStrokeWidth = 6;
        svg += `<g class="gps-arrow" transform="translate(${pos.x}, ${pos.y}) rotate(${heading - 90})">`;
        svg += `<polygon points="${tipLocalX},${tipLocalY} ${baseLeftLocalX},${baseLeftLocalY} ${baseRightLocalX},${baseRightLocalY}"
                fill="#00ff00" stroke="#ffffff" stroke-width="${arrowStrokeWidth}" stroke-linejoin="miter"/>`;
        svg += `</g>`;
    }

    // Close the transform group
    svg += `</g>`;


    svg += `</svg>`;
    mapContainer.innerHTML = svg;

    // Add click handler on background to dismiss popup
    const svgElement = mapContainer.querySelector('svg');
    if (svgElement) {
        svgElement.addEventListener('click', (e) => {
            if (e.target === svgElement || e.target.tagName === 'svg') {
                hidePopup();
            }
        });

        // Add touch support for both pan and pinch-to-zoom
        svgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
        svgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
        svgElement.addEventListener('touchend', handleTouchEnd, { passive: false });

        // Add drag/pan support (only when zoomed in)
        svgElement.addEventListener('mousedown', handlePanStart);
        svgElement.addEventListener('mousemove', handlePanMove);
        svgElement.addEventListener('mouseup', handlePanEnd);
        svgElement.addEventListener('mouseleave', handlePanEnd);
    }

    // Add hover/click handlers for route waypoints
    const waypointElements = mapContainer.querySelectorAll('.map-waypoint');
    waypointElements.forEach(el => {
        const index = parseInt(el.getAttribute('data-index'));
        const waypoint = waypoints[index];

        // Show popup on hover (desktop) or tap (mobile)
        el.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent background click
            showPopup(waypoint, legs, index);
        });
    });
}

function showPopup(waypoint, legs, index) {
    const statusBar = document.getElementById('mapStatusBar');
    const statusBarContent = document.getElementById('statusBarContent');
    if (!statusBar || !statusBarContent) return;

    const code = window.RouteCalculator.getWaypointCode(waypoint);
    const lat = window.Utils?.formatCoordinate(waypoint.lat, 'lat');
    const lon = window.Utils?.formatCoordinate(waypoint.lon, 'lon');
    const pos = `${lat} ${lon}`;

    // Type display with reporting point indicator
    let typeDisplay;
    if (waypoint.waypointType === 'airport') {
        typeDisplay = 'AIRPORT';
    } else if (waypoint.waypointType === 'navaid') {
        typeDisplay = waypoint.type || 'NAVAID';
    } else if (waypoint.waypointType === 'fix') {
        typeDisplay = waypoint.isReportingPoint ? 'REPORTING POINT' : 'FIX';
    } else {
        typeDisplay = waypoint.type || 'WAYPOINT';
    }

    // Determine color based on waypoint type
    let colorClass = 'text-fix'; // Default white for unspecified
    if (waypoint.waypointType === 'airport') {
        colorClass = 'text-airport'; // Cyan
    } else if (waypoint.waypointType === 'navaid') {
        colorClass = 'text-navaid'; // Magenta
    } else if (waypoint.waypointType === 'fix') {
        colorClass = waypoint.isReportingPoint ? 'text-reporting' : 'text-fix'; // Amber or White
    }

    // Elevation and magnetic variation
    const elev = waypoint.elevation !== null && !isNaN(waypoint.elevation) ? `${Math.round(waypoint.elevation)} FT` : null;
    const magVarValue = waypoint.magVar !== null && waypoint.magVar !== undefined ? Math.abs(waypoint.magVar).toFixed(1) : '-';
    const magVarDir = waypoint.magVar >= 0 ? 'E' : 'W';
    const magVarDisplay = magVarValue !== '-' ? `VAR ${magVarValue}°${magVarDir}` : 'VAR -';

    let elevMagLine = '';
    if (elev) {
        elevMagLine = `<div class="text-airport text-xs">ELEV ${elev} | ${magVarDisplay}</div>`;
    } else {
        elevMagLine = `<div class="text-airport text-xs">${magVarDisplay}</div>`;
    }

    // Runways
    let runwayHTML = '';
    if (waypoint.waypointType === 'airport') {
        const airportCode = waypoint.icao || waypoint.ident;
        if (airportCode) {
            const runways = window.DataManager.getRunways(airportCode);
            if (runways && runways.length > 0) {
                const runwayInfo = runways.map(r => {
                    const idents = r.leIdent && r.heIdent ? `${r.leIdent}/${r.heIdent}` : (r.leIdent || r.heIdent || 'N/A');
                    const length = r.length ? `${r.length}FT` : '';
                    const surface = r.surface || '';
                    return `<strong>${idents}</strong> ${length} ${surface}`.trim();
                }).join(', ');
                runwayHTML = `<div class="text-secondary text-xs">RWY ${runwayInfo}</div>`;
            }
        }
    }

    // Frequencies
    let freqHTML = '';
    if (waypoint.waypointType === 'airport') {
        const airportCode = waypoint.icao || waypoint.ident;
        if (airportCode) {
            const frequencies = window.DataManager.getFrequencies(airportCode);
            if (frequencies && frequencies.length > 0) {
                const grouped = {};
                frequencies.forEach(f => {
                    const type = f.type.toUpperCase();
                    if (!grouped[type]) grouped[type] = [];
                    grouped[type].push(f.frequency.toFixed(3));
                });
                const freqItems = Object.entries(grouped).map(([type, freqs]) =>
                    `<span class="text-metric text-xs">${type} ${freqs.join('/')}</span>`
                );
                freqHTML = freqItems.join(' ');
            }
        }
    } else if (waypoint.waypointType === 'navaid' && waypoint.frequency) {
        const formattedFreq = window.Utils?.formatNavaidFrequency(waypoint.frequency, waypoint.type);
        if (formattedFreq) {
            freqHTML = `<span class="text-metric text-xs">${formattedFreq}</span>`;
        }
    }

    // GPS-relative information (distance and heading from current position)
    let gpsRelativeInfo = '';
    if (currentPosition) {
        const dist = window.RouteCalculator.calculateDistance(
            currentPosition.lat, currentPosition.lon,
            waypoint.lat, waypoint.lon
        );
        const trueBearing = window.RouteCalculator.calculateBearing(
            currentPosition.lat, currentPosition.lon,
            waypoint.lat, waypoint.lon
        );
        // Get magnetic variation at current position
        const magVar = waypoint.magVar !== null && waypoint.magVar !== undefined ? waypoint.magVar : 0;
        const magBearing = trueBearing - magVar;
        // Normalize to 0-360
        const normalizedMagBearing = ((magBearing % 360) + 360) % 360;
        gpsRelativeInfo = `<div class="text-metric text-xs">FROM GPS: ${dist.toFixed(1)}NM @ ${String(Math.round(normalizedMagBearing)).padStart(3, '0')}°M</div>`;
    }

    // Direct/Divert button - check if waypoint is in route
    let setNextWptHTML = '';
    if (watchId !== null && routeData) {
        const isInRoute = routeData.waypoints.some(w => w === waypoint);
        const buttonText = isInRoute ? 'DCT' : 'DIVERT';
        setNextWptHTML = `<button class="btn btn-secondary btn-sm" id="setNextWptBtn" style="width: 100%; margin-top: 0.25rem; padding: 0.15rem 0.25rem; font-size: 0.7rem;">${buttonText}</button>`;
    }

    // Build waypoint row using exact navlog structure
    let html = `
        <tr class="wpt-row">
            <td class="wpt-num text-primary font-bold">${index + 1}</td>
            <td class="wpt-info-cell">
                <div class="${colorClass} wpt-code">${code}</div>
                <div class="text-xs text-secondary">${typeDisplay}</div>
                ${setNextWptHTML}
            </td>
            <td colspan="2">
                <div class="text-secondary text-xs">${pos}</div>
                ${gpsRelativeInfo}
                ${elevMagLine}
                ${runwayHTML}
                ${freqHTML ? `<div class="mt-xs">${freqHTML}</div>` : ''}
            </td>
        </tr>
    `;

    statusBarContent.innerHTML = html;
    statusBar.classList.remove('hidden');
    currentStatusItem = index;

    // Hide navigation panel when showing status bar
    const navPanel = document.getElementById('navigationPanel');
    if (navPanel) {
        navPanel.style.display = 'none';
    }

    // Attach event listener to "Set as Next WPT" button (DCT button)
    const setNextWptBtn = document.getElementById('setNextWptBtn');
    if (setNextWptBtn) {
        setNextWptBtn.addEventListener('click', () => {
            // Clear diversion mode when going direct to a route waypoint
            diversionWaypoint = null;

            // Set to leg that goes TO this waypoint
            // Waypoint index 2 -> leg index 1 (goes TO waypoint 2)
            currentLegIndex = index - 1;
            if (currentLegIndex >= 0 && routeData.legs[currentLegIndex]) {
                // If GPS is active, let updateLiveNavigation handle the display update
                // Otherwise, update with static leg data
                if (watchId === null) {
                    updateCurrentInstruction(routeData.legs[currentLegIndex], routeData.options);
                } else {
                    updateLiveNavigation();
                }
                updateNavButtonLabels();
            }
        });
    }
}

function hidePopup() {
    const statusBar = document.getElementById('mapStatusBar');
    if (statusBar) {
        statusBar.classList.add('hidden');
        document.getElementById('statusBarContent').innerHTML = '';
        currentStatusItem = null;
    }

    // Show navigation panel when hiding status bar
    const navPanel = document.getElementById('navigationPanel');
    if (navPanel) {
        navPanel.style.display = 'block';
    }
}

function updateCurrentInstruction(firstLeg, options) {
    const toCode = window.RouteCalculator.getWaypointCode(firstLeg.to);
    const waypoint = firstLeg.to;
    const els = cacheNavElements();

    // Set waypoint with color based on type
    if (els.nextWp) {
        els.nextWp.textContent = toCode;

        // Apply waypoint color
        let color = '#ffffff'; // Default white for fixes
        if (waypoint.waypointType === 'airport') {
            color = '#00ffff'; // Cyan
        } else if (waypoint.waypointType === 'navaid') {
            color = '#ff00ff'; // Magenta
        } else if (waypoint.waypointType === 'fix') {
            color = waypoint.isReportingPoint ? '#ffbf00' : '#ffffff'; // Amber or White
        }
        els.nextWp.style.color = color;
    }

    // Heading in cyan
    const heading = firstLeg.magHeading !== null ? Math.round(firstLeg.magHeading) : Math.round(firstLeg.trueCourse);
    if (els.reqHdg) {
        els.reqHdg.textContent = String(heading).padStart(3, '0') + '°';
        els.reqHdg.style.color = '#00ffff'; // Cyan for heading
    }

    // Distance in green
    if (els.dist) {
        els.dist.textContent = firstLeg.distance.toFixed(1);
        els.dist.style.color = '#00ff00'; // Green
    }

    // ETE in green
    if (els.ete) {
        if (firstLeg.legTime !== undefined) {
            const hours = Math.floor(firstLeg.legTime / 60);
            const minutes = Math.round(firstLeg.legTime % 60);
            els.ete.textContent = hours > 0 ? `${hours}H${minutes}M` : `${minutes}M`;
        } else {
            els.ete.textContent = '--';
        }
        els.ete.style.color = '#00ff00'; // Green
    }

    // ETA in green
    if (els.eta) {
        if (firstLeg.legTime !== undefined) {
            const now = new Date();
            const etaMs = now.getTime() + firstLeg.legTime * 60 * 1000;
            const eta = new Date(etaMs);
            const hours = String(eta.getHours()).padStart(2, '0');
            const minutes = String(eta.getMinutes()).padStart(2, '0');
            els.eta.textContent = `${hours}:${minutes}`;
        } else {
            els.eta.textContent = '--:--';
        }
        els.eta.style.color = '#00ff00'; // Green
    }

    // Ground speed in green
    if (els.gs) {
        if (firstLeg.groundSpeed !== undefined) {
            els.gs.textContent = Math.round(firstLeg.groundSpeed);
        } else {
            els.gs.textContent = '--';
        }
        els.gs.style.color = '#00ff00'; // Green
    }
}

function updateNavigationDisplay(navData) {
    const { nextWaypoint, distToNext, magHeading, eteNextWP, etaNextWP,
            gpsGroundSpeed, horizontalAccuracy, verticalAccuracy } = navData;
    const els = cacheNavElements();

    // Update waypoint name with color
    if (els.nextWp && nextWaypoint) {
        const toCode = window.RouteCalculator.getWaypointCode(nextWaypoint);
        els.nextWp.textContent = toCode;

        // Apply waypoint color
        let color = '#ffffff'; // Default white for fixes
        if (nextWaypoint.waypointType === 'airport') {
            color = '#00ffff'; // Cyan
        } else if (nextWaypoint.waypointType === 'navaid') {
            color = '#ff00ff'; // Magenta
        } else if (nextWaypoint.waypointType === 'fix') {
            color = nextWaypoint.isReportingPoint ? '#ffbf00' : '#ffffff'; // Amber or White
        }
        els.nextWp.style.color = color;
    }

    // Update distance to next waypoint (green)
    if (els.dist) {
        els.dist.textContent = distToNext.toFixed(1);
        els.dist.style.color = '#00ff00'; // Green
    }

    // Update magnetic heading (cyan)
    if (els.reqHdg) {
        if (magHeading !== null) {
            els.reqHdg.textContent = String(Math.round(magHeading)).padStart(3, '0') + '°';
        } else {
            els.reqHdg.textContent = '---°';
        }
        els.reqHdg.style.color = '#00ffff'; // Cyan for heading
    }

    // Update ETE to next waypoint (green) - hide if ground speed < 5kt (likely noise)
    if (els.ete && eteNextWP !== null && gpsGroundSpeed !== null && gpsGroundSpeed >= 5) {
        const hours = Math.floor(eteNextWP / 60);
        const minutes = Math.round(eteNextWP % 60);
        els.ete.textContent = hours > 0 ? `${hours}H${minutes}M` : `${minutes}M`;
        els.ete.style.color = '#00ff00'; // Green
    } else if (els.ete) {
        els.ete.textContent = '--';
        els.ete.style.color = '#00ff00'; // Green
    }

    // Update ETA (green) - hide if ground speed < 5kt (likely noise)
    if (els.eta && etaNextWP && gpsGroundSpeed !== null && gpsGroundSpeed >= 5) {
        const hours = String(etaNextWP.getHours()).padStart(2, '0');
        const minutes = String(etaNextWP.getMinutes()).padStart(2, '0');
        els.eta.textContent = `${hours}:${minutes}`;
        els.eta.style.color = '#00ff00'; // Green
    } else if (els.eta) {
        els.eta.textContent = '--:--';
        els.eta.style.color = '#00ff00'; // Green
    }

    // Update GPS ground speed (green)
    if (els.gs && gpsGroundSpeed !== null) {
        els.gs.textContent = Math.round(gpsGroundSpeed);
        els.gs.style.color = '#00ff00'; // Green
    } else if (els.gs) {
        els.gs.textContent = '--';
        els.gs.style.color = '#00ff00'; // Green
    }

    // Update GPS accuracy with color coding (convert meters to feet)
    if (els.horizAcc && horizontalAccuracy !== null) {
        const accFeet = Math.round(horizontalAccuracy * 3.28084); // meters to feet
        els.horizAcc.textContent = `±${accFeet}FT`;

        // Color code: green <164ft (50m), yellow 164-328ft (50-100m), red >328ft (100m)
        els.horizAcc.className = 'gps-horiz-acc';
        if (accFeet < 164) {
            els.horizAcc.classList.add('text-metric'); // green
        } else if (accFeet < 328) {
            els.horizAcc.classList.add('text-warning'); // yellow
        } else {
            els.horizAcc.classList.add('text-error'); // red
        }
    } else if (els.horizAcc) {
        els.horizAcc.textContent = '--';
        els.horizAcc.className = 'gps-horiz-acc text-secondary';
    }

    if (els.vertAcc && verticalAccuracy !== null) {
        const accFeet = Math.round(verticalAccuracy * 3.28084); // meters to feet
        els.vertAcc.textContent = `±${accFeet}FT`;

        // Color code: green <164ft (50m), yellow 164-328ft (50-100m), red >328ft (100m)
        els.vertAcc.className = 'gps-vert-acc';
        if (accFeet < 164) {
            els.vertAcc.classList.add('text-metric'); // green
        } else if (accFeet < 328) {
            els.vertAcc.classList.add('text-warning'); // yellow
        } else {
            els.vertAcc.classList.add('text-error'); // red
        }
    } else if (els.vertAcc) {
        els.vertAcc.textContent = '--';
        els.vertAcc.className = 'gps-vert-acc text-secondary';
    }

    // Regenerate map with current position
    if (routeData) {
        generateMap(routeData.waypoints, routeData.legs);
    }
}

// ============================================
// ZOOM CONTROL
// ============================================

function setZoomMode(mode) {
    if (['full', 'destination', 'surrounding-50', 'surrounding-25'].includes(mode)) {
        currentZoomMode = mode;
        zoomLevel = 1; // Reset zoom level when switching modes
        panOffset = { x: 0, y: 0 }; // Reset pan offset when switching modes

        // Regenerate map with new zoom
        if (routeData) {
            generateMap(routeData.waypoints, routeData.legs);
        }

        console.log(`[VectorMap] Zoom mode: ${mode}`);
    }
}

function zoomIn() {
    const newZoomLevel = Math.min(3.0, zoomLevel * 1.25);
    if (newZoomLevel !== zoomLevel) {
        zoomLevel = newZoomLevel;
        if (routeData) {
            generateMap(routeData.waypoints, routeData.legs);
        }
        console.log(`[VectorMap] Zoomed in to ${zoomLevel.toFixed(2)}x`);
    }
}

function zoomOut() {
    const newZoomLevel = Math.max(1.0, zoomLevel / 1.25);
    if (newZoomLevel !== zoomLevel) {
        zoomLevel = newZoomLevel;

        // Reset pan offset when zooming back to 1.0
        if (zoomLevel === 1.0) {
            panOffset = { x: 0, y: 0 };
        }

        if (routeData) {
            generateMap(routeData.waypoints, routeData.legs);
        }
        console.log(`[VectorMap] Zoomed out to ${zoomLevel.toFixed(2)}x`);
    }
}

// ============================================
// TOUCH HANDLERS (PAN & PINCH-TO-ZOOM)
// ============================================

function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleTouchStart(e) {
    // Don't handle touches on interactive elements
    if (e.target.classList.contains('waypoint-circle') ||
        e.target.closest('.map-waypoint') ||
        e.target.closest('.nearby-airport') ||
        e.target.closest('.nearby-navaid')) {
        return;
    }

    if (e.touches.length === 1) {
        // Single finger: start panning (only if zoomed in)
        if (zoomLevel > 1.0) {
            isPanning = true;
            touchStartPositions = [{
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            }];
            e.preventDefault();
        }
    } else if (e.touches.length === 2) {
        // Two fingers: start pinch-to-zoom
        isPanning = false;
        initialPinchDistance = getPinchDistance(e.touches);
        touchStartPositions = [
            { x: e.touches[0].clientX, y: e.touches[0].clientY },
            { x: e.touches[1].clientX, y: e.touches[1].clientY }
        ];
        e.preventDefault();
    }
}

function handleTouchMove(e) {
    if (!touchStartPositions) return;

    if (e.touches.length === 1 && isPanning && zoomLevel > 1.0) {
        // Single finger pan
        const dx = e.touches[0].clientX - touchStartPositions[0].x;
        const dy = e.touches[0].clientY - touchStartPositions[0].y;

        panOffset.x += dx;
        panOffset.y += dy;

        // Calculate pan limits - allow panning to see all zoomed content
        // At 2x zoom, allow panning by the full viewport width to explore all areas
        const maxPanX = zoomLevel * svgDimensions.width / 2;
        const maxPanY = zoomLevel * svgDimensions.height / 2;

        // Clamp pan offset
        panOffset.x = Math.max(-maxPanX, Math.min(maxPanX, panOffset.x));
        panOffset.y = Math.max(-maxPanY, Math.min(maxPanY, panOffset.y));

        // Update touch start position for next move
        touchStartPositions[0] = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };

        // Update transform without regenerating entire SVG (performance)
        const mapContent = document.getElementById('mapContent');
        if (mapContent) {
            mapContent.setAttribute('transform', `translate(${panOffset.x}, ${panOffset.y})`);
        }

        e.preventDefault();
    } else if (e.touches.length === 2 && initialPinchDistance) {
        // Two finger pinch zoom
        const currentDistance = getPinchDistance(e.touches);
        const scale = currentDistance / initialPinchDistance;

        // Calculate new zoom level, clamped between 1.0 and 3.0
        const newZoomLevel = Math.max(1.0, Math.min(3.0, zoomLevel * scale));

        if (Math.abs(newZoomLevel - zoomLevel) > 0.05) {
            zoomLevel = newZoomLevel;
            initialPinchDistance = currentDistance;

            // Reset pan offset when zooming back to 1.0
            if (zoomLevel === 1.0) {
                panOffset = { x: 0, y: 0 };
            }

            // Regenerate map with new zoom
            if (routeData) {
                generateMap(routeData.waypoints, routeData.legs);
            }
        }

        e.preventDefault();
    }
}

function handleTouchEnd(e) {
    if (e.touches.length === 0) {
        // All fingers lifted
        isPanning = false;
        touchStartPositions = null;
        initialPinchDistance = null;
    } else if (e.touches.length === 1) {
        // One finger remaining (transition from pinch to pan)
        initialPinchDistance = null;
        if (zoomLevel > 1.0) {
            isPanning = true;
            touchStartPositions = [{
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            }];
        } else {
            isPanning = false;
            touchStartPositions = null;
        }
    }
}

// ============================================
// PAN/DRAG HANDLERS
// ============================================

function handlePanStart(e) {
    // Only allow panning when zoomed in
    if (zoomLevel <= 1.0) return;

    // Don't pan if clicking on a waypoint or other interactive element
    if (e.target.classList.contains('waypoint-circle') ||
        e.target.closest('.map-waypoint') ||
        e.target.closest('.nearby-airport') ||
        e.target.closest('.nearby-navaid')) {
        return;
    }

    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    e.preventDefault();
}

function handlePanMove(e) {
    if (!isPanning || !panStart) return;

    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;

    panOffset.x += dx;
    panOffset.y += dy;

    // Calculate pan limits - allow panning to see all zoomed content
    // At 2x zoom, allow panning by the full viewport width to explore all areas
    const maxPanX = zoomLevel * svgDimensions.width / 2;
    const maxPanY = zoomLevel * svgDimensions.height / 2;

    // Clamp pan offset
    panOffset.x = Math.max(-maxPanX, Math.min(maxPanX, panOffset.x));
    panOffset.y = Math.max(-maxPanY, Math.min(maxPanY, panOffset.y));

    panStart = { x: e.clientX, y: e.clientY };

    // Update transform without regenerating entire SVG (performance optimization)
    const mapContent = document.getElementById('mapContent');
    if (mapContent) {
        mapContent.setAttribute('transform', `translate(${panOffset.x}, ${panOffset.y})`);
    }
}

function handlePanEnd(e) {
    isPanning = false;
    panStart = null;
}

// ============================================
// WINDOW RESIZE HANDLER
// ============================================

// Regenerate map when window size changes (e.g., device rotation, browser resize)
let resizeTimeout = null;
window.addEventListener('resize', () => {
    // Debounce resize events to avoid excessive regeneration
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(() => {
        if (routeData) {
            console.log('[VectorMap] Window resized, regenerating map');
            generateMap(routeData.waypoints, routeData.legs);
        }
    }, 250); // Wait 250ms after last resize event
});

// ============================================
// NAVIGATION WAYPOINT SELECTION
// ============================================

function updateNavButtonLabels() {
    if (!routeData) return;

    const prevBtn = document.getElementById('prevNavWptBtn');
    const nextBtn = document.getElementById('nextNavWptBtn');

    // If in diversion mode (currentLegIndex = -1), disable both buttons
    if (currentLegIndex === -1) {
        if (prevBtn) {
            prevBtn.textContent = '◄ PREV';
            prevBtn.disabled = true;
        }
        if (nextBtn) {
            nextBtn.textContent = 'NEXT ►';
            nextBtn.disabled = true;
        }
        return;
    }

    if (prevBtn) {
        if (currentLegIndex > 0) {
            const prevWaypoint = routeData.waypoints[currentLegIndex];
            const prevCode = window.RouteCalculator.getWaypointCode(prevWaypoint);
            prevBtn.textContent = `◄ ${prevCode}`;
            prevBtn.disabled = false;
        } else {
            prevBtn.textContent = '◄ PREV';
            prevBtn.disabled = true;
        }
    }

    if (nextBtn) {
        if (currentLegIndex < routeData.legs.length - 1) {
            const nextWaypoint = routeData.waypoints[currentLegIndex + 2]; // +2 because currentLegIndex points to current leg (from waypoint[i] to waypoint[i+1])
            const nextCode = window.RouteCalculator.getWaypointCode(nextWaypoint);
            nextBtn.textContent = `${nextCode} ►`;
            nextBtn.disabled = false;
        } else {
            nextBtn.textContent = 'NEXT ►';
            nextBtn.disabled = true;
        }
    }
}

function navigateToPrevWaypoint() {
    if (!routeData || currentLegIndex <= 0) return;

    // Clear diversion mode when navigating back to route
    diversionWaypoint = null;

    currentLegIndex--;
    if (routeData.legs[currentLegIndex]) {
        // If GPS is active, let updateLiveNavigation handle the display update
        // Otherwise, update with static leg data
        if (watchId === null) {
            updateCurrentInstruction(routeData.legs[currentLegIndex], routeData.options);
        } else {
            updateLiveNavigation();
        }
        updateNavButtonLabels();
    }
}

function navigateToNextWaypoint() {
    if (!routeData || currentLegIndex >= routeData.legs.length - 1) return;

    // Clear diversion mode when navigating forward in route
    diversionWaypoint = null;

    currentLegIndex++;
    if (routeData.legs[currentLegIndex]) {
        // If GPS is active, let updateLiveNavigation handle the display update
        // Otherwise, update with static leg data
        if (watchId === null) {
            updateCurrentInstruction(routeData.legs[currentLegIndex], routeData.options);
        } else {
            updateLiveNavigation();
        }
        updateNavButtonLabels();
    }
}

// ============================================
// EXPORTS
// ============================================

window.VectorMap = {
    displayMap,
    hideMap,
    startGPSTracking,
    stopGPSTracking,
    setZoomMode,
    zoomIn,
    zoomOut,
    navigateToPrevWaypoint,
    navigateToNextWaypoint
};
