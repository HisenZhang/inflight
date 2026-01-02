// Tests for compute/navigation.js - Pure navigation calculations
// Architecture v3.0.0 - Compute Layer (Pure Functions)

// ============================================
// NAVIGATION MODULE EXISTENCE
// ============================================

TestFramework.describe('Navigation - Module Structure', function({ it }) {

    it('should have Navigation defined', () => {
        assert.isDefined(window.Navigation, 'Navigation should be defined');
    });

    it('should have calculateDistance method', () => {
        assert.isFunction(window.Navigation.calculateDistance,
            'Should have calculateDistance method');
    });

    it('should have calculateBearing method', () => {
        assert.isFunction(window.Navigation.calculateBearing,
            'Should have calculateBearing method');
    });

    it('should have calculateMagneticBearing method', () => {
        assert.isFunction(window.Navigation.calculateMagneticBearing,
            'Should have calculateMagneticBearing method');
    });

    it('should have calculateWindCorrection method', () => {
        assert.isFunction(window.Navigation.calculateWindCorrection,
            'Should have calculateWindCorrection method');
    });

    it('should have calculateLeg method', () => {
        assert.isFunction(window.Navigation.calculateLeg,
            'Should have calculateLeg method');
    });

    it('should have calculateRoute method', () => {
        assert.isFunction(window.Navigation.calculateRoute,
            'Should have calculateRoute method');
    });
});

// ============================================
// DISTANCE CALCULATIONS
// ============================================

TestFramework.describe('Navigation - Distance Calculations', function({ it }) {

    it('should calculate SFO to LAX distance correctly (~294nm)', () => {
        // KSFO: 37.6191, -122.3756
        // KLAX: 33.9425, -118.4081
        const distance = window.Navigation.calculateDistance(
            37.6191, -122.3756,
            33.9425, -118.4081
        );

        // Known distance SFO-LAX is approximately 294 nautical miles (337 statute miles)
        assert.isTrue(distance > 288 && distance < 300,
            `Distance should be ~294nm, got ${distance}`);
    });

    it('should return 0 for same point', () => {
        const distance = window.Navigation.calculateDistance(40, -75, 40, -75);
        assert.equals(distance, 0, 'Same point should have 0 distance');
    });

    it('should calculate NYC to LON distance correctly (~3000nm)', () => {
        // JFK: 40.6413, -73.7781
        // LHR: 51.4700, -0.4543
        const distance = window.Navigation.calculateDistance(
            40.6413, -73.7781,
            51.4700, -0.4543
        );

        // Known distance JFK-LHR is approximately 2999 nautical miles
        assert.isTrue(distance > 2950 && distance < 3050,
            `Distance should be ~3000nm, got ${distance}`);
    });

    it('should handle equator crossing', () => {
        const distance = window.Navigation.calculateDistance(
            5.0, -80.0,   // Panama
            -5.0, -80.0   // Ecuador
        );

        assert.isTrue(distance > 0, 'Should calculate positive distance across equator');
    });

    it('should handle date line crossing', () => {
        const distance = window.Navigation.calculateDistance(
            35.0, 179.0,   // East of date line
            35.0, -179.0   // West of date line
        );

        // ~120nm across the date line
        assert.isTrue(distance < 200, 'Should handle date line correctly');
    });
});

// ============================================
// BEARING CALCULATIONS
// ============================================

TestFramework.describe('Navigation - Bearing Calculations', function({ it }) {

    it('should calculate bearing due north as ~0/360', () => {
        const bearing = window.Navigation.calculateBearing(40, -75, 45, -75);
        assert.isTrue(bearing < 5 || bearing > 355,
            `Due north bearing should be ~0/360, got ${bearing}`);
    });

    it('should calculate bearing due south as ~180', () => {
        const bearing = window.Navigation.calculateBearing(45, -75, 40, -75);
        assert.isTrue(bearing > 175 && bearing < 185,
            `Due south bearing should be ~180, got ${bearing}`);
    });

    it('should calculate bearing due east as ~90', () => {
        const bearing = window.Navigation.calculateBearing(40, -75, 40, -70);
        assert.isTrue(bearing > 85 && bearing < 95,
            `Due east bearing should be ~90, got ${bearing}`);
    });

    it('should calculate bearing due west as ~270', () => {
        const bearing = window.Navigation.calculateBearing(40, -70, 40, -75);
        assert.isTrue(bearing > 265 && bearing < 275,
            `Due west bearing should be ~270, got ${bearing}`);
    });

    it('should calculate SFO to LAX bearing (~137 degrees)', () => {
        const bearing = window.Navigation.calculateBearing(
            37.6191, -122.3756,  // SFO
            33.9425, -118.4081   // LAX
        );

        // Known bearing SFO to LAX is approximately 137 degrees
        assert.isTrue(bearing > 130 && bearing < 145,
            `SFO-LAX bearing should be ~137, got ${bearing}`);
    });

    it('should return bearing in 0-360 range', () => {
        const bearing = window.Navigation.calculateBearing(40, -75, 35, -80);
        assert.isTrue(bearing >= 0 && bearing < 360,
            'Bearing should be in 0-360 range');
    });
});

// ============================================
// MAGNETIC BEARING
// ============================================

TestFramework.describe('Navigation - Magnetic Bearing', function({ it }) {

    it('should apply magnetic variation to bearing', () => {
        // San Francisco area has easterly variation (~13E) per WMM2025
        const trueBearing = window.Navigation.calculateBearing(
            37.6191, -122.3756,
            33.9425, -118.4081
        );
        const magBearing = window.Navigation.calculateMagneticBearing(
            37.6191, -122.3756,
            33.9425, -118.4081
        );

        // Magnetic bearing = true - variation
        // With ~13E variation (positive), magnetic should be ~13 degrees lower
        const diff = magBearing - trueBearing;
        assert.isTrue(diff < -8 && diff > -18,
            `Magnetic adjustment should be ~-13, got ${diff}`);
    });

    it('should return bearing in 0-360 range', () => {
        const bearing = window.Navigation.calculateMagneticBearing(40, -75, 35, -80);
        assert.isTrue(bearing >= 0 && bearing < 360,
            'Magnetic bearing should be in 0-360 range');
    });
});

// ============================================
// WIND CORRECTION
// ============================================

TestFramework.describe('Navigation - Wind Correction', function({ it }) {

    it('should calculate direct headwind', () => {
        // Flying north at 120kts with 20kt headwind from north
        const result = window.Navigation.calculateWindCorrection(360, 120, 360, 20);

        assert.equals(result.windCorrectionAngle, 0, 'WCA should be 0 for headwind');
        assert.equals(result.groundSpeed, 100, 'GS should be TAS - wind');
        assert.isTrue(result.heading >= 359 || result.heading <= 1,
            'Heading should equal course for headwind');
    });

    it('should calculate direct tailwind', () => {
        // Flying north at 120kts with 20kt tailwind from south
        const result = window.Navigation.calculateWindCorrection(360, 120, 180, 20);

        assert.equals(result.windCorrectionAngle, 0, 'WCA should be 0 for tailwind');
        assert.equals(result.groundSpeed, 140, 'GS should be TAS + wind');
    });

    it('should calculate left crosswind correction', () => {
        // Flying north at 120kts with 30kt crosswind from west (270)
        const result = window.Navigation.calculateWindCorrection(360, 120, 270, 30);

        // Should crab left (heading west of north) to compensate
        assert.isTrue(result.windCorrectionAngle < 0,
            'WCA should be negative for left crosswind');
        assert.isTrue(result.heading > 340 && result.heading < 360,
            'Heading should be left of course');
    });

    it('should calculate right crosswind correction', () => {
        // Flying north at 120kts with 30kt crosswind from east (90)
        const result = window.Navigation.calculateWindCorrection(360, 120, 90, 30);

        // Should crab right (heading east of north) to compensate
        assert.isTrue(result.windCorrectionAngle > 0,
            'WCA should be positive for right crosswind');
        assert.isTrue(result.heading > 0 && result.heading < 20,
            'Heading should be right of course');
    });

    it('should return correct result structure', () => {
        const result = window.Navigation.calculateWindCorrection(180, 100, 270, 15);

        assert.isDefined(result.heading, 'Should have heading');
        assert.isDefined(result.groundSpeed, 'Should have groundSpeed');
        assert.isDefined(result.windCorrectionAngle, 'Should have windCorrectionAngle');

        assert.isNumber(result.heading, 'heading should be number');
        assert.isNumber(result.groundSpeed, 'groundSpeed should be number');
        assert.isNumber(result.windCorrectionAngle, 'WCA should be number');
    });

    it('should handle zero wind', () => {
        const result = window.Navigation.calculateWindCorrection(90, 120, 0, 0);

        assert.equals(result.windCorrectionAngle, 0, 'WCA should be 0 with no wind');
        assert.equals(result.groundSpeed, 120, 'GS should equal TAS with no wind');
        assert.equals(result.heading, 90, 'Heading should equal course with no wind');
    });
});

// ============================================
// LEG CALCULATIONS
// ============================================

TestFramework.describe('Navigation - Leg Calculations', function({ it }) {

    it('should calculate leg between two waypoints', () => {
        const from = { lat: 37.6191, lon: -122.3756, ident: 'KSFO' };
        const to = { lat: 33.9425, lon: -118.4081, ident: 'KLAX' };

        const leg = window.Navigation.calculateLeg(from, to, { tas: 120 });

        assert.isDefined(leg.distance, 'Should have distance');
        assert.isDefined(leg.trueCourse, 'Should have trueCourse');
        assert.isDefined(leg.magCourse, 'Should have magCourse');
        assert.isDefined(leg.heading, 'Should have heading');
        assert.isDefined(leg.groundSpeed, 'Should have groundSpeed');
        assert.isDefined(leg.ete, 'Should have ete (time)');
        assert.isDefined(leg.from, 'Should have from identifier');
        assert.isDefined(leg.to, 'Should have to identifier');
    });

    it('should calculate ETE correctly', () => {
        // 120nm at 120kts = 60 minutes
        const from = { lat: 40, lon: -75, ident: 'A' };
        const to = { lat: 42, lon: -75, ident: 'B' }; // ~120nm north

        const leg = window.Navigation.calculateLeg(from, to, { tas: 120 });

        // ETE should be approximately 60 minutes
        assert.isTrue(leg.ete > 55 && leg.ete < 65,
            `ETE should be ~60min, got ${leg.ete}`);
    });

    it('should apply wind correction when wind provided', () => {
        const from = { lat: 40, lon: -75, ident: 'A' };
        const to = { lat: 42, lon: -75, ident: 'B' };

        const noWind = window.Navigation.calculateLeg(from, to, { tas: 120 });
        const withWind = window.Navigation.calculateLeg(from, to, {
            tas: 120,
            wind: { direction: 180, speed: 20 } // Tailwind
        });

        assert.isTrue(withWind.groundSpeed > noWind.groundSpeed,
            'Ground speed should increase with tailwind');
        assert.isTrue(withWind.ete < noWind.ete,
            'ETE should decrease with tailwind');
    });

    it('should use default TAS if not provided', () => {
        const from = { lat: 40, lon: -75, ident: 'A' };
        const to = { lat: 42, lon: -75, ident: 'B' };

        const leg = window.Navigation.calculateLeg(from, to);

        assert.isTrue(leg.groundSpeed > 0, 'Should have positive ground speed');
        assert.isTrue(leg.ete > 0, 'Should have positive ETE');
    });

    it('should extract identifier from various formats', () => {
        const tests = [
            { from: { ident: 'ABC' }, to: { ident: 'XYZ' } },
            { from: { icao: 'KABC' }, to: { icao: 'KXYZ' } },
            { from: { id: 'ID1' }, to: { id: 'ID2' } }
        ];

        tests.forEach(test => {
            const from = { ...test.from, lat: 40, lon: -75 };
            const to = { ...test.to, lat: 42, lon: -75 };
            const leg = window.Navigation.calculateLeg(from, to);

            assert.isDefined(leg.from, 'Should extract from identifier');
            assert.isDefined(leg.to, 'Should extract to identifier');
        });
    });
});

// ============================================
// ROUTE CALCULATIONS
// ============================================

TestFramework.describe('Navigation - Route Calculations', function({ it }) {

    it('should calculate complete route', () => {
        const waypoints = [
            { lat: 37.6191, lon: -122.3756, ident: 'KSFO' },
            { lat: 36.0, lon: -121.0, ident: 'MID' },
            { lat: 33.9425, lon: -118.4081, ident: 'KLAX' }
        ];

        const route = window.Navigation.calculateRoute(waypoints, { tas: 120 });

        assert.isDefined(route.legs, 'Should have legs array');
        assert.isDefined(route.totals, 'Should have totals');
        assert.isArray(route.legs, 'legs should be array');
        assert.equals(route.legs.length, 2, 'Should have 2 legs for 3 waypoints');
    });

    it('should calculate correct totals', () => {
        const waypoints = [
            { lat: 40, lon: -75, ident: 'A' },
            { lat: 41, lon: -75, ident: 'B' },
            { lat: 42, lon: -75, ident: 'C' }
        ];

        const route = window.Navigation.calculateRoute(waypoints, { tas: 120 });

        // Total distance should be sum of leg distances
        const sumDistance = route.legs.reduce((sum, leg) => sum + leg.distance, 0);
        assert.isTrue(Math.abs(route.totals.distance - sumDistance) < 0.5,
            'Total distance should equal sum of legs');

        // Total ETE should be sum of leg ETEs
        const sumEte = route.legs.reduce((sum, leg) => sum + leg.ete, 0);
        assert.isTrue(Math.abs(route.totals.ete - sumEte) < 1,
            'Total ETE should equal sum of legs');
    });

    it('should handle single waypoint', () => {
        const waypoints = [{ lat: 40, lon: -75, ident: 'A' }];
        const route = window.Navigation.calculateRoute(waypoints);

        assert.equals(route.legs.length, 0, 'Single waypoint should have no legs');
        assert.equals(route.totals.distance, 0, 'Single waypoint should have 0 distance');
        assert.equals(route.totals.ete, 0, 'Single waypoint should have 0 ete');
    });

    it('should handle empty waypoints', () => {
        const route = window.Navigation.calculateRoute([]);

        assert.isArray(route.legs, 'Should return empty legs array');
        assert.equals(route.legs.length, 0, 'Should have no legs');
        assert.equals(route.totals.distance, 0, 'Should have 0 total distance');
    });

    it('should handle null waypoints', () => {
        const route = window.Navigation.calculateRoute(null);

        assert.isArray(route.legs, 'Should return empty legs array');
        assert.equals(route.legs.length, 0, 'Should have no legs');
    });

    it('should apply wind to all legs', () => {
        const waypoints = [
            { lat: 40, lon: -75, ident: 'A' },
            { lat: 42, lon: -75, ident: 'B' },
            { lat: 44, lon: -75, ident: 'C' }
        ];

        const noWind = window.Navigation.calculateRoute(waypoints, { tas: 120 });
        const withWind = window.Navigation.calculateRoute(waypoints, {
            tas: 120,
            wind: { direction: 180, speed: 20 }
        });

        // With tailwind, ground speed should be higher for all legs
        assert.isTrue(withWind.legs[0].groundSpeed > noWind.legs[0].groundSpeed,
            'First leg GS should increase with tailwind');
        assert.isTrue(withWind.legs[1].groundSpeed > noWind.legs[1].groundSpeed,
            'Second leg GS should increase with tailwind');
    });
});

// ============================================
// PURE FUNCTION VERIFICATION
// ============================================

TestFramework.describe('Navigation - Pure Function Behavior', function({ it }) {

    it('should produce same output for same input (distance)', () => {
        const d1 = window.Navigation.calculateDistance(40, -75, 45, -80);
        const d2 = window.Navigation.calculateDistance(40, -75, 45, -80);

        assert.equals(d1, d2, 'Distance should be deterministic');
    });

    it('should produce same output for same input (bearing)', () => {
        const b1 = window.Navigation.calculateBearing(40, -75, 45, -80);
        const b2 = window.Navigation.calculateBearing(40, -75, 45, -80);

        assert.equals(b1, b2, 'Bearing should be deterministic');
    });

    it('should produce same output for same input (wind correction)', () => {
        const w1 = window.Navigation.calculateWindCorrection(90, 120, 270, 20);
        const w2 = window.Navigation.calculateWindCorrection(90, 120, 270, 20);

        assert.deepEquals(w1, w2, 'Wind correction should be deterministic');
    });

    it('should not modify input waypoints', () => {
        const from = { lat: 40, lon: -75, ident: 'A' };
        const to = { lat: 45, lon: -80, ident: 'B' };

        const fromCopy = JSON.stringify(from);
        const toCopy = JSON.stringify(to);

        window.Navigation.calculateLeg(from, to);

        assert.equals(JSON.stringify(from), fromCopy, 'Should not modify from waypoint');
        assert.equals(JSON.stringify(to), toCopy, 'Should not modify to waypoint');
    });

    it('should not modify input waypoints array', () => {
        const waypoints = [
            { lat: 40, lon: -75, ident: 'A' },
            { lat: 45, lon: -80, ident: 'B' }
        ];

        const copy = JSON.stringify(waypoints);

        window.Navigation.calculateRoute(waypoints);

        assert.equals(JSON.stringify(waypoints), copy, 'Should not modify input array');
    });
});

// ============================================
// RETURN FUEL CALCULATIONS
// ============================================

TestFramework.describe('Navigation - Return Fuel Calculations', function({ it }) {

    it('should have calculateReturnFuel method', () => {
        assert.isFunction(window.Navigation.calculateReturnFuel,
            'Should have calculateReturnFuel method');
    });

    it('should return null for invalid inputs', () => {
        assert.isNull(window.Navigation.calculateReturnFuel(null, 10, 100));
        assert.isNull(window.Navigation.calculateReturnFuel([], 10, 100));
        assert.isNull(window.Navigation.calculateReturnFuel([{}], null, 100));
        assert.isNull(window.Navigation.calculateReturnFuel([{}], 10, null));
    });

    it('should calculate return with no wind correctly', () => {
        // No wind: outbound and return should be the same
        const legs = [
            { distance: 100, headwind: 0, legTime: 60 },
            { distance: 100, headwind: 0, legTime: 60 }
        ];
        const burnRate = 10; // gal/hr
        const tas = 100; // kts

        const result = window.Navigation.calculateReturnFuel(legs, burnRate, tas);

        assert.isDefined(result, 'Should return result');
        assert.equals(result.returnTime, 120, 'Return time should equal outbound (120 min)');
        assert.equals(result.timeDifference, 0, 'Time difference should be 0');
        assert.isTrue(Math.abs(result.fuelDifference) < 0.1, 'Fuel difference should be ~0');
    });

    it('should calculate faster return with headwind outbound', () => {
        // Outbound had 20kt headwind, return will have 20kt tailwind
        // TAS 100kt: outbound GS = 80kt, return GS = 120kt
        // Distance 100nm: outbound = 75min, return = 50min
        const legs = [
            { distance: 100, headwind: 20, legTime: 75 }
        ];
        const burnRate = 10; // gal/hr
        const tas = 100; // kts

        const result = window.Navigation.calculateReturnFuel(legs, burnRate, tas);

        assert.isDefined(result, 'Should return result');
        // Return GS = 100 + 20 = 120kt, time = 100/120 * 60 = 50 min
        assert.equals(result.returnTime, 50, 'Return time should be 50 min');
        assert.isTrue(result.timeDifference < 0, 'Return should be faster (negative difference)');
        assert.isTrue(result.fuelDifference < 0, 'Return should use less fuel');
    });

    it('should calculate slower return with tailwind outbound', () => {
        // Outbound had 20kt tailwind (negative headwind), return will have headwind
        // TAS 100kt: outbound GS = 120kt, return GS = 80kt
        const legs = [
            { distance: 100, headwind: -20, legTime: 50 }
        ];
        const burnRate = 10; // gal/hr
        const tas = 100; // kts

        const result = window.Navigation.calculateReturnFuel(legs, burnRate, tas);

        assert.isDefined(result, 'Should return result');
        // Return GS = 100 + (-20) = 80kt, time = 100/80 * 60 = 75 min
        assert.equals(result.returnTime, 75, 'Return time should be 75 min');
        assert.isTrue(result.timeDifference > 0, 'Return should be slower (positive difference)');
        assert.isTrue(result.fuelDifference > 0, 'Return should use more fuel');
    });

    it('should handle multiple legs with different winds', () => {
        // Leg 1: 40kt headwind, Leg 2: 10kt headwind
        const legs = [
            { distance: 100, headwind: 40, legTime: 100 },  // GS = 60kt
            { distance: 100, headwind: 10, legTime: 55 }    // GS = 90kt
        ];
        const burnRate = 10;
        const tas = 100;

        const result = window.Navigation.calculateReturnFuel(legs, burnRate, tas);

        assert.isDefined(result, 'Should return result');
        // Return: Leg 1 GS = 140kt (28.6min), Leg 2 GS = 110kt (54.5min)
        // Total return ~83 min vs outbound 155 min
        assert.isTrue(result.returnTime < result.outboundTime,
            'Return should be faster with headwinds outbound');
        assert.isTrue(result.fuelDifference < 0, 'Return should use less fuel');
    });
});

// ============================================
// SPHERICAL BOUNDING BOX CALCULATIONS
// ============================================

TestFramework.describe('Navigation - Spherical Bounding Box', function({ it }) {

    it('should have calculateSphericalBounds method', () => {
        assert.isFunction(window.Navigation.calculateSphericalBounds,
            'Should have calculateSphericalBounds method');
    });

    it('should handle empty waypoint array', () => {
        const bounds = window.Navigation.calculateSphericalBounds([]);
        assert.isDefined(bounds, 'Should return bounds');
        assert.equals(bounds.minLat, -90, 'Min lat should be -90');
        assert.equals(bounds.maxLat, 90, 'Max lat should be 90');
        assert.equals(bounds.minLon, -180, 'Min lon should be -180');
        assert.equals(bounds.maxLon, 180, 'Max lon should be 180');
    });

    it('should handle single waypoint', () => {
        const waypoints = [{ lat: 37.62, lon: -122.38 }]; // KSFO
        const bounds = window.Navigation.calculateSphericalBounds(waypoints);

        assert.equals(bounds.minLat, 37.62, 'Min lat should equal waypoint lat');
        assert.equals(bounds.maxLat, 37.62, 'Max lat should equal waypoint lat');
        assert.equals(bounds.minLon, -122.38, 'Min lon should equal waypoint lon');
        assert.equals(bounds.maxLon, -122.38, 'Max lon should equal waypoint lon');
    });

    it('should calculate normal bounds for domestic US route (no anti-meridian)', () => {
        const waypoints = [
            { lat: 37.62, lon: -122.38 }, // KSFO (San Francisco)
            { lat: 40.64, lon: -73.78 }   // KJFK (New York)
        ];
        const bounds = window.Navigation.calculateSphericalBounds(waypoints);

        // Latitude is straightforward
        assert.equals(bounds.minLat, 37.62, 'Min lat should be SFO');
        assert.equals(bounds.maxLat, 40.64, 'Max lat should be JFK');

        // Longitude should be simple min/max (west to east)
        assert.equals(bounds.minLon, -122.38, 'Min lon should be SFO (westmost)');
        assert.equals(bounds.maxLon, -73.78, 'Max lon should be JFK (eastmost)');
    });

    it('should handle anti-meridian crossing (Pacific route)', () => {
        const waypoints = [
            { lat: 35.68, lon: 139.65 },  // Tokyo (RJTT): 139.65°E
            { lat: 21.31, lon: -157.86 }  // Honolulu (PHNL): -157.86°E (or 202.14°)
        ];
        const bounds = window.Navigation.calculateSphericalBounds(waypoints);

        // The route crosses the anti-meridian (±180°)
        // Shortest path goes eastward from Tokyo (139.65°) to Honolulu (-157.86°)
        // Crossing the dateline at 180°
        // The bounding box should wrap around correctly

        // Latitude is straightforward
        assert.isTrue(bounds.minLat >= 21.31 && bounds.minLat <= 21.31,
            'Min lat should be around Honolulu');
        assert.isTrue(bounds.maxLat >= 35.68 && bounds.maxLat <= 35.68,
            'Max lat should be around Tokyo');

        // Longitude: the bounds should NOT span the whole globe
        // Correct bounds should be approximately Tokyo (139.65°) to Honolulu (-157.86°)
        // going eastward across the dateline
        const lonSpan = bounds.maxLon - bounds.minLon;
        if (lonSpan < 0) {
            // Handles anti-meridian crossing with minLon > maxLon
            const actualSpan = 360 + (bounds.maxLon - bounds.minLon);
            assert.isTrue(actualSpan < 180,
                `Longitude span should be < 180° for shortest path, got ${actualSpan.toFixed(1)}°`);
        } else {
            assert.isTrue(lonSpan < 180,
                `Longitude span should be < 180° for shortest path, got ${lonSpan.toFixed(1)}°`);
        }
    });

    it('should handle route longer than halfway around Earth', () => {
        // Create a route that goes the "long way" around (> 180° span)
        // Example: From Alaska to Russia, but going WEST (the long way)
        const waypoints = [
            { lat: 61.17, lon: -150.0 },  // PANC (Anchorage): -150°
            { lat: 60.0, lon: -90.0 },    // Waypoint 1
            { lat: 55.0, lon: -30.0 },    // Waypoint 2
            { lat: 50.0, lon: 30.0 },     // Waypoint 3
            { lat: 55.75, lon: 37.62 }    // UUEE (Moscow): 37.62°
        ];
        const bounds = window.Navigation.calculateSphericalBounds(waypoints);

        // Total longitude span: -150° to 37.62° = 187.62°
        // This is > 180°, so we're going the "long way"
        // The bounding box should encompass this entire path

        const lonSpan = Math.abs(bounds.maxLon - bounds.minLon);
        assert.isTrue(lonSpan > 100,
            `For long path, longitude span should be large, got ${lonSpan.toFixed(1)}°`);
    });

    it('should handle route near but not crossing anti-meridian', () => {
        const waypoints = [
            { lat: 60.0, lon: 170.0 },  // Near dateline (west side)
            { lat: 55.0, lon: 175.0 }   // Closer to dateline
        ];
        const bounds = window.Navigation.calculateSphericalBounds(waypoints);

        // Should be simple min/max since we don't cross ±180°
        assert.equals(bounds.minLon, 170.0, 'Min lon should be 170°');
        assert.equals(bounds.maxLon, 175.0, 'Max lon should be 175°');
    });

    it('should handle polar route crossing anti-meridian multiple times', () => {
        const waypoints = [
            { lat: 60.0, lon: -179.0 },  // Just west of dateline
            { lat: 70.0, lon: 179.0 },   // Just east of dateline
            { lat: 75.0, lon: -178.0 },  // Back to west side
            { lat: 80.0, lon: 178.0 }    // Back to east side
        ];
        const bounds = window.Navigation.calculateSphericalBounds(waypoints);

        // Route zigzags across the dateline
        // Bounding box should recognize anti-meridian crossing
        const lonSpan = bounds.maxLon - bounds.minLon;
        if (lonSpan < 0) {
            // Wraps around anti-meridian
            const actualSpan = 360 + lonSpan;
            assert.isTrue(actualSpan < 180,
                'Polar route bounds should use shorter arc');
        } else {
            assert.isTrue(lonSpan < 180,
                'Polar route bounds should use shorter arc');
        }
    });

    it('should normalize longitude values outside -180 to +180 range', () => {
        const waypoints = [
            { lat: 40.0, lon: -190.0 },  // Out of range (should normalize to 170°)
            { lat: 40.0, lon: 200.0 }    // Out of range (should normalize to -160°)
        ];
        const bounds = window.Navigation.calculateSphericalBounds(waypoints);

        // Both longitudes should be normalized
        assert.isTrue(bounds.minLon >= -180 && bounds.minLon <= 180,
            'Min lon should be normalized to -180 to +180 range');
        assert.isTrue(bounds.maxLon >= -180 && bounds.maxLon <= 180,
            'Max lon should be normalized to -180 to +180 range');
    });
});
