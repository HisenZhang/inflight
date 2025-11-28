// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E Tests: Route Planning
 * Tests route entry, calculation, and navlog generation
 */

test.describe('Route Entry Tab', () => {

    test('should show placeholder when database not loaded', async ({ page }) => {
        await page.goto('/');

        // Navigate to ENTRY tab
        await page.click('[data-tab="route"]');

        // Should show placeholder
        await expect(page.locator('#routePlaceholder')).toBeVisible();

        // Should show "LOAD DATABASE" button in placeholder
        await expect(page.locator('#routePlaceholder button')).toContainText('LOAD DATABASE');
    });

    test('should have disabled inputs before database loaded', async ({ page }) => {
        await page.goto('/');

        // Navigate to ENTRY tab
        await page.click('[data-tab="route"]');

        // Check that departure input exists but is disabled
        const departureInput = page.locator('#departureInput');
        await expect(departureInput).toBeDisabled();
    });

});

test.describe('Route Calculation (with mock data)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Wait for app to initialize
        await page.waitForFunction(() => window.App !== undefined);
    });

    test('should have Navigation pure functions available', async ({ page }) => {
        // Test Navigation.calculateDistance
        const distance = await page.evaluate(() => {
            return window.Navigation.calculateDistance(37.62, -122.38, 33.94, -118.41);
        });

        // SFO to LAX should be ~294nm
        expect(distance).toBeGreaterThan(288);
        expect(distance).toBeLessThan(300);
    });

    test('should have Navigation.calculateBearing available', async ({ page }) => {
        // Test bearing calculation
        const bearing = await page.evaluate(() => {
            return window.Navigation.calculateBearing(37.62, -122.38, 33.94, -118.41);
        });

        // SFO to LAX should be ~137 degrees
        expect(bearing).toBeGreaterThan(130);
        expect(bearing).toBeLessThan(145);
    });

    test('should have Navigation.calculateWindCorrection available', async ({ page }) => {
        // Test wind correction
        const result = await page.evaluate(() => {
            return window.Navigation.calculateWindCorrection(180, 120, 270, 20);
        });

        expect(result).toHaveProperty('heading');
        expect(result).toHaveProperty('groundSpeed');
        expect(result).toHaveProperty('windCorrectionAngle');
    });

    test('should calculate route with Navigation.calculateRoute', async ({ page }) => {
        // Test full route calculation
        const result = await page.evaluate(() => {
            const waypoints = [
                { lat: 37.62, lon: -122.38, ident: 'KSFO' },
                { lat: 33.94, lon: -118.41, ident: 'KLAX' }
            ];
            return window.Navigation.calculateRoute(waypoints, { tas: 120 });
        });

        expect(result.legs).toHaveLength(1);
        expect(result.totals.distance).toBeGreaterThan(288);
        expect(result.totals.distance).toBeLessThan(300);
        expect(result.totals.ete).toBeGreaterThan(0);
    });

    test('should calculate multi-leg route', async ({ page }) => {
        const result = await page.evaluate(() => {
            const waypoints = [
                { lat: 37.62, lon: -122.38, ident: 'KSFO' },
                { lat: 36.0, lon: -121.0, ident: 'MID' },
                { lat: 33.94, lon: -118.41, ident: 'KLAX' }
            ];
            return window.Navigation.calculateRoute(waypoints, { tas: 120 });
        });

        expect(result.legs).toHaveLength(2);
        expect(result.totals.distance).toBeGreaterThan(0);
    });

});

test.describe('Terrain Analysis', () => {

    test('should have Terrain pure functions available', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.Terrain !== undefined);

        // Check Terrain module exists
        const hasTerrain = await page.evaluate(() => !!window.Terrain);
        expect(hasTerrain).toBe(true);
    });

    test('should analyze terrain profile', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.Terrain !== undefined);

        const result = await page.evaluate(() => {
            const waypoints = [
                { lat: 37.62, lon: -122.38 },
                { lat: 36.0, lon: -121.0 },
                { lat: 33.94, lon: -118.41 }
            ];
            const moraData = new Map([
                ['37,-122', { lat: 37, lon: -122, mora: 4000 }],
                ['36,-121', { lat: 36, lon: -121, mora: 5500 }],
                ['34,-118', { lat: 34, lon: -118, mora: 3500 }]
            ]);
            return window.Terrain.analyzeProfile(waypoints, moraData);
        });

        expect(result.maxMORA).toBe(5500);
        expect(result.minMORA).toBe(3500);
    });

    test('should check clearance', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.Terrain !== undefined);

        const result = await page.evaluate(() => {
            const analysis = {
                maxMORA: 6000,
                minMORA: 3000,
                maxTerrain: 5000,
                isMountainous: true,
                requiredClearance: 2000
            };
            return window.Terrain.checkClearance(analysis, 8000);
        });

        expect(result.status).toBe('OK');
        expect(result.clearance).toBe(3000);
    });

});

test.describe('Weather Functions', () => {

    test('should have Weather pure functions available', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.Weather !== undefined);

        const hasWeather = await page.evaluate(() => !!window.Weather);
        expect(hasWeather).toBe(true);
    });

    test('should determine flight category', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.Weather !== undefined);

        // Test VFR
        const vfr = await page.evaluate(() => window.Weather.getFlightCategory(10, 5000));
        expect(vfr).toBe('VFR');

        // Test MVFR
        const mvfr = await page.evaluate(() => window.Weather.getFlightCategory(4, 2500));
        expect(mvfr).toBe('MVFR');

        // Test IFR
        const ifr = await page.evaluate(() => window.Weather.getFlightCategory(2, 800));
        expect(ifr).toBe('IFR');

        // Test LIFR
        const lifr = await page.evaluate(() => window.Weather.getFlightCategory(0.5, 200));
        expect(lifr).toBe('LIFR');
    });

    test('should calculate density altitude', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.Weather !== undefined);

        const da = await page.evaluate(() => {
            return window.Weather.calculateDensityAltitude(5000, 30, 29.92);
        });

        // Hot day at 5000ft should have DA > 5000
        expect(da).toBeGreaterThan(5000);
    });

    test('should parse METAR', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.Weather !== undefined);

        const metar = await page.evaluate(() => {
            return window.Weather.parseMETAR('KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012');
        });

        expect(metar.station).toBe('KSFO');
        expect(metar.visibility).toBe(10);
    });

});

test.describe('Query Engine v2', () => {

    test('should have QueryEngineV2 initialized', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.App?.queryEngine !== undefined);

        const hasQE = await page.evaluate(() => !!window.App.queryEngine);
        expect(hasQE).toBe(true);
    });

    test('should have index registration methods', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.QueryEngineV2 !== undefined);

        const hasRegister = await page.evaluate(() => {
            return typeof window.QueryEngineV2.prototype.registerIndex === 'function';
        });
        expect(hasRegister).toBe(true);
    });

});
