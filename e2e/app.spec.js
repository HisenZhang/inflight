// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E Tests: App Bootstrap and Navigation
 * Tests that the application loads correctly and basic navigation works
 */

test.describe('App Bootstrap', () => {

    test('should load the app and display title', async ({ page }) => {
        await page.goto('/');

        // Check page title
        await expect(page).toHaveTitle('IN-FLIGHT');

        // Check main heading is visible
        await expect(page.locator('h1')).toContainText('IN-FLIGHT');
    });

    test('should display welcome tab by default', async ({ page }) => {
        await page.goto('/');

        // Welcome tab should be active
        const welcomeTab = page.locator('[data-tab="welcome"]');
        await expect(welcomeTab).toHaveClass(/active/);

        // Welcome content should be visible
        const welcomeContent = page.locator('#tab-welcome');
        await expect(welcomeContent).toBeVisible();

        // Check for welcome tagline
        await expect(page.locator('.welcome-tagline')).toContainText('EFB Webapp');
    });

    test('should display version information', async ({ page }) => {
        await page.goto('/');

        // Wait for version to be populated
        await page.waitForFunction(() => {
            const el = document.getElementById('app-version');
            return el && el.textContent !== 'Loading...';
        });

        // Check version is displayed (v3.x.x format)
        const versionEl = page.locator('#app-version');
        await expect(versionEl).toContainText('v3.');

        // Check cache version is displayed
        const cacheEl = page.locator('#cache-version');
        await expect(cacheEl).toContainText('flight-planning-v');
    });

    test('should have v3 architecture initialized', async ({ page }) => {
        await page.goto('/');

        // Wait for App to be defined
        await page.waitForFunction(() => window.App !== undefined);

        // Check v3 architecture is initialized
        const architecture = await page.evaluate(() => window.App?.architecture);
        expect(architecture).toBe('v3');

        const version = await page.evaluate(() => window.App?.version);
        expect(version).toBe('3.0.0');
    });

    test('should have all v3 components available', async ({ page }) => {
        await page.goto('/');

        // Wait for bootstrap
        await page.waitForFunction(() => window.App !== undefined);

        // Check core v3 components
        const hasRepository = await page.evaluate(() => !!window.App?.repository);
        const hasQueryEngine = await page.evaluate(() => !!window.App?.queryEngine);
        const hasRouteService = await page.evaluate(() => !!window.App?.routeService);
        const hasWeatherService = await page.evaluate(() => !!window.App?.weatherService);

        expect(hasRepository).toBe(true);
        expect(hasQueryEngine).toBe(true);
        expect(hasRouteService).toBe(true);
        expect(hasWeatherService).toBe(true);

        // Check pure function modules
        const hasNavigation = await page.evaluate(() => !!window.App?.Navigation);
        const hasTerrain = await page.evaluate(() => !!window.App?.Terrain);
        const hasWeather = await page.evaluate(() => !!window.App?.Weather);

        expect(hasNavigation).toBe(true);
        expect(hasTerrain).toBe(true);
        expect(hasWeather).toBe(true);
    });

    test('should have legacy components available for backward compatibility', async ({ page }) => {
        await page.goto('/');

        // Wait for page to load
        await page.waitForFunction(() => window.DataManager !== undefined);

        // Check legacy components exist
        const hasDataManager = await page.evaluate(() => !!window.DataManager);
        const hasQueryEngine = await page.evaluate(() => !!window.QueryEngine);
        const hasRouteCalculator = await page.evaluate(() => !!window.RouteCalculator);

        expect(hasDataManager).toBe(true);
        expect(hasQueryEngine).toBe(true);
        expect(hasRouteCalculator).toBe(true);
    });

});

test.describe('Tab Navigation', () => {

    test('should navigate to DATA tab', async ({ page }) => {
        await page.goto('/');

        // Click DATA tab
        await page.click('[data-tab="data"]');

        // DATA tab should be active
        await expect(page.locator('[data-tab="data"]')).toHaveClass(/active/);

        // DATA content should be visible
        await expect(page.locator('#tab-data')).toBeVisible();

        // Should show database status
        await expect(page.locator('#databaseStatus')).toBeVisible();
    });

    test('should navigate to ENTRY tab', async ({ page }) => {
        await page.goto('/');

        // Click ENTRY tab
        await page.click('[data-tab="route"]');

        // ENTRY tab should be active
        await expect(page.locator('[data-tab="route"]')).toHaveClass(/active/);

        // ENTRY content should be visible
        await expect(page.locator('#tab-route')).toBeVisible();
    });

    test('should navigate to NAVLOG tab', async ({ page }) => {
        await page.goto('/');

        // Click NAVLOG tab
        await page.click('[data-tab="navlog"]');

        // NAVLOG tab should be active
        await expect(page.locator('[data-tab="navlog"]')).toHaveClass(/active/);

        // NAVLOG content should be visible
        await expect(page.locator('#tab-navlog')).toBeVisible();
    });

    test('should navigate to MAP tab', async ({ page }) => {
        await page.goto('/');

        // Click MAP tab
        await page.click('[data-tab="map"]');

        // MAP tab should be active
        await expect(page.locator('[data-tab="map"]')).toHaveClass(/active/);

        // MAP content should be visible
        await expect(page.locator('#tab-map')).toBeVisible();
    });

    test('should navigate through all tabs', async ({ page }) => {
        await page.goto('/');

        const tabs = ['welcome', 'data', 'route', 'navlog', 'wx', 'charts', 'map', 'inflight', 'chklst', 'stats'];

        for (const tab of tabs) {
            await page.click(`[data-tab="${tab}"]`);
            await expect(page.locator(`[data-tab="${tab}"]`)).toHaveClass(/active/);
            await expect(page.locator(`#tab-${tab}`)).toBeVisible();
        }
    });

});

test.describe('GET STARTED Flow', () => {

    test('should navigate to DATA tab when clicking GET STARTED', async ({ page }) => {
        await page.goto('/');

        // Click GET STARTED button
        await page.click('button:has-text("GET STARTED")');

        // Should navigate to DATA tab
        await expect(page.locator('[data-tab="data"]')).toHaveClass(/active/);
        await expect(page.locator('#tab-data')).toBeVisible();
    });

});

test.describe('Responsive Layout', () => {

    test('should work on mobile viewport', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        await page.goto('/');

        // App should still load
        await expect(page.locator('h1')).toContainText('IN-FLIGHT');

        // Tabs should be visible
        await expect(page.locator('.tab-navigation')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
        // Set tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });

        await page.goto('/');

        // App should still load
        await expect(page.locator('h1')).toContainText('IN-FLIGHT');
    });

});
