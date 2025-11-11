// OurAirports Adapter Module - Handles OurAirports data loading and parsing
// Used as fallback for international airports and when NASR is unavailable

const AIRPORTS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airports.csv';
const NAVAIDS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/navaids.csv';
const FREQUENCIES_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/airport-frequencies.csv';
const RUNWAYS_CSV_URL = 'https://cors.hisenz.com/?url=https://raw.githubusercontent.com/davidmegginson/ourairports-data/refs/heads/main/runways.csv';

// Parse OurAirports CSV format
function parseOACSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(val => val.trim());
}

// Parse airports.csv
function parseOAAirports(csvText) {
    const lines = csvText.split('\n');
    const headers = parseOACSVLine(lines[0]);

    const idIdx = headers.indexOf('id');
    const identIdx = headers.indexOf('ident');
    const typeIdx = headers.indexOf('type');
    const nameIdx = headers.indexOf('name');
    const latIdx = headers.indexOf('latitude_deg');
    const lonIdx = headers.indexOf('longitude_deg');
    const elevIdx = headers.indexOf('elevation_ft');
    const iataIdx = headers.indexOf('iata_code');
    const municipalityIdx = headers.indexOf('municipality');
    const isoCountryIdx = headers.indexOf('iso_country');

    const airports = new Map();
    const iataToIcao = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseOACSVLine(lines[i]);

            const icao = values[identIdx]?.toUpperCase();
            const lat = parseFloat(values[latIdx]);
            const lon = parseFloat(values[lonIdx]);

            if (!icao || isNaN(lat) || isNaN(lon)) continue;

            const airport = {
                id: values[idIdx],
                icao,
                type: values[typeIdx],
                name: values[nameIdx],
                lat,
                lon,
                elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
                iata: values[iataIdx]?.toUpperCase(),
                municipality: values[municipalityIdx],
                country: values[isoCountryIdx],
                waypointType: 'airport',
                source: 'ourairports'
            };

            airports.set(icao, airport);

            if (airport.iata && airport.iata.trim()) {
                iataToIcao.set(airport.iata, icao);
            }
        } catch (error) {
            continue;
        }
    }

    return { airports, iataToIcao };
}

// Parse navaids.csv
function parseOANavaids(csvText) {
    const lines = csvText.split('\n');
    const headers = parseOACSVLine(lines[0]);

    const idIdx = headers.indexOf('id');
    const identIdx = headers.indexOf('ident');
    const nameIdx = headers.indexOf('name');
    const typeIdx = headers.indexOf('type');
    const freqIdx = headers.indexOf('frequency_khz');
    const latIdx = headers.indexOf('latitude_deg');
    const lonIdx = headers.indexOf('longitude_deg');
    const elevIdx = headers.indexOf('elevation_ft');
    const isoCountryIdx = headers.indexOf('iso_country');

    const navaids = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseOACSVLine(lines[i]);
            const ident = values[identIdx]?.toUpperCase();
            const lat = parseFloat(values[latIdx]);
            const lon = parseFloat(values[lonIdx]);

            if (!ident || isNaN(lat) || isNaN(lon)) continue;

            const navaid = {
                id: values[idIdx],
                ident,
                name: values[nameIdx],
                type: values[typeIdx],
                frequency: values[freqIdx] ? parseFloat(values[freqIdx]) : null,
                lat,
                lon,
                elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
                country: values[isoCountryIdx],
                waypointType: 'navaid',
                source: 'ourairports'
            };

            navaids.set(ident, navaid);
        } catch (error) {
            continue;
        }
    }

    return navaids;
}

// Parse airport-frequencies.csv
function parseOAFrequencies(csvText) {
    const lines = csvText.split('\n');
    const headers = parseOACSVLine(lines[0]);

    const airportIdIdx = headers.indexOf('airport_ref');
    const typeIdx = headers.indexOf('type');
    const descIdx = headers.indexOf('description');
    const freqIdx = headers.indexOf('frequency_mhz');

    const frequencies = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseOACSVLine(lines[i]);
            const airportId = values[airportIdIdx];

            if (!airportId) continue;

            const frequency = {
                type: values[typeIdx],
                description: values[descIdx],
                frequency: parseFloat(values[freqIdx])
            };

            if (!frequencies.has(airportId)) {
                frequencies.set(airportId, []);
            }
            frequencies.get(airportId).push(frequency);
        } catch (error) {
            continue;
        }
    }

    return frequencies;
}

// Parse runways.csv
function parseOARunways(csvText) {
    const lines = csvText.split('\n');
    const headers = parseOACSVLine(lines[0]);

    const airportIdIdx = headers.indexOf('airport_ref');
    const lengthIdx = headers.indexOf('length_ft');
    const widthIdx = headers.indexOf('width_ft');
    const surfaceIdx = headers.indexOf('surface');
    const leIdentIdx = headers.indexOf('le_ident');
    const heIdentIdx = headers.indexOf('he_ident');

    const runways = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseOACSVLine(lines[i]);
            const airportId = values[airportIdIdx];

            if (!airportId) continue;

            const runway = {
                length: values[lengthIdx] ? parseInt(values[lengthIdx]) : null,
                width: values[widthIdx] ? parseInt(values[widthIdx]) : null,
                surface: values[surfaceIdx],
                leIdent: values[leIdentIdx],
                heIdent: values[heIdentIdx]
            };

            if (!runways.has(airportId)) {
                runways.set(airportId, []);
            }
            runways.get(airportId).push(runway);
        } catch (error) {
            continue;
        }
    }

    return runways;
}

// Load all OurAirports data with individual file tracking
async function loadOurAirportsData(onStatusUpdate, onFileLoaded) {
    try {
        const fileMetadata = new Map();

        // Define files to download
        const filesToDownload = [
            { id: 'oa_airports', url: AIRPORTS_CSV_URL, label: 'AIRPORTS', parser: parseOAAirports },
            { id: 'oa_navaids', url: NAVAIDS_CSV_URL, label: 'NAVAIDS', parser: parseOANavaids },
            { id: 'oa_frequencies', url: FREQUENCIES_CSV_URL, label: 'FREQUENCIES', parser: parseOAFrequencies },
            { id: 'oa_runways', url: RUNWAYS_CSV_URL, label: 'RUNWAYS', parser: parseOARunways }
        ];

        const parsedData = {};
        const rawCSV = {};

        // Download and parse all files in parallel
        onStatusUpdate('[...] DOWNLOADING OURAIRPORTS FILES IN PARALLEL', 'loading');

        const downloadPromises = filesToDownload.map(async (fileInfo) => {
            const startTime = Date.now();
            const response = await fetch(fileInfo.url);
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${fileInfo.label}`);
            const csvData = await response.text();
            const downloadTime = Date.now() - startTime;

            const parseStartTime = Date.now();
            const parsed = fileInfo.parser(csvData);
            const parseTime = Date.now() - parseStartTime;

            return { fileInfo, csvData, parsed, downloadTime, parseTime };
        });

        const results = await Promise.all(downloadPromises);

        // Process results and build metadata
        for (const result of results) {
            const dataKey = result.fileInfo.id.replace('oa_', '');

            // Handle different parser return types
            if (result.fileInfo.id === 'oa_airports') {
                parsedData.airports = result.parsed.airports;
                parsedData.iataToIcao = result.parsed.iataToIcao;
                rawCSV[`${result.fileInfo.id}CSV`] = result.csvData;  // Use full ID to avoid collision with NASR
            } else {
                parsedData[dataKey] = result.parsed;
                rawCSV[`${result.fileInfo.id}CSV`] = result.csvData;  // Use full ID to avoid collision with NASR
            }

            // Track file metadata
            const recordCount = result.parsed.size || (result.parsed.airports ? result.parsed.airports.size : 0);
            const metadata = {
                id: result.fileInfo.id,
                label: result.fileInfo.label,
                timestamp: Date.now(),
                downloadTime: result.downloadTime,
                parseTime: result.parseTime,
                recordCount,
                sizeBytes: result.csvData.length,
                source: 'OurAirports'
            };

            fileMetadata.set(result.fileInfo.id, metadata);

            // Notify about file completion
            if (onFileLoaded) {
                onFileLoaded(metadata);
            }

            onStatusUpdate(`[OK] OURAIRPORTS ${result.fileInfo.label} (${recordCount} RECORDS)`, 'success');
        }

        onStatusUpdate('[OK] OURAIRPORTS DATA LOADED', 'success');

        return {
            source: 'ourairports',
            data: parsedData,
            rawCSV,
            fileMetadata
        };
    } catch (error) {
        console.error('OurAirports loading error:', error);
        throw error;
    }
}

// Export
window.OurAirportsAdapter = {
    loadOurAirportsData,
    parseOAAirports,
    parseOANavaids,
    parseOAFrequencies,
    parseOARunways
};
