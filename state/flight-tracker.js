// Flight Tracker - Tracks flight time, fuel, and GPS track
// ============================================

const FlightTracker = (() => {
    // Flight state
    let isInFlight = false;
    let takeoffTime = null;
    let flightDuration = 0; // seconds
    let lastUpdateTime = null;

    // GPS track recording
    let gpsTrack = [];
    let isRecording = false;
    let currentTrackId = null;
    let recordingMode = 'auto'; // 'auto' or 'manual'

    // Speed tracking for average calculation
    let speedSamples = [];
    const TAKEOFF_SPEED_THRESHOLD = 40; // knots
    const MIN_SPEED_FOR_FLIGHT = 40; // knots

    // Distance tracking
    let totalDistance = 0; // nautical miles
    let lastPosition = null;

    // Track storage
    const TRACKS_STORAGE_KEY = 'flight_tracks';

    // Fuel tracking
    let initialFuel = 0;
    let burnRate = 0; // gal/hr
    let taxiFuel = 0;

    // Timer for flight duration
    let flightTimer = null;

    // ============================================
    // FLIGHT STATE MANAGEMENT
    // ============================================

    function updateFlightState(groundSpeed) {
        if (!groundSpeed) return;

        const now = Date.now();

        // Detect takeoff (start recording automatically when >40kt) - only in AUTO mode
        if (!isInFlight && groundSpeed >= TAKEOFF_SPEED_THRESHOLD) {
            isInFlight = true;
            takeoffTime = now;
            lastUpdateTime = now;
            startFlightTimer();
            if (recordingMode === 'auto') {
                startRecording(); // Auto-start recording
            }
            console.log('[FlightTracker] Takeoff detected at', new Date(now).toISOString());
        }

        // Detect landing (stop recording automatically when <40kt) - only in AUTO mode
        if (isInFlight && groundSpeed < MIN_SPEED_FOR_FLIGHT) {
            // Require sustained low speed to avoid false landing detection
            if (lastUpdateTime && (now - lastUpdateTime) > 10000) { // 10 seconds
                isInFlight = false;
                stopFlightTimer();
                if (recordingMode === 'auto') {
                    stopRecording(); // Auto-stop recording and save track
                }
                console.log('[FlightTracker] Landing detected at', new Date(now).toISOString());
            }
        }

        // Update flight duration while in flight
        if (isInFlight && lastUpdateTime) {
            const elapsed = (now - lastUpdateTime) / 1000;
            flightDuration += elapsed;
        }

        lastUpdateTime = now;

        // Track speed for average calculation
        if (isInFlight && groundSpeed > 0) {
            speedSamples.push(groundSpeed);
            // Keep only last 100 samples
            if (speedSamples.length > 100) {
                speedSamples.shift();
            }
        }
    }

    function startFlightTimer() {
        if (flightTimer) return;

        flightTimer = setInterval(() => {
            if (isInFlight) {
                flightDuration++;
                updateUI();
            }
        }, 1000);
    }

    function stopFlightTimer() {
        if (flightTimer) {
            clearInterval(flightTimer);
            flightTimer = null;
        }
    }

    // ============================================
    // GPS TRACK RECORDING
    // ============================================

    function recordGPSPoint(position) {
        if (!isRecording) return;

        const point = {
            timestamp: Date.now(),
            lat: position.lat,
            lon: position.lon,
            alt: position.altitude || null,
            speed: position.speed || null,
            heading: position.heading || null,
            accuracy: position.accuracy || null,
            verticalAccuracy: position.verticalAccuracy || null
        };

        gpsTrack.push(point);

        // Calculate distance flown if we have a previous position
        if (lastPosition && isInFlight) {
            const distance = calculateDistance(
                lastPosition.lat,
                lastPosition.lon,
                position.lat,
                position.lon
            );
            totalDistance += distance;
        }

        lastPosition = { lat: position.lat, lon: position.lon };
    }

    // Haversine formula for distance calculation (in nautical miles)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in nautical miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function startRecording() {
        if (isRecording) return;

        isRecording = true;
        gpsTrack = [];
        totalDistance = 0;
        lastPosition = null;
        currentTrackId = Date.now(); // Use timestamp as track ID
        console.log('[FlightTracker] GPS recording started, track ID:', currentTrackId);
    }

    function stopRecording() {
        if (!isRecording) return;

        isRecording = false;

        // Save track to storage if it has points
        if (gpsTrack.length > 0 && currentTrackId) {
            saveCurrentTrack();
        }

        console.log('[FlightTracker] GPS recording stopped');
    }

    function clearTrack() {
        gpsTrack = [];
        currentTrackId = null;
        console.log('[FlightTracker] GPS track cleared');
    }

    // ============================================
    // TRACK STORAGE MANAGEMENT
    // ============================================

    function saveCurrentTrack() {
        if (gpsTrack.length === 0 || !currentTrackId) return false;

        try {
            const tracks = loadTracksFromStorage();

            const track = {
                id: currentTrackId,
                timestamp: currentTrackId,
                date: new Date(currentTrackId).toISOString(),
                takeoffTime: takeoffTime ? new Date(takeoffTime).toISOString() : null,
                landingTime: new Date().toISOString(),
                flightDuration: flightDuration,
                pointCount: gpsTrack.length,
                points: gpsTrack
            };

            tracks.push(track);
            localStorage.setItem(TRACKS_STORAGE_KEY, JSON.stringify(tracks));

            console.log('[FlightTracker] Track saved:', track.id, `(${track.pointCount} points)`);
            return true;
        } catch (error) {
            console.error('[FlightTracker] Failed to save track:', error);
            return false;
        }
    }

    function loadTracksFromStorage() {
        try {
            const stored = localStorage.getItem(TRACKS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('[FlightTracker] Failed to load tracks:', error);
            return [];
        }
    }

    function getSavedTracks() {
        return loadTracksFromStorage();
    }

    function deleteTrack(trackId) {
        try {
            let tracks = loadTracksFromStorage();
            tracks = tracks.filter(t => t.id !== trackId);
            localStorage.setItem(TRACKS_STORAGE_KEY, JSON.stringify(tracks));
            console.log('[FlightTracker] Track deleted:', trackId);
            return true;
        } catch (error) {
            console.error('[FlightTracker] Failed to delete track:', error);
            return false;
        }
    }

    function clearAllTracks() {
        try {
            localStorage.removeItem(TRACKS_STORAGE_KEY);
            console.log('[FlightTracker] All tracks cleared');
            return true;
        } catch (error) {
            console.error('[FlightTracker] Failed to clear tracks:', error);
            return false;
        }
    }

    function exportTrackAsGeoJSON(track) {
        // Convert track to GeoJSON format
        const geojson = {
            type: "Feature",
            properties: {
                name: `Flight Track ${new Date(track.timestamp).toLocaleString()}`,
                timestamp: track.timestamp,
                date: track.date,
                takeoffTime: track.takeoffTime,
                landingTime: track.landingTime,
                flightDuration: track.flightDuration,
                pointCount: track.pointCount
            },
            geometry: {
                type: "LineString",
                coordinates: track.points.map(p => [p.lon, p.lat, p.alt || 0])
            }
        };

        const filename = `flight-track-${new Date(track.timestamp).toISOString().replace(/[:.]/g, '-')}.geojson`;
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        console.log('[FlightTracker] Track exported as GeoJSON:', filename);
    }

    function exportCurrentTrack() {
        if (gpsTrack.length === 0) {
            console.warn('[FlightTracker] No track data to export');
            return;
        }

        const track = {
            id: currentTrackId || Date.now(),
            timestamp: currentTrackId || Date.now(),
            date: new Date().toISOString(),
            takeoffTime: takeoffTime ? new Date(takeoffTime).toISOString() : null,
            landingTime: new Date().toISOString(),
            flightDuration: flightDuration,
            pointCount: gpsTrack.length,
            points: gpsTrack
        };

        exportTrackAsGeoJSON(track);
    }

    // ============================================
    // CALCULATIONS
    // ============================================

    function getAverageGroundSpeed() {
        if (speedSamples.length === 0) return 0;
        const sum = speedSamples.reduce((a, b) => a + b, 0);
        return Math.round(sum / speedSamples.length);
    }

    function getFuelUsed() {
        if (!burnRate || !flightDuration) return 0;
        const flightHours = flightDuration / 3600;
        return (flightHours * burnRate) + taxiFuel;
    }

    function getFuelRemaining() {
        // Initial fuel available for flight = usable fuel - taxi fuel
        const initialAvailable = Math.max(0, initialFuel - taxiFuel);
        // Subtract fuel burned during flight
        const flightFuelUsed = burnRate && flightDuration ? (flightDuration / 3600) * burnRate : 0;
        return Math.max(0, initialAvailable - flightFuelUsed);
    }

    function getEndurance() {
        if (!burnRate) return 0;
        const fuelRemaining = getFuelRemaining();
        return (fuelRemaining / burnRate) * 60; // minutes
    }

    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function formatHours(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        return `${hours}:${String(mins).padStart(2, '0')}`;
    }

    // ============================================
    // UI UPDATE
    // ============================================

    function updateUI() {
        // Flight status
        const statusEl = document.getElementById('flightStatus');
        if (statusEl) {
            statusEl.textContent = isInFlight ? 'IN FLIGHT' : 'ON GROUND';
            statusEl.style.color = isInFlight ? 'var(--color-metric)' : 'var(--text-primary)';
        }

        // Flight time
        const flightTimeEl = document.getElementById('flightTime');
        if (flightTimeEl) {
            flightTimeEl.textContent = formatDuration(flightDuration);
        }

        // Takeoff time
        const takeoffTimeEl = document.getElementById('takeoffTime');
        if (takeoffTimeEl && takeoffTime) {
            const date = new Date(takeoffTime);
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            takeoffTimeEl.textContent = `${hours}:${minutes}`;
            takeoffTimeEl.style.color = 'var(--color-metric)';
        } else if (takeoffTimeEl) {
            takeoffTimeEl.textContent = '--:--';
            takeoffTimeEl.style.color = 'var(--text-secondary)';
        }

        // Average ground speed
        const avgSpeedEl = document.getElementById('avgGroundSpeed');
        if (avgSpeedEl) {
            const avgSpeed = getAverageGroundSpeed();
            avgSpeedEl.textContent = avgSpeed > 0 ? `${avgSpeed} KT` : '-- KT';
        }

        // Distance flown
        const distanceEl = document.getElementById('distanceFlown');
        if (distanceEl) {
            distanceEl.textContent = totalDistance > 0 ? `${totalDistance.toFixed(1)} NM` : '-- NM';
        }

        // Fuel stats (only if fuel tracking is enabled)
        if (initialFuel > 0 && burnRate > 0) {
            const fuelCard = document.getElementById('fuelStatsCard');
            if (fuelCard) fuelCard.style.display = 'block';

            const fuelOnBoardEl = document.getElementById('fuelOnBoard');
            if (fuelOnBoardEl) fuelOnBoardEl.textContent = `${initialFuel.toFixed(1)} GAL`;

            const fuelUsedEl = document.getElementById('fuelUsed');
            if (fuelUsedEl) fuelUsedEl.textContent = `${getFuelUsed().toFixed(1)} GAL`;

            const fuelRemainingEl = document.getElementById('fuelRemaining');
            if (fuelRemainingEl) {
                const remaining = getFuelRemaining();
                fuelRemainingEl.textContent = `${remaining.toFixed(1)} GAL`;
                // Warning color if low fuel
                if (remaining < initialFuel * 0.2) {
                    fuelRemainingEl.style.color = 'var(--color-warning)';
                } else {
                    fuelRemainingEl.style.color = 'var(--color-metric)';
                }
            }

            const enduranceEl = document.getElementById('endurance');
            if (enduranceEl) enduranceEl.textContent = formatHours(getEndurance());
        }

        // GPS track stats
        const trackPointsEl = document.getElementById('trackPoints');
        if (trackPointsEl) trackPointsEl.textContent = gpsTrack.length;

        const recordingStatusEl = document.getElementById('recordingStatus');
        if (recordingStatusEl) {
            recordingStatusEl.textContent = isRecording ? 'ACTIVE' : 'INACTIVE';
            recordingStatusEl.style.color = isRecording ? 'var(--color-metric)' : 'var(--text-secondary)';
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        // Recording will start automatically when takeoff is detected (>40kt GS)
        // No need to start recording manually
        console.log('[FlightTracker] Initialized - waiting for takeoff (>40kt)');
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        init,
        updateFlightState,
        recordGPSPoint,
        startRecording,
        stopRecording,
        clearTrack,
        exportCurrentTrack,
        updateUI,

        // Track storage management
        getSavedTracks,
        deleteTrack,
        clearAllTracks,
        exportTrackAsGeoJSON,

        // Fuel configuration
        setFuel: (fuel, rate, taxi) => {
            initialFuel = fuel;
            burnRate = rate;
            taxiFuel = taxi || 0;
            updateUI();
        },

        // Recording mode management
        setRecordingMode: (mode) => {
            if (mode !== 'auto' && mode !== 'manual') {
                console.error('[FlightTracker] Invalid recording mode:', mode);
                return false;
            }
            recordingMode = mode;
            console.log('[FlightTracker] Recording mode set to:', mode);

            // If switching to auto while recording manually, stop recording
            if (mode === 'auto' && isRecording && !isInFlight) {
                stopRecording();
            }

            return true;
        },
        getRecordingMode: () => recordingMode,
        isRecording: () => isRecording,

        // Getters
        isInFlight: () => isInFlight,
        getFlightDuration: () => flightDuration,
        getTrackPoints: () => gpsTrack.length,
        getAverageGroundSpeed,
        getFuelRemaining,
        getFuelBurnRate: () => burnRate,
        getEndurance
    };
})();

// Export for use in other modules
window.FlightTracker = FlightTracker;
