// Data Repository - Central Data Access Facade
// Architecture v3.0.0 - Data Layer

(function() {
    'use strict';

    /**
     * Main data access facade.
     * All data flows through here.
     * Implements multi-level caching: L1 (memory) → L2 (persistent) → L3 (source)
     */
    class DataRepository {
        constructor() {
            this._sources = new Map();
            this._caches = new Map();
            this._storage = null;
        }

        /**
         * Set the persistent storage adapter
         * @param {StorageAdapter} storageAdapter - Storage implementation
         * @returns {DataRepository} this for chaining
         */
        setStorage(storageAdapter) {
            this._storage = storageAdapter;
            return this;
        }

        /**
         * Register a data source with its cache strategy
         * @param {string} name - Unique source name
         * @param {DataSource} source - Data source implementation
         * @param {CacheStrategy} cacheStrategy - Cache validity strategy
         * @returns {DataRepository} this for chaining
         */
        registerSource(name, source, cacheStrategy) {
            this._sources.set(name, source);
            this._caches.set(name, {
                strategy: cacheStrategy,
                memory: new Map()
            });
            return this;
        }

        /**
         * Get data with multi-level caching
         * @param {string} sourceName - Name of registered source
         * @param {string} key - Cache key (use '_all' for all data)
         * @returns {Promise<any>} Cached or freshly loaded data
         */
        async get(sourceName, key) {
            const cache = this._caches.get(sourceName);
            if (!cache) {
                console.warn(`[DataRepository] Unknown source: ${sourceName}`);
                return null;
            }

            // L1: Memory cache
            if (cache.memory.has(key)) {
                const entry = cache.memory.get(key);
                if (cache.strategy.isValid(entry)) {
                    console.debug(`[DataRepository] L1 cache hit: ${sourceName}:${key}`);
                    return entry.data;
                }
            }

            // L2: Persistent storage
            if (this._storage) {
                const storeKey = `${sourceName}:${key}`;
                const stored = await this._storage.get(storeKey);
                if (stored && cache.strategy.isValid(stored)) {
                    console.debug(`[DataRepository] L2 cache hit: ${sourceName}:${key}`);
                    cache.memory.set(key, stored);
                    return stored.data;
                }
            }

            // L3: Source (fetch fresh data)
            console.log(`[DataRepository] L3 source fetch: ${sourceName}`);
            const source = this._sources.get(sourceName);
            if (!source) {
                console.error(`[DataRepository] Source not found: ${sourceName}`);
                return null;
            }

            try {
                const data = await source.load();
                const entry = cache.strategy.createEntry(data);

                // Store in L1 and L2
                cache.memory.set(key, entry);
                if (this._storage) {
                    await this._storage.set(`${sourceName}:${key}`, entry);
                }

                return data;
            } catch (error) {
                console.error(`[DataRepository] Failed to load ${sourceName}:`, error);
                return null;
            }
        }

        /**
         * Get all data from a source
         * @param {string} sourceName - Name of registered source
         * @returns {Promise<any>} All data from source
         */
        async getAll(sourceName) {
            return this.get(sourceName, '_all');
        }

        /**
         * Load all registered sources
         * @returns {Promise<Object>} Object with source names as keys
         */
        async loadAll() {
            const results = {};
            for (const [name] of this._sources) {
                results[name] = await this.getAll(name);
            }
            return results;
        }

        /**
         * Clear cache for a specific source
         * @param {string} sourceName - Name of source to clear
         * @returns {Promise<void>}
         */
        async clearCache(sourceName) {
            const cache = this._caches.get(sourceName);
            if (cache) {
                cache.memory.clear();
            }

            if (this._storage) {
                const keys = await this._storage.keys();
                for (const key of keys) {
                    if (key.startsWith(`${sourceName}:`)) {
                        await this._storage.delete(key);
                    }
                }
            }
        }

        /**
         * Clear all caches
         * @returns {Promise<void>}
         */
        async clearAllCaches() {
            for (const [name, cache] of this._caches) {
                cache.memory.clear();
            }

            if (this._storage) {
                await this._storage.clear();
            }
        }

        /**
         * Check if a source is registered
         * @param {string} sourceName - Source name
         * @returns {boolean} True if source exists
         */
        hasSource(sourceName) {
            return this._sources.has(sourceName);
        }

        /**
         * Get list of registered source names
         * @returns {string[]} Array of source names
         */
        getSourceNames() {
            return Array.from(this._sources.keys());
        }
    }

    // Export to window
    window.DataRepository = DataRepository;

})();
