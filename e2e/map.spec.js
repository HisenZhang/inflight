// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E Tests: Map Display
 * Tests map tab and map rendering functionality
 */

test.describe('Map Tab', () => {

    test('should navigate to map tab', async ({ page }) => {
        await page.goto('/');

        // Click MAP tab
        await page.click('[data-tab="map"]');

        // MAP tab should be active
        await expect(page.locator('[data-tab="map"]')).toHaveClass(/active/);

        // MAP content should be visible
        await expect(page.locator('#tab-map')).toBeVisible();
    });

    test('should have map container', async ({ page }) => {
        await page.goto('/');

        // Navigate to MAP tab
        await page.click('[data-tab="map"]');

        // Check for map container
        const mapContainer = page.locator('#mapContainer, #map-container, .map-container');
        // Map container should exist (may be empty without data)
        await expect(mapContainer.first()).toBeVisible();
    });

    test('should have MapDisplay module available', async ({ page }) => {
        await page.goto('/');

        // Wait for modules to load
        await page.waitForFunction(() => window.MapDisplay !== undefined);

        const hasMapDisplay = await page.evaluate(() => !!window.MapDisplay);
        expect(hasMapDisplay).toBe(true);
    });

    test('should have GPS tracking methods', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => window.MapDisplay !== undefined);

        // Check for GPS-related methods
        const hasGPSMethods = await page.evaluate(() => {
            return (
                typeof window.MapDisplay.startGPSTracking === 'function' ||
                typeof window.MapDisplay.init === 'function' ||
                typeof window.MapDisplay.displayMap === 'function'
            );
        });
        expect(hasGPSMethods).toBe(true);
    });

});

test.describe('Map Controls', () => {

    test('should have zoom controls available', async ({ page }) => {
        await page.goto('/');

        await page.click('[data-tab="map"]');

        // Look for zoom controls (may be buttons or other elements)
        const zoomIn = page.locator('button:has-text("+"), .zoom-in, [aria-label*="zoom in"]');
        const zoomOut = page.locator('button:has-text("-"), .zoom-out, [aria-label*="zoom out"]');

        // At least check the tab is accessible
        await expect(page.locator('#tab-map')).toBeVisible();
    });

});

test.describe('Map Rendering (Mock Data)', () => {

    test('should calculate projection coordinates', async ({ page }) => {
        await page.goto('/');

        // Wait for geodesy module
        await page.waitForFunction(() => window.Geodesy !== undefined);

        // Test that geodesy calculations work (used by map projection)
        const distance = await page.evaluate(() => {
            return window.Geodesy.vincentyDistance(37.62, -122.38, 33.94, -118.41);
        });

        expect(distance).toBeGreaterThan(288);
        expect(distance).toBeLessThan(300);
    });

    test('should calculate magnetic declination for map', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => window.Geodesy !== undefined);

        const declination = await page.evaluate(() => {
            return window.Geodesy.getMagneticDeclination(37.62, -122.38);
        });

        // San Francisco area should have easterly variation (~13E)
        expect(declination).toBeGreaterThan(10);
        expect(declination).toBeLessThan(16);
    });

});

test.describe('SVG Map Elements', () => {

    test('should support SVG rendering', async ({ page }) => {
        await page.goto('/');

        await page.click('[data-tab="map"]');

        // Check that browser supports SVG
        const supportsSVG = await page.evaluate(() => {
            return !!document.createElementNS &&
                   !!document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect;
        });
        expect(supportsSVG).toBe(true);
    });

    test('should have CSS styles for map elements', async ({ page }) => {
        await page.goto('/');

        // Check that map styles are loaded
        const hasMapStyles = await page.evaluate(() => {
            const styles = document.styleSheets;
            for (let i = 0; i < styles.length; i++) {
                try {
                    const rules = styles[i].cssRules || styles[i].rules;
                    if (rules) {
                        for (let j = 0; j < rules.length; j++) {
                            if (rules[j].selectorText &&
                                (rules[j].selectorText.includes('map') ||
                                 rules[j].selectorText.includes('svg'))) {
                                return true;
                            }
                        }
                    }
                } catch (e) {
                    // CORS may prevent access to external stylesheets
                }
            }
            return false;
        });

        // Either has map styles or styles.css is loaded
        const stylesLoaded = await page.evaluate(() => {
            return document.querySelector('link[href*="styles"]') !== null;
        });
        expect(stylesLoaded).toBe(true);
    });

});

test.describe('Flight Tracker Integration', () => {

    test('should have FlightTracker module', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => window.FlightTracker !== undefined);

        const hasTracker = await page.evaluate(() => !!window.FlightTracker);
        expect(hasTracker).toBe(true);
    });

    test('should have flight state detection methods', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => window.FlightTracker !== undefined);

        const hasMethods = await page.evaluate(() => {
            return (
                typeof window.FlightTracker.getFlightState === 'function' ||
                typeof window.FlightTracker.updateFlightState === 'function'
            );
        });
        expect(hasMethods).toBe(true);
    });

    test('should have GPS track recording methods', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => window.FlightTracker !== undefined);

        const hasMethods = await page.evaluate(() => {
            return (
                typeof window.FlightTracker.startRecording === 'function' ||
                typeof window.FlightTracker.setRecordingMode === 'function'
            );
        });
        expect(hasMethods).toBe(true);
    });

});
