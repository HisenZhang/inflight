# Navlog, Map, and UI

## Navlog Display

**Module:** [display/ui-controller.js](../../display/ui-controller.js)

### Navlog Table Rendering

The navlog displays calculated route legs in a tabular format.

**Implementation:** [ui-controller.js:450-650](../../display/ui-controller.js#L450-L650)

```javascript
function displayNavlog(legs, options) {
    const tbody = document.getElementById('navlogTableBody');
    tbody.innerHTML = '';

    let cumulativeDistance = 0;
    let cumulativeTime = 0;
    let cumulativeFuel = 0;

    legs.forEach((leg, index) => {
        cumulativeDistance += leg.distance;
        cumulativeTime += leg.time;
        cumulativeFuel += leg.fuel;

        const row = createNavlogRow(leg, index, {
            cumDistance: cumulativeDistance,
            cumTime: cumulativeTime,
            cumFuel: cumulativeFuel
        });

        tbody.appendChild(row);
    });
}
```

### Navlog Columns

| Column | Data | Format | Source |
|--------|------|--------|--------|
| # | Leg number | Integer | Index |
| From | Departure waypoint | ICAO/Ident | leg.from.ident |
| To | Arrival waypoint | ICAO/Ident | leg.to.ident |
| Distance | Leg distance | NM | leg.distance |
| Bearing | True course | °T | leg.bearing |
| Mag Heading | Magnetic heading | °M | leg.heading |
| Ground Speed | Speed over ground | KT | leg.groundSpeed |
| Time | Leg time | HH:MM | leg.time (minutes) |
| Fuel | Leg fuel burn | GAL | leg.fuel |
| Cum Dist | Cumulative distance | NM | Sum of leg.distance |
| Cum Time | Cumulative time | HH:MM | Sum of leg.time |
| Cum Fuel | Cumulative fuel | GAL | Sum of leg.fuel |

### Formatting Functions

**Module:** [utils/formatters.js](../../utils/formatters.js)

```javascript
// Time formatting: 81.5 minutes → "01:22"
function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Distance formatting: 123.456 → "123.5 NM"
function formatDistance(nm) {
    return `${nm.toFixed(1)} NM`;
}

// Bearing formatting: 45.678 → "046°"
function formatBearing(degrees) {
    return `${Math.round(degrees).toString().padStart(3, '0')}°`;
}

// Frequency formatting: 118.025 → "118.02"
function formatFrequency(mhz) {
    return mhz.toFixed(2);
}
```

### Export Functions

**CSV Export:** [ui-controller.js:850-920](../../display/ui-controller.js#L850-L920)

```javascript
function exportNavlogCSV(legs) {
    const headers = ['Leg', 'From', 'To', 'Distance (NM)', 'Bearing', 'Heading', 'GS (KT)', 'Time', 'Fuel'];
    const rows = legs.map((leg, i) => [
        i + 1,
        leg.from.ident,
        leg.to.ident,
        leg.distance.toFixed(1),
        formatBearing(leg.bearing),
        formatBearing(leg.heading),
        Math.round(leg.groundSpeed),
        formatTime(leg.time),
        leg.fuel.toFixed(1)
    ]);

    const csv = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

    downloadFile('navlog.csv', csv, 'text/csv');
}
```

## Map Display

**Module:** [display/map-display.js](../../display/map-display.js)

### SVG Vector Map

IN-FLIGHT renders the route as an SVG vector map with the following features:

- **Orthographic projection** (see Architecture doc for details)
- **Responsive sizing** (adapts to route orientation)
- **Pan and zoom** (touch and mouse support)
- **GPS tracking** (live position with heading arrow)

### Map Generation

**Implementation:** [map-display.js:350-673](../../display/map-display.js#L350-L673)

```javascript
function generateMap(waypoints, legs) {
    // 1. Calculate bounds
    const bounds = calculateBounds(waypoints, currentPosition, currentZoomMode);

    // 2. Calculate aspect ratio
    const routeAspectRatio = calculateAspectRatio(bounds);

    // 3. Determine SVG dimensions
    const { width, height } = determineSVGDimensions(routeAspectRatio);

    // 4. Create projection
    const project = createOrthographicProjection(bounds, width, height, zoomLevel);

    // 5. Generate SVG elements
    let svg = `<svg viewBox="0 0 ${width} ${height}">`;
    svg += `<g id="mapContent" transform="translate(${panOffset.x}, ${panOffset.y})">`;

    // 6. Draw route legs
    svg += drawLegs(legs, project);

    // 7. Draw waypoints
    svg += drawWaypoints(waypoints, project);

    // 8. Draw GPS position
    if (currentPosition) {
        svg += drawGPSArrow(currentPosition, project);
    }

    svg += `</g></svg>`;

    // 9. Render to DOM
    document.getElementById('mapDisplay').innerHTML = svg;
}
```

### Map Layers

Rendered in this order (bottom to top):

1. **Background grid** (lat/lon lines)
2. **Route legs** (blue lines connecting waypoints)
3. **Waypoints** (circles with labels)
4. **Nearby points** (navaids, fixes within 25nm - gray)
5. **GPS arrow** (yellow triangle pointing heading direction)

### GPS Arrow

**Implementation:** [map-display.js:620-640](../../display/map-display.js#L620-L640)

```javascript
function drawGPSArrow(position, project) {
    const { x, y } = project(position.lat, position.lon);
    const heading = position.heading || 0;

    // Triangle pointing in heading direction
    return `
        <g transform="translate(${x}, ${y}) rotate(${heading - 90})">
            <polygon
                points="0,-15 10,15 0,10 -10,15"
                fill="#FFD700"
                stroke="#000"
                stroke-width="2"
            />
            <circle cx="0" cy="0" r="20" fill="none" stroke="#FFD700" stroke-width="2" />
        </g>
    `;
}
```

### Zoom Modes

**Implementation:** [map-display.js:354-416](../../display/map-display.js#L354-L416)

Three zoom modes available:

1. **Full Route** (default): Shows entire route with 5% padding
2. **Surrounding 50/25nm**: Circular region around GPS position
3. **To Destination**: Shows GPS position and destination only

```javascript
function calculateBounds(waypoints, currentPosition, zoomMode) {
    if (zoomMode === 'full') {
        // Calculate bounds from all waypoints
        return calculateRouteBounds(waypoints);
    }
    else if (zoomMode === 'surrounding-50' || zoomMode === 'surrounding-25') {
        // Circular bounds around current position
        const radiusNM = (zoomMode === 'surrounding-25') ? 25 : 50;
        return calculateCircularBounds(currentPosition, radiusNM);
    }
    else if (zoomMode === 'to-destination') {
        // Bounds from current position to destination
        return calculateDestinationBounds(currentPosition, waypoints[waypoints.length - 1]);
    }
}
```

## User Interface Components

### Tab Navigation

**Implementation:** [display/app.js:250-310](../../display/app.js#L250-L310)

```javascript
function setupTabNavigation() {
    const tabs = document.querySelectorAll('[data-tab]');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            showTab(tabName);
        });
    });
}

function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // Show selected tab
    document.getElementById(`${tabName}Tab`).style.display = 'block';

    // Update active tab styling
    document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Start/stop GPS tracking based on MAP tab visibility
    if (tabName === 'MAP') {
        MapDisplay.startGPSTracking();
    } else {
        MapDisplay.stopGPSTracking();
    }
}
```

### Auto-complete

**Implementation:** [display/ui-controller.js:125-220](../../display/ui-controller.js#L125-L220)

```javascript
function setupAutocomplete(inputElement, resultLimit = 10) {
    inputElement.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();

        if (query.length < 2) {
            hideAutocomplete();
            return;
        }

        const results = QueryEngine.searchWaypoints(query, resultLimit);
        displayAutocompleteResults(results);
    });
}

function displayAutocompleteResults(results) {
    const dropdown = document.getElementById('autocompleteDropdown');
    dropdown.innerHTML = '';

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = `${result.ident} - ${result.name} (${result.type})`;

        item.addEventListener('click', () => {
            inputElement.value = result.ident;
            hideAutocomplete();
        });

        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}
```

### Status Messages

**Implementation:** [display/ui-controller.js:950-985](../../display/ui-controller.js#L950-L985)

```javascript
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');

    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;  // info, warning, error, success
    statusEl.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}

// Usage examples:
showStatus('Route calculated successfully', 'success');
showStatus('Database loaded', 'info');
showStatus('Waypoint not found', 'error');
showStatus('Database cache expired', 'warning');
```

### Progressive Web App (PWA)

**Service Worker:** [service-worker.js](../../service-worker.js)

```javascript
const CACHE_NAME = 'flight-planning-v48';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles/base.css',
    './styles/components.css',
    // ... all JS/CSS files
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
```

**Manifest:** [manifest.json](../../manifest.json)

```json
{
    "name": "IN-FLIGHT - Flight Planning",
    "short_name": "IN-FLIGHT",
    "start_url": "./",
    "display": "standalone",
    "background_color": "#1a1a1a",
    "theme_color": "#00D9FF",
    "icons": [
        {
            "src": "icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
}
```

## Responsive Design

### CSS Grid Layout

**Implementation:** [styles/components.css:150-250](../../styles/components.css#L150-L250)

```css
.tab-container {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
}

/* Desktop: Side-by-side layout */
@media (min-width: 768px) {
    .route-input-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }
}

/* Mobile: Stacked layout */
@media (max-width: 767px) {
    .route-input-container {
        display: block;
    }

    .navlog-table {
        font-size: 0.85rem;  /* Smaller on mobile */
    }
}
```

### Touch Support

**Implementation:** [map-display.js:1090-1260](../../display/map-display.js#L1090-L1260)

```javascript
// Pinch-to-zoom
mapElement.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        const currentDistance = getPinchDistance(e.touches);
        const scale = currentDistance / initialPinchDistance;
        zoomLevel = Math.max(1.0, Math.min(3.0, zoomLevel * scale));
        regenerateMap();
    }
});

// Pan with single finger
mapElement.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isPanning) {
        const touch = e.touches[0];
        panOffset.x += touch.clientX - panStart.x;
        panOffset.y += touch.clientY - panStart.y;
        updateMapTransform();
    }
});
```

## Weather Controller

**Module:** [display/weather-controller.js](../../display/weather-controller.js)

### Overview

The WeatherController fetches and displays aviation weather data from NOAA's Aviation Weather Center. It provides METAR, TAF, SIGMET, and G-AIRMET information for airports.

### Key Methods

```javascript
window.WeatherController = {
    // Search for weather by airport code
    searchWeather(code),

    // Called from navlog WX button
    showWeatherForAirport(icao),

    // Update route airports quick-select bar
    updateRouteAirports(airports),

    // Internal: fetch and display weather products
    _fetchWeather(code),
    _renderMETAR(metar),
    _renderTAF(taf),
    _renderSIGMETs(sigmets, lat, lon),
    _renderGAIRMETs(gairmets, lat, lon)
};
```

### Route Integration

When a route is calculated, `app.js` calls `WeatherController.updateRouteAirports()` with the route's airport waypoints. This populates the quick-select bar in the WX tab:

```javascript
// In app.js after route calculation
const routeAirports = waypoints
    .filter(w => w.waypointType === 'airport')
    .map(w => ({ icao: w.icao || w.ident }));

WeatherController.updateRouteAirports(routeAirports);
```

### Location-Based Filtering

SIGMETs and G-AIRMETs are filtered to show only hazards relevant to the queried airport using pure functions from `compute/weather.js`:

```javascript
// In compute/weather.js - Pure functions
Weather.pointInPolygon(lat, lon, polygon);    // Ray casting algorithm
Weather.haversineDistance(lat1, lon1, lat2, lon2); // Distance in NM
Weather.isHazardRelevantToPoint(hazard, lat, lon, radiusNm);
Weather.isHazardRelevantToRoute(hazard, waypoints, corridorNm);
Weather.findAffectedWaypointsWithIndex(hazard, waypoints, corridorNm);
Weather.formatAffectedWaypointsRange(affectedWaypoints);
```

### Time-Based Filtering

Hazards are filtered based on ETA at each waypoint (v3.1.0+):

```javascript
// Calculate ETA for each waypoint
const waypointETAs = Weather.calculateWaypointETAs(legs, departureTime);

// Check if hazard valid when aircraft arrives
Weather.isWeatherValidAtTime(hazard, waypointETA, 'sigmet'); // or 'gairmet'

// Get time range for affected waypoints
Weather.calculateAffectedTimeRange(affectedWaypoints, waypointETAs, departureTime);
```

### Validity-Based Caching

Weather data uses validity-based caching (v3.1.0+):

- **METAR**: Cached until 5 minutes past the next hour after observation
- **TAF**: Cached until `validTimeTo` timestamp
- **PIREP**: Cached for 10 minutes (bulk fetch interval)

### Offline Behavior

Weather features require internet. The controller checks `UIController.isOnline()` before fetching:

```javascript
if (!window.UIController?.isOnline?.()) {
    this._showError('Internet connection required for weather data');
    return;
}
```

## Charts Controller

**Module:** [display/charts-controller.js](../../display/charts-controller.js)

### Overview

The ChartsController provides links to FAA airport charts and procedures via the FAA's digital Terminal Procedures Publication (d-TPP).

### Key Methods

```javascript
window.ChartsController = {
    // Search for charts by airport code
    searchCharts(code),

    // Called from navlog CHARTS button
    showChartsForAirport(icao, name),

    // Update route airports quick-select bar
    updateRouteAirports(airports),

    // Check if airport has charts
    hasChartsForAirport(icao)
};
```

### Route Integration

Similar to WeatherController, the ChartsController updates its quick-select bar when a route is calculated:

```javascript
// In app.js after route calculation
ChartsController.updateRouteAirports(routeAirports);
```

The charts bar only shows airports that have available charts (verified via `hasChartsForAirport()`).

### Navlog Integration

The navlog displays a CHARTS button only for airports with available charts:

```javascript
// In ui-controller.js navlog rendering
if (waypoint.waypointType === 'airport') {
    const hasCharts = ChartsController.hasChartsForAirport(icao);
    if (hasCharts) {
        airportActionsHTML += `<button class="btn btn-secondary btn-sm"
            onclick="ChartsController.showChartsForAirport('${icao}', '${name}')">
            CHARTS
        </button>`;
    }
}
```

### Offline Behavior

Charts require internet for both searching and viewing PDF links. The controller disables search when offline.

---

**Last Updated:** November 2025
