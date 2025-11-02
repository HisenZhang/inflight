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

// Load all OurAirports data
async function loadOurAirportsData(onStatusUpdate) {
    try {
        // Fetch airports
        onStatusUpdate('[...] DOWNLOADING OURAIRPORTS AIRPORTS', 'loading');
        const airportsResponse = await fetch(AIRPORTS_CSV_URL);
        if (!airportsResponse.ok) throw new Error(`HTTP ${airportsResponse.status}`);
        const airportsCSV = await airportsResponse.text();

        // Fetch navaids
        onStatusUpdate('[...] DOWNLOADING OURAIRPORTS NAVAIDS', 'loading');
        const navaidsResponse = await fetch(NAVAIDS_CSV_URL);
        if (!navaidsResponse.ok) throw new Error(`HTTP ${navaidsResponse.status}`);
        const navaidsCSV = await navaidsResponse.text();

        // Fetch frequencies
        onStatusUpdate('[...] DOWNLOADING OURAIRPORTS FREQUENCIES', 'loading');
        const frequenciesResponse = await fetch(FREQUENCIES_CSV_URL);
        if (!frequenciesResponse.ok) throw new Error(`HTTP ${frequenciesResponse.status}`);
        const frequenciesCSV = await frequenciesResponse.text();

        // Fetch runways
        onStatusUpdate('[...] DOWNLOADING OURAIRPORTS RUNWAYS', 'loading');
        const runwaysResponse = await fetch(RUNWAYS_CSV_URL);
        if (!runwaysResponse.ok) throw new Error(`HTTP ${runwaysResponse.status}`);
        const runwaysCSV = await runwaysResponse.text();

        // Parse data
        onStatusUpdate('[...] PARSING OURAIRPORTS DATA', 'loading');
        const { airports, iataToIcao } = parseOAAirports(airportsCSV);
        const navaids = parseOANavaids(navaidsCSV);
        const frequencies = parseOAFrequencies(frequenciesCSV);
        const runways = parseOARunways(runwaysCSV);

        onStatusUpdate('[OK] OURAIRPORTS DATA LOADED', 'success');

        return {
            source: 'ourairports',
            data: {
                airports,
                iataToIcao,
                navaids,
                frequencies,
                runways
            },
            rawCSV: {
                airportsCSV,
                navaidsCSV,
                frequenciesCSV,
                runwaysCSV
            }
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
