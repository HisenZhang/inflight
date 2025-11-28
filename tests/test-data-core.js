// Tests for data/core/* - DataSource, StorageAdapter, CacheStrategy
// Architecture v3.0.0 - Data Layer Core Abstractions

// ============================================
// DATA SOURCE TESTS
// ============================================

TestFramework.describe('DataSource - Abstract Base Class', function({ it, beforeEach }) {

    it('should have DataSource defined', () => {
        assert.isDefined(window.DataSource, 'DataSource should be defined');
    });

    it('should be a class/constructor', () => {
        assert.isFunction(window.DataSource, 'DataSource should be a constructor');
    });

    it('should throw on direct fetch() call', async () => {
        const source = new window.DataSource({});
        await assert.throwsAsync(async () => {
            await source.fetch();
        }, 'Abstract fetch() should throw');
    });

    it('should throw on direct parse() call', async () => {
        const source = new window.DataSource({});
        await assert.throwsAsync(async () => {
            await source.parse('data');
        }, 'Abstract parse() should throw');
    });

    it('should have default validate() that returns true', async () => {
        const source = new window.DataSource({});
        const result = await source.validate({ test: 'data' });
        assert.isTrue(result, 'Default validate should return true');
    });

    it('should have default transform() that returns data unchanged', async () => {
        const source = new window.DataSource({});
        const data = { test: 'data' };
        const result = await source.transform(data);
        assert.deepEquals(result, data, 'Default transform should return data unchanged');
    });

    it('should store config in constructor', () => {
        const config = { baseUrl: 'http://test.com', file: 'test.csv' };
        const source = new window.DataSource(config);
        assert.deepEquals(source.config, config, 'Should store config');
    });

    it('should have name property from constructor name', () => {
        const source = new window.DataSource({});
        assert.equals(source.name, 'DataSource', 'Name should be constructor name');
    });
});

TestFramework.describe('DataSource - Template Method (load)', function({ it }) {

    it('should have load() method', () => {
        const source = new window.DataSource({});
        assert.isFunction(source.load, 'Should have load method');
    });

    it('should orchestrate fetch -> parse -> validate -> transform', async () => {
        // Create a concrete implementation for testing
        class TestSource extends window.DataSource {
            constructor() {
                super({});
                this.callOrder = [];
            }
            async fetch() {
                this.callOrder.push('fetch');
                return 'raw data';
            }
            async parse(raw) {
                this.callOrder.push('parse');
                return { parsed: raw };
            }
            async validate(data) {
                this.callOrder.push('validate');
                return true;
            }
            async transform(data) {
                this.callOrder.push('transform');
                return { ...data, transformed: true };
            }
        }

        const source = new TestSource();
        const result = await source.load();

        assert.deepEquals(source.callOrder, ['fetch', 'parse', 'validate', 'transform'],
            'Should call methods in order');
        assert.isTrue(result.transformed, 'Should return transformed data');
    });

    it('should throw if validation fails', async () => {
        class InvalidSource extends window.DataSource {
            async fetch() { return 'data'; }
            async parse(raw) { return { data: raw }; }
            async validate(data) { return false; }
        }

        const source = new InvalidSource();
        await assert.throwsAsync(async () => {
            await source.load();
        }, 'Should throw on validation failure');
    });
});

// ============================================
// STORAGE ADAPTER TESTS
// ============================================

TestFramework.describe('StorageAdapter - Abstract Interface', function({ it }) {

    it('should have StorageAdapter defined', () => {
        assert.isDefined(window.StorageAdapter, 'StorageAdapter should be defined');
    });

    it('should be a class/constructor', () => {
        assert.isFunction(window.StorageAdapter, 'StorageAdapter should be a constructor');
    });

    it('should throw on direct get() call', async () => {
        const adapter = new window.StorageAdapter();
        await assert.throwsAsync(async () => {
            await adapter.get('key');
        }, 'Abstract get() should throw');
    });

    it('should throw on direct set() call', async () => {
        const adapter = new window.StorageAdapter();
        await assert.throwsAsync(async () => {
            await adapter.set('key', 'value');
        }, 'Abstract set() should throw');
    });

    it('should throw on direct delete() call', async () => {
        const adapter = new window.StorageAdapter();
        await assert.throwsAsync(async () => {
            await adapter.delete('key');
        }, 'Abstract delete() should throw');
    });

    it('should throw on direct clear() call', async () => {
        const adapter = new window.StorageAdapter();
        await assert.throwsAsync(async () => {
            await adapter.clear();
        }, 'Abstract clear() should throw');
    });

    it('should throw on direct keys() call', async () => {
        const adapter = new window.StorageAdapter();
        await assert.throwsAsync(async () => {
            await adapter.keys();
        }, 'Abstract keys() should throw');
    });

    it('should throw on direct has() call', async () => {
        const adapter = new window.StorageAdapter();
        await assert.throwsAsync(async () => {
            await adapter.has('key');
        }, 'Abstract has() should throw');
    });
});

// ============================================
// CACHE STRATEGY TESTS
// ============================================

TestFramework.describe('CacheStrategy - Abstract Base', function({ it }) {

    it('should have CacheStrategy defined', () => {
        assert.isDefined(window.CacheStrategy, 'CacheStrategy should be defined');
    });

    it('should throw on direct isValid() call', () => {
        const strategy = new window.CacheStrategy();
        assert.throws(() => {
            strategy.isValid({});
        }, 'Abstract isValid() should throw');
    });

    it('should have createEntry() method', () => {
        const strategy = new window.CacheStrategy();
        assert.isFunction(strategy.createEntry, 'Should have createEntry method');
    });

    it('should create entry with timestamp', () => {
        const strategy = new window.CacheStrategy();
        const before = Date.now();
        const entry = strategy.createEntry({ test: 'data' });
        const after = Date.now();

        assert.isDefined(entry.timestamp, 'Entry should have timestamp');
        assert.isTrue(entry.timestamp >= before && entry.timestamp <= after,
            'Timestamp should be current time');
        assert.deepEquals(entry.data, { test: 'data' }, 'Entry should contain data');
    });

    it('should include metadata in entry', () => {
        const strategy = new window.CacheStrategy();
        const entry = strategy.createEntry({ test: 'data' }, { version: '1.0' });

        assert.equals(entry.version, '1.0', 'Entry should include metadata');
    });
});

TestFramework.describe('TTLStrategy - Time-Based Cache', function({ it }) {

    it('should have TTLStrategy defined', () => {
        assert.isDefined(window.TTLStrategy, 'TTLStrategy should be defined');
    });

    it('should accept duration in constructor', () => {
        const strategy = new window.TTLStrategy(5000);
        assert.equals(strategy.duration, 5000, 'Should store duration');
    });

    it('should return true for fresh entries', () => {
        const strategy = new window.TTLStrategy(5000);
        const entry = { data: 'test', timestamp: Date.now() };

        assert.isTrue(strategy.isValid(entry), 'Fresh entry should be valid');
    });

    it('should return false for expired entries', () => {
        const strategy = new window.TTLStrategy(5000);
        const entry = { data: 'test', timestamp: Date.now() - 10000 };

        assert.isFalse(strategy.isValid(entry), 'Expired entry should be invalid');
    });

    it('should return false for entries exactly at expiry', () => {
        const strategy = new window.TTLStrategy(5000);
        const entry = { data: 'test', timestamp: Date.now() - 5000 };

        assert.isFalse(strategy.isValid(entry), 'Entry at expiry should be invalid');
    });
});

TestFramework.describe('PermanentStrategy - Never Expires', function({ it }) {

    it('should have PermanentStrategy defined', () => {
        assert.isDefined(window.PermanentStrategy, 'PermanentStrategy should be defined');
    });

    it('should always return true for isValid', () => {
        const strategy = new window.PermanentStrategy();

        // Test with various entries
        assert.isTrue(strategy.isValid({ timestamp: 0 }), 'Old entry should be valid');
        assert.isTrue(strategy.isValid({ timestamp: Date.now() }), 'New entry should be valid');
        assert.isTrue(strategy.isValid({}), 'Entry without timestamp should be valid');
    });
});

TestFramework.describe('VersionStrategy - Version-Based Cache', function({ it }) {

    it('should have VersionStrategy defined', () => {
        assert.isDefined(window.VersionStrategy, 'VersionStrategy should be defined');
    });

    it('should accept version validator function', () => {
        const validator = (v) => v === '2.0';
        const strategy = new window.VersionStrategy(validator);

        assert.isFunction(strategy.isVersionValid, 'Should store validator function');
    });

    it('should validate entry version', () => {
        const validator = (v) => v === '2.0';
        const strategy = new window.VersionStrategy(validator);

        const validEntry = { data: 'test', version: '2.0' };
        const invalidEntry = { data: 'test', version: '1.0' };

        assert.isTrue(strategy.isValid(validEntry), 'Matching version should be valid');
        assert.isFalse(strategy.isValid(invalidEntry), 'Non-matching version should be invalid');
    });
});

// ============================================
// MEMORY STORAGE TESTS
// ============================================

TestFramework.describe('MemoryStorage - In-Memory Implementation', function({ it, beforeEach }) {
    let storage;

    beforeEach(() => {
        storage = new window.MemoryStorage();
    });

    it('should have MemoryStorage defined', () => {
        assert.isDefined(window.MemoryStorage, 'MemoryStorage should be defined');
    });

    it('should implement StorageAdapter interface', () => {
        assert.isFunction(storage.get, 'Should have get method');
        assert.isFunction(storage.set, 'Should have set method');
        assert.isFunction(storage.delete, 'Should have delete method');
        assert.isFunction(storage.clear, 'Should have clear method');
        assert.isFunction(storage.keys, 'Should have keys method');
        assert.isFunction(storage.has, 'Should have has method');
    });

    it('should store and retrieve values', async () => {
        await storage.set('testKey', { data: 'testValue' });
        const result = await storage.get('testKey');

        assert.deepEquals(result, { data: 'testValue' }, 'Should retrieve stored value');
    });

    it('should return null for missing keys', async () => {
        const result = await storage.get('nonexistent');
        assert.isNull(result, 'Should return null for missing key');
    });

    it('should delete values', async () => {
        await storage.set('testKey', 'value');
        await storage.delete('testKey');
        const result = await storage.get('testKey');

        assert.isNull(result, 'Should return null after delete');
    });

    it('should clear all values', async () => {
        await storage.set('key1', 'value1');
        await storage.set('key2', 'value2');
        await storage.clear();

        const keys = await storage.keys();
        assert.equals(keys.length, 0, 'Should have no keys after clear');
    });

    it('should list all keys', async () => {
        await storage.set('key1', 'value1');
        await storage.set('key2', 'value2');

        const keys = await storage.keys();
        assert.isArray(keys, 'Should return array');
        assert.contains(keys, 'key1', 'Should contain key1');
        assert.contains(keys, 'key2', 'Should contain key2');
    });

    it('should check if key exists', async () => {
        await storage.set('exists', 'value');

        const hasExisting = await storage.has('exists');
        const hasMissing = await storage.has('missing');

        assert.isTrue(hasExisting, 'Should return true for existing key');
        assert.isFalse(hasMissing, 'Should return false for missing key');
    });
});

// ============================================
// DATA REPOSITORY TESTS
// ============================================

TestFramework.describe('DataRepository - Central Data Access', function({ it, beforeEach }) {
    let repository;
    let mockStorage;

    beforeEach(() => {
        repository = new window.DataRepository();
        mockStorage = new window.MemoryStorage();
    });

    it('should have DataRepository defined', () => {
        assert.isDefined(window.DataRepository, 'DataRepository should be defined');
    });

    it('should allow setting storage adapter', () => {
        const result = repository.setStorage(mockStorage);
        assert.equals(result, repository, 'setStorage should return this for chaining');
    });

    it('should allow registering data sources', () => {
        const mockSource = {
            load: async () => new Map([['TEST', { data: 'test' }]])
        };
        const strategy = new window.PermanentStrategy();

        const result = repository.registerSource('test', mockSource, strategy);
        assert.equals(result, repository, 'registerSource should return this for chaining');
    });

    it('should fetch data from source on cache miss', async () => {
        let fetchCount = 0;
        const mockSource = {
            load: async () => {
                fetchCount++;
                return new Map([['TEST', { data: 'test' }]]);
            }
        };

        repository.registerSource('test', mockSource, new window.PermanentStrategy());

        const result = await repository.getAll('test');
        assert.equals(fetchCount, 1, 'Should fetch from source');
        assert.isTrue(result instanceof Map, 'Should return Map');
    });

    it('should use memory cache on subsequent requests', async () => {
        let fetchCount = 0;
        const mockSource = {
            load: async () => {
                fetchCount++;
                return new Map([['TEST', { data: 'test' }]]);
            }
        };

        repository.registerSource('test', mockSource, new window.PermanentStrategy());

        await repository.getAll('test');
        await repository.getAll('test');
        await repository.getAll('test');

        assert.equals(fetchCount, 1, 'Should only fetch once');
    });

    it('should clear cache for specific source', async () => {
        let fetchCount = 0;
        const mockSource = {
            load: async () => {
                fetchCount++;
                return new Map([['TEST', { data: 'test' }]]);
            }
        };

        repository.registerSource('test', mockSource, new window.PermanentStrategy());

        await repository.getAll('test');
        await repository.clearCache('test');
        await repository.getAll('test');

        assert.equals(fetchCount, 2, 'Should fetch again after cache clear');
    });

    it('should load all registered sources', async () => {
        const source1 = { load: async () => new Map([['A', 1]]) };
        const source2 = { load: async () => new Map([['B', 2]]) };

        repository
            .registerSource('source1', source1, new window.PermanentStrategy())
            .registerSource('source2', source2, new window.PermanentStrategy());

        const results = await repository.loadAll();

        assert.isDefined(results.source1, 'Should have source1 data');
        assert.isDefined(results.source2, 'Should have source2 data');
    });
});
