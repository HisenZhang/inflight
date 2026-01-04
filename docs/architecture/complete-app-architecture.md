# IN-FLIGHT Complete Application Architecture
## Building the Entire App on Clean Abstractions

**Vision:** Every piece of the app built on composable, testable, validated domain objects.

---

## 1. Foundation Layer: Domain Models

### Core Value Objects (Immutable)
```javascript
// data/models/geo-point.js
class GeoPoint {
    constructor(lat, lon) { /* immutable position */ }
    distanceTo(other) { /* pure function */ }
    bearingTo(other) { /* pure function */ }
}

// data/models/waypoint.js
class Waypoint {
    constructor(ident, position, metadata) {
        this._position = position; // HAS-A GeoPoint
        this._facility = metadata.facility; // HAS-A Facility (optional)
    }

    get isAirport() { return this._facility instanceof AirportFacility; }
    get displayName() { return this.isAirport ? this._facility.icao : this._ident; }
    distanceTo(other) { return this._position.distanceTo(other.position); }
}

// data/models/route-leg.js
class RouteLeg {
    constructor(from, to, options) {
        this._from = from; // Waypoint
        this._to = to;     // Waypoint
        this._calculate(options); // Immutable after construction
        Object.freeze(this);
    }

    isValid() { return this._distance > 0 && !isNaN(this._trueCourse); }
}

// data/models/flight-plan.js
class FlightPlan {
    constructor(waypoints, options) {
        this._waypoints = waypoints;
        this._legs = this._calculateLegs(options);
        this.validate(); // Enforces invariants
    }

    validate() {
        // Ensures: legs.length === waypoints.length - 1
        // Ensures: departure === waypoints[0]
        // Ensures: all legs are valid
    }

    withWind(windData) {
        return new FlightPlan(this._waypoints, { ...options, wind: windData });
    }
}
```

### Time-Sensitive Data (Auto-Refreshing)
```javascript
// data/models/time-sensitive-data.js
class TimeSensitiveData {
    async getData() {
        if (this.isStale()) await this.refresh();
        return this._data;
    }
}

// data/models/weather-data.js
class WeatherData extends TimeSensitiveData {
    constructor(metar, station) {
        super(Weather.parseMETAR(metar), {
            validUntil: timestamp + 3600000, // 1 hour
            staleAfter: 1800000 // 30 minutes
        });
    }

    get flightCategory() { return this._data.flightCategory; }
    async _doRefresh() { return WeatherAPI.getMETAR(this._station); }
}
```

---

## 2. Data Layer: Repository Pattern

### Unified Data Access
```javascript
// data/repository.js
class DataRepository {
    constructor() {
        this._sources = new Map();
        this._cache = new Map(); // L1: Memory cache
        this._persistent = new Map(); // L2: IndexedDB cache
    }

    // Generic query - returns domain objects
    async query(sourceName, params) {
        const data = await this._getFromCache(sourceName, params);

        // Convert plain objects → domain objects
        if (sourceName === 'airports') {
            return data.map(obj => Waypoint.fromPlainObject(obj));
        }

        return data;
    }

    // Specialized queries return typed objects
    async getAirport(icao) {
        const data = await this.query('airports', { icao });
        return data ? Waypoint.fromPlainObject(data) : null;
    }

    async getWeather(station) {
        const cached = this._weatherCache.get(station);

        // Return cached if still valid
        if (cached && !cached.isStale()) {
            return cached;
        }

        // Fetch new
        const metar = await WeatherAPI.getMETAR(station);
        const weatherData = new WeatherData(metar, station);
        this._weatherCache.set(station, weatherData);

        return weatherData;
    }
}

window.DataRepository = DataRepository;
```

### Data Sources (Adapters)
```javascript
// data/sources/airports-source.js
class AirportsSource extends DataSource {
    async fetch() {
        const response = await fetch('/data/airports.csv');
        return response.text();
    }

    async parse(csv) {
        const parsed = parseCSV(csv);

        // Return as plain objects (Repository converts to Waypoint)
        return parsed.map(row => ({
            ident: row.ident,
            icao: row.icao,
            lat: parseFloat(row.latitude),
            lon: parseFloat(row.longitude),
            type: 'AIRPORT',
            elevation: parseInt(row.elevation)
        }));
    }
}

// data/sources/weather-source.js
class WeatherSource extends DataSource {
    constructor(apiKey) {
        super();
        this._apiKey = apiKey;
    }

    async fetch({ station }) {
        const response = await fetch(
            `https://api.weather.gov/stations/${station}/observations/latest`
        );
        return response.json();
    }

    async parse(json) {
        return {
            rawText: json.properties.rawMessage,
            timestamp: new Date(json.properties.timestamp).getTime(),
            station: json.properties.station
        };
    }
}
```

---

## 3. Query Layer: Index-Based Search

### Query Engine (Unchanged - Already Clean)
```javascript
// query/query-engine-v2.js
class QueryEngineV2 {
    constructor(repository) {
        this._repo = repository;
        this._indexes = new Map();
    }

    registerIndex(name, strategy) {
        this._indexes.set(name, strategy);
    }

    async query(params) {
        const index = this._indexes.get(params.type);
        const results = index.query(params);

        // Results are plain objects - convert to domain objects
        return results.map(obj => {
            if (params.type === 'airports') {
                return Waypoint.fromPlainObject(obj);
            }
            return obj;
        });
    }
}
```

### Index Strategies (Unchanged)
```javascript
// query/indexes/trie-index.js - works with plain objects
class TrieIndex extends IndexStrategy {
    build(data) { /* build trie from plain objects */ }
    query({ prefix }) { /* return plain objects */ }
}

// Repository converts to Waypoint instances
```

---

## 4. Compute Layer: Pure Functions on Domain Objects

### Navigation (Pure Functions)
```javascript
// compute/navigation.js
const Navigation = {
    // Works with both GeoPoint and Waypoint
    calculateDistance(from, to) {
        const fromPos = from instanceof Waypoint ? from.position : from;
        const toPos = to instanceof Waypoint ? to.position : to;

        return Geodesy.vincentyDistance(
            fromPos.lat, fromPos.lon,
            toPos.lat, toPos.lon
        );
    },

    // Returns plain object (RouteLeg constructor will use it)
    calculateLeg(from, to, options) {
        const distance = this.calculateDistance(from, to);
        const trueCourse = this.calculateBearing(from, to);
        const magCourse = this.applyMagneticVariation(trueCourse, from.position);

        let windCorrection = null;
        if (options.wind) {
            windCorrection = this.calculateWindCorrection(
                trueCourse,
                options.tas,
                options.wind
            );
        }

        return {
            distance,
            trueCourse,
            magCourse,
            heading: windCorrection?.heading || magCourse,
            groundSpeed: windCorrection?.groundSpeed || options.tas,
            wind: windCorrection
        };
    },

    // Accepts array of Waypoints, returns calculation data
    calculateRoute(waypoints, options) {
        const legs = [];

        for (let i = 0; i < waypoints.length - 1; i++) {
            const legData = this.calculateLeg(
                waypoints[i],
                waypoints[i + 1],
                options
            );
            legs.push(legData);
        }

        return {
            legs,
            totalDistance: legs.reduce((sum, leg) => sum + leg.distance, 0),
            totalTime: legs.reduce((sum, leg) => sum + (leg.distance / leg.groundSpeed * 60), 0)
        };
    }
};

window.Navigation = Navigation;
```

### Weather Analysis (Pure Functions on Domain Objects)
```javascript
// compute/weather.js
const Weather = {
    // Parse raw METAR → plain object
    parseMETAR(metar) {
        // Returns: { visibility, ceiling, flightCategory, wind, timestamp, ... }
    },

    // Check if WeatherData affects route
    checkRouteWeather(flightPlan, weatherData) {
        const affectedWaypoints = [];

        for (const waypoint of flightPlan.waypoints) {
            if (weatherData.affectsPoint(waypoint.position)) {
                affectedWaypoints.push(waypoint);
            }
        }

        return {
            hasImpact: affectedWaypoints.length > 0,
            affected: affectedWaypoints,
            severity: weatherData.flightCategory
        };
    }
};

window.Weather = Weather;
```

---

## 5. Service Layer: Orchestration with Domain Objects

### Route Service
```javascript
// services/route-service.js
class RouteService {
    constructor({ queryEngine, dataRepository }) {
        this._query = queryEngine;
        this._repo = dataRepository;
    }

    // Main entry point - returns FlightPlan instance
    async planRoute(routeString, options = {}) {
        console.log('[RouteService] Planning route:', routeString);

        // 1. Parse route string → waypoint identifiers
        const parsed = RouteParser.parse(routeString);

        // 2. Resolve identifiers → Waypoint instances
        const waypoints = await this._resolveWaypoints(parsed.waypoints);

        // 3. Create FlightPlan (calculates legs automatically)
        const plan = new FlightPlan(waypoints, {
            routeString: routeString,
            altitude: options.altitude,
            tas: options.tas
        });

        // 4. Validate
        const validation = plan.validate();
        if (!validation.valid) {
            throw new Error(`Invalid flight plan: ${validation.errors.join(', ')}`);
        }

        console.log('[RouteService] Plan created:', {
            waypoints: plan.waypointCount,
            distance: plan.totalDistance,
            time: plan.totalTime
        });

        return plan; // Returns FlightPlan instance
    }

    // Resolve waypoint identifiers → Waypoint instances
    async _resolveWaypoints(identifiers) {
        const waypoints = [];

        for (const ident of identifiers) {
            // Try airport first
            let waypoint = await this._repo.getAirport(ident);

            // Try navaid
            if (!waypoint) {
                waypoint = await this._query.query({
                    type: 'navaids',
                    ident: ident
                }).then(results => results[0]);
            }

            // Try fix
            if (!waypoint) {
                waypoint = await this._query.query({
                    type: 'fixes',
                    ident: ident
                }).then(results => results[0]);
            }

            if (!waypoint) {
                throw new Error(`Waypoint not found: ${ident}`);
            }

            waypoints.push(waypoint); // Already a Waypoint instance
        }

        return waypoints;
    }

    // Add weather to existing plan → returns new FlightPlan
    async addWeatherToPlan(flightPlan, weatherOptions = {}) {
        console.log('[RouteService] Adding weather to plan');

        // Get weather for departure and destination
        const departureWeather = await this._repo.getWeather(
            flightPlan.departure.facility.icao
        );
        const destinationWeather = await this._repo.getWeather(
            flightPlan.destination.facility.icao
        );

        // Get winds aloft
        const winds = await this._getWindsForRoute(flightPlan);

        // Create new plan with wind corrections
        const updatedPlan = flightPlan.withWind(winds);

        return {
            plan: updatedPlan,
            departureWeather,
            destinationWeather
        };
    }

    async _getWindsForRoute(flightPlan) {
        const altitude = flightPlan.altitude || 5000;
        const midpoint = this._calculateMidpoint(
            flightPlan.departure.position,
            flightPlan.destination.position
        );

        const windData = await this._repo.getWinds(
            midpoint.lat,
            midpoint.lon,
            altitude
        );

        return windData; // WindsAloftData instance
    }
}

window.RouteService = RouteService;
```

### Weather Service
```javascript
// services/weather-service.js
class WeatherService {
    constructor({ dataRepository }) {
        this._repo = dataRepository;
        this._cache = new Map(); // Station → WeatherData
    }

    // Get weather - returns WeatherData instance (auto-refreshes if stale)
    async getWeather(station) {
        const cached = this._cache.get(station);

        if (cached && !cached.isStale()) {
            return cached;
        }

        // Repository returns WeatherData instance
        const weatherData = await this._repo.getWeather(station);
        this._cache.set(station, weatherData);

        return weatherData;
    }

    // Get weather for entire route
    async getRouteWeather(flightPlan) {
        const weatherPoints = [];

        // Departure
        weatherPoints.push({
            waypoint: flightPlan.departure,
            weather: await this.getWeather(flightPlan.departure.facility.icao)
        });

        // Enroute airports (every ~100nm or so)
        for (const waypoint of flightPlan.waypoints) {
            if (waypoint.isAirport && waypoint !== flightPlan.departure && waypoint !== flightPlan.destination) {
                weatherPoints.push({
                    waypoint: waypoint,
                    weather: await this.getWeather(waypoint.facility.icao)
                });
            }
        }

        // Destination
        weatherPoints.push({
            waypoint: flightPlan.destination,
            weather: await this.getWeather(flightPlan.destination.facility.icao)
        });

        return weatherPoints;
    }

    // Analyze weather hazards for route
    analyzeHazards(flightPlan, weatherPoints) {
        const hazards = [];

        for (const point of weatherPoints) {
            const category = point.weather.flightCategory;

            if (category === 'LIFR' || category === 'IFR') {
                hazards.push({
                    waypoint: point.waypoint,
                    type: 'LOW_VISIBILITY',
                    severity: category === 'LIFR' ? 'SEVERE' : 'MODERATE',
                    weather: point.weather
                });
            }
        }

        return hazards;
    }
}

window.WeatherService = WeatherService;
```

---

## 6. State Layer: Managed Domain Objects

### Flight State Manager
```javascript
// state/flight-state-manager.js
class FlightStateManager {
    constructor() {
        this._currentPlan = null; // FlightPlan instance
        this._weatherData = new Map(); // Station → WeatherData
        this._listeners = [];
    }

    // Set current plan
    setFlightPlan(plan) {
        if (!(plan instanceof FlightPlan)) {
            throw new Error('Must be FlightPlan instance');
        }

        const validation = plan.validate();
        if (!validation.valid) {
            throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
        }

        this._currentPlan = plan;
        this._notifyListeners('plan-updated', plan);
    }

    // Get current plan
    getFlightPlan() {
        return this._currentPlan;
    }

    // Update plan with wind data → creates new plan (immutable)
    updateWinds(windData) {
        if (!this._currentPlan) {
            throw new Error('No active flight plan');
        }

        const newPlan = this._currentPlan.withWind(windData);
        this.setFlightPlan(newPlan);
    }

    // Save to localStorage
    savePlan() {
        if (!this._currentPlan) return;

        const json = this._currentPlan.toJSON();
        localStorage.setItem('flight_plan', JSON.stringify(json));
    }

    // Load from localStorage
    async loadPlan(routeService) {
        const json = localStorage.getItem('flight_plan');
        if (!json) return null;

        const data = JSON.parse(json);

        // Reconstruct waypoints (may need to re-resolve)
        const waypoints = data.waypoints.map(wp => Waypoint.fromPlainObject(wp));

        const plan = new FlightPlan(waypoints, {
            routeString: data.routeString,
            altitude: data.altitude,
            tas: data.tas
        });

        this.setFlightPlan(plan);
        return plan;
    }

    // Add listener
    addListener(callback) {
        this._listeners.push(callback);
    }

    _notifyListeners(event, data) {
        for (const listener of this._listeners) {
            listener(event, data);
        }
    }
}

window.FlightStateManager = FlightStateManager;
```

---

## 7. Display Layer: Renders Domain Objects

### UI Controller
```javascript
// display/ui-controller.js
class UIController {
    constructor({ flightStateManager, routeService, weatherService }) {
        this._state = flightStateManager;
        this._routeService = routeService;
        this._weatherService = weatherService;

        // Listen to state changes
        this._state.addListener((event, data) => {
            if (event === 'plan-updated') {
                this.renderPlan(data);
            }
        });
    }

    // Handle route planning form submission
    async handlePlanRoute() {
        const routeString = document.getElementById('route-input').value;
        const altitude = parseInt(document.getElementById('altitude-input').value);
        const tas = parseInt(document.getElementById('tas-input').value);

        try {
            // Service returns FlightPlan instance
            const plan = await this._routeService.planRoute(routeString, {
                altitude,
                tas
            });

            // Update state (triggers render)
            this._state.setFlightPlan(plan);

            // Save to localStorage
            this._state.savePlan();

        } catch (error) {
            this.showError(error.message);
        }
    }

    // Render flight plan
    renderPlan(plan) {
        // Render waypoints
        const waypointsHTML = plan.waypoints.map((wp, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${wp.displayName}</td>
                <td>${wp.displayInfo}</td>
                <td>${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}</td>
                <td>${wp.elevation || '—'}</td>
            </tr>
        `).join('');

        document.getElementById('waypoints-table').innerHTML = waypointsHTML;

        // Render legs
        const legsHTML = plan.legs.map((leg, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${leg.from.displayName}</td>
                <td>${leg.to.displayName}</td>
                <td>${leg.distance.toFixed(1)}</td>
                <td>${leg.trueCourse.toFixed(0)}°</td>
                <td>${leg.magCourse.toFixed(0)}°</td>
                <td>${leg.heading.toFixed(0)}°</td>
                <td>${leg.groundSpeed.toFixed(0)}</td>
                <td>${leg.legTime.toFixed(0)}</td>
            </tr>
        `).join('');

        document.getElementById('navlog-table').innerHTML = legsHTML;

        // Render totals
        document.getElementById('total-distance').textContent =
            plan.totalDistance.toFixed(1) + ' nm';
        document.getElementById('total-time').textContent =
            Math.floor(plan.totalTime / 60) + 'h ' + (plan.totalTime % 60).toFixed(0) + 'm';
    }

    // Add weather to plan
    async handleAddWeather() {
        const plan = this._state.getFlightPlan();
        if (!plan) return;

        try {
            const { plan: updatedPlan, departureWeather, destinationWeather } =
                await this._routeService.addWeatherToPlan(plan);

            // Update state with new plan (has wind corrections)
            this._state.setFlightPlan(updatedPlan);

            // Render weather
            this.renderWeather(departureWeather, destinationWeather);

        } catch (error) {
            this.showError(error.message);
        }
    }

    // Render weather data
    renderWeather(departureWeather, destinationWeather) {
        // departureWeather is WeatherData instance
        document.getElementById('departure-weather').innerHTML = `
            <div class="weather-card">
                <h4>${departureWeather.station}</h4>
                <p class="metar">${departureWeather.rawMETAR}</p>
                <div class="category ${departureWeather.flightCategory}">
                    ${departureWeather.flightCategory}
                </div>
                <p>Visibility: ${departureWeather.visibility} SM</p>
                <p>Ceiling: ${departureWeather.ceiling || 'Unlimited'}</p>
                <p class="age">
                    ${departureWeather.isStale() ? '⚠️ Stale' : '✓ Current'}
                    (${Math.floor(departureWeather.age / 60000)} min old)
                </p>
            </div>
        `;

        // Same for destination
        // ...
    }
}

window.UIController = UIController;
```

### Map Display
```javascript
// display/map-display.js
class MapDisplay {
    constructor({ flightStateManager }) {
        this._state = flightStateManager;
        this._map = null; // VectorMap instance

        // Listen to plan updates
        this._state.addListener((event, data) => {
            if (event === 'plan-updated') {
                this.renderRoute(data);
            }
        });
    }

    // Render route on map
    renderRoute(plan) {
        // Clear existing route
        this._map.clearRoute();

        // Plot waypoints
        for (const waypoint of plan.waypoints) {
            this._map.addMarker({
                position: waypoint.position, // GeoPoint
                label: waypoint.displayName,
                type: waypoint.isAirport ? 'airport' : 'waypoint'
            });
        }

        // Draw route line
        const positions = plan.waypoints.map(wp => wp.position);
        this._map.drawPolyline(positions, {
            color: '#0066cc',
            width: 3
        });

        // Fit bounds
        const bounds = this._calculateBounds(plan.waypoints);
        this._map.fitBounds(bounds);
    }

    _calculateBounds(waypoints) {
        // waypoints are Waypoint instances with position property
        const lats = waypoints.map(wp => wp.lat);
        const lons = waypoints.map(wp => wp.lon);

        return {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lons),
            west: Math.min(...lons)
        };
    }
}

window.MapDisplay = MapDisplay;
```

---

## 8. Application Bootstrap

### Main Entry Point
```javascript
// main.js
(async function initializeApp() {
    console.log('[App] Initializing IN-FLIGHT v3...');

    // 1. Initialize Data Layer
    const repository = new DataRepository();

    // Register data sources
    repository.registerSource('airports', new AirportsSource(), new TTLStrategy(24 * 60 * 60 * 1000));
    repository.registerSource('navaids', new NavaidsSource(), new TTLStrategy(24 * 60 * 60 * 1000));
    repository.registerSource('fixes', new FixesSource(), new TTLStrategy(24 * 60 * 60 * 1000));

    console.log('[App] Data sources registered');

    // 2. Initialize Query Layer
    const queryEngine = new QueryEngineV2(repository);

    // Register indexes
    queryEngine.registerIndex('airports', new TrieIndex('ident'));
    queryEngine.registerIndex('navaids', new MapIndex('ident'));
    queryEngine.registerIndex('spatial', new SpatialGridIndex());

    console.log('[App] Query indexes registered');

    // 3. Preload data and build indexes
    await queryEngine.initialize();
    console.log('[App] Indexes built:', queryEngine.getStats());

    // 4. Initialize Services
    const routeService = new RouteService({
        queryEngine: queryEngine,
        dataRepository: repository
    });

    const weatherService = new WeatherService({
        dataRepository: repository
    });

    console.log('[App] Services initialized');

    // 5. Initialize State Management
    const stateManager = new FlightStateManager();

    // Try to load saved plan
    const savedPlan = await stateManager.loadPlan(routeService);
    if (savedPlan) {
        console.log('[App] Loaded saved plan:', savedPlan.routeString);
    }

    // 6. Initialize Display Layer
    const uiController = new UIController({
        flightStateManager: stateManager,
        routeService: routeService,
        weatherService: weatherService
    });

    const mapDisplay = new MapDisplay({
        flightStateManager: stateManager
    });

    console.log('[App] UI initialized');

    // 7. Expose global app object
    window.App = {
        version: '3.0.0',
        architecture: 'v3-domain-driven',

        // Services
        routeService,
        weatherService,

        // State
        state: stateManager,

        // Display
        ui: uiController,
        map: mapDisplay,

        // Infrastructure
        repository,
        queryEngine
    };

    console.log('[App] Ready!');

    // 8. Show UI
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';

})();
```

---

## 9. Complete User Flow Example

### Scenario: Plan a flight from KSFO to KLAX with weather

```javascript
// 1. USER ACTION: Enter route in form
// Route: "KSFO V25 KLAX"
// Altitude: 5000
// TAS: 120

// 2. UI CONTROLLER: Handle submission
await uiController.handlePlanRoute();

// 3. ROUTE SERVICE: Plan route
const plan = await routeService.planRoute("KSFO V25 KLAX", {
    altitude: 5000,
    tas: 120
});

// 4. ROUTE SERVICE: Resolve waypoints
const waypoints = await routeService._resolveWaypoints(['KSFO', 'V25', 'KLAX']);
// Returns: [
//   Waypoint { ident: 'KSFO', position: GeoPoint(37.62, -122.38), facility: AirportFacility {...} },
//   Waypoint { ident: 'V25', position: GeoPoint(...), facility: null },
//   Waypoint { ident: 'KLAX', position: GeoPoint(33.94, -118.41), facility: AirportFacility {...} }
// ]

// 5. FLIGHT PLAN: Create and calculate
const plan = new FlightPlan(waypoints, {
    routeString: "KSFO V25 KLAX",
    altitude: 5000,
    tas: 120
});
// Internally:
// - Validates waypoints.length >= 2 ✓
// - Calculates legs using Navigation.calculateLeg()
// - Creates RouteLeg instances
// - Validates all legs ✓
// - Freezes object (immutable)

// 6. STATE MANAGER: Update state
stateManager.setFlightPlan(plan);
// - Validates plan again ✓
// - Stores reference
// - Notifies listeners

// 7. UI CONTROLLER: Render (triggered by listener)
uiController.renderPlan(plan);
// - plan.waypoints → table rows
// - plan.legs → navlog rows
// - plan.totalDistance → summary
// - plan.totalTime → summary

// 8. MAP DISPLAY: Render map (triggered by listener)
mapDisplay.renderRoute(plan);
// - waypoint.position → markers
// - waypoints → polyline
// - Auto-fit bounds

// 9. USER ACTION: Add weather
await uiController.handleAddWeather();

// 10. WEATHER SERVICE: Fetch weather
const departureWeather = await weatherService.getWeather('KSFO');
// Returns: WeatherData {
//   _data: { visibility: 10, ceiling: null, flightCategory: 'VFR', ... },
//   _validUntil: timestamp + 3600000,
//   _station: 'KSFO'
// }

// 11. ROUTE SERVICE: Add wind corrections
const { plan: updatedPlan, departureWeather, destinationWeather } =
    await routeService.addWeatherToPlan(plan);

// 12. FLIGHT PLAN: Create new plan with wind (immutable pattern)
const updatedPlan = plan.withWind(windData);
// Creates entirely new FlightPlan instance
// Recalculates all legs with wind corrections
// Original plan unchanged

// 13. STATE MANAGER: Update state
stateManager.setFlightPlan(updatedPlan);
// Triggers re-render with new headings, ground speeds

// 14. PERSISTENCE: Auto-save
stateManager.savePlan();
// Converts to JSON: updatedPlan.toJSON()
// Saves to localStorage

// DONE! User sees:
// ✓ Route displayed on map
// ✓ Navigation log with wind corrections
// ✓ Weather at departure/destination
// ✓ All data validated
// ✓ State persisted
```

---

## 10. Testing Strategy

### Unit Tests: Domain Objects
```javascript
// tests/test-waypoint.js
TestFramework.describe('Waypoint', function({ it }) {
    it('should create from coordinates', () => {
        const wp = new Waypoint('TEST', new GeoPoint(37.62, -122.38));
        assert.equals(wp.ident, 'TEST');
        assert.equals(wp.lat, 37.62);
    });

    it('should calculate distance to another waypoint', () => {
        const sfo = new Waypoint('KSFO', new GeoPoint(37.62, -122.38));
        const lax = new Waypoint('KLAX', new GeoPoint(33.94, -118.41));

        const distance = sfo.distanceTo(lax);
        assert.isTrue(distance > 288 && distance < 300);
    });

    it('should identify airport vs fix', () => {
        const airport = new Waypoint('KSFO', new GeoPoint(37.62, -122.38), {
            facility: new AirportFacility({ icao: 'KSFO', name: 'San Francisco' })
        });

        const fix = new Waypoint('PAYGE', new GeoPoint(37.0, -122.0));

        assert.isTrue(airport.isAirport);
        assert.isFalse(fix.isAirport);
        assert.isTrue(fix.isFix);
    });
});

// tests/test-flight-plan.js
TestFramework.describe('FlightPlan', function({ it }) {
    it('should validate waypoint count', () => {
        assert.throws(() => {
            new FlightPlan([/* only 1 waypoint */]);
        }, 'At least 2 waypoints required');
    });

    it('should enforce leg count invariant', () => {
        const waypoints = [
            new Waypoint('KSFO', new GeoPoint(37.62, -122.38)),
            new Waypoint('KLAX', new GeoPoint(33.94, -118.41))
        ];

        const plan = new FlightPlan(waypoints);

        assert.equals(plan.legCount, 1); // 2 waypoints = 1 leg
        assert.equals(plan.legs.length, plan.waypoints.length - 1);
    });

    it('should create new plan when adding wind (immutable)', () => {
        const plan1 = new FlightPlan(waypoints);
        const plan2 = plan1.withWind({ direction: 270, speed: 15 });

        assert.notEquals(plan1, plan2); // Different instances
        assert.equals(plan1.legs[0].groundSpeed, 120); // Original unchanged
        assert.isTrue(plan2.legs[0].groundSpeed < 120); // Headwind applied
    });
});
```

### Integration Tests: Services
```javascript
// tests/test-route-service.js
TestFramework.describe('RouteService Integration', function({ it }) {
    it('should plan complete route', async () => {
        const routeService = new RouteService({ queryEngine, dataRepository });

        const plan = await routeService.planRoute('KSFO V25 KLAX', {
            altitude: 5000,
            tas: 120
        });

        assert.isTrue(plan instanceof FlightPlan);
        assert.equals(plan.waypointCount, 3);
        assert.equals(plan.departure.ident, 'KSFO');
        assert.equals(plan.destination.ident, 'KLAX');
        assert.isTrue(plan.validate().valid);
    });
});
```

### E2E Tests: Complete Flows
```javascript
// e2e/route-planning.spec.js
test('should plan route with weather', async ({ page }) => {
    await page.goto('http://localhost:8080');

    // Enter route
    await page.fill('#route-input', 'KSFO V25 KLAX');
    await page.fill('#altitude-input', '5000');
    await page.fill('#tas-input', '120');
    await page.click('#plan-button');

    // Wait for plan to render
    await page.waitForSelector('#navlog-table tr');

    // Verify waypoints
    const rows = await page.$$('#waypoints-table tr');
    expect(rows.length).toBe(3); // Header + 2 waypoints

    // Add weather
    await page.click('#add-weather-button');
    await page.waitForSelector('.weather-card');

    // Verify weather displayed
    const weather = await page.textContent('.weather-card .category');
    expect(['VFR', 'MVFR', 'IFR', 'LIFR']).toContain(weather);

    // Verify wind corrections applied
    const headingCell = await page.textContent('#navlog-table tr:nth-child(2) td:nth-child(7)');
    expect(headingCell).toBeTruthy();
});
```

---

## 11. Benefits Summary

### Code Quality
- ✅ **Single source of truth** for all concepts
- ✅ **Type safety** via instanceof checks
- ✅ **Validation at boundaries** (FlightPlan constructor)
- ✅ **Immutability** where appropriate (GeoPoint, RouteLeg)
- ✅ **Pure functions** in compute layer (unchanged)
- ✅ **Testability** - easy to mock and test

### Developer Experience
- ✅ **Autocomplete** works better (real methods vs object fields)
- ✅ **Easier debugging** - `plan instanceof FlightPlan` is clear
- ✅ **Self-documenting** - `waypoint.displayName` vs scattered logic
- ✅ **Refactoring safety** - change class, all uses update

### Maintainability
- ✅ **Encapsulation** - logic lives with data
- ✅ **Single responsibility** - each class has one job
- ✅ **Easy to extend** - add methods to classes
- ✅ **Backward compatible** - `fromPlainObject()` / `toJSON()`

### Performance
- ✅ **No performance penalty** - same underlying objects
- ✅ **Better caching** - TimeSensitiveData auto-manages
- ✅ **Lazy evaluation** - only calculate when needed

---

## 12. Migration Path

### Phase 1: Add Models (Week 1)
- Create `/data/models/` directory
- Implement: GeoPoint, Waypoint, RouteLeg, FlightPlan
- Implement: TimeSensitiveData, WeatherData, WindsAloftData
- Write comprehensive tests
- **No breaking changes** - classes available but not required

### Phase 2: Update Services (Week 2)
- RouteService returns FlightPlan instances
- WeatherService returns WeatherData instances
- Update tests to use new return types
- **Backward compatible** - old code still works

### Phase 3: Update State (Week 3)
- FlightStateManager uses FlightPlan class
- Validate on state updates
- Convert localStorage data on load
- **Migration logic** - convert old saved plans

### Phase 4: Update UI (Week 4)
- UIController uses class methods
- Remove scattered type checking
- Use domain object methods for display
- **Cleaner code** - simplified rendering

### Phase 5: Deprecate Plain Objects (Week 5)
- Add deprecation warnings to old code paths
- Update documentation
- Plan removal of old patterns

---

## 13. File Structure

```
inflight/
├── data/
│   ├── models/                    # NEW: Domain models
│   │   ├── geo-point.js
│   │   ├── waypoint.js
│   │   ├── route-leg.js
│   │   ├── flight-plan.js
│   │   ├── time-sensitive-data.js
│   │   ├── weather-data.js
│   │   └── winds-aloft-data.js
│   ├── core/
│   │   ├── data-source.js         # Existing
│   │   └── cache-strategy.js
│   ├── sources/
│   │   ├── airports-source.js
│   │   ├── navaids-source.js
│   │   └── weather-source.js
│   └── repository.js              # Updated: returns domain objects
├── query/
│   ├── query-engine-v2.js         # Existing
│   └── indexes/                   # Existing
├── compute/
│   ├── navigation.js              # Existing: works with domain objects
│   ├── terrain.js
│   └── weather.js
├── services/
│   ├── route-service.js           # Updated: returns FlightPlan
│   └── weather-service.js         # Updated: returns WeatherData
├── state/
│   └── flight-state-manager.js    # NEW: manages FlightPlan instances
├── display/
│   ├── ui-controller.js           # Updated: uses domain object methods
│   └── map-display.js
├── main.js                         # Updated: bootstrap with new classes
└── tests/
    ├── test-geo-point.js          # NEW
    ├── test-waypoint.js           # NEW
    ├── test-flight-plan.js        # NEW
    └── test-time-sensitive-data.js # NEW
```

---

## Summary

**Every layer of the app built on clean, composable domain objects:**

1. **Foundation**: GeoPoint, Waypoint, RouteLeg, FlightPlan (validated, immutable)
2. **Data**: Repository returns domain objects, TimeSensitiveData auto-refreshes
3. **Query**: Indexes work with plain objects, Repository converts to domain objects
4. **Compute**: Pure functions work with domain objects
5. **Services**: Orchestrate using domain objects, return domain objects
6. **State**: Manages FlightPlan instances, enforces validation
7. **Display**: Renders domain objects using their methods

**Result**: Clean, testable, maintainable code where every piece has a clear responsibility and type.
