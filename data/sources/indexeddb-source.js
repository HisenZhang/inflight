// IndexedDB Data Source - Load aviation data from IndexedDB
// Architecture v3.0.0 - Data Layer

(function() {
    'use strict';

    const DB_NAME = 'FlightPlanningDB';
    const DB_VERSION = 12;
    const STORE_NAME = 'flightdata';
    const CACHE_KEY = 'flightdata_cache_v12';

    /**
     * Data source that reads aviation data from IndexedDB.
     * Used to load cached NASR data that was previously downloaded and parsed.
     */
    class IndexedDBSource extends window.DataSource {
        constructor(config = {}) {
            super(config);
            this._db = null;
        }

        /**
         * Open IndexedDB connection
         * @private
         */
        async _openDB() {
            if (this._db) return this._db;

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this._db = request.result;
                    resolve(this._db);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                };
            });
        }

        /**
         * Fetch data from IndexedDB
         * @returns {Promise<Object|null>} Cached data or null if not found
         */
        async fetch() {
            const db = await this._openDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(CACHE_KEY);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result || null);
                };
            });
        }

        /**
         * Parse IndexedDB data into Maps
         * @param {Object|null} rawData - Raw data from IndexedDB
         * @returns {Promise<Object>} Parsed data with Maps
         */
        async parse(rawData) {
            if (!rawData) {
                return {
                    airports: new Map(),
                    navaids: new Map(),
                    fixes: new Map(),
                    airways: new Map(),
                    frequencies: new Map(),
                    iataToIcao: new Map()
                };
            }

            // Convert arrays back to Maps
            return {
                airports: new Map(rawData.airports || []),
                navaids: new Map(rawData.navaids || []),
                fixes: new Map(rawData.fixes || []),
                airways: new Map(rawData.airways || []),
                frequencies: new Map(rawData.frequencies || []),
                iataToIcao: new Map(rawData.iataToIcao || [])
            };
        }

        /**
         * Validate that we have some data
         * @param {Object} data - Parsed data
         * @returns {Promise<boolean>} True if valid
         */
        async validate(data) {
            // At least one dataset should have data if cache exists
            return data.airports.size > 0 ||
                   data.navaids.size > 0 ||
                   data.fixes.size > 0;
        }

        /**
         * Close database connection
         */
        close() {
            if (this._db) {
                this._db.close();
                this._db = null;
            }
        }
    }

    // Export to window
    window.IndexedDBSource = IndexedDBSource;

})();
