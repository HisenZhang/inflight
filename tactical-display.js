// Tactical Display Module - GPS Navigation-style interface
// Shows current position, next waypoint, and turn-by-turn directions

let currentPosition = null;
let watchId = null;
let routeData = null;
let currentLegIndex = 0;

// ============================================
// GPS TRACKING
// ============================================

function startGPSTracking() {
    if (!navigator.geolocation) {
        console.warn('[TacticalDisplay] Geolocation not supported');
        return false;
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            currentPosition = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading,
                speed: position.coords.speed // m/s
            };
            updateLiveNavigation();
        },
        (error) => {
            console.error('[TacticalDisplay] GPS error:', error);
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

    const bearing = window.RouteCalculator.calculateBearing(
        currentPosition.lat,
        currentPosition.lon,
        nextWaypoint.lat,
        nextWaypoint.lon
    );

    // Calculate ETA based on current ground speed
    let eta = null;
    let timeRemaining = null;
    if (currentPosition.speed && currentPosition.speed > 0) {
        const speedKt = currentPosition.speed * 1.94384; // m/s to knots
        timeRemaining = (distToNext / speedKt) * 60; // minutes
        const etaMs = Date.now() + timeRemaining * 60 * 1000;
        eta = new Date(etaMs);
    }

    // Update display
    updateNavigationDisplay({
        nextWaypoint,
        distToNext,
        bearing,
        eta,
        timeRemaining,
        currentSpeed: currentPosition.speed ? currentPosition.speed * 1.94384 : null
    });
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

function displayTacticalNavigation(waypoints, legs, options = {}) {
    if (waypoints.length < 2) {
        hideTacticalDisplay();
        return;
    }

    routeData = { waypoints, legs, options };
    currentLegIndex = 0;

    showTacticalDisplay();
    generateMap(waypoints, legs);
    updateCurrentInstruction(legs[0], options);
}

function showTacticalDisplay() {
    const display = document.getElementById('tacticalDisplay');
    if (display) {
        display.style.display = 'block';
    }
}

function hideTacticalDisplay() {
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

    // Draw current position if available
    if (currentPosition) {
        const pos = project(currentPosition.lat, currentPosition.lon);
        svg += `<circle cx="${pos.x}" cy="${pos.y}" r="8" fill="#00ff00" stroke="#ffffff" stroke-width="2"/>`;
        svg += `<text x="${pos.x}" y="${pos.y - 15}" text-anchor="middle" fill="#00ff00" font-family="Roboto Mono" font-size="10" font-weight="700">YOU</text>`;
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
    const { nextWaypoint, distToNext, bearing, eta, timeRemaining, currentSpeed } = navData;

    // Update distance
    const distEl = document.querySelector('.dist-nm');
    if (distEl) {
        distEl.textContent = distToNext.toFixed(1);
    }

    // Update heading
    const reqHdgEl = document.querySelector('.req-hdg');
    if (reqHdgEl) {
        reqHdgEl.textContent = String(Math.round(bearing)).padStart(3, '0') + '°';
    }

    // Update ETA
    const etaEl = document.querySelector('.eta-time');
    if (etaEl && eta) {
        const hours = String(eta.getHours()).padStart(2, '0');
        const minutes = String(eta.getMinutes()).padStart(2, '0');
        etaEl.textContent = `${hours}:${minutes}`;
    }

    // Update ground speed
    const gsEl = document.querySelector('.gs-value');
    if (gsEl && currentSpeed) {
        gsEl.textContent = Math.round(currentSpeed);
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

window.TacticalDisplay = {
    displayTacticalNavigation,
    hideTacticalDisplay,
    toggleGPS,
    startGPSTracking,
    stopGPSTracking
};
