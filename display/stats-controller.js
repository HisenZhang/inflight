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
            hobbsStartNow: document.getElementById('hobbsStartNow'),
            hobbsEndNow: document.getElementById('hobbsEndNow'),
            hobbsTotal: document.getElementById('hobbsTotal'),

            // Tach inputs
            tachStart: document.getElementById('tachStart'),
            tachEnd: document.getElementById('tachEnd'),
            tachTotal: document.getElementById('tachTotal'),

            // GPS track buttons
            exportTrackBtn: document.getElementById('exportTrackBtn'),
            clearTrackBtn: document.getElementById('clearTrackBtn')
        };
    }

    function setupEventListeners() {
        // Hobbs "NOW" buttons - use current Hobbs from aircraft (simulated)
        elements.hobbsStartNow.addEventListener('click', () => {
            // In real implementation, this would read from aircraft Hobbs meter
            // For now, use elapsed flight time as a proxy
            const currentHobbs = getCurrentHobbsReading();
            elements.hobbsStart.value = currentHobbs.toFixed(1);
            calculateHobbsTotal();
        });

        elements.hobbsEndNow.addEventListener('click', () => {
            const currentHobbs = getCurrentHobbsReading();
            elements.hobbsEnd.value = currentHobbs.toFixed(1);
            calculateHobbsTotal();
        });

        // Calculate Hobbs total when inputs change
        elements.hobbsStart.addEventListener('input', calculateHobbsTotal);
        elements.hobbsEnd.addEventListener('input', calculateHobbsTotal);

        // Calculate Tach total when inputs change
        elements.tachStart.addEventListener('input', calculateTachTotal);
        elements.tachEnd.addEventListener('input', calculateTachTotal);

        // GPS track buttons
        elements.exportTrackBtn.addEventListener('click', () => {
            window.FlightTracker.exportTrack();
        });

        elements.clearTrackBtn.addEventListener('click', () => {
            if (confirm('Clear GPS track? This cannot be undone.')) {
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
    // HOBBS/TACH CALCULATIONS
    // ============================================

    function getCurrentHobbsReading() {
        // Simulate Hobbs meter reading
        // In real implementation, this would come from aircraft systems
        // For now, use a base value + flight time
        const baseHobbs = 1000; // Example base Hobbs
        const flightHours = window.FlightTracker.getFlightDuration() / 3600;
        return baseHobbs + flightHours;
    }

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
