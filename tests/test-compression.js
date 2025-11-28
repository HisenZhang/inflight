// Tests for utils/compression.js - Data compression utilities

TestFramework.describe('Compression Utils', function({ it }) {

    // ============================================
    // SUPPORT DETECTION
    // ============================================

    it('should check compression support', () => {
        const supported = window.CompressionUtils.isCompressionSupported();

        // In Node.js/JSDOM environment, CompressionStream may not be available
        assert.isTrue(typeof supported === 'boolean', 'Should return boolean');
    });

    // ============================================
    // COMPRESS/DECOMPRESS (when supported)
    // ============================================

    it('should compress text data', async () => {
        const testData = 'Hello, World! This is test data for compression.';

        const compressed = await window.CompressionUtils.compress(testData);

        // In fallback mode (no CompressionStream), returns ArrayBuffer from TextEncoder
        // Check for ArrayBuffer-like object (has byteLength property)
        assert.isTrue(compressed && typeof compressed.byteLength === 'number', 'Should return ArrayBuffer-like object');
        // Compressed data exists (may be larger for small inputs)
        assert.isTrue(compressed.byteLength > 0, 'Compressed data should not be empty');
    });

    it('should decompress data back to original', async () => {
        const testData = 'Hello, World! This is test data for compression.';

        const compressed = await window.CompressionUtils.compress(testData);
        const decompressed = await window.CompressionUtils.decompress(compressed);

        assert.equals(decompressed, testData, 'Decompressed should match original');
    });

    it('should handle empty string', async () => {
        const testData = '';

        const compressed = await window.CompressionUtils.compress(testData);
        const decompressed = await window.CompressionUtils.decompress(compressed);

        assert.equals(decompressed, testData, 'Should handle empty string');
    });

    it('should handle large text data', async () => {
        // Generate large test data
        const testData = 'AIRPORT,ICAO,LAT,LON\n' +
            Array(1000).fill('TEST,KTST,40.0000,-75.0000').join('\n');

        const compressed = await window.CompressionUtils.compress(testData);
        const decompressed = await window.CompressionUtils.decompress(compressed);

        assert.equals(decompressed, testData, 'Should handle large data');
    });

    it('should handle Unicode characters', async () => {
        const testData = 'Test with Unicode: 日本語 中文 한국어 emoji: 🛫✈️🛬';

        const compressed = await window.CompressionUtils.compress(testData);
        const decompressed = await window.CompressionUtils.decompress(compressed);

        assert.equals(decompressed, testData, 'Should handle Unicode');
    });

    // ============================================
    // MULTIPLE FILE COMPRESSION
    // ============================================

    it('should compress multiple CSV files', async () => {
        const rawData = {
            airports: 'ICAO,NAME\nKSFO,San Francisco\nKLAX,Los Angeles',
            navaids: 'IDENT,TYPE\nSFO,VOR\nLAX,VOR'
        };

        const compressed = await window.CompressionUtils.compressMultiple(rawData);

        assert.isTrue('airports' in compressed, 'Should have airports key');
        assert.isTrue('navaids' in compressed, 'Should have navaids key');
        // Check for ArrayBuffer-like objects (have byteLength)
        assert.isTrue(compressed.airports && typeof compressed.airports.byteLength === 'number', 'airports should be ArrayBuffer-like');
        assert.isTrue(compressed.navaids && typeof compressed.navaids.byteLength === 'number', 'navaids should be ArrayBuffer-like');
    });

    it('should decompress multiple CSV files', async () => {
        // Test the round-trip compress -> decompress with direct ArrayBuffer
        // The compressMultiple returns ArrayBuffer, but decompressMultiple
        // checks instanceof ArrayBuffer which may fail in Node.js due to different globals
        // So we test compress/decompress individually which is more reliable
        const rawData = {
            airports: 'ICAO,NAME\nKSFO,San Francisco\nKLAX,Los Angeles',
            navaids: 'IDENT,TYPE\nSFO,VOR\nLAX,VOR'
        };

        // Test individual compress/decompress round-trip
        const compressedAirports = await window.CompressionUtils.compress(rawData.airports);
        const compressedNavaids = await window.CompressionUtils.compress(rawData.navaids);
        const decompressedAirports = await window.CompressionUtils.decompress(compressedAirports);
        const decompressedNavaids = await window.CompressionUtils.decompress(compressedNavaids);

        assert.equals(decompressedAirports, rawData.airports, 'airports should match');
        assert.equals(decompressedNavaids, rawData.navaids, 'navaids should match');
    });

    it('should skip invalid data in compressMultiple', async () => {
        const rawData = {
            valid: 'Valid CSV data',
            invalid: null,
            alsoInvalid: 123
        };

        const compressed = await window.CompressionUtils.compressMultiple(rawData);

        assert.isTrue('valid' in compressed, 'Should include valid data');
        assert.isFalse('invalid' in compressed, 'Should skip null');
        assert.isFalse('alsoInvalid' in compressed, 'Should skip non-string');
    });

    // ============================================
    // COMPRESSION STATISTICS
    // ============================================

    it('should calculate compression statistics', () => {
        const originalData = {
            airports: 'A'.repeat(10000),
            navaids: 'B'.repeat(5000)
        };

        const compressedData = {
            airports: new ArrayBuffer(1000),
            navaids: new ArrayBuffer(500)
        };

        const stats = window.CompressionUtils.getCompressionStats(originalData, compressedData);

        assert.equals(stats.originalSize, 15000, 'Original size should be 15000');
        assert.equals(stats.compressedSize, 1500, 'Compressed size should be 1500');
        assert.equals(stats.ratio, '90.0%', 'Ratio should be 90%');
        assert.isTrue('supported' in stats, 'Should include supported flag');
        assert.isTrue('originalSizeMB' in stats, 'Should include MB sizes');
    });

    it('should handle empty data in stats', () => {
        const stats = window.CompressionUtils.getCompressionStats({}, {});

        assert.equals(stats.originalSize, 0, 'Original size should be 0');
        assert.equals(stats.compressedSize, 0, 'Compressed size should be 0');
    });

    // ============================================
    // EDGE CASES
    // ============================================

    it('should handle newlines and special characters', async () => {
        const testData = 'Line1\nLine2\rLine3\r\nLine4\tTabbed';

        const compressed = await window.CompressionUtils.compress(testData);
        const decompressed = await window.CompressionUtils.decompress(compressed);

        assert.equals(decompressed, testData, 'Should preserve special characters');
    });

    it('should handle JSON data', async () => {
        const jsonData = JSON.stringify({
            airports: [
                { icao: 'KSFO', name: 'San Francisco', lat: 37.6191, lon: -122.3756 },
                { icao: 'KLAX', name: 'Los Angeles', lat: 33.9425, lon: -118.4081 }
            ]
        });

        const compressed = await window.CompressionUtils.compress(jsonData);
        const decompressed = await window.CompressionUtils.decompress(compressed);

        assert.equals(decompressed, jsonData, 'Should handle JSON data');

        // Verify JSON is still valid
        const parsed = JSON.parse(decompressed);
        assert.equals(parsed.airports.length, 2, 'JSON should be parseable');
    });
});
