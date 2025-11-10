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

    // Speed tracking for average calculation
    let speedSamples = [];
    const TAKEOFF_SPEED_THRESHOLD = 40; // knots
    const MIN_SPEED_FOR_FLIGHT = 40; // knots

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

        // Detect takeoff
        if (!isInFlight && groundSpeed >= TAKEOFF_SPEED_THRESHOLD) {
            isInFlight = true;
            takeoffTime = now;
            lastUpdateTime = now;
            startFlightTimer();
            console.log('[FlightTracker] Takeoff detected at', new Date(now).toISOString());
        }

        // Detect landing
        if (isInFlight && groundSpeed < MIN_SPEED_FOR_FLIGHT) {
            // Require sustained low speed to avoid false landing detection
            if (lastUpdateTime && (now - lastUpdateTime) > 10000) { // 10 seconds
                isInFlight = false;
                stopFlightTimer();
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
    }

    function startRecording() {
        isRecording = true;
        console.log('[FlightTracker] GPS recording started');
    }

    function stopRecording() {
        isRecording = false;
        console.log('[FlightTracker] GPS recording stopped');
    }

    function clearTrack() {
        gpsTrack = [];
        console.log('[FlightTracker] GPS track cleared');
    }

    function exportTrack() {
        const trackData = {
            version: '1.0',
            aircraft: 'Unknown',
            date: new Date().toISOString(),
            takeoffTime: takeoffTime ? new Date(takeoffTime).toISOString() : null,
            flightDuration: flightDuration,
            points: gpsTrack
        };

        const blob = new Blob([JSON.stringify(trackData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flight-track-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
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
        return Math.max(0, initialFuel - getFuelUsed());
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

        // Average ground speed
        const avgSpeedEl = document.getElementById('avgGroundSpeed');
        if (avgSpeedEl) {
            const avgSpeed = getAverageGroundSpeed();
            avgSpeedEl.textContent = avgSpeed > 0 ? `${avgSpeed} KT` : '-- KT';
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
        // Start recording automatically when GPS is enabled
        startRecording();

        console.log('[FlightTracker] Initialized');
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
        exportTrack,
        updateUI,

        // Fuel configuration
        setFuel: (fuel, rate, taxi) => {
            initialFuel = fuel;
            burnRate = rate;
            taxiFuel = taxi || 0;
            updateUI();
        },

        // Getters
        isInFlight: () => isInFlight,
        getFlightDuration: () => flightDuration,
        getTrackPoints: () => gpsTrack.length,
        getAverageGroundSpeed,
        getFuelRemaining,
        getEndurance
    };
})();

// Export for use in other modules
window.FlightTracker = FlightTracker;
