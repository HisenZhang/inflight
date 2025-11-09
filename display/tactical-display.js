// Vector Map Display Module - GPS moving map navigation
// Shows current position, next waypoint, and navigation data

let currentPosition = null;
let watchId = null;
let routeData = null;
let currentLegIndex = 0;
let currentZoomMode = 'full'; // 'full', 'destination', 'surrounding'
let currentPopup = null; // Track currently visible popup
let zoomLevel = 1.0; // Pinch zoom level (1.0 = default, max based on route bounds)
let initialPinchDistance = null;

// Pan/drag state
let panOffset = { x: 0, y: 0 }; // Pan offset in screen pixels
let isPanning = false;
let panStart = null;
let svgDimensions = { width: 1000, height: 500 }; // Track SVG dimensions for pan limits

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

    // Check if we've reached the next waypoint (within 0.5nm threshold)
    const nextWaypoint = waypoints[currentLegIndex + 1];
    if (!nextWaypoint) return;

    const distToNext = window.RouteCalculator.calculateDistance(
        currentPosition.lat,
        currentPosition.lon,
        nextWaypoint.lat,
        nextWaypoint.lon
    );

    // Auto-advance to next waypoint if within 0.5nm (waypoint passage)
    const waypointThreshold = 0.5; // nautical miles
    if (distToNext < waypointThreshold && currentLegIndex < legs.length - 1) {
        currentLegIndex++;
        console.log(`[VectorMap] Advanced to leg ${currentLegIndex + 1}/${legs.length}`);

        // Update instruction for new leg
        const nextLeg = legs[currentLegIndex];
        if (nextLeg) {
            updateCurrentInstruction(nextLeg, routeData.options);
        }

        // Continue processing with new leg
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

    showMap();
    generateMap(waypoints, legs);
    updateCurrentInstruction(legs[0], options);
}

function showMap() {
    const display = document.getElementById('tacticalDisplay');
    if (display) {
        display.style.display = 'block';
    }
}

function hideMap() {
    const display = document.getElementById('tacticalDisplay');
    if (display) {
        display.style.display = 'none';
    }
    stopGPSTracking();
    routeData = null;
}

function generateMap(waypoints, legs) {
    const mapContainer = document.getElementById('tacticalMap');
    if (!mapContainer) return;

    // Calculate bounds based on zoom mode
    let bounds;

    if (currentZoomMode === 'surrounding' && currentPosition) {
        // 100nm radius around current position
        const radiusNM = 100;
        const radiusDeg = radiusNM / 60; // 1 degree ≈ 60nm

        bounds = {
            minLat: currentPosition.lat - radiusDeg,
            maxLat: currentPosition.lat + radiusDeg,
            minLon: currentPosition.lon - radiusDeg / Math.cos(currentPosition.lat * Math.PI / 180),
            maxLon: currentPosition.lon + radiusDeg / Math.cos(currentPosition.lat * Math.PI / 180)
        };
    } else if (currentZoomMode === 'destination' && currentPosition && waypoints.length > 0) {
        // From current position to destination
        const destination = waypoints[waypoints.length - 1];
        const lats = [currentPosition.lat, destination.lat];
        const lons = [currentPosition.lon, destination.lon];

        // Add remaining waypoints to bounds
        for (let i = currentLegIndex + 1; i < waypoints.length; i++) {
            lats.push(waypoints[i].lat);
            lons.push(waypoints[i].lon);
        }

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        const latRange = maxLat - minLat;
        const lonRange = maxLon - minLon;
        const padding = 0.05; // Reduced from 0.15

        bounds = {
            minLat: minLat - latRange * padding,
            maxLat: maxLat + latRange * padding,
            minLon: minLon - lonRange * padding,
            maxLon: maxLon + lonRange * padding
        };
    } else {
        // Full route view (default)
        const lats = waypoints.map(w => w.lat);
        const lons = waypoints.map(w => w.lon);

        // Include current position if available
        if (currentPosition) {
            lats.push(currentPosition.lat);
            lons.push(currentPosition.lon);
        }

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        const latRange = maxLat - minLat;
        const lonRange = maxLon - minLon;
        const padding = 0.05; // Reduced from 0.15

        bounds = {
            minLat: minLat - latRange * padding,
            maxLat: maxLat + latRange * padding,
            minLon: minLon - lonRange * padding,
            maxLon: maxLon + lonRange * padding
        };
    }

    // Calculate responsive sizes based on viewport width
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 768;

    // Increase base dimensions for mobile to make everything larger
    const width = isMobile ? 1400 : 1000;
    const height = isMobile ? 700 : 500;

    // Store dimensions for pan limit calculations
    svgDimensions = { width, height };

    const waypointLabelSize = isMobile ? 16 : 12;
    const positionLabelSize = isMobile ? 18 : 12;

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

    // Scale to fit viewport with padding, apply zoom level
    const padding = 0.1;
    const scaleX = width * (1 - 2 * padding) / projRangeX;
    const scaleY = height * (1 - 2 * padding) / projRangeY;
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

    // Get nearby airports and navaids within 45nm of the route
    const nearbyPoints = window.DataManager.getPointsNearRoute(legs, 45);

    // Draw nearby airports (lower brightness, smaller, clickable)
    if (nearbyPoints && nearbyPoints.airports) {
        nearbyPoints.airports.forEach((airport, idx) => {
            // Skip if this airport is already in the route
            const isInRoute = waypoints.some(w =>
                w.waypointType === 'airport' &&
                (w.icao === airport.icao || w.icao === airport.code)
            );
            if (isInRoute) return;

            const pos = project(airport.lat, airport.lon);
            svg += `<g class="nearby-airport" data-nearby-index="${idx}">`;
            svg += `<circle cx="${pos.x}" cy="${pos.y}" r="3"
                    fill="none" stroke="#00ffff" stroke-width="1" opacity="0.3" style="cursor: pointer;"/>`;
            svg += `</g>`;
        });
    }

    // Draw nearby navaids (lower brightness, smaller, clickable)
    if (nearbyPoints && nearbyPoints.navaids) {
        nearbyPoints.navaids.forEach((navaid, idx) => {
            // Skip if this navaid is already in the route
            const isInRoute = waypoints.some(w =>
                w.waypointType === 'navaid' &&
                (w.ident === navaid.ident || w.name === navaid.name)
            );
            if (isInRoute) return;

            const pos = project(navaid.lat, navaid.lon);
            svg += `<g class="nearby-navaid" data-nearby-index="${idx}">`;
            svg += `<circle cx="${pos.x}" cy="${pos.y}" r="2"
                    fill="#ff00ff" stroke="#ff00ff" stroke-width="1" opacity="0.3" style="cursor: pointer;"/>`;
            svg += `</g>`;
        });
    }

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
        const color = isAirport ? '#00ffff' : (waypoint.waypointType === 'fix' ? '#ffffff' : '#ff00ff');

        // Priority: first/last waypoints (airports usually) > airports > navaids > fixes
        let priority = 0;
        if (index === 0 || index === waypoints.length - 1) {
            priority = 3; // Departure/destination always visible
        } else if (isAirport) {
            priority = 2;
        } else if (waypoint.waypointType === 'navaid') {
            priority = 1;
        }

        return { waypoint, index, pos, code, color, priority, labelY: pos.y - 12 };
    });

    // Label collision detection - hide labels that are too close
    const minLabelDistance = 30; // pixels
    const visibleLabels = new Set();

    // Sort by priority (higher first) to preserve important labels
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
        svg += `<g class="map-waypoint" data-index="${index}">`;
        svg += `<circle class="waypoint-circle" cx="${pos.x}" cy="${pos.y}" r="5" fill="${color}" stroke="${color}" stroke-width="2"/>`;

        if (visibleLabels.has(index)) {
            svg += `<text class="waypoint-label" x="${pos.x}" y="${labelY}" text-anchor="middle" fill="${color}" font-size="${waypointLabelSize}" font-family="Roboto Mono" font-weight="700">${code}</text>`;
        }

        svg += `</g>`;
    });

    // Draw current position if available (amber arrow)
    if (currentPosition) {
        const pos = project(currentPosition.lat, currentPosition.lon);
        const heading = currentPosition.heading || 0; // GPS heading in degrees

        // Draw amber vector arrow pointing in heading direction
        // Arrow is 20 units long, points up when heading=0
        const arrowLength = 20;
        const arrowWidth = 8;

        // Calculate arrow points (rotate based on heading)
        const headingRad = (heading - 90) * Math.PI / 180; // -90 because SVG 0° is East
        const tipX = pos.x + Math.cos(headingRad) * arrowLength;
        const tipY = pos.y + Math.sin(headingRad) * arrowLength;

        const perpRad = headingRad + Math.PI / 2;
        const base1X = pos.x + Math.cos(perpRad) * arrowWidth;
        const base1Y = pos.y + Math.sin(perpRad) * arrowWidth;
        const base2X = pos.x - Math.cos(perpRad) * arrowWidth;
        const base2Y = pos.y - Math.sin(perpRad) * arrowWidth;

        // Draw arrow as triangle
        svg += `<polygon points="${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}" fill="#ffbf00" stroke="#ffffff" stroke-width="2"/>`;
        svg += `<circle cx="${pos.x}" cy="${pos.y}" r="4" fill="#ffbf00" stroke="#ffffff" stroke-width="2"/>`;

        // Label
        const labelY = pos.y - 25;
        svg += `<text x="${pos.x}" y="${labelY}" text-anchor="middle" fill="#ffbf00" font-family="Roboto Mono" font-size="${positionLabelSize}" font-weight="700">YOU</text>`;
    }

    // Close the transform group
    svg += `</g>`;

    // Add popup container (initially hidden) - outside transform group so it doesn't pan
    svg += `<g id="waypointPopup" class="waypoint-popup" style="display: none;"></g>`;

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

        // Add pinch-to-zoom support
        svgElement.addEventListener('touchstart', handleTouchStart, { passive: true });
        svgElement.addEventListener('touchmove', handleTouchMove, { passive: true });
        svgElement.addEventListener('touchend', handleTouchEnd, { passive: true });

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
        el.addEventListener('mouseenter', () => {
            showPopup(waypoint, legs, index);
        });

        el.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent background click
            showPopup(waypoint, legs, index);
        });

        // Hide popup on mouse leave (desktop only)
        el.addEventListener('mouseleave', () => {
            // On desktop, hide after a short delay to allow moving to popup
            setTimeout(() => {
                const popup = document.getElementById('waypointPopup');
                if (popup && !popup.matches(':hover')) {
                    hidePopup();
                }
            }, 100);
        });
    });

    // Add hover/click handlers for nearby airports
    const nearbyAirportElements = mapContainer.querySelectorAll('.nearby-airport');
    nearbyAirportElements.forEach(el => {
        const index = parseInt(el.getAttribute('data-nearby-index'));
        const airport = nearbyPoints.airports[index];

        el.addEventListener('mouseenter', () => {
            showNearbyPointPopup(airport, 'airport', index);
        });

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            showNearbyPointPopup(airport, 'airport', index);
        });

        el.addEventListener('mouseleave', () => {
            setTimeout(() => {
                const popup = document.getElementById('waypointPopup');
                if (popup && !popup.matches(':hover')) {
                    hidePopup();
                }
            }, 100);
        });
    });

    // Add hover/click handlers for nearby navaids
    const nearbyNavaidElements = mapContainer.querySelectorAll('.nearby-navaid');
    nearbyNavaidElements.forEach(el => {
        const index = parseInt(el.getAttribute('data-nearby-index'));
        const navaid = nearbyPoints.navaids[index];

        el.addEventListener('mouseenter', () => {
            showNearbyPointPopup(navaid, 'navaid', index);
        });

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            showNearbyPointPopup(navaid, 'navaid', index);
        });

        el.addEventListener('mouseleave', () => {
            setTimeout(() => {
                const popup = document.getElementById('waypointPopup');
                if (popup && !popup.matches(':hover')) {
                    hidePopup();
                }
            }, 100);
        });
    });
}

function showPopup(waypoint, legs, index) {
    const popup = document.getElementById('waypointPopup');
    if (!popup) return;

    const code = window.RouteCalculator.getWaypointCode(waypoint);
    const lat = window.RouteCalculator.formatCoordinate(waypoint.lat, 'lat');
    const lon = window.RouteCalculator.formatCoordinate(waypoint.lon, 'lon');

    // Get waypoint screen position
    const waypointEl = document.querySelector(`.map-waypoint[data-index="${index}"]`);
    if (!waypointEl) return;

    const circle = waypointEl.querySelector('circle');
    if (!circle) return;

    const cx = parseFloat(circle.getAttribute('cx'));
    const cy = parseFloat(circle.getAttribute('cy'));

    // Build popup content with specific type
    let typeDisplay = waypoint.waypointType.toUpperCase();
    if (waypoint.waypointType === 'navaid' && waypoint.type) {
        typeDisplay = waypoint.type; // Show specific type like VOR, DME, VORTAC
    } else if (waypoint.waypointType === 'fix' && waypoint.type) {
        typeDisplay = waypoint.type; // Show WP, RP, etc.
    }

    let lines = [
        `${code} (${typeDisplay})`,
        `${lat} ${lon}`
    ];

    // Build elevation and magnetic variation line
    let elevMagParts = [];
    if (waypoint.elevation !== null && !isNaN(waypoint.elevation)) {
        elevMagParts.push(`ELEV ${Math.round(waypoint.elevation)}FT`);
    }
    if (waypoint.magVar !== null && waypoint.magVar !== undefined) {
        const magVarValue = Math.abs(waypoint.magVar).toFixed(1);
        const magVarDir = waypoint.magVar >= 0 ? 'E' : 'W';
        elevMagParts.push(`VAR ${magVarValue}°${magVarDir}`);
    } else {
        elevMagParts.push('VAR -');
    }
    if (elevMagParts.length > 0) {
        lines.push(elevMagParts.join(' | '));
    }

    // Show frequency for navaids
    if (waypoint.waypointType === 'navaid' && waypoint.frequency) {
        const freqFormatted = window.RouteCalculator.formatNavaidFrequency(waypoint.frequency);
        lines.push(`FREQ: ${freqFormatted}`);
    }

    // Show frequencies for airports
    if (waypoint.waypointType === 'airport') {
        const airportCode = waypoint.icao || waypoint.iata || waypoint.code || code;
        const frequencies = window.DataManager.getFrequencies(airportCode);
        if (frequencies && frequencies.length > 0) {
            const grouped = {};
            frequencies.forEach(f => {
                const type = f.type.toUpperCase();
                if (!grouped[type]) grouped[type] = [];
                grouped[type].push(f.frequency.toFixed(3));
            });
            const freqItems = Object.entries(grouped).map(([type, freqs]) =>
                `${type} ${freqs.join('/')}`
            );
            freqItems.forEach(item => lines.push(item));
        }
    }

    // Show runways for airports
    if (waypoint.waypointType === 'airport') {
        const airportCode = waypoint.icao || waypoint.iata || waypoint.code || code;
        const runways = window.DataManager.getRunways(airportCode);
        if (runways && runways.length > 0) {
            const runwayList = runways.map(r => {
                const idents = r.leIdent && r.heIdent ? `${r.leIdent}/${r.heIdent}` : (r.leIdent || r.heIdent || 'N/A');
                const length = r.length ? ` ${r.length}FT` : '';
                const surface = r.surface ? ` ${r.surface}` : '';
                return `${idents}${length}${surface}`;
            }).join(', ');
            lines.push(`RWY: ${runwayList}`);
        }
    }

    if (index < legs.length) {
        const leg = legs[index];
        lines.push(`NEXT: ${leg.distance.toFixed(1)}NM @ ${Math.round(leg.trueCourse)}°`);
    }

    // Calculate popup dimensions
    const lineHeight = 16;
    const padding = 8;
    const width = 220;
    const height = lines.length * lineHeight + padding * 2;

    // Position popup (above and to the right of waypoint)
    const popupX = cx + 15;
    const popupY = cy - height - 10;

    // Create popup SVG
    let popupSVG = `
        <rect x="${popupX}" y="${popupY}" width="${width}" height="${height}"
              fill="#1a1a1a" stroke="#00ff00" stroke-width="2" rx="4"/>
    `;

    // Add text lines
    lines.forEach((line, i) => {
        const textY = popupY + padding + (i + 1) * lineHeight - 4;
        const fontSize = i === 0 ? 12 : 10;
        const fontWeight = i === 0 ? 700 : 400;
        const fill = i === 0 ? '#00ff00' : '#ffffff';
        popupSVG += `<text x="${popupX + padding}" y="${textY}"
                          font-family="Roboto Mono" font-size="${fontSize}"
                          font-weight="${fontWeight}" fill="${fill}">${line}</text>`;
    });

    popup.innerHTML = popupSVG;
    popup.style.display = 'block';
    currentPopup = index;
}

function hidePopup() {
    const popup = document.getElementById('waypointPopup');
    if (popup) {
        popup.style.display = 'none';
        popup.innerHTML = '';
        currentPopup = null;
    }
}

function showNearbyPointPopup(point, type, elementIndex) {
    const popup = document.getElementById('waypointPopup');
    if (!popup) return;

    // Find the specific element for this nearby point using the index
    let pointEl;
    if (type === 'airport') {
        pointEl = document.querySelector(`.nearby-airport[data-nearby-index="${elementIndex}"] circle`);
    } else {
        pointEl = document.querySelector(`.nearby-navaid[data-nearby-index="${elementIndex}"] circle`);
    }
    if (!pointEl) return;

    const cx = parseFloat(pointEl.getAttribute('cx'));
    const cy = parseFloat(pointEl.getAttribute('cy'));

    // Build popup content for nearby point with specific type
    const code = point.code || point.ident;
    const lat = window.RouteCalculator.formatCoordinate(point.lat, 'lat');
    const lon = window.RouteCalculator.formatCoordinate(point.lon, 'lon');

    // Get specific type
    let typeDisplay = type.toUpperCase();
    if (type === 'navaid' && point.type) {
        typeDisplay = point.type; // Show VOR, DME, VORTAC, etc.
    } else if (type === 'airport' && point.type) {
        typeDisplay = point.type.replace(/_/g, ' ').toUpperCase(); // Show LARGE_AIRPORT, etc.
    }

    let lines = [
        `${code} (${typeDisplay})`,
        `${lat} ${lon}`
    ];

    if (point.name) {
        lines.push(`${point.name}`);
    }

    // Build elevation and magnetic variation line
    let elevMagParts = [];
    if (point.elevation !== null && !isNaN(point.elevation)) {
        elevMagParts.push(`ELEV ${Math.round(point.elevation)}FT`);
    }
    if (point.magVar !== null && point.magVar !== undefined) {
        const magVarValue = Math.abs(point.magVar).toFixed(1);
        const magVarDir = point.magVar >= 0 ? 'E' : 'W';
        elevMagParts.push(`VAR ${magVarValue}°${magVarDir}`);
    } else {
        elevMagParts.push('VAR -');
    }
    if (elevMagParts.length > 0) {
        lines.push(elevMagParts.join(' | '));
    }

    // Add frequency info for navaids with proper formatting
    if (type === 'navaid' && point.frequency) {
        const freqFormatted = window.RouteCalculator.formatNavaidFrequency(point.frequency);
        lines.push(`FREQ: ${freqFormatted}`);
    }

    // Show frequencies for airports
    if (type === 'airport') {
        const airportCode = point.icao || point.iata || point.code || code;
        const frequencies = window.DataManager.getFrequencies(airportCode);
        if (frequencies && frequencies.length > 0) {
            const grouped = {};
            frequencies.forEach(f => {
                const type = f.type.toUpperCase();
                if (!grouped[type]) grouped[type] = [];
                grouped[type].push(f.frequency.toFixed(3));
            });
            const freqItems = Object.entries(grouped).map(([type, freqs]) =>
                `${type} ${freqs.join('/')}`
            );
            freqItems.forEach(item => lines.push(item));
        }
    }

    // Show runways for airports
    if (type === 'airport') {
        const airportCode = point.icao || point.iata || point.code || code;
        const runways = window.DataManager.getRunways(airportCode);
        if (runways && runways.length > 0) {
            const runwayList = runways.map(r => {
                const idents = r.leIdent && r.heIdent ? `${r.leIdent}/${r.heIdent}` : (r.leIdent || r.heIdent || 'N/A');
                const length = r.length ? ` ${r.length}FT` : '';
                const surface = r.surface ? ` ${r.surface}` : '';
                return `${idents}${length}${surface}`;
            }).join(', ');
            lines.push(`RWY: ${runwayList}`);
        }
    }

    lines.push(`[NEARBY - NOT IN ROUTE]`);

    // Calculate popup dimensions
    const lineHeight = 16;
    const padding = 8;
    const width = 220;
    const height = lines.length * lineHeight + padding * 2;

    // Position popup (above and to the right of point)
    const popupX = cx + 15;
    const popupY = cy - height - 10;

    // Create popup SVG
    let popupSVG = `
        <rect x="${popupX}" y="${popupY}" width="${width}" height="${height}"
              fill="#1a1a1a" stroke="#00ff00" stroke-width="2" rx="4"/>
    `;

    // Add text lines
    lines.forEach((line, i) => {
        const textY = popupY + padding + (i + 1) * lineHeight - 4;
        const fontSize = i === 0 ? 12 : 10;
        const fontWeight = i === 0 ? 700 : 400;
        const fill = i === 0 ? '#00ff00' : (i === lines.length - 1 ? '#ffbf00' : '#ffffff');
        popupSVG += `<text x="${popupX + padding}" y="${textY}"
                          font-family="Roboto Mono" font-size="${fontSize}"
                          font-weight="${fontWeight}" fill="${fill}">${line}</text>`;
    });

    popup.innerHTML = popupSVG;
    popup.style.display = 'block';
    currentPopup = `nearby_${type}_${code}`;
}

function updateCurrentInstruction(firstLeg, options) {
    const toCode = window.RouteCalculator.getWaypointCode(firstLeg.to);

    const instructionEl = document.querySelector('.instruction-text');
    if (instructionEl) {
        instructionEl.textContent = `PROCEED DIRECT TO ${toCode}`;
    }

    const nextWpEl = document.querySelector('.next-wp');
    if (nextWpEl) {
        nextWpEl.textContent = toCode;
    }

    const heading = firstLeg.magHeading !== null ? Math.round(firstLeg.magHeading) : Math.round(firstLeg.trueCourse);
    const reqHdgEl = document.querySelector('.req-hdg');
    if (reqHdgEl) {
        reqHdgEl.textContent = String(heading).padStart(3, '0') + '°';
    }

    const distEl = document.querySelector('.dist-nm');
    if (distEl) {
        distEl.textContent = firstLeg.distance.toFixed(1);
    }

    // ETA
    const etaEl = document.querySelector('.eta-time');
    if (etaEl) {
        if (firstLeg.legTime !== undefined) {
            const now = new Date();
            const etaMs = now.getTime() + firstLeg.legTime * 60 * 1000;
            const eta = new Date(etaMs);
            const hours = String(eta.getHours()).padStart(2, '0');
            const minutes = String(eta.getMinutes()).padStart(2, '0');
            etaEl.textContent = `${hours}:${minutes}`;
        } else {
            etaEl.textContent = '--:--';
        }
    }

    // Ground speed
    const gsEl = document.querySelector('.gs-value');
    if (gsEl) {
        if (firstLeg.groundSpeed !== undefined) {
            gsEl.textContent = Math.round(firstLeg.groundSpeed);
        } else {
            gsEl.textContent = '--';
        }
    }
}

function updateNavigationDisplay(navData) {
    const { nextWaypoint, distToNext, magHeading, eteNextWP, etaNextWP, etaDestination,
            gpsGroundSpeed, horizontalAccuracy, verticalAccuracy } = navData;

    // Update distance to next waypoint
    const distEl = document.querySelector('.dist-nm');
    if (distEl) {
        distEl.textContent = distToNext.toFixed(1);
    }

    // Update magnetic heading
    const reqHdgEl = document.querySelector('.req-hdg');
    if (reqHdgEl) {
        if (magHeading !== null) {
            reqHdgEl.textContent = String(Math.round(magHeading)).padStart(3, '0') + '°';
        } else {
            reqHdgEl.textContent = '---°';
        }
    }

    // Update ETE to next waypoint
    const eteEl = document.querySelector('.ete-value');
    if (eteEl && eteNextWP !== null) {
        const hours = Math.floor(eteNextWP / 60);
        const minutes = Math.round(eteNextWP % 60);
        eteEl.textContent = hours > 0 ? `${hours}H${minutes}M` : `${minutes}M`;
    } else if (eteEl) {
        eteEl.textContent = '--';
    }

    // Update ETA to next waypoint
    const etaEl = document.querySelector('.eta-time');
    if (etaEl && etaNextWP) {
        const hours = String(etaNextWP.getHours()).padStart(2, '0');
        const minutes = String(etaNextWP.getMinutes()).padStart(2, '0');
        etaEl.textContent = `${hours}:${minutes}`;
    } else if (etaEl) {
        etaEl.textContent = '--:--';
    }

    // Update ETA to destination
    const etaDestEl = document.querySelector('.eta-dest-value');
    if (etaDestEl && etaDestination) {
        const hours = String(etaDestination.getHours()).padStart(2, '0');
        const minutes = String(etaDestination.getMinutes()).padStart(2, '0');
        etaDestEl.textContent = `${hours}:${minutes}`;
    } else if (etaDestEl) {
        etaDestEl.textContent = '--:--';
    }

    // Update GPS ground speed
    const gsEl = document.querySelector('.gs-value');
    if (gsEl && gpsGroundSpeed !== null) {
        gsEl.textContent = Math.round(gpsGroundSpeed);
    } else if (gsEl) {
        gsEl.textContent = '--';
    }

    // Update GPS accuracy with color coding (convert meters to feet)
    const horizAccEl = document.querySelector('.gps-horiz-acc');
    if (horizAccEl && horizontalAccuracy !== null) {
        const accFeet = Math.round(horizontalAccuracy * 3.28084); // meters to feet
        horizAccEl.textContent = `±${accFeet}FT`;

        // Color code: green <164ft (50m), yellow 164-328ft (50-100m), red >328ft (100m)
        horizAccEl.className = 'gps-horiz-acc';
        if (accFeet < 164) {
            horizAccEl.classList.add('text-metric'); // green
        } else if (accFeet < 328) {
            horizAccEl.classList.add('text-warning'); // yellow
        } else {
            horizAccEl.classList.add('text-error'); // red
        }
    } else if (horizAccEl) {
        horizAccEl.textContent = '--';
        horizAccEl.className = 'gps-horiz-acc text-secondary';
    }

    const vertAccEl = document.querySelector('.gps-vert-acc');
    if (vertAccEl && verticalAccuracy !== null) {
        const accFeet = Math.round(verticalAccuracy * 3.28084); // meters to feet
        vertAccEl.textContent = `±${accFeet}FT`;

        // Color code: green <164ft (50m), yellow 164-328ft (50-100m), red >328ft (100m)
        vertAccEl.className = 'gps-vert-acc';
        if (accFeet < 164) {
            vertAccEl.classList.add('text-metric'); // green
        } else if (accFeet < 328) {
            vertAccEl.classList.add('text-warning'); // yellow
        } else {
            vertAccEl.classList.add('text-error'); // red
        }
    } else if (vertAccEl) {
        vertAccEl.textContent = '--';
        vertAccEl.className = 'gps-vert-acc text-secondary';
    }

    // Regenerate map with current position
    if (routeData) {
        generateMap(routeData.waypoints, routeData.legs);
    }
}

function toggleGPS() {
    const btn = document.getElementById('toggleGPSBtn');
    if (!btn) return;

    if (watchId === null) {
        const started = startGPSTracking();
        if (started) {
            btn.textContent = 'STOP GPS TRACKING';
            btn.classList.add('active');
        } else {
            alert('GPS NOT AVAILABLE\n\nYour device does not support geolocation or permission was denied.');
        }
    } else {
        stopGPSTracking();
        btn.textContent = 'START GPS TRACKING';
        btn.classList.remove('active');

        // Regenerate map without position marker
        if (routeData) {
            generateMap(routeData.waypoints, routeData.legs);
        }
    }
}

// ============================================
// ZOOM CONTROL
// ============================================

function setZoomMode(mode) {
    if (['full', 'destination', 'surrounding'].includes(mode)) {
        currentZoomMode = mode;
        zoomLevel = 1.0; // Reset zoom level when switching modes
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
// PINCH-TO-ZOOM HANDLERS
// ============================================

function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleTouchStart(e) {
    if (e.touches.length === 2) {
        initialPinchDistance = getPinchDistance(e.touches);
    }
}

function handleTouchMove(e) {
    if (e.touches.length === 2 && initialPinchDistance) {
        const currentDistance = getPinchDistance(e.touches);
        const scale = currentDistance / initialPinchDistance;

        // Calculate new zoom level, clamped between 1.0 (route bounds) and 3.0 (max zoom in)
        const newZoomLevel = Math.max(1.0, Math.min(3.0, zoomLevel * scale));

        if (Math.abs(newZoomLevel - zoomLevel) > 0.05) {
            zoomLevel = newZoomLevel;
            initialPinchDistance = currentDistance;

            // Regenerate map with new zoom
            if (routeData) {
                generateMap(routeData.waypoints, routeData.legs);
            }
        }
    }
}

function handleTouchEnd(e) {
    if (e.touches.length < 2) {
        initialPinchDistance = null;
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

    // Calculate pan limits: when zoomed in, we can pan but must keep some content visible
    // Allow panning up to (zoomLevel - 1) * viewport dimension / 2
    // This ensures content stays within reasonable bounds
    const maxPanX = (zoomLevel - 1) * svgDimensions.width / 2;
    const maxPanY = (zoomLevel - 1) * svgDimensions.height / 2;

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
// EXPORTS
// ============================================

window.VectorMap = {
    displayMap,
    hideMap,
    toggleGPS,
    startGPSTracking,
    stopGPSTracking,
    setZoomMode,
    zoomIn,
    zoomOut
};
