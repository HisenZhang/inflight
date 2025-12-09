// Main Bootstrap - Application Initialization
// Architecture v3.0.0 - Bootstrap Sequence

(function() {
    'use strict';

    /**
     * Bootstrap the IN-FLIGHT application with v3 architecture.
     *
     * Initialization sequence:
     * 1. Create storage adapter
     * 2. Create data repository
     * 3. Create query engine with indexes
     * 4. Create services
     * 5. Try to load data from IndexedDB cache
     * 6. Export to window.App
     */
    async function bootstrap() {
        console.log('[App v3] Bootstrapping v3 architecture...');
        const startTime = performance.now();

        try {
            // 1. Create storage adapter
            const storage = new window.MemoryStorage();

            // 2. Create data repository
            const repository = new window.DataRepository()
                .setStorage(storage);

            // 3. Create query engine with indexes
            const queryEngine = new window.QueryEngineV2()
                .registerIndex('airports', new window.MapIndex())
                .registerIndex('airports_search', new window.TrieIndex())
                .registerIndex('airports_spatial', new window.SpatialGridIndex())
                .registerIndex('navaids', new window.MapIndex())
                .registerIndex('navaids_search', new window.TrieIndex())
                .registerIndex('navaids_spatial', new window.SpatialGridIndex())
                .registerIndex('fixes', new window.MapIndex())
                .registerIndex('fixes_search', new window.TrieIndex())
                .registerIndex('fixes_spatial', new window.SpatialGridIndex())
                .registerIndex('airways', new window.MapIndex())
                .registerIndex('tokenTypes', new window.MapIndex());

            // 4. Create services
            const routeService = new window.RouteService({
                queryEngine,
                dataRepository: repository
            });

            const weatherService = new window.WeatherService({
                dataRepository: repository
            });

            // 5. Export to window.App
            window.App = {
                // Core components
                repository,
                queryEngine,
                storage,

                // Services
                routeService,
                weatherService,

                // Pure function modules (v3)
                Navigation: window.Navigation,
                Terrain: window.Terrain,
                Weather: window.Weather,

                // Version info
                version: '3.0.0',
                architecture: 'v3',

                // Utility functions
                isReady: () => queryEngine.isReady(),
                getStats: () => queryEngine.getStats(),

                // Initialize from IndexedDB
                loadFromCache: loadDataFromIndexedDB
            };

            const elapsed = Math.round(performance.now() - startTime);
            console.log(`[App v3] Bootstrap complete in ${elapsed}ms`);

            return window.App;

        } catch (error) {
            console.error('[App v3] Bootstrap failed:', error);
            throw error;
        }
    }

    /**
     * Load aviation data from IndexedDB cache.
     * This is called automatically on app startup.
     */
    async function loadDataFromIndexedDB() {
        console.log('[App v3] Loading data from IndexedDB...');
        const startTime = performance.now();

        try {
            // Create IndexedDB source
            const dbSource = new window.IndexedDBSource();

            // Load data
            const data = await dbSource.load();

            if (!data || data.airports.size === 0) {
                console.log('[App v3] No cached data found in IndexedDB');
                return false;
            }

            console.log('[App v3] Data loaded from IndexedDB:', {
                airports: data.airports.size,
                navaids: data.navaids.size,
                fixes: data.fixes.size,
                airways: data.airways.size
            });

            // Build query engine indexes
            const qe = window.App.queryEngine;

            if (data.airports.size > 0) {
                console.log(`[App v3] Building airport indexes (${data.airports.size} entries)`);
                qe._indexes.get('airports')?.build(data.airports);
                qe._indexes.get('airports_search')?.build(data.airports);
                qe._indexes.get('airports_spatial')?.build(data.airports);
            }

            if (data.navaids.size > 0) {
                console.log(`[App v3] Building navaid indexes (${data.navaids.size} entries)`);
                qe._indexes.get('navaids')?.build(data.navaids);
                qe._indexes.get('navaids_search')?.build(data.navaids);
                qe._indexes.get('navaids_spatial')?.build(data.navaids);
            }

            if (data.fixes.size > 0) {
                console.log(`[App v3] Building fix indexes (${data.fixes.size} entries)`);
                qe._indexes.get('fixes')?.build(data.fixes);
                qe._indexes.get('fixes_search')?.build(data.fixes);
                qe._indexes.get('fixes_spatial')?.build(data.fixes);
            }

            if (data.airways.size > 0) {
                console.log(`[App v3] Building airway indexes (${data.airways.size} entries)`);
                // Log sample airways for debugging
                const sampleAirways = Array.from(data.airways.entries()).slice(0, 10);
                console.log('[App v3] Sample airways:', sampleAirways.map(([id, awy]) => `${id} (${awy.fixes?.length || 0} fixes)`).join(', '));
                qe._indexes.get('airways')?.build(data.airways);
            }

            // Build token type index
            const tokenTypes = new Map();
            for (const [code] of data.airports) tokenTypes.set(code, 'AIRPORT');
            for (const [code] of data.navaids) tokenTypes.set(code, 'NAVAID');
            for (const [code] of data.fixes) tokenTypes.set(code, 'FIX');
            for (const [code] of data.airways) tokenTypes.set(code, 'AIRWAY');
            qe._indexes.get('tokenTypes')?.build(tokenTypes);

            qe._initialized = true;

            const elapsed = Math.round(performance.now() - startTime);
            console.log(`[App v3] IndexedDB data loaded in ${elapsed}ms`);
            console.log('[App v3] Stats:', window.App.getStats());

            // Close DB connection
            dbSource.close();

            return true;

        } catch (error) {
            console.error('[App v3] Failed to load from IndexedDB:', error);
            return false;
        }
    }

    // Export bootstrap function
    window.bootstrapApp = bootstrap;

    // Auto-bootstrap when script loads
    bootstrap().catch(err => {
        console.error('[App v3] Auto-bootstrap failed:', err);
    });

})();
