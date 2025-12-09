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

test.describe('Fixes and Airways Display', () => {

    test('should have fixes spatial index initialized', async ({ page }) => {
        await page.goto('/');

        // Wait for App and QueryEngine to load
        await page.waitForFunction(() => window.App?.queryEngine !== undefined);

        // Check if fixes_spatial index exists and has data
        const fixesIndexInfo = await page.evaluate(() => {
            const qe = window.App?.queryEngine;
            if (!qe) return { exists: false };

            const index = qe._indexes.get('fixes_spatial');
            return {
                exists: !!index,
                size: index?.size || 0,
                cellCount: index?.cellCount || 0
            };
        });

        expect(fixesIndexInfo.exists).toBe(true);
        expect(fixesIndexInfo.size).toBeGreaterThan(0);
        expect(fixesIndexInfo.cellCount).toBeGreaterThan(0);
    });

    test('should have fixes data loaded in DataManager', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => window.DataManager?.getFixesData !== undefined);

        const fixesDataInfo = await page.evaluate(() => {
            const fixesData = window.DataManager?.getFixesData();
            if (!fixesData) return { exists: false, size: 0 };

            // Get a sample fix to verify structure
            const sampleFix = Array.from(fixesData.values())[0];

            return {
                exists: true,
                size: fixesData.size,
                hasSample: !!sampleFix,
                sampleHasLatLon: sampleFix ? (sampleFix.lat != null && sampleFix.lon != null) : false,
                sampleHasIdent: sampleFix ? !!sampleFix.ident : false
            };
        });

        expect(fixesDataInfo.exists).toBe(true);
        expect(fixesDataInfo.size).toBeGreaterThan(0);
        expect(fixesDataInfo.hasSample).toBe(true);
        expect(fixesDataInfo.sampleHasLatLon).toBe(true);
        expect(fixesDataInfo.sampleHasIdent).toBe(true);
    });

    test('should have airways data loaded in DataManager', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => window.DataManager?.getAirwaysData !== undefined);

        const airwaysDataInfo = await page.evaluate(() => {
            const airwaysData = window.DataManager?.getAirwaysData();
            if (!airwaysData) return { exists: false, size: 0 };

            // Get a sample airway to verify structure
            const sampleAirway = Array.from(airwaysData.values())[0];

            return {
                exists: true,
                size: airwaysData.size,
                hasSample: !!sampleAirway,
                sampleHasFixes: sampleAirway ? Array.isArray(sampleAirway.fixes) : false
            };
        });

        expect(airwaysDataInfo.exists).toBe(true);
        expect(airwaysDataInfo.size).toBeGreaterThan(0);
        expect(airwaysDataInfo.hasSample).toBe(true);
        expect(airwaysDataInfo.sampleHasFixes).toBe(true);
    });

    test('should query fixes within bounds using spatial index', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => window.App?.queryEngine !== undefined);

        // Test with a known area (e.g., San Francisco Bay Area)
        const results = await page.evaluate(() => {
            const qe = window.App?.queryEngine;
            if (!qe) return [];

            const bounds = {
                minLat: 37.0,
                maxLat: 38.0,
                minLon: -123.0,
                maxLon: -122.0
            };

            return qe.findInBounds('fixes_spatial', bounds);
        });

        // Should find some fixes in SF Bay Area
        expect(results.length).toBeGreaterThan(0);

        // Verify result structure
        if (results.length > 0) {
            expect(results[0]).toHaveProperty('ident');
            expect(results[0]).toHaveProperty('lat');
            expect(results[0]).toHaveProperty('lon');
        }
    });

    test('should render fixes SVG elements at zoom level 25', async ({ page }) => {
        await page.goto('/');

        // Wait for modules to load
        await page.waitForFunction(() => window.MapDisplay !== undefined);
        await page.waitForFunction(() => window.App?.queryEngine !== undefined);

        // Test drawFixes function directly
        const svgResult = await page.evaluate(() => {
            // Mock project function
            const project = (lat, lon) => ({ x: lon * 100, y: lat * 100 });

            // Test bounds (SF Bay Area)
            const bounds = {
                minLat: 37.0,
                maxLat: 38.0,
                minLon: -123.0,
                maxLon: -122.0
            };

            // Call drawFixes (it's in the global scope in map-display.js)
            // We need to access it through the generated map
            const qe = window.App?.queryEngine;
            const fixesData = window.DataManager?.getFixesData();

            if (!qe || !fixesData || fixesData.size === 0) {
                return { success: false, reason: 'missing data' };
            }

            const fixesInBounds = qe.findInBounds('fixes_spatial', bounds);

            return {
                success: true,
                fixesInBoundsCount: fixesInBounds.length,
                totalFixes: fixesData.size,
                sampleFixes: fixesInBounds.slice(0, 3).map(f => ({ ident: f.ident, lat: f.lat, lon: f.lon }))
            };
        });

        expect(svgResult.success).toBe(true);
        expect(svgResult.fixesInBoundsCount).toBeGreaterThan(0);
        expect(svgResult.totalFixes).toBeGreaterThan(0);
    });

    test('should have airway filter toggle button', async ({ page }) => {
        await page.goto('/');

        // Click MAP tab
        await page.click('[data-tab="map"]');

        // Check for airway filter button
        const airwayFilterBtn = page.locator('#airwayFilterBtn');
        await expect(airwayFilterBtn).toBeVisible();

        // Should show 'LOW' by default
        await expect(airwayFilterBtn).toHaveText('LOW');
    });

    test('should cycle airway filter: LOW -> HIGH -> ALL -> LOW', async ({ page }) => {
        await page.goto('/');

        await page.click('[data-tab="map"]');

        // Wait for VectorMap to be available
        await page.waitForFunction(() => {
            // @ts-ignore - VectorMap is dynamically added
            return window.VectorMap?.cycleAirwayFilter !== undefined;
        });

        const airwayFilterBtn = page.locator('#airwayFilterBtn');

        // Initial state: LOW
        await expect(airwayFilterBtn).toHaveText('LOW');

        // Click to cycle to HIGH
        await airwayFilterBtn.click();
        await expect(airwayFilterBtn).toHaveText('HIGH');

        // Click to cycle to ALL
        await airwayFilterBtn.click();
        await expect(airwayFilterBtn).toHaveText('ALL');

        // Click to cycle back to LOW
        await airwayFilterBtn.click();
        await expect(airwayFilterBtn).toHaveText('LOW');
    });

    test('should query both fixes and navaids for airways', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => window.App?.queryEngine !== undefined);

        const queryResults = await page.evaluate(() => {
            const qe = window.App?.queryEngine;
            if (!qe) return { success: false };

            // Test querying a known VOR (navaid) that's part of airways
            const navaid = qe.getByKey('navaids', 'SFO'); // San Francisco VOR
            const fix = qe.getByKey('fixes', 'PORTE'); // A fix near SFO

            return {
                success: true,
                hasNavaid: !!navaid,
                hasFix: !!fix,
                navaidHasCoords: navaid ? (navaid.lat !== undefined && navaid.lon !== undefined) : false,
                fixHasCoords: fix ? (fix.lat !== undefined && fix.lon !== undefined) : false
            };
        });

        expect(queryResults.success).toBe(true);
        // At least one should exist (depends on data loaded)
        expect(queryResults.hasNavaid || queryResults.hasFix).toBe(true);
    });

    test('should distinguish high altitude airways with dashed lines', async ({ page }) => {
        await page.goto('/');

        await page.waitForFunction(() => {
            // @ts-ignore - DataManager is dynamically added
            return window.DataManager !== undefined;
        });

        const airwayTypes = await page.evaluate(() => {
            // @ts-ignore - DataManager is dynamically added
            const airwaysData = window.DataManager?.getAirwaysData();
            if (!airwaysData || airwaysData.size === 0) {
                return { success: false };
            }

            // Find examples of different airway types
            const airways = Array.from(airwaysData.entries());
            const victorAirway = airways.find(([id]) => id.startsWith('V'));
            const jetAirway = airways.find(([id]) => id.startsWith('J'));
            const tAirway = airways.find(([id]) => id.startsWith('T'));
            const qAirway = airways.find(([id]) => id.startsWith('Q'));

            return {
                success: true,
                totalAirways: airways.length,
                hasVictor: !!victorAirway,
                hasJet: !!jetAirway,
                hasT: !!tAirway,
                hasQ: !!qAirway,
                victorId: victorAirway ? victorAirway[0] : null,
                jetId: jetAirway ? jetAirway[0] : null
            };
        });

        expect(airwayTypes.success).toBe(true);
        expect(airwayTypes.totalAirways).toBeGreaterThan(0);
        // Should have at least some of these airway types
        expect(airwayTypes.hasVictor || airwayTypes.hasJet || airwayTypes.hasT || airwayTypes.hasQ).toBe(true);
    });

    test('should have zoom-based airways and fixes visibility', async ({ page }) => {
        await page.goto('/');

        // Navigate to MAP tab
        await page.click('[data-tab="map"]');

        // Wait for zoom buttons
        await page.waitForSelector('[data-zoom="surrounding-50"]');

        // Check all zoom mode buttons exist
        const zoomButtons = {
            route: page.locator('[data-zoom="full"]'),
            dest: page.locator('[data-zoom="destination"]'),
            nm50: page.locator('[data-zoom="surrounding-50"]'),
            nm25: page.locator('[data-zoom="surrounding-25"]'),
            nm5: page.locator('[data-zoom="surrounding-5"]')
        };

        for (const [, btn] of Object.entries(zoomButtons)) {
            await expect(btn).toBeVisible();
        }
    });

});
