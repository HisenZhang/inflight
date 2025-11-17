// Demo Route Loader
// Loads a sample route to demonstrate core functionality

/**
 * Demo route: Chicago O'Hare (KORD) to New York LaGuardia (KLGA)
 * via airways and fixes
 */
const DEMO_ROUTE = {
    departure: 'KORD',
    route: 'PAYGE Q822 FNT WYNDE3',
    destination: 'KLGA',
    altitude: 7000,
    tas: 140
};

/**
 * Loads the demo route into the application
 */
async function loadDemoRoute() {
    try {
        // Check if database is loaded
        const cacheResult = await DataManager.checkCachedData();

        if (!cacheResult.loaded) {
            // Database not loaded - prompt user to load it first
            if (confirm('Demo route requires aviation database.\n\nLoad database now? (This will take a moment)')) {
                // Switch to DATA tab and show loading message
                document.querySelector('[data-tab="data"]').click();

                // Load the database
                await DataManager.loadAllData();

                // Wait a moment for UI to update
                await new Promise(resolve => setTimeout(resolve, 500));

                // Now proceed with demo route
                await populateDemoRoute();
            }
        } else {
            // Database already loaded
            await populateDemoRoute();
        }
    } catch (error) {
        console.error('Failed to load demo route:', error);
        alert('Failed to load demo route. Please try loading the database manually from the DATA tab.');
    }
}

/**
 * Populates the form with demo route data
 */
async function populateDemoRoute() {
    // Switch to ROUTE tab
    document.querySelector('[data-tab="route"]').click();

    // Wait for tab to be visible
    await new Promise(resolve => setTimeout(resolve, 100));

    // Fill in the form
    const departureInput = document.getElementById('departureInput');
    const routeInput = document.getElementById('routeInput');
    const destinationInput = document.getElementById('destinationInput');
    const altitudeInput = document.getElementById('altitudeInput');
    const tasInput = document.getElementById('tasInput');

    if (departureInput) departureInput.value = DEMO_ROUTE.departure;
    if (routeInput) routeInput.value = DEMO_ROUTE.route;
    if (destinationInput) destinationInput.value = DEMO_ROUTE.destination;

    // Enable wind correction to show more features
    const windsToggle = document.getElementById('enableWindsToggle');
    if (windsToggle && !windsToggle.classList.contains('active')) {
        windsToggle.click();

        // Wait for wind inputs to appear
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (altitudeInput) altitudeInput.value = DEMO_ROUTE.altitude;
    if (tasInput) tasInput.value = DEMO_ROUTE.tas;

    // Trigger calculation
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn && !calculateBtn.disabled) {
        // Wait a moment for autocomplete to clear
        await new Promise(resolve => setTimeout(resolve, 200));
        calculateBtn.click();

        // Show info message
        setTimeout(() => {
            console.log('[Demo] Demo route loaded: KORD → KLGA');
            console.log('[Demo] Check NAVLOG and MAP tabs to see results');
        }, 500);
    } else {
        alert('Demo route populated!\n\nClick CALCULATE to compute the route.');
    }
}
