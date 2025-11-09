// Vector Map Display Module - GPS moving map navigation
// Shows current position, next waypoint, and navigation data

let currentPosition = null;
let watchId = null;
let routeData = null;
let currentLegIndex = 0;

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

    // Calculate distance to next waypoint
    const nextWaypoint = waypoints[currentLegIndex + 1];
    if (!nextWaypoint) return;

    const distToNext = window.RouteCalculator.calculateDistance(
        currentPosition.lat,
        currentPosition.lon,
        nextWaypoint.lat,
        nextWaypoint.lon
    );

    // True bearing to next waypoint
    const trueBearing = window.RouteCalculator.calculateBearing(
        currentPosition.lat,
        currentPosition.lon,
        nextWaypoint.lat,
        nextWaypoint.lon
    );

    // Convert to magnetic heading
    const magVariation = window.RouteCalculator.getMagneticVariation(
        currentPosition.lat,
        currentPosition.lon
    );
    const magHeading = (trueBearing - magVariation + 360) % 360;

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

    // Calculate bounds
    const lats = waypoints.map(w => w.lat);
    const lons = waypoints.map(w => w.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;
    const padding = 0.15;

    const bounds = {
        minLat: minLat - latRange * padding,
        maxLat: maxLat + latRange * padding,
        minLon: minLon - lonRange * padding,
        maxLon: maxLon + lonRange * padding
    };

    const width = 1000;
    const height = 500;

    const project = (lat, lon) => {
        const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
        const y = height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
        return { x, y };
    };

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Draw route lines
    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const from = project(leg.from.lat, leg.from.lon);
        const to = project(leg.to.lat, leg.to.lon);

        svg += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="route-line"/>`;
    }

    // Draw waypoints
    waypoints.forEach((waypoint, index) => {
        const pos = project(waypoint.lat, waypoint.lon);
        const code = window.RouteCalculator.getWaypointCode(waypoint);
        const isAirport = waypoint.waypointType === 'airport';
        const color = isAirport ? '#00ffff' : (waypoint.waypointType === 'fix' ? '#ffffff' : '#ff00ff');

        svg += `<g class="map-waypoint" data-index="${index}">`;
        svg += `<circle class="waypoint-circle" cx="${pos.x}" cy="${pos.y}" r="5" fill="${color}" stroke="${color}" stroke-width="2"/>`;
        const labelY = pos.y - 12;
        svg += `<text class="waypoint-label" x="${pos.x}" y="${labelY}" text-anchor="middle" fill="${color}">${code}</text>`;
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
        svg += `<text x="${pos.x}" y="${labelY}" text-anchor="middle" fill="#ffbf00" font-family="Roboto Mono" font-size="12" font-weight="700">YOU</text>`;
    }

    svg += `</svg>`;
    mapContainer.innerHTML = svg;

    // Add click handlers
    const waypointElements = mapContainer.querySelectorAll('.map-waypoint');
    waypointElements.forEach(el => {
        el.addEventListener('click', () => {
            const index = parseInt(el.getAttribute('data-index'));
            showPointInfo(waypoints[index], legs, index);
        });
    });
}

function showPointInfo(waypoint, legs, index) {
    const code = window.RouteCalculator.getWaypointCode(waypoint);
    const pos = `${window.RouteCalculator.formatCoordinate(waypoint.lat, 'lat')} ${window.RouteCalculator.formatCoordinate(waypoint.lon, 'lon')}`;

    let infoHTML = `
        <div class="info-row">
            <span class="info-label">IDENTIFIER:</span>
            <span class="info-value">${code}</span>
        </div>
        <div class="info-row">
            <span class="info-label">TYPE:</span>
            <span class="info-value">${waypoint.waypointType.toUpperCase()}</span>
        </div>
        <div class="info-row">
            <span class="info-label">POSITION:</span>
            <span class="info-value">${pos}</span>
        </div>
    `;

    if (waypoint.elevation !== null && !isNaN(waypoint.elevation)) {
        infoHTML += `
            <div class="info-row">
                <span class="info-label">ELEVATION:</span>
                <span class="info-value">${Math.round(waypoint.elevation)} FT</span>
            </div>
        `;
    }

    if (index < legs.length) {
        const leg = legs[index];
        infoHTML += `
            <div class="info-row">
                <span class="info-label">NEXT LEG:</span>
                <span class="info-value">${leg.distance.toFixed(1)} NM @ ${Math.round(leg.trueCourse)}°</span>
            </div>
        `;
    }

    const placeholder = document.querySelector('.info-placeholder');
    const content = document.querySelector('.info-content');
    if (placeholder && content) {
        placeholder.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = infoHTML;
    }
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
        reqHdgEl.textContent = String(Math.round(magHeading)).padStart(3, '0') + '°';
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

    // Update GPS accuracy with color coding
    const horizAccEl = document.querySelector('.gps-horiz-acc');
    if (horizAccEl && horizontalAccuracy !== null) {
        const accMeters = Math.round(horizontalAccuracy);
        horizAccEl.textContent = `${accMeters}M`;

        // Color code: green <50m, yellow 50-100m, red >100m
        horizAccEl.className = 'gps-horiz-acc';
        if (accMeters < 50) {
            horizAccEl.classList.add('text-metric'); // green
        } else if (accMeters < 100) {
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
        const accMeters = Math.round(verticalAccuracy);
        vertAccEl.textContent = `${accMeters}M`;

        // Color code: green <50m, yellow 50-100m, red >100m
        vertAccEl.className = 'gps-vert-acc';
        if (accMeters < 50) {
            vertAccEl.classList.add('text-metric'); // green
        } else if (accMeters < 100) {
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
// EXPORTS
// ============================================

window.VectorMap = {
    displayMap,
    hideMap,
    toggleGPS,
    startGPSTracking,
    stopGPSTracking
};
