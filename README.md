# Flight Planning Webapp

A lightweight web application for flight planning that calculates distances and bearings between airports.

## Features

- **Airport Database**: Caches airport data from [OurAirports GitHub mirror](https://github.com/davidmegginson/ourairports-data) in local storage
- **Smart Caching**: Stores data locally for 7 days to minimize network requests
- **Route Planning**: Input multiple airport codes to plan your route
- **Distance Calculation**: Uses the Haversine formula to calculate great circle distances in nautical miles
- **Bearing Calculation**: Computes initial bearing for each leg with cardinal direction
- **Dual Code Support**: Accepts both ICAO (e.g., KJFK) and IATA (e.g., JFK) airport codes
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## How to Use

1. **Load Airport Data**
   - Open `index.html` in your web browser
   - Click "Load Airport Data" to fetch and cache airport information
   - The data will be stored in your browser's local storage for 7 days

2. **Plan Your Route**
   - Enter airport codes separated by spaces (e.g., `KJFK EGLL LFPG`)
   - You can use ICAO codes (4 letters) or IATA codes (3 letters)
   - Click "Calculate Route" or press Enter

3. **View Results**
   - See the total route distance and number of legs
   - Each leg shows:
     - Departure and arrival airports with full names
     - Distance in nautical miles (NM) and kilometers (km)
     - Initial bearing in degrees and cardinal direction
     - Airport coordinates

## Example Routes

- **Transatlantic**: `KJFK EGLL` (New York to London)
- **European Tour**: `EGLL LFPG EDDF LIRF` (London → Paris → Frankfurt → Rome)
- **US Cross-Country**: `KLAX KORD KJFK` (Los Angeles → Chicago → New York)
- **Pacific Route**: `KSFO PHNL RJAA` (San Francisco → Honolulu → Tokyo)

## Technical Details

### Distance Calculation
Uses the Haversine formula to calculate great circle distances:
```
a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
c = 2 * atan2(√a, √(1−a))
d = R * c
```
Where R is Earth's radius in nautical miles (3440.065 NM).

### Bearing Calculation
Calculates initial bearing (forward azimuth):
```
y = sin(Δlon) * cos(lat2)
x = cos(lat1) * sin(lat2) − sin(lat1) * cos(lat2) * cos(Δlon)
bearing = atan2(y, x)
```

### Data Source
Airport data is sourced from the [OurAirports GitHub mirror](https://github.com/davidmegginson/ourairports-data), which provides comprehensive airport information including:
- ICAO and IATA codes
- Airport names and locations
- Latitude and longitude coordinates
- Country and municipality information

The data is fetched from: `https://davidmegginson.github.io/ourairports-data/airports.csv` (updated daily)

### Local Storage
- **Cache Duration**: 7 days
- **Storage Keys**:
  - `airports_data`: CSV data
  - `airports_data_timestamp`: Cache timestamp
- **Size**: Approximately 5-10 MB (varies by data)

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

Requires a modern browser with support for:
- LocalStorage API
- Fetch API
- ES6 JavaScript features

## Privacy

All data processing happens in your browser. No data is sent to any server except the initial fetch from the OurAirports GitHub mirror.

## Offline Usage

After loading the airport data once, the app can work offline for up to 7 days using the cached data.

## Clearing Cache

Click the "Clear Cache" button to remove stored airport data and free up browser storage. You'll need to reload the data to use the app again.

## License

This project uses data from OurAirports via the [GitHub mirror](https://github.com/davidmegginson/ourairports-data). The data is in the public domain.
