// Checksum Utilities Test Suite
// Tests SHA-256 checksum calculation and verification for data integrity

window.ChecksumTests = [
    {
        name: 'should calculate checksum for simple object',
        async run() {
            const data = { route: 'KALB KBOS', waypoints: 2 };
            const checksum = await ChecksumUtils.calculate(data);

            // SHA-256 produces 64 character hex string
            assert.equals(checksum.length, 64, 'checksum should be 64 characters');
            assert.matches(checksum, /^[0-9a-f]{64}$/, 'checksum should be hex');
        }
    },

    {
        name: 'should calculate same checksum for identical data',
        async run() {
            const data1 = { airport: 'KALB', lat: 42.7, lon: -73.8 };
            const data2 = { airport: 'KALB', lat: 42.7, lon: -73.8 };

            const checksum1 = await ChecksumUtils.calculate(data1);
            const checksum2 = await ChecksumUtils.calculate(data2);

            assert.equals(checksum1, checksum2, 'checksums should match for identical data');
        }
    },

    {
        name: 'should calculate different checksums for different data',
        async run() {
            const data1 = { airport: 'KALB' };
            const data2 = { airport: 'KBOS' };

            const checksum1 = await ChecksumUtils.calculate(data1);
            const checksum2 = await ChecksumUtils.calculate(data2);

            assert.notEquals(checksum1, checksum2, 'checksums should differ for different data');
        }
    },

    {
        name: 'should detect data corruption',
        async run() {
            const original = { route: 'KALB KBOS' };
            const checksum = await ChecksumUtils.calculate(original);

            // Simulate corruption
            const corrupted = { route: 'CORRUPTED' };
            const valid = await ChecksumUtils.verify(corrupted, checksum);

            assert.equals(valid, false, 'should detect corrupted data');
        }
    },

    {
        name: 'should verify valid data',
        async run() {
            const data = { route: 'KALB KBOS', distance: 150 };
            const checksum = await ChecksumUtils.calculate(data);

            const valid = await ChecksumUtils.verify(data, checksum);

            assert.equals(valid, true, 'should verify valid data');
        }
    },

    {
        name: 'should handle Map data structures',
        async run() {
            const map = new Map();
            map.set('KALB', { lat: 42.7, lon: -73.8 });
            map.set('KBOS', { lat: 42.4, lon: -71.0 });

            const checksum = await ChecksumUtils.calculate(map);

            assert.equals(checksum.length, 64, 'should generate checksum for Map');
        }
    },

    {
        name: 'should produce deterministic checksums for Maps (sorted keys)',
        async run() {
            // Create two maps with same data added in different order
            const map1 = new Map();
            map1.set('KALB', { lat: 42.7 });
            map1.set('KBOS', { lat: 42.4 });

            const map2 = new Map();
            map2.set('KBOS', { lat: 42.4 });
            map2.set('KALB', { lat: 42.7 });

            const checksum1 = await ChecksumUtils.calculate(map1);
            const checksum2 = await ChecksumUtils.calculate(map2);

            assert.equals(checksum1, checksum2, 'Map checksums should be deterministic (order-independent)');
        }
    },

    {
        name: 'should handle Array data',
        async run() {
            const arr = [
                { code: 'KALB', lat: 42.7 },
                { code: 'KBOS', lat: 42.4 }
            ];

            const checksum = await ChecksumUtils.calculate(arr);

            assert.equals(checksum.length, 64, 'should generate checksum for Array');
        }
    },

    {
        name: 'should detect array element changes',
        async run() {
            const arr1 = ['KALB', 'KBOS', 'KJFK'];
            const arr2 = ['KALB', 'KBOS', 'KLAX']; // Last element changed

            const checksum1 = await ChecksumUtils.calculate(arr1);
            const checksum2 = await ChecksumUtils.calculate(arr2);

            assert.notEquals(checksum1, checksum2, 'should detect array element changes');
        }
    },

    {
        name: 'should handle nested objects',
        async run() {
            const data = {
                airport: 'KALB',
                location: {
                    lat: 42.7,
                    lon: -73.8,
                    city: 'Albany'
                },
                runways: [
                    { id: '01', length: 7200 },
                    { id: '19', length: 7200 }
                ]
            };

            const checksum = await ChecksumUtils.calculate(data);

            assert.equals(checksum.length, 64, 'should handle nested structures');
        }
    },

    {
        name: 'should handle null values',
        async run() {
            const data = { airport: 'KALB', elevation: null };
            const checksum = await ChecksumUtils.calculate(data);

            assert.equals(checksum.length, 64, 'should handle null values');
        }
    },

    {
        name: 'should handle primitive values',
        async run() {
            const str = 'KALB';
            const num = 42.7;
            const bool = true;

            const cs1 = await ChecksumUtils.calculate(str);
            const cs2 = await ChecksumUtils.calculate(num);
            const cs3 = await ChecksumUtils.calculate(bool);

            assert.equals(cs1.length, 64, 'should handle string');
            assert.equals(cs2.length, 64, 'should handle number');
            assert.equals(cs3.length, 64, 'should handle boolean');

            assert.notEquals(cs1, cs2, 'different types should have different checksums');
        }
    },

    {
        name: 'should calculateMultiple for multiple datasets',
        async run() {
            const datasets = {
                airports: new Map([['KALB', { lat: 42.7 }]]),
                navaids: new Map([['ALB', { type: 'VOR' }]]),
                fixes: ['FIX1', 'FIX2']
            };

            const checksums = await ChecksumUtils.calculateMultiple(datasets);

            assert.equals(Object.keys(checksums).length, 3, 'should calculate 3 checksums');
            assert.equals(checksums.airports.length, 64, 'airports checksum');
            assert.equals(checksums.navaids.length, 64, 'navaids checksum');
            assert.equals(checksums.fixes.length, 64, 'fixes checksum');
        }
    },

    {
        name: 'should verifyMultiple datasets',
        async run() {
            const datasets = {
                airports: { KALB: { lat: 42.7 } },
                navaids: { ALB: { type: 'VOR' } }
            };

            const checksums = await ChecksumUtils.calculateMultiple(datasets);

            // Verify both
            const results = await ChecksumUtils.verifyMultiple(datasets, checksums);

            assert.equals(results.airports, true, 'airports should verify');
            assert.equals(results.navaids, true, 'navaids should verify');
        }
    },

    {
        name: 'should detect corruption in verifyMultiple',
        async run() {
            const original = {
                airports: { KALB: { lat: 42.7 } },
                navaids: { ALB: { type: 'VOR' } }
            };

            const checksums = await ChecksumUtils.calculateMultiple(original);

            // Corrupt one dataset
            const corrupted = {
                airports: { KALB: { lat: 42.7 } }, // Same
                navaids: { ALB: { type: 'NDB' } }  // Changed
            };

            const results = await ChecksumUtils.verifyMultiple(corrupted, checksums);

            assert.equals(results.airports, true, 'airports should still verify');
            assert.equals(results.navaids, false, 'navaids should fail verification');
        }
    },

    {
        name: 'should handle backward compatibility (no checksum provided)',
        async run() {
            const data = { airport: 'KALB' };

            // Old data without checksums
            const valid = await ChecksumUtils.verify(data, null);

            assert.equals(valid, true, 'should pass verification when no checksum provided (backward compat)');
        }
    },

    {
        name: 'should report isSupported() correctly',
        run() {
            const supported = ChecksumUtils.isSupported();

            // Web Crypto API should be available in modern browsers
            assert.equals(supported, true, 'Web Crypto API should be available');
        }
    },

    {
        name: 'should provide stats for checksum map',
        async run() {
            const checksums = {
                airports: 'a'.repeat(64),
                navaids: 'b'.repeat(64),
                fixes: 'c'.repeat(64)
            };

            const stats = ChecksumUtils.getStats(checksums);

            assert.equals(stats.count, 3, 'should count 3 checksums');
            assert.equals(stats.totalBytes, 96, 'should calculate total bytes (3 * 32 bytes)');
            assert.deepEquals(stats.keys, ['airports', 'navaids', 'fixes'], 'should list keys');
        }
    },

    {
        name: 'should handle large datasets (performance test)',
        async run() {
            // Simulate large airport database
            const largeMap = new Map();
            for (let i = 0; i < 1000; i++) {
                largeMap.set(`AP${i}`, {
                    lat: 40 + Math.random() * 10,
                    lon: -100 + Math.random() * 20,
                    name: `Airport ${i}`,
                    runways: [{ id: '01', length: 5000 + Math.random() * 5000 }]
                });
            }

            const startTime = performance.now();
            const checksum = await ChecksumUtils.calculate(largeMap);
            const duration = performance.now() - startTime;

            assert.equals(checksum.length, 64, 'should generate checksum for large dataset');
            console.log(`[ChecksumTest] Large dataset (1000 airports) checksum took ${duration.toFixed(2)}ms`);

            // Should complete in reasonable time (< 500ms for 1000 records)
            assert.lessThan(duration, 500, 'checksum calculation should be fast');
        }
    },

    {
        name: 'should handle empty Map',
        async run() {
            const emptyMap = new Map();
            const checksum = await ChecksumUtils.calculate(emptyMap);

            assert.equals(checksum.length, 64, 'should generate checksum for empty Map');
        }
    },

    {
        name: 'should handle empty object',
        async run() {
            const emptyObj = {};
            const checksum = await ChecksumUtils.calculate(emptyObj);

            assert.equals(checksum.length, 64, 'should generate checksum for empty object');
        }
    },

    {
        name: 'should produce consistent checksums across invocations',
        async run() {
            const data = {
                route: 'KALB KBOS',
                waypoints: [
                    { code: 'KALB', lat: 42.7, lon: -73.8 },
                    { code: 'KBOS', lat: 42.4, lon: -71.0 }
                ]
            };

            // Calculate checksum multiple times
            const checksums = await Promise.all([
                ChecksumUtils.calculate(data),
                ChecksumUtils.calculate(data),
                ChecksumUtils.calculate(data),
                ChecksumUtils.calculate(data),
                ChecksumUtils.calculate(data)
            ]);

            // All should be identical
            const allSame = checksums.every(cs => cs === checksums[0]);

            assert.equals(allSame, true, 'checksums should be consistent across invocations');
        }
    }
];
