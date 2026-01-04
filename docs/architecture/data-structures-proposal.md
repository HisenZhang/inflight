# Data Structure Abstraction Proposal

## 1. Geographic Point Hierarchy

### Core Principle
**Everything is just a coordinate** with optional metadata layers.

### Proposed Class Hierarchy

```javascript
/**
 * Base class: Pure geographic position
 * Immutable value object
 */
class GeoPoint {
    constructor(lat, lon) {
        this._lat = lat;
        this._lon = lon;
        Object.freeze(this);
    }

    get lat() { return this._lat; }
    get lon() { return this._lon; }

    // Pure navigation methods
    distanceTo(other) {
        return Navigation.calculateDistance(this.lat, this.lon, other.lat, other.lon);
    }

    bearingTo(other) {
        return Navigation.calculateBearing(this.lat, this.lon, other.lat, other.lon);
    }

    equals(other) {
        return Math.abs(this.lat - other.lat) < 0.0001 &&
               Math.abs(this.lon - other.lon) < 0.0001;
    }

    toString() {
        return `${this.lat.toFixed(4)}, ${this.lon.toFixed(4)}`;
    }

    toJSON() {
        return { lat: this.lat, lon: this.lon };
    }
}

/**
 * Waypoint: Named geographic point used in navigation
 * Composition over inheritance - HAS-A GeoPoint
 */
class Waypoint {
    constructor(ident, position, metadata = {}) {
        this._ident = ident;
        this._position = position instanceof GeoPoint
            ? position
            : new GeoPoint(position.lat, position.lon);
        this._type = metadata.type || 'fix';
        this._elevation = metadata.elevation || null;
        this._facility = metadata.facility || null; // NavaidFacility | AirportFacility
        this._metadata = metadata; // Additional fields
    }

    // Identity
    get ident() { return this._ident; }
    get type() { return this._type; }

    // Position (delegate to GeoPoint)
    get lat() { return this._position.lat; }
    get lon() { return this._position.lon; }
    get position() { return this._position; }

    // Elevation
    get elevation() { return this._elevation; }

    // Facility (if any)
    get facility() { return this._facility; }
    get hasFacility() { return this._facility !== null; }

    // Type checks
    get isAirport() { return this._facility instanceof AirportFacility; }
    get isNavaid() { return this._facility instanceof NavaidFacility; }
    get isFix() { return this._facility === null && this._type === 'fix'; }
    get isUserDefined() { return this._type === 'user-defined'; }

    // Navigation (delegate to position)
    distanceTo(other) {
        const otherPos = other instanceof Waypoint ? other.position : other;
        return this._position.distanceTo(otherPos);
    }

    bearingTo(other) {
        const otherPos = other instanceof Waypoint ? other.position : other;
        return this._position.bearingTo(otherPos);
    }

    // Display name logic encapsulated
    get displayName() {
        if (this.isAirport) {
            return this._facility.icao || this._ident;
        }
        return this._ident;
    }

    get displayInfo() {
        if (this.isAirport) {
            return `${this.displayName} - ${this._facility.name}`;
        }
        if (this.isNavaid) {
            return `${this._ident} (${this._facility.navaidType})`;
        }
        return this._ident;
    }

    // Serialization
    toJSON() {
        return {
            ident: this._ident,
            type: this._type,
            lat: this.lat,
            lon: this.lon,
            elevation: this._elevation,
            facility: this._facility?.toJSON(),
            ...this._metadata
        };
    }

    // Factory: Create from plain object (current format)
    static fromPlainObject(obj) {
        const position = new GeoPoint(obj.lat, obj.lon);

        let facility = null;
        if (obj.waypointType === 'airport' || obj.type === 'AIRPORT') {
            facility = new AirportFacility({
                icao: obj.icao,
                iata: obj.iata,
                name: obj.name,
                elevation: obj.elevation
            });
        } else if (obj.frequency) {
            facility = new NavaidFacility({
                navaidType: obj.type,
                frequency: obj.frequency,
                range: obj.range
            });
        }

        return new Waypoint(obj.ident, position, {
            type: obj.waypointType || obj.type,
            elevation: obj.elevation || obj.alt,
            facility: facility,
            ...obj // Preserve other fields
        });
    }
}

/**
 * Airport facility metadata
 */
class AirportFacility {
    constructor({ icao, iata, name, elevation, runways = [] }) {
        this.icao = icao;
        this.iata = iata;
        this.name = name;
        this.elevation = elevation;
        this.runways = runways;
    }

    get primaryIdentifier() { return this.icao || this.iata; }

    toJSON() {
        return {
            icao: this.icao,
            iata: this.iata,
            name: this.name,
            elevation: this.elevation,
            runways: this.runways
        };
    }
}

/**
 * Navaid facility metadata
 */
class NavaidFacility {
    constructor({ navaidType, frequency, range, magVar }) {
        this.navaidType = navaidType; // VOR, NDB, VORTAC, etc.
        this.frequency = frequency;
        this.range = range;
        this.magVar = magVar;
    }

    get isVOR() { return this.navaidType?.includes('VOR'); }
    get isNDB() { return this.navaidType === 'NDB'; }

    toJSON() {
        return {
            navaidType: this.navaidType,
            frequency: this.frequency,
            range: this.range,
            magVar: this.magVar
        };
    }
}
```

### Benefits
1. **Single source of truth** for identity: `waypoint.ident` always works
2. **Encapsulated type logic**: No more scattered `if (waypoint.waypointType === 'airport')`
3. **Position delegation**: Navigation methods built-in
4. **Backward compatible**: `fromPlainObject()` converts existing data
5. **Immutable GeoPoint**: Coordinates can't accidentally change

---

## 2. Route Leg Abstraction

```javascript
/**
 * Represents a flight segment between two waypoints
 * Immutable once calculated
 */
class RouteLeg {
    constructor(from, to, { wind, tas, altitude } = {}) {
        this._from = from instanceof Waypoint ? from : Waypoint.fromPlainObject(from);
        this._to = to instanceof Waypoint ? to : Waypoint.fromPlainObject(to);

        // Calculate navigation data
        const calc = Navigation.calculateLeg(this._from, this._to, { wind, tas, altitude });

        this._distance = calc.distance;
        this._trueCourse = calc.trueCourse;
        this._magCourse = calc.magCourse;
        this._heading = calc.heading;
        this._groundSpeed = calc.groundSpeed;
        this._legTime = calc.legTime;
        this._wind = calc.wind || null;

        Object.freeze(this);
    }

    // Waypoints
    get from() { return this._from; }
    get to() { return this._to; }

    // Navigation
    get distance() { return this._distance; }
    get trueCourse() { return this._trueCourse; }
    get magCourse() { return this._magCourse; }
    get heading() { return this._heading; }
    get groundSpeed() { return this._groundSpeed; }
    get legTime() { return this._legTime; } // minutes

    // Wind
    get wind() { return this._wind; }
    get hasWind() { return this._wind !== null; }
    get headwind() { return this._wind?.headwind || 0; }
    get crosswind() { return this._wind?.crosswind || 0; }
    get wca() { return this._wind?.wca || 0; }

    // Validation
    isValid() {
        return this._distance > 0 &&
               !isNaN(this._trueCourse) &&
               this._from.lat !== undefined &&
               this._to.lat !== undefined;
    }

    // Display
    toString() {
        return `${this._from.ident} → ${this._to.ident} (${this._distance.toFixed(1)}nm)`;
    }

    toJSON() {
        return {
            from: this._from.toJSON(),
            to: this._to.toJSON(),
            distance: this._distance,
            trueCourse: this._trueCourse,
            magCourse: this._magCourse,
            heading: this._heading,
            groundSpeed: this._groundSpeed,
            legTime: this._legTime,
            wind: this._wind
        };
    }
}
```

---

## 3. Flight Plan Abstraction

```javascript
/**
 * Represents a complete flight plan with invariant validation
 */
class FlightPlan {
    constructor(waypoints, options = {}) {
        // Validate
        if (!Array.isArray(waypoints) || waypoints.length < 2) {
            throw new Error('Flight plan requires at least 2 waypoints');
        }

        // Ensure all are Waypoint instances
        this._waypoints = waypoints.map(wp =>
            wp instanceof Waypoint ? wp : Waypoint.fromPlainObject(wp)
        );

        // Calculate legs
        this._legs = this._calculateLegs(options);

        // Metadata
        this._routeString = options.routeString || this._buildRouteString();
        this._altitude = options.altitude || null;
        this._tas = options.tas || null;
        this._timestamp = Date.now();
    }

    // Waypoints
    get waypoints() { return [...this._waypoints]; } // Defensive copy
    get departure() { return this._waypoints[0]; }
    get destination() { return this._waypoints[this._waypoints.length - 1]; }
    get waypointCount() { return this._waypoints.length; }

    // Legs
    get legs() { return [...this._legs]; } // Defensive copy
    get legCount() { return this._legs.length; }

    // Totals
    get totalDistance() {
        return this._legs.reduce((sum, leg) => sum + leg.distance, 0);
    }

    get totalTime() {
        return this._legs.reduce((sum, leg) => sum + leg.legTime, 0);
    }

    get routeString() { return this._routeString; }
    get altitude() { return this._altitude; }
    get tas() { return this._tas; }
    get timestamp() { return this._timestamp; }

    // Validation - Ensures invariants
    validate() {
        const errors = [];

        if (this._waypoints.length < 2) {
            errors.push('At least 2 waypoints required');
        }

        if (this._legs.length !== this._waypoints.length - 1) {
            errors.push(`Leg count mismatch: ${this._legs.length} legs for ${this._waypoints.length} waypoints`);
        }

        for (const leg of this._legs) {
            if (!leg.isValid()) {
                errors.push(`Invalid leg: ${leg.toString()}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Private: Calculate legs from waypoints
    _calculateLegs(options) {
        const legs = [];
        for (let i = 0; i < this._waypoints.length - 1; i++) {
            legs.push(new RouteLeg(
                this._waypoints[i],
                this._waypoints[i + 1],
                options
            ));
        }
        return legs;
    }

    _buildRouteString() {
        return this._waypoints.map(wp => wp.displayName).join(' ');
    }

    // Modification (returns new FlightPlan - immutable pattern)
    withWind(windData) {
        return new FlightPlan(this._waypoints, {
            routeString: this._routeString,
            altitude: this._altitude,
            tas: this._tas,
            wind: windData
        });
    }

    withAltitude(altitude) {
        return new FlightPlan(this._waypoints, {
            routeString: this._routeString,
            altitude: altitude,
            tas: this._tas
        });
    }

    // Serialization
    toJSON() {
        return {
            routeString: this._routeString,
            waypoints: this._waypoints.map(wp => wp.toJSON()),
            legs: this._legs.map(leg => leg.toJSON()),
            altitude: this._altitude,
            tas: this._tas,
            timestamp: this._timestamp,
            totals: {
                distance: this.totalDistance,
                time: this.totalTime
            }
        };
    }
}
```

---

## 4. Time-Sensitive Data Abstraction

### Core Principle
**Data with expiration and auto-refresh capability**

```javascript
/**
 * Abstract base for time-sensitive aviation data
 * Handles validity periods, staleness detection, and refresh
 */
class TimeSensitiveData {
    constructor(data, { validFrom, validUntil, staleAfter }) {
        this._data = data;
        this._validFrom = validFrom || Date.now();
        this._validUntil = validUntil;
        this._staleAfter = staleAfter || (60 * 60 * 1000); // 1 hour default
        this._fetchedAt = Date.now();
        this._refreshPromise = null;
    }

    // Validity
    get validFrom() { return this._validFrom; }
    get validUntil() { return this._validUntil; }
    get fetchedAt() { return this._fetchedAt; }

    isValidAt(timestamp = Date.now()) {
        if (this._validFrom && timestamp < this._validFrom) {
            return false;
        }
        if (this._validUntil && timestamp > this._validUntil) {
            return false;
        }
        return true;
    }

    isStale(now = Date.now()) {
        return (now - this._fetchedAt) > this._staleAfter;
    }

    get isExpired() {
        return !this.isValidAt();
    }

    get age() {
        return Date.now() - this._fetchedAt;
    }

    get timeUntilExpiry() {
        if (!this._validUntil) return Infinity;
        return this._validUntil - Date.now();
    }

    // Data access with auto-refresh
    async getData() {
        if (this.isExpired || this.isStale()) {
            await this.refresh();
        }
        return this._data;
    }

    // Refresh (abstract - must be implemented by subclass)
    async refresh() {
        // Prevent multiple simultaneous refreshes
        if (this._refreshPromise) {
            return this._refreshPromise;
        }

        this._refreshPromise = this._doRefresh()
            .then(newData => {
                this._data = newData.data;
                this._validFrom = newData.validFrom || Date.now();
                this._validUntil = newData.validUntil;
                this._fetchedAt = Date.now();
                this._refreshPromise = null;
                return this._data;
            })
            .catch(error => {
                console.error('[TimeSensitiveData] Refresh failed:', error);
                this._refreshPromise = null;
                throw error;
            });

        return this._refreshPromise;
    }

    // Abstract method - subclasses must implement
    async _doRefresh() {
        throw new Error('_doRefresh() must be implemented by subclass');
    }

    // Manual update
    update(data, { validFrom, validUntil } = {}) {
        this._data = data;
        this._validFrom = validFrom || Date.now();
        this._validUntil = validUntil;
        this._fetchedAt = Date.now();
    }

    toJSON() {
        return {
            data: this._data,
            validFrom: this._validFrom,
            validUntil: this._validUntil,
            fetchedAt: this._fetchedAt,
            isValid: this.isValidAt(),
            isStale: this.isStale()
        };
    }
}

/**
 * Weather data (METAR) - expires hourly
 */
class WeatherData extends TimeSensitiveData {
    constructor(metar, station) {
        const parsed = Weather.parseMETAR(metar);

        super(parsed, {
            validFrom: parsed.timestamp,
            validUntil: parsed.timestamp + (60 * 60 * 1000), // 1 hour
            staleAfter: 30 * 60 * 1000 // 30 minutes
        });

        this._station = station;
        this._rawMETAR = metar;
    }

    get station() { return this._station; }
    get rawMETAR() { return this._rawMETAR; }
    get flightCategory() { return this._data.flightCategory; }
    get visibility() { return this._data.visibility; }
    get ceiling() { return this._data.ceiling; }

    async _doRefresh() {
        const newMetar = await WeatherAPI.getMETAR(this._station);
        const parsed = Weather.parseMETAR(newMetar);

        return {
            data: parsed,
            validFrom: parsed.timestamp,
            validUntil: parsed.timestamp + (60 * 60 * 1000)
        };
    }
}

/**
 * Winds aloft - expires every 6 hours
 */
class WindsAloftData extends TimeSensitiveData {
    constructor(windData, { latitude, longitude, altitude }) {
        // Winds aloft forecast valid for 6-12 hours typically
        super(windData, {
            validFrom: windData.timestamp,
            validUntil: windData.timestamp + (6 * 60 * 60 * 1000),
            staleAfter: 3 * 60 * 60 * 1000 // 3 hours
        });

        this._location = { latitude, longitude, altitude };
    }

    get location() { return this._location; }
    get direction() { return this._data.direction; }
    get speed() { return this._data.speed; }
    get temperature() { return this._data.temperature; }

    async _doRefresh() {
        const newData = await WindsAloft.getWindForLocation(
            this._location.latitude,
            this._location.longitude,
            this._location.altitude
        );

        return {
            data: newData,
            validFrom: newData.timestamp,
            validUntil: newData.timestamp + (6 * 60 * 60 * 1000)
        };
    }
}

/**
 * NOTAM data - varies by NOTAM type
 */
class NOTAMData extends TimeSensitiveData {
    constructor(notam) {
        super(notam, {
            validFrom: notam.effectiveStart,
            validUntil: notam.effectiveEnd,
            staleAfter: 60 * 60 * 1000 // Re-check hourly
        });

        this._location = notam.location;
    }

    get location() { return this._location; }
    get message() { return this._data.message; }
    get type() { return this._data.type; }

    async _doRefresh() {
        const newNotams = await NOTAMService.getForLocation(this._location);

        return {
            data: newNotams[0], // First matching NOTAM
            validFrom: newNotams[0].effectiveStart,
            validUntil: newNotams[0].effectiveEnd
        };
    }
}
```

### Benefits of Time-Sensitive Abstraction

1. **Automatic staleness detection**: `data.isStale()`
2. **Auto-refresh on access**: `await data.getData()` refreshes if needed
3. **Prevents duplicate fetches**: Coalesces simultaneous refresh requests
4. **Type-specific validity**: Weather expires in 1hr, winds in 6hr, NOTAMs vary
5. **Transparent caching**: Old data still accessible while refreshing

---

## 5. Integration Strategy

### Phase 1: Add classes alongside existing code
```javascript
// New classes available
window.GeoPoint = GeoPoint;
window.Waypoint = Waypoint;
window.RouteLeg = RouteLeg;
window.FlightPlan = FlightPlan;
window.TimeSensitiveData = TimeSensitiveData;
window.WeatherData = WeatherData;
window.WindsAloftData = WindsAloftData;

// Old code still works with plain objects
// New code can use classes
```

### Phase 2: Migrate services to use classes
```javascript
// RouteService returns FlightPlan instances
class RouteService {
    async planRoute(routeString, options) {
        const waypoints = await this._resolveWaypoints(routeString);
        return new FlightPlan(waypoints, options); // Returns class instance
    }
}
```

### Phase 3: Migrate state management
```javascript
// flight-state.js uses FlightPlan class
function updateFlightPlan(plan) {
    if (!(plan instanceof FlightPlan)) {
        plan = new FlightPlan(plan.waypoints, plan);
    }
    flightPlan = plan;
}
```

### Phase 4: Update UI layer
```javascript
// ui-controller.js uses class methods
const plan = FlightState.getFlightPlan();
console.log(plan.departure.displayName); // No more conditional logic
console.log(plan.validate()); // Built-in validation
```

---

## 6. Testing Strategy

```javascript
// test-waypoint.js
TestFramework.describe('Waypoint Class', function({ it }) {
    it('should create waypoint from coordinates', () => {
        const wp = new Waypoint('TEST', new GeoPoint(37.62, -122.38));
        assert.equals(wp.lat, 37.62);
        assert.equals(wp.ident, 'TEST');
    });

    it('should convert from plain object', () => {
        const plain = { ident: 'KSFO', lat: 37.62, lon: -122.38, type: 'AIRPORT' };
        const wp = Waypoint.fromPlainObject(plain);
        assert.equals(wp.ident, 'KSFO');
        assert.isTrue(wp.isAirport);
    });

    it('should calculate distance to another waypoint', () => {
        const sfo = new Waypoint('KSFO', new GeoPoint(37.62, -122.38));
        const lax = new Waypoint('KLAX', new GeoPoint(33.94, -118.41));
        const distance = sfo.distanceTo(lax);
        assert.isTrue(distance > 288 && distance < 300); // ~294nm
    });
});

// test-time-sensitive-data.js
TestFramework.describe('TimeSensitiveData', function({ it }) {
    it('should detect stale data', async () => {
        const data = new WeatherData('KSFO 121853Z 28008KT 10SM FEW015 14/12', 'KSFO');
        assert.isFalse(data.isStale()); // Fresh

        // Simulate 31 minutes passing
        data._fetchedAt = Date.now() - (31 * 60 * 1000);
        assert.isTrue(data.isStale()); // Now stale
    });
});
```

---

## 7. Backward Compatibility

All classes provide `fromPlainObject()` and `toJSON()` methods:

```javascript
// Old code: plain object
const legOld = {
    from: { ident: 'KSFO', lat: 37.62, lon: -122.38 },
    to: { ident: 'KLAX', lat: 33.94, lon: -118.41 },
    distance: 294
};

// New code: convert seamlessly
const legNew = new RouteLeg(legOld.from, legOld.to);

// Export back to plain object for LocalStorage
localStorage.setItem('plan', JSON.stringify(legNew.toJSON()));
```

---

## Summary

### Geographic Abstraction
- **GeoPoint**: Pure coordinates (immutable)
- **Waypoint**: Named point with optional facility (airports, navaids)
- **RouteLeg**: Flight segment with calculated navigation data
- **FlightPlan**: Complete plan with invariant validation

### Time-Sensitive Abstraction
- **TimeSensitiveData**: Base class with validity/staleness logic
- **WeatherData**: 1-hour expiry, auto-refresh METAR
- **WindsAloftData**: 6-hour expiry, auto-refresh winds
- **NOTAMData**: Variable expiry per NOTAM

### Key Benefits
1. ✅ Single source of truth for waypoint identity
2. ✅ Encapsulated type checking (no more scattered ifs)
3. ✅ Built-in validation (prevent invalid states)
4. ✅ Automatic data refresh for time-sensitive data
5. ✅ Backward compatible via `fromPlainObject()`
6. ✅ Immutability where appropriate (GeoPoint, RouteLeg)
7. ✅ Easy testing with pure methods
