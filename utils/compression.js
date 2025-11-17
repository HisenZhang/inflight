// Compression Utility Module - Handles CSV data compression for IndexedDB storage
// Uses native CompressionStreams API (Chrome 80+, Firefox 113+, Safari 16.4+)

/**
 * Check if browser supports CompressionStreams API
 * @returns {boolean} True if compression is supported
 */
function isCompressionSupported() {
    return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/**
 * Compress text data using gzip
 * @param {string} text - Text data to compress
 * @returns {Promise<ArrayBuffer>} Compressed data as ArrayBuffer
 */
async function compress(text) {
    if (!isCompressionSupported()) {
        console.warn('[Compression] CompressionStreams API not supported, storing uncompressed');
        // Fallback: store as UTF-8 encoded ArrayBuffer
        const encoder = new TextEncoder();
        return encoder.encode(text).buffer;
    }

    try {
        const blob = new Blob([text], { type: 'text/plain' });
        const stream = blob.stream();
        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
        const compressedBlob = await new Response(compressedStream).blob();
        return await compressedBlob.arrayBuffer();
    } catch (error) {
        console.error('[Compression] Error compressing data:', error);
        throw error;
    }
}

/**
 * Decompress gzip data back to text
 * @param {ArrayBuffer} arrayBuffer - Compressed data
 * @returns {Promise<string>} Decompressed text
 */
async function decompress(arrayBuffer) {
    if (!isCompressionSupported()) {
        console.warn('[Compression] CompressionStreams API not supported, reading uncompressed');
        // Fallback: decode UTF-8 ArrayBuffer
        const decoder = new TextDecoder();
        return decoder.decode(arrayBuffer);
    }

    try {
        const blob = new Blob([arrayBuffer]);
        const stream = blob.stream();
        const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
        const decompressedBlob = await new Response(decompressedStream).blob();
        return await decompressedBlob.text();
    } catch (error) {
        console.error('[Compression] Error decompressing data:', error);
        throw error;
    }
}

/**
 * Compress multiple CSV files in parallel
 * @param {Object} rawCSVData - Object with CSV data { key: csvText, ... }
 * @returns {Promise<Object>} Object with compressed data { key: ArrayBuffer, ... }
 */
async function compressMultiple(rawCSVData) {
    const compressed = {};
    const compressionPromises = [];

    for (const [key, csvText] of Object.entries(rawCSVData)) {
        if (!csvText || typeof csvText !== 'string') {
            console.warn(`[Compression] Skipping invalid CSV data for key: ${key}`);
            continue;
        }

        const promise = compress(csvText).then(arrayBuffer => {
            compressed[key] = arrayBuffer;
            const originalSize = csvText.length;
            const compressedSize = arrayBuffer.byteLength;
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            console.log(`[Compression] ${key}: ${(originalSize / 1024).toFixed(1)}KB to ${(compressedSize / 1024).toFixed(1)}KB (${ratio}% reduction)`);
        });

        compressionPromises.push(promise);
    }

    await Promise.all(compressionPromises);
    return compressed;
}

/**
 * Decompress multiple CSV files in parallel
 * @param {Object} compressedData - Object with compressed data { key: ArrayBuffer, ... }
 * @returns {Promise<Object>} Object with decompressed CSV text { key: csvText, ... }
 */
async function decompressMultiple(compressedData) {
    const decompressed = {};
    const decompressionPromises = [];

    for (const [key, arrayBuffer] of Object.entries(compressedData)) {
        if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
            console.warn(`[Compression] Skipping invalid compressed data for key: ${key}`);
            continue;
        }

        const promise = decompress(arrayBuffer).then(csvText => {
            decompressed[key] = csvText;
            console.log(`[Compression] Decompressed ${key}: ${(arrayBuffer.byteLength / 1024).toFixed(1)}KB to ${(csvText.length / 1024).toFixed(1)}KB`);
        });

        decompressionPromises.push(promise);
    }

    await Promise.all(decompressionPromises);
    return decompressed;
}

/**
 * Get compression statistics
 * @param {Object} originalData - Original CSV data
 * @param {Object} compressedData - Compressed data
 * @returns {Object} Statistics { originalSize, compressedSize, ratio }
 */
function getCompressionStats(originalData, compressedData) {
    let originalSize = 0;
    let compressedSize = 0;

    for (const csvText of Object.values(originalData)) {
        if (typeof csvText === 'string') {
            originalSize += csvText.length;
        }
    }

    for (const arrayBuffer of Object.values(compressedData)) {
        if (arrayBuffer instanceof ArrayBuffer) {
            compressedSize += arrayBuffer.byteLength;
        }
    }

    const ratio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : 0;

    return {
        originalSize,
        compressedSize,
        originalSizeMB: (originalSize / (1024 * 1024)).toFixed(2),
        compressedSizeMB: (compressedSize / (1024 * 1024)).toFixed(2),
        ratio: `${ratio}%`,
        supported: isCompressionSupported()
    };
}

// Export
window.CompressionUtils = {
    isCompressionSupported,
    compress,
    decompress,
    compressMultiple,
    decompressMultiple,
    getCompressionStats
};
