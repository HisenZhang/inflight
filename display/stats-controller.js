// Stats Controller - Handles stats tab UI interactions
// ============================================

const StatsController = (() => {
    let elements = {};

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        cacheElements();
        setupEventListeners();
        initializeFlightTracker();
    }

    function cacheElements() {
        elements = {
            // Hobbs inputs
            hobbsStart: document.getElementById('hobbsStart'),
            hobbsEnd: document.getElementById('hobbsEnd'),
            hobbsTotal: document.getElementById('hobbsTotal'),

            // Tach inputs
            tachStart: document.getElementById('tachStart'),
            tachEnd: document.getElementById('tachEnd'),
            tachTotal: document.getElementById('tachTotal'),

            // GPS track mode and controls
            trackMode: document.getElementById('trackMode'),
            toggleModeBtn: document.getElementById('toggleModeBtn'),
            startRecBtn: document.getElementById('startRecBtn'),
            stopRecBtn: document.getElementById('stopRecBtn'),
            exportTrackBtn: document.getElementById('exportTrackBtn'),
            clearTrackBtn: document.getElementById('clearTrackBtn')
        };
    }

    function setupEventListeners() {
        // Calculate Hobbs total when inputs change
        elements.hobbsStart.addEventListener('input', calculateHobbsTotal);
        elements.hobbsEnd.addEventListener('input', calculateHobbsTotal);

        // Calculate Tach total when inputs change
        elements.tachStart.addEventListener('input', calculateTachTotal);
        elements.tachEnd.addEventListener('input', calculateTachTotal);

        // GPS track mode toggle
        elements.toggleModeBtn.addEventListener('click', toggleRecordingMode);

        // Manual recording controls
        elements.startRecBtn.addEventListener('click', () => {
            window.FlightTracker.startRecording();
            updateRecordingUI();
        });

        elements.stopRecBtn.addEventListener('click', () => {
            window.FlightTracker.stopRecording();
            updateRecordingUI();
        });

        // GPS track buttons
        elements.exportTrackBtn.addEventListener('click', () => {
            window.FlightTracker.exportCurrentTrack();
        });

        elements.clearTrackBtn.addEventListener('click', () => {
            if (confirm('Clear current GPS track? This cannot be undone.')) {
                window.FlightTracker.clearTrack();
                window.FlightTracker.updateUI();
            }
        });
    }

    function initializeFlightTracker() {
        window.FlightTracker.init();

        // Update UI every second
        setInterval(() => {
            window.FlightTracker.updateUI();
        }, 1000);
    }

    // ============================================
    // GPS RECORDING MODE CONTROL
    // ============================================

    function toggleRecordingMode() {
        const currentMode = window.FlightTracker.getRecordingMode();
        const newMode = currentMode === 'auto' ? 'manual' : 'auto';

        window.FlightTracker.setRecordingMode(newMode);
        updateRecordingUI();
    }

    function updateRecordingUI() {
        const mode = window.FlightTracker.getRecordingMode();
        const isRecording = window.FlightTracker.isRecording();

        // Update mode display
        elements.trackMode.textContent = mode.toUpperCase();
        elements.trackMode.style.color = mode === 'auto' ? 'var(--color-metric)' : 'var(--color-warning)';

        // Update toggle button
        elements.toggleModeBtn.textContent = mode === 'auto' ? 'MANUAL' : 'AUTO';

        // Show/hide manual controls
        if (mode === 'manual') {
            if (isRecording) {
                elements.startRecBtn.style.display = 'none';
                elements.stopRecBtn.style.display = 'inline-block';
            } else {
                elements.startRecBtn.style.display = 'inline-block';
                elements.stopRecBtn.style.display = 'none';
            }
        } else {
            elements.startRecBtn.style.display = 'none';
            elements.stopRecBtn.style.display = 'none';
        }

        window.FlightTracker.updateUI();
    }

    // ============================================
    // HOBBS/TACH CALCULATIONS
    // ============================================

    function calculateHobbsTotal() {
        const start = parseFloat(elements.hobbsStart.value) || 0;
        const end = parseFloat(elements.hobbsEnd.value) || 0;

        if (start > 0 && end > start) {
            const total = end - start;
            elements.hobbsTotal.textContent = `${total.toFixed(1)} HR`;
            elements.hobbsTotal.style.color = 'var(--color-metric)';
        } else {
            elements.hobbsTotal.textContent = '-- HR';
            elements.hobbsTotal.style.color = 'var(--text-primary)';
        }
    }

    function calculateTachTotal() {
        const start = parseFloat(elements.tachStart.value) || 0;
        const end = parseFloat(elements.tachEnd.value) || 0;

        if (start > 0 && end > start) {
            const total = end - start;
            elements.tachTotal.textContent = `${total.toFixed(1)} HR`;
            elements.tachTotal.style.color = 'var(--color-metric)';
        } else {
            elements.tachTotal.textContent = '-- HR';
            elements.tachTotal.style.color = 'var(--text-primary)';
        }
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        init
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', StatsController.init);
} else {
    StatsController.init();
}
