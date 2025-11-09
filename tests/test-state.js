// Tests for state/flight-state.js

TestFramework.describe('FlightState Management', function({ it, beforeEach }) {

    beforeEach(() => {
        // Clear state before each test
        window.FlightState.clearFlightPlan();
        window.FlightState.stopNavigation();
        window.FlightState.clearStorage();
    });

    // ============================================
    // FLIGHT PLAN MANAGEMENT
    // ============================================

    it('should update flight plan', () => {
        const testPlan = {
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }, { name: 'KSQL' }],
            legs: [{ distance: 25.3 }],
            totalDistance: 25.3,
            totalTime: 12.5,
            fuelStatus: null,
            options: { enableWinds: false }
        };

        window.FlightState.updateFlightPlan(testPlan);
        const plan = window.FlightState.getFlightPlan();

        assert.equals(plan.routeString, 'KSFO KSQL');
        assert.equals(plan.waypoints.length, 2);
        assert.equals(plan.totalDistance, 25.3);
    });

    it('should validate flight plan', () => {
        assert.isFalse(window.FlightState.isFlightPlanValid(), 'Empty plan should be invalid');

        window.FlightState.updateFlightPlan({
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }, { name: 'KSQL' }],
            legs: []
        });

        assert.isTrue(window.FlightState.isFlightPlanValid(), 'Plan with waypoints should be valid');
    });

    it('should clear flight plan', () => {
        window.FlightState.updateFlightPlan({
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }]
        });

        window.FlightState.clearFlightPlan();
        const plan = window.FlightState.getFlightPlan();

        assert.isNull(plan.routeString);
        assert.equals(plan.waypoints.length, 0);
    });

    // ============================================
    // NAVIGATION MANAGEMENT
    // ============================================

    it('should not start navigation without valid plan', () => {
        const result = window.FlightState.startNavigation();
        assert.isFalse(result, 'Should not start without flight plan');
    });

    it('should start navigation with valid plan', () => {
        window.FlightState.updateFlightPlan({
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }, { name: 'KSQL' }],
            legs: [{ distance: 25.3 }]
        });

        const result = window.FlightState.startNavigation();
        assert.isTrue(result, 'Should start with valid plan');
        assert.isTrue(window.FlightState.isNavigationActive());
    });

    it('should update navigation state', () => {
        window.FlightState.updateFlightPlan({
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }, { name: 'KSQL' }],
            legs: [{ distance: 25.3 }]
        });

        window.FlightState.startNavigation();
        window.FlightState.updateNavigation({
            currentPosition: { lat: 37.5, lon: -122.3 },
            distanceToNext: 10.5,
            headingToNext: 45,
            groundSpeed: 120
        });

        const nav = window.FlightState.getNavigationState();
        assert.isNotNull(nav.currentPosition);
        assert.equals(nav.distanceToNext, 10.5);
        assert.equals(nav.headingToNext, 45);
    });

    it('should advance leg', () => {
        window.FlightState.updateFlightPlan({
            routeString: 'KSFO KOAK KSQL',
            waypoints: [{ name: 'KSFO' }, { name: 'KOAK' }, { name: 'KSQL' }],
            legs: [{ distance: 10 }, { distance: 15 }]
        });

        window.FlightState.startNavigation();

        const nav1 = window.FlightState.getNavigationState();
        assert.equals(nav1.activeLegIndex, 0);

        const advanced = window.FlightState.advanceLeg();
        assert.isTrue(advanced);

        const nav2 = window.FlightState.getNavigationState();
        assert.equals(nav2.activeLegIndex, 1);
    });

    it('should not advance past last leg', () => {
        window.FlightState.updateFlightPlan({
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }, { name: 'KSQL' }],
            legs: [{ distance: 25.3 }]
        });

        window.FlightState.startNavigation();
        const advanced = window.FlightState.advanceLeg();
        assert.isFalse(advanced, 'Should not advance past last leg');
    });

    it('should stop navigation', () => {
        window.FlightState.updateFlightPlan({
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }, { name: 'KSQL' }],
            legs: [{ distance: 25.3 }]
        });

        window.FlightState.startNavigation();
        window.FlightState.stopNavigation();

        assert.isFalse(window.FlightState.isNavigationActive());
        const nav = window.FlightState.getNavigationState();
        assert.isNull(nav.currentPosition);
    });

    // ============================================
    // PERSISTENCE
    // ============================================

    it('should save and load from storage', () => {
        const testPlan = {
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }, { name: 'KSQL' }],
            legs: [{ distance: 25.3 }],
            totalDistance: 25.3
        };

        window.FlightState.updateFlightPlan(testPlan);
        const saved = window.FlightState.saveToStorage();
        assert.isTrue(saved);

        window.FlightState.clearFlightPlan();
        const loaded = window.FlightState.loadFromStorage();

        assert.isNotNull(loaded);
        assert.equals(loaded.routeString, 'KSFO KSQL');
        assert.equals(loaded.totalDistance, 25.3);
    });

    it('should restore flight plan', () => {
        const navlogData = {
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }, { name: 'KSQL' }],
            legs: [{ distance: 25.3 }],
            totalDistance: 25.3
        };

        window.FlightState.restoreFlightPlan(navlogData);
        const plan = window.FlightState.getFlightPlan();

        assert.equals(plan.routeString, 'KSFO KSQL');
        assert.equals(plan.totalDistance, 25.3);
    });

    it('should clear storage', () => {
        window.FlightState.updateFlightPlan({
            routeString: 'KSFO KSQL',
            waypoints: [{ name: 'KSFO' }]
        });

        window.FlightState.saveToStorage();
        window.FlightState.clearStorage();

        const loaded = window.FlightState.loadFromStorage();
        assert.isNull(loaded);
    });

    // ============================================
    // ROUTE HISTORY
    // ============================================

    it('should save to history', () => {
        window.FlightState.saveToHistory('KSFO KSQL');
        const history = window.FlightState.loadHistory();

        assert.isArray(history);
        assert.contains(history, 'KSFO KSQL');
    });

    it('should maintain history order (newest first)', () => {
        window.FlightState.saveToHistory('ROUTE1');
        window.FlightState.saveToHistory('ROUTE2');
        window.FlightState.saveToHistory('ROUTE3');

        const history = window.FlightState.loadHistory();
        assert.equals(history[0], 'ROUTE3');
        assert.equals(history[1], 'ROUTE2');
        assert.equals(history[2], 'ROUTE1');
    });

    it('should limit history to 10 entries', () => {
        for (let i = 0; i < 15; i++) {
            window.FlightState.saveToHistory(`ROUTE${i}`);
        }

        const history = window.FlightState.loadHistory();
        assert.lessThan(history.length, 11, 'History should be limited to 10 entries');
    });

    it('should deduplicate history entries', () => {
        window.FlightState.saveToHistory('KSFO KSQL');
        window.FlightState.saveToHistory('KOAK KSQL');
        window.FlightState.saveToHistory('KSFO KSQL'); // Duplicate

        const history = window.FlightState.loadHistory();
        const count = history.filter(r => r === 'KSFO KSQL').length;
        assert.equals(count, 1, 'Should only have one entry of KSFO KSQL');
        assert.equals(history[0], 'KSFO KSQL', 'Duplicate should move to front');
    });
});
