/**
 * Weather Controller
 * Handles the WX tab display and weather data visualization
 */

window.WeatherController = {
    currentIcao: null,
    currentSubtab: 'metar',
    weatherData: null,
    routeWaypoints: [], // Stores current route waypoints for hazard analysis
    routeLegs: [],      // Stores route legs with leg times for time-based filtering
    routeDepartureTime: null, // Departure time for ETA calculation

    /**
     * Initialize weather controller
     */
    init() {
        console.log('[WeatherController] Initializing...');

        // Wire up event listeners
        const wxSearchBtn = document.getElementById('wxSearchBtn');
        const wxClearBtn = document.getElementById('wxClearBtn');
        const wxAirportInput = document.getElementById('wxAirportInput');

        if (wxSearchBtn) {
            wxSearchBtn.addEventListener('click', () => this.fetchWeather());
        }

        if (wxClearBtn) {
            wxClearBtn.addEventListener('click', () => this.clearWeather());
        }

        if (wxAirportInput) {
            wxAirportInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.fetchWeather();
                }
            });

            // Auto-uppercase
            wxAirportInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }

        // Sub-tab switching
        const subtabButtons = document.querySelectorAll('.wx-subtab');
        subtabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const subtab = btn.getAttribute('data-subtab');
                this.switchSubtab(subtab);
            });
        });

        // ROUTE tab integration - auto-fetch weather when user enters airports
        const departureInput = document.getElementById('departureInput');
        const destinationInput = document.getElementById('destinationInput');

        if (departureInput) {
            departureInput.addEventListener('blur', () => {
                const icao = departureInput.value.trim().toUpperCase();
                if (icao.length === 4) {
                    this.displayRouteWeather(icao, 'departureWeather');
                }
            });
        }

        if (destinationInput) {
            destinationInput.addEventListener('blur', () => {
                const icao = destinationInput.value.trim().toUpperCase();
                if (icao.length === 4) {
                    this.displayRouteWeather(icao, 'destinationWeather');
                }
            });
        }

        console.log('[WeatherController] Initialized');
    },

    /**
     * Update route airports quick select bar
     * Called when a route is calculated or cleared
     * @param {Array} airports - Array of airport objects with icao property
     */
    updateRouteAirports(airports) {
        const container = document.getElementById('wxRouteAirports');
        const list = document.getElementById('wxRouteAirportsList');
        if (!container || !list) return;

        if (!airports || airports.length === 0) {
            container.style.display = 'none';
            return;
        }

        // Build buttons for each airport
        list.innerHTML = airports.map((apt, index) => {
            const isFirst = index === 0;
            const isLast = index === airports.length - 1;
            let className = 'route-airport-btn';
            if (isFirst) className += ' departure';
            else if (isLast) className += ' destination';

            return `<button class="${className}" onclick="WeatherController.showWeatherForAirport('${apt.icao}')">${apt.icao}</button>`;
        }).join('');

        container.style.display = 'flex';
    },

    /**
     * Update route waypoints for hazard analysis
     * Called when a route is calculated or cleared
     * @param {Array} waypoints - Array of waypoint objects with lat, lon, ident/icao
     */
    updateRouteWaypoints(waypoints) {
        this.routeWaypoints = waypoints || [];
    },

    /**
     * Update route legs for time-based hazard filtering
     * Called when a route is calculated or cleared
     * @param {Array} legs - Array of leg objects with legTime in minutes
     * @param {Date} departureTime - Departure time for ETA calculation
     */
    updateRouteLegs(legs, departureTime = null) {
        this.routeLegs = legs || [];
        this.routeDepartureTime = departureTime || new Date();
    },

    /**
     * Calculate ETAs for each waypoint based on current route legs
     * @returns {Array} Array of Date objects for each waypoint's ETA
     */
    calculateWaypointETAs() {
        if (!this.routeLegs || this.routeLegs.length === 0) {
            return null;
        }
        const depTime = this.routeDepartureTime || new Date();
        return window.Weather?.calculateWaypointETAs(this.routeLegs, depTime) || null;
    },

    /**
     * Filter affected waypoints by time (ETA vs hazard expiration)
     * @param {Array} affectedWaypoints - Array of {ident, index} objects
     * @param {Object} hazard - G-AIRMET or SIGMET with expireTime
     * @param {string} type - 'gairmet' or 'sigmet'
     * @returns {Array} Time-filtered affected waypoints
     */
    filterAffectedByTime(affectedWaypoints, hazard, type) {
        if (!affectedWaypoints || affectedWaypoints.length === 0) {
            return affectedWaypoints;
        }
        const waypointETAs = this.calculateWaypointETAs();
        if (!waypointETAs) {
            return affectedWaypoints; // Can't filter without ETAs
        }
        return affectedWaypoints.filter(wp => {
            // Check if hazard is active when we START the leg TO this waypoint
            // For waypoint N (1-based), the leg TO it starts at waypoint N-1 (1-based)
            // waypointETAs[N-2] = ETA at waypoint N-1 (since etas[0] = wp1, etas[1] = wp2, etc.)
            const legStartIndex = Math.max(0, wp.index - 2);
            const legStartETA = waypointETAs[legStartIndex];
            return window.Weather?.isWeatherValidAtTime(hazard, legStartETA, type) ?? true;
        });
    },

    /**
     * Shows weather for an airport (called from navlog or route quick-select)
     * @param {string} icao - Airport ICAO code
     */
    showWeatherForAirport(icao) {
        // Check online status first
        if (!window.UIController?.isOnline?.()) {
            // Switch to WX tab first so user sees the error there
            const wxTab = document.querySelector('[data-tab="wx"]');
            if (wxTab) {
                wxTab.click();
            }
            this.showError('Internet connection required for weather data');
            return;
        }

        // Switch to WX tab
        const wxTab = document.querySelector('[data-tab="wx"]');
        if (wxTab) {
            wxTab.click();
        }

        // Set input value and fetch
        const input = document.getElementById('wxAirportInput');
        if (input) {
            input.value = icao.toUpperCase();
        }

        this.fetchWeather();
    },

    /**
     * Fetch weather data for an airport
     */
    async fetchWeather() {
        // Check online status first
        if (!window.UIController?.isOnline?.()) {
            this.showError('Internet connection required for weather data');
            return;
        }
        const input = document.getElementById('wxAirportInput');
        const icao = input?.value?.trim().toUpperCase();

        if (!icao || icao.length !== 4) {
            this.showError('Please enter a valid 4-letter ICAO code');
            return;
        }

        this.currentIcao = icao;

        // Hide placeholder, show loading
        this.hideElement('wxPlaceholder');
        this.hideElement('wxError');
        this.hideElement('wxSubtabs');
        this.showElement('wxLoading');

        try {
            console.log(`[WeatherController] Fetching weather for ${icao}`);

            // Get airport location for filtering area hazards
            const airport = window.DataManager?.getAirport(icao);
            const airportLat = airport?.lat;
            const airportLon = airport?.lon;

            // Fetch all weather data in parallel
            const [metar, taf, pireps, sigmets, gairmets] = await Promise.allSettled([
                WeatherAPI.fetchMETAR(icao),
                WeatherAPI.fetchTAF(icao),
                WeatherAPI.fetchPIREPs(icao, 100, 6),
                WeatherAPI.fetchSIGMETs(),
                WeatherAPI.fetchGAIRMETs()
            ]);

            // Filter SIGMETs and G-AIRMETs to those affecting the airport area
            let filteredSigmets = sigmets.status === 'fulfilled' ? sigmets.value : [];
            let filteredGairmets = gairmets.status === 'fulfilled' ? gairmets.value : [];

            if (airportLat !== undefined && airportLon !== undefined) {
                // Filter to hazards within ~150nm or whose polygon contains the airport
                filteredSigmets = filteredSigmets.filter(s =>
                    window.Weather.isHazardRelevantToPoint(s, airportLat, airportLon, 150)
                );
                filteredGairmets = filteredGairmets.filter(g =>
                    window.Weather.isHazardRelevantToPoint(g, airportLat, airportLon, 150)
                );
                console.log(`[WeatherController] Filtered to ${filteredSigmets.length} SIGMETs, ${filteredGairmets.length} G-AIRMETs near ${icao}`);
            }

            this.weatherData = {
                icao,
                metar: metar.status === 'fulfilled' ? metar.value : null,
                taf: taf.status === 'fulfilled' ? taf.value : null,
                pireps: pireps.status === 'fulfilled' ? pireps.value : [],
                sigmets: filteredSigmets,
                gairmets: filteredGairmets
            };

            // Hide loading, show subtabs
            this.hideElement('wxLoading');
            this.showElement('wxSubtabs');

            // Render current subtab
            this.renderCurrentSubtab();

        } catch (error) {
            console.error('[WeatherController] Fetch error:', error);
            this.hideElement('wxLoading');
            this.showError(`Failed to fetch weather: ${error.message}`);
        }
    },

    /**
     * Show a hazard area on the map
     * Enables the appropriate weather overlay and centers the map on the polygon
     * @param {string} type - 'sigmet' or 'gairmet'
     * @param {number} index - Index in the stored array
     */
    showHazardOnMap(type, index) {
        let hazard;
        if (type === 'sigmet' && window._wxSigmets) {
            hazard = window._wxSigmets[index];
        } else if (type === 'gairmet' && window._wxGairmets) {
            hazard = window._wxGairmets[index];
        }

        if (!hazard || !hazard.coords || hazard.coords.length < 3) {
            console.warn('[WeatherController] No valid coordinates for hazard');
            return;
        }

        // Switch to MAP tab first
        const mapTab = document.querySelector('[data-tab="map"]');
        if (mapTab) {
            mapTab.click();
        }

        // Enable the appropriate weather overlay based on hazard type
        if (type === 'sigmet') {
            // Enable SIGMETs overlay
            if (!window.VectorMap.isWeatherEnabled('sigmets')) {
                window.VectorMap.toggleWeatherOverlays('sigmets', true);
                const sigmetBtn = document.getElementById('sigmetBtn');
                if (sigmetBtn) sigmetBtn.classList.add('active');
            }
        } else if (type === 'gairmet') {
            // Determine which G-AIRMET type to enable
            const hazardCode = (hazard.hazard || '').toUpperCase();
            let targetType = null;

            // Map hazard codes to overlay types
            if (hazardCode === 'ICE') {
                targetType = 'ice';
            } else if (hazardCode.includes('TURB') || hazardCode === 'LLWS') {
                targetType = 'turb';
            } else if (hazardCode === 'IFR') {
                targetType = 'ifr';
            } else if (hazardCode === 'MT_OBSC') {
                targetType = 'mtn';
            } else if (hazardCode === 'FZLVL' || hazardCode === 'M_FZLVL') {
                targetType = 'fzlvl';
            }

            // Enable target G-AIRMET type if identified
            if (targetType && !window.VectorMap.isWeatherEnabled(`gairmet-${targetType}`)) {
                window.VectorMap.toggleWeatherOverlays(`gairmet-${targetType}`, true);
                const gairmetBtnIds = {
                    'ice': 'gairmetIceBtn',
                    'turb': 'gairmetTurbBtn',
                    'ifr': 'gairmetIfrBtn',
                    'mtn': 'gairmetMtnBtn',
                    'fzlvl': 'gairmetFzlvlBtn'
                };
                const btn = document.getElementById(gairmetBtnIds[targetType]);
                if (btn) btn.classList.add('active');
            }
        }

        // Center the map on the hazard polygon
        if (window.VectorMap && window.VectorMap.focusOnPolygon) {
            window.VectorMap.focusOnPolygon(hazard.coords);
        }

        const hazardName = window.Weather.getHazardLabel(hazard.hazard || 'UNKNOWN');
        console.log(`[WeatherController] Showing ${type} on map: ${hazardName}`);
    },

    /**
     * Clear weather display
     */
    clearWeather() {
        this.currentIcao = null;
        this.weatherData = null;

        const input = document.getElementById('wxAirportInput');
        if (input) input.value = '';

        this.hideElement('wxSubtabs');
        this.hideElement('wxError');
        this.hideElement('wxLoading');
        this.showElement('wxPlaceholder');

        // Clear displays
        document.getElementById('wxMetarDisplay').innerHTML = '';
        document.getElementById('wxTafDisplay').innerHTML = '';
        document.getElementById('wxPirepDisplay').innerHTML = '';
        document.getElementById('wxSigmetDisplay').innerHTML = '';
        document.getElementById('wxGairmetDisplay').innerHTML = '';
    },

    /**
     * Switch between weather sub-tabs
     */
    switchSubtab(subtab) {
        this.currentSubtab = subtab;

        // Update button states
        document.querySelectorAll('.wx-subtab').forEach(btn => {
            if (btn.getAttribute('data-subtab') === subtab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Hide all subtab contents
        document.querySelectorAll('.wx-subtab-content').forEach(el => {
            el.style.display = 'none';
        });

        // Show selected subtab
        const viewMap = {
            metar: 'wxMetarView',
            taf: 'wxTafView',
            pirep: 'wxPirepView',
            sigmet: 'wxSigmetView',
            gairmet: 'wxGairmetView'
        };

        const viewId = viewMap[subtab];
        if (viewId) {
            document.getElementById(viewId).style.display = 'block';
        }

        // Render content
        this.renderCurrentSubtab();
    },

    /**
     * Render the current subtab content
     */
    renderCurrentSubtab() {
        if (!this.weatherData) return;

        switch (this.currentSubtab) {
            case 'metar':
                this.renderMETAR();
                break;
            case 'taf':
                this.renderTAF();
                break;
            case 'pirep':
                this.renderPIREPs();
                break;
            case 'sigmet':
                this.renderSIGMETs();
                break;
            case 'gairmet':
                this.renderGAIRMETs();
                break;
        }
    },

    /**
     * Render METAR display
     */
    renderMETAR() {
        const container = document.getElementById('wxMetarDisplay');
        const metar = this.weatherData.metar;

        if (!metar) {
            container.innerHTML = '<div class="error-panel"><div class="error-text">No METAR data available</div></div>';
            return;
        }

        const flightCategory = WeatherAPI.getFlightCategoryFromMETAR(metar);
        const categoryBadge = this.getFlightCategoryBadge(flightCategory);

        // Format observation time
        const obsTime = metar.obsTime ? new Date(metar.obsTime * 1000).toUTCString() : 'Unknown';

        // Cloud layers (human readable) - already computed below as cloudsFull

        // Wind information
        const windDir = metar.wdir !== null && metar.wdir !== undefined ? `${metar.wdir.toString().padStart(3, '0')}°` : 'VRB';
        const windSpd = metar.wspd !== null && metar.wspd !== undefined ? `${metar.wspd} KT` : '0 KT';
        const windGust = metar.wgst ? ` G${metar.wgst} KT` : '';

        // Temperature and dewpoint
        const tempC = metar.temp !== null && metar.temp !== undefined ? metar.temp : null;
        const dewpC = metar.dewp !== null && metar.dewp !== undefined ? metar.dewp : null;
        const tempF = tempC !== null ? Math.round(tempC * 9/5 + 32) : null;
        const dewpF = dewpC !== null ? Math.round(dewpC * 9/5 + 32) : null;
        const spread = (tempC !== null && dewpC !== null) ? (tempC - dewpC).toFixed(1) : null;

        const temp = tempC !== null ? `${tempC}°C (${tempF}°F)` : '--';
        const dewp = dewpC !== null ? `${dewpC}°C (${dewpF}°F)` : '--';

        // Altimeter
        const altimInHg = metar.altim || 29.92;
        const altim = `${altimInHg.toFixed(2)}" Hg (${Math.round(altimInHg * 33.8639)} mb)`;

        // Visibility
        const visib = metar.visib ? (metar.visib >= 10 ? '10+ SM' : `${metar.visib} SM`) : '--';

        // Weather string
        const wxRaw = metar.wxString || '';
        const wx = wxRaw.trim() !== '' ? wxRaw : 'None';
        const wxDecoded = wxRaw.trim() !== '' ? this.decodeWxString(wxRaw) : 'None reported';

        // Cloud layers (human readable)
        const cloudsFull = this.formatClouds(metar.clouds);

        container.innerHTML = `
            <div class="stats-card">
                <h3 class="stats-card-title">${this.weatherData.icao} METAR ${categoryBadge}</h3>
                <div class="stats-grid-compact">
                    <div class="stat-item">
                        <span class="stat-label">OBS TIME</span>
                        <span class="stat-value text-secondary" style="font-size: 0.7rem;">${obsTime}</span>
                    </div>
                </div>
            </div>

            <div class="stats-card">
                <h3 class="stats-card-title">CURRENT CONDITIONS</h3>
                <div class="stats-grid-compact">
                    <div class="stat-item">
                        <span class="stat-label">WIND</span>
                        <span class="stat-value text-metric">${windDir} ${windSpd}${windGust}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">VISIBILITY</span>
                        <span class="stat-value text-metric">${visib}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">TEMPERATURE</span>
                        <span class="stat-value text-metric">${temp}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">DEWPOINT</span>
                        <span class="stat-value text-metric">${dewp}</span>
                    </div>
                    ${spread !== null ? `
                    <div class="stat-item">
                        <span class="stat-label">TEMP/DEWPT SPREAD</span>
                        <span class="stat-value text-metric">${spread}°C</span>
                    </div>
                    ` : ''}
                    <div class="stat-item">
                        <span class="stat-label">ALTIMETER</span>
                        <span class="stat-value text-metric">${altim}</span>
                    </div>
                    <div class="stat-item" style="grid-column: 1 / -1;">
                        <span class="stat-label">SKY CONDITION</span>
                        <span class="stat-value text-secondary">${cloudsFull}</span>
                    </div>
                    ${wx !== 'None' ? `
                    <div class="stat-item" style="grid-column: 1 / -1;">
                        <span class="stat-label">PRESENT WEATHER</span>
                        <span class="stat-value text-warning">${wxDecoded}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <div class="stats-card">
                <h3 class="stats-card-title">RAW METAR</h3>
                <div style="padding: 12px;">
                    <div style="font-family: 'Roboto Mono', monospace; color: #00FF00; font-size: 0.8rem; line-height: 1.4; word-break: break-all;">
                        ${metar.rawOb || 'N/A'}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render TAF display (table format matching wx.hisenz.com)
     */
    renderTAF() {
        const container = document.getElementById('wxTafDisplay');
        const taf = this.weatherData.taf;

        if (!taf) {
            container.innerHTML = '<div class="error-panel"><div class="error-text">No TAF data available</div></div>';
            return;
        }

        // Format valid times
        const validFrom = taf.validTimeFrom ? new Date(taf.validTimeFrom * 1000).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
        }) : 'Unknown';
        const validTo = taf.validTimeTo ? new Date(taf.validTimeTo * 1000).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
        }) : 'Unknown';

        // Build forecast table rows
        let tableRowsHTML = '';
        if (taf.fcsts && Array.isArray(taf.fcsts)) {
            tableRowsHTML = taf.fcsts.map((fcst, index) => {
                // Format time period
                const timeFrom = fcst.timeFrom ? new Date(fcst.timeFrom * 1000) : null;
                const timeTo = fcst.timeTo ? new Date(fcst.timeTo * 1000) : null;

                const timeFromStr = timeFrom ? timeFrom.toLocaleString('en-US', {
                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
                }) : '??';
                const timeToStr = timeTo ? timeTo.toLocaleString('en-US', {
                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
                }) : '??';

                const changeType = fcst.fcstChange || (index === 0 ? '' : 'FM');

                // Wind
                const windDir = fcst.wdir !== null && fcst.wdir !== undefined ? `${fcst.wdir.toString().padStart(3, '0')}°` : 'VRB';
                const windSpd = fcst.wspd !== null && fcst.wspd !== undefined ? `${fcst.wspd}KT` : '0KT';
                const windGust = fcst.wgst ? ` G${fcst.wgst}KT` : '';
                const windStr = `${windDir} ${windSpd}${windGust}`;

                // Visibility
                const visib = fcst.visib !== null && fcst.visib !== undefined ?
                    (fcst.visib >= 10 ? '10+SM' : `${fcst.visib}SM`) : '--';

                // Weather
                const wx = fcst.wxString && fcst.wxString.trim() !== '' ? fcst.wxString : '';

                // Clouds (abbreviated)
                let cloudStr = '';
                if (fcst.clouds && Array.isArray(fcst.clouds) && fcst.clouds.length > 0) {
                    cloudStr = fcst.clouds.map(c => {
                        if (c.cover === 'SKC' || c.cover === 'CLR') return c.cover;
                        const base = c.base !== undefined ? c.base.toString().padStart(3, '0') : '';
                        return base ? `${c.cover}${base}` : c.cover;
                    }).join(' ');
                } else {
                    cloudStr = 'SKC';
                }

                // Determine flight category for this period
                let ceiling = null;
                if (fcst.clouds && Array.isArray(fcst.clouds)) {
                    for (const cloud of fcst.clouds) {
                        if (cloud.cover && (cloud.cover === 'BKN' || cloud.cover === 'OVC') &&
                            cloud.base !== null && cloud.base !== undefined) {
                            ceiling = cloud.base;
                            break;
                        }
                    }
                }
                const visibility = fcst.visib || 10;
                const ceilingStr = ceiling !== null ? ceiling.toString() : 'CLR';
                const flightCat = window.WeatherAPI.determineFlightCategory(visibility.toString(), ceilingStr);

                // Flight category color
                let catColor = '#808080';
                if (flightCat === 'VFR') catColor = '#00FF00';
                else if (flightCat === 'MVFR') catColor = '#0077FF';
                else if (flightCat === 'IFR') catColor = '#FF0000';
                else if (flightCat === 'LIFR') catColor = '#FF00FF';

                return `
                    <tr>
                        <td style="color: #00FFFF; font-weight: bold;">${changeType}</td>
                        <td style="color: #e0e0e0; font-size: 0.75rem; white-space: nowrap;">${timeFromStr} - ${timeToStr}</td>
                        <td style="color: #fff;">${windStr}</td>
                        <td style="color: #fff;">${visib}</td>
                        <td style="color: #ffff00;">${wx}</td>
                        <td style="color: #aaa;">${cloudStr}</td>
                        <td style="color: ${catColor}; font-weight: bold; text-align: center;">${flightCat}</td>
                    </tr>
                `;
            }).join('');
        }

        // Format raw TAF with line breaks for FM/TEMPO
        let rawTAF = taf.rawTAF || 'N/A';
        if (rawTAF !== 'N/A') {
            rawTAF = rawTAF.replace(/(^|\s)(FM\d{2,6})/g, (_match, p1, p2) => `${p1}<br/>&nbsp;&nbsp;&nbsp;&nbsp;${p2}`);
            rawTAF = rawTAF.replace(/(^|\s)(TEMPO\b)/g, (_match, p1, p2) => `${p1}<br/>&nbsp;&nbsp;&nbsp;&nbsp;${p2}`);
            rawTAF = rawTAF.replace(/(^|\s)(BECMG\b)/g, (_match, p1, p2) => `${p1}<br/>&nbsp;&nbsp;&nbsp;&nbsp;${p2}`);
        }

        container.innerHTML = `
            <div class="stats-card">
                <h3 class="stats-card-title">${this.weatherData.icao} TAF</h3>
                <div style="padding: 12px; color: var(--text-secondary); font-size: 0.85rem;">
                    Valid: ${validFrom} - ${validTo}
                </div>
            </div>

            <div class="stats-card" style="padding: 0; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.3);">
                            <th style="padding: 8px; text-align: left; color: #888; font-weight: 600;">TYPE</th>
                            <th style="padding: 8px; text-align: left; color: #888; font-weight: 600;">TIME</th>
                            <th style="padding: 8px; text-align: left; color: #888; font-weight: 600;">WIND</th>
                            <th style="padding: 8px; text-align: left; color: #888; font-weight: 600;">VIS</th>
                            <th style="padding: 8px; text-align: left; color: #888; font-weight: 600;">WX</th>
                            <th style="padding: 8px; text-align: left; color: #888; font-weight: 600;">SKY</th>
                            <th style="padding: 8px; text-align: center; color: #888; font-weight: 600;">CAT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHTML}
                    </tbody>
                </table>
            </div>

            <div class="stats-card">
                <h3 class="stats-card-title">RAW TAF</h3>
                <div style="padding: 12px;">
                    <div style="font-family: 'Roboto Mono', monospace; color: #00FF00; font-size: 0.75rem; line-height: 1.6;">
                        ${rawTAF}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render PIREPs display
     */
    renderPIREPs() {
        const container = document.getElementById('wxPirepDisplay');
        const pireps = this.weatherData.pireps;

        if (!pireps || pireps.length === 0) {
            container.innerHTML = `
                <div class="stats-card">
                    <h3 class="stats-card-title">NO PIREPS</h3>
                    <div style="padding: 12px; color: var(--text-secondary);">
                        No pilot reports within 100 NM in the last 6 hours.
                    </div>
                </div>
            `;
            return;
        }

        // Sort PIREPs by time (most recent first)
        const sortedPireps = [...pireps].sort((a, b) => {
            const timeA = a.obsTime || 0;
            const timeB = b.obsTime || 0;
            return timeB - timeA; // Descending (newest first)
        });

        const pirepHTML = sortedPireps.map(pirep => {
            // Calculate relative time
            const getRelativeTime = (obsTime) => {
                if (!obsTime) return '';
                const now = Date.now() / 1000;
                const diffMinutes = Math.round((now - obsTime) / 60);
                if (diffMinutes < 60) return `${diffMinutes}m ago`;
                const diffHours = Math.round(diffMinutes / 60);
                return `${diffHours}h ago`;
            };

            const obsDate = pirep.obsTime ? new Date(pirep.obsTime * 1000) : null;
            const timeStr = obsDate ? obsDate.toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }) : '-';
            const relTime = getRelativeTime(pirep.obsTime);

            // Location (lat/lon from API)
            let locationText = '';
            if (pirep.lat !== undefined && pirep.lat !== null && pirep.lon !== undefined && pirep.lon !== null) {
                const latStr = Math.abs(pirep.lat).toFixed(2) + (pirep.lat >= 0 ? 'N' : 'S');
                const lonStr = Math.abs(pirep.lon).toFixed(2) + (pirep.lon >= 0 ? 'E' : 'W');
                locationText = `${latStr} ${lonStr}`;
            }

            // Flight level (API returns fltLvl as string in hundreds of feet, e.g., "230" = FL230)
            let altText = '-';
            if (pirep.fltLvl !== undefined && pirep.fltLvl !== null && pirep.fltLvl !== '') {
                const fltLvlNum = parseInt(pirep.fltLvl);
                if (!isNaN(fltLvlNum)) {
                    altText = `FL${fltLvlNum} (${fltLvlNum * 100} ft)`;
                }
            }

            // Decode additional weather info
            const decodedInfo = [];

            // Add location if available
            if (locationText) {
                decodedInfo.push(`Location: ${locationText}`);
            }

            // Temperature
            if (pirep.temp !== undefined && pirep.temp !== null && pirep.temp !== 0) {
                decodedInfo.push(`Temp: ${pirep.temp}°C`);
            }

            // Icing
            if (pirep.icgInt1 && pirep.icgInt1 !== 'NEG') {
                let icingStr = `Icing: ${pirep.icgInt1}`;
                if (pirep.icgType1) icingStr += ` ${pirep.icgType1}`;
                if (pirep.icgBas1 && pirep.icgTop1) {
                    icingStr += ` ${pirep.icgBas1}-${pirep.icgTop1}`;
                }
                decodedInfo.push(icingStr);
            }

            // Turbulence
            if (pirep.tbInt1 && pirep.tbInt1 !== 'NEG') {
                let turbStr = `Turb: ${pirep.tbInt1}`;
                if (pirep.tbType1) turbStr += ` ${pirep.tbType1}`;
                if (pirep.tbFreq1) turbStr += ` ${pirep.tbFreq1}`;
                if (pirep.tbBas1 && pirep.tbTop1) {
                    turbStr += ` ${pirep.tbBas1}-${pirep.tbTop1}`;
                }
                decodedInfo.push(turbStr);
            }

            // Sky conditions
            if (pirep.clouds && pirep.clouds.length > 0) {
                const clouds = pirep.clouds.map(c => `${c.cover || ''} ${c.base || ''}`).join(', ');
                decodedInfo.push(`Sky: ${clouds}`);
            }

            // Wind
            if (pirep.wdir !== undefined && pirep.wdir !== null && pirep.wdir !== 0 &&
                pirep.wspd !== undefined && pirep.wspd !== null && pirep.wspd !== 0) {
                decodedInfo.push(`Wind: ${pirep.wdir}° at ${pirep.wspd} kt`);
            }

            return `
                <div class="stats-card" style="margin-bottom: 12px; padding: 12px;">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px; flex-wrap: wrap;">
                        <span style="color: #e0e0e0; font-size: 0.9rem;">${timeStr}</span>
                        ${relTime ? `<span style="color: #ff00ff; font-weight: bold; font-size: 0.85rem;">${relTime}</span>` : ''}
                        <span style="color: #aaa; font-size: 0.85rem;">${pirep.acType || 'Unknown A/C'}</span>
                        <span style="color: #00FFFF; font-weight: bold; font-size: 0.9rem;">${altText}</span>
                    </div>
                    ${decodedInfo.length > 0 ? `
                    <div style="color: #ffff00; font-size: 0.85rem; margin-bottom: 8px;">
                        ${decodedInfo.join(' | ')}
                    </div>
                    ` : ''}
                    <div style="padding: 8px; background: #0a0a0a; border-radius: 4px;">
                        <div style="font-family: 'Roboto Mono', monospace; color: #00FF00; font-size: 0.75rem; line-height: 1.4; word-break: break-all;">
                            ${pirep.rawOb || 'N/A'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="stats-card">
                <h3 class="stats-card-title">PILOT REPORTS (${pireps.length})</h3>
                <div style="padding: 12px; color: var(--text-secondary); font-size: 0.75rem;">
                    Within 100 NM • Last 6 hours
                </div>
            </div>
            ${pirepHTML}
        `;
    },

    /**
     * Render SIGMETs display - each area shown as clickable row
     */
    renderSIGMETs() {
        const container = document.getElementById('wxSigmetDisplay');
        const sigmets = this.weatherData.sigmets;

        if (!sigmets || sigmets.length === 0) {
            container.innerHTML = `
                <div class="stats-card">
                    <h3 class="stats-card-title">NO ACTIVE SIGMETS</h3>
                    <div style="padding: 12px; color: var(--text-secondary);">
                        No significant meteorological information currently active.
                    </div>
                </div>
            `;
            return;
        }

        // Format time display
        const formatValidTime = (timestamp) => {
            if (!timestamp) return 'N/A';
            const d = new Date(timestamp * 1000);
            const day = d.getUTCDate();
            const hours = d.getUTCHours().toString().padStart(2, '0');
            const mins = d.getUTCMinutes().toString().padStart(2, '0');
            return `${day}/${hours}:${mins}Z`;
        };

        // Store sigmets in window for click handler access
        window._wxSigmets = sigmets;

        // Check if we have route waypoints for affected analysis
        const hasRouteWaypoints = this.routeWaypoints && this.routeWaypoints.length > 0;

        // Render each SIGMET area as a clickable row
        const sigmetHTML = sigmets.map((sigmet, index) => {
            const hazardColor = window.Weather.getHazardColor(sigmet.hazard);
            const type = sigmet.airSigmetType || 'SIGMET';
            const hazard = sigmet.hazard || 'UNKNOWN';
            const validFrom = formatValidTime(sigmet.validTimeFrom);
            const validTo = formatValidTime(sigmet.validTimeTo);

            // Altitude
            const altLow = sigmet.altitudeLow1 || sigmet.altitudeLow || null;
            const altHi = sigmet.altitudeHi1 || sigmet.altitudeHi || null;
            const altStr = (altLow && altHi) ? `${altLow}-${altHi}` : '--';

            // Check if has valid coords for clicking
            const hasCoords = sigmet.coords && Array.isArray(sigmet.coords) && sigmet.coords.length >= 3;
            const clickStyle = hasCoords ? 'cursor: pointer;' : '';
            const clickHandler = hasCoords ? `onclick="WeatherController.showHazardOnMap('sigmet', ${index})"` : '';
            const hoverClass = hasCoords ? 'hazard-row-clickable' : '';

            // Calculate affected waypoints if route exists (with index for range formatting)
            // WX tab shows GEOGRAPHIC overlap only (no time filtering)
            // Time filtering is done in navlog HAZARDS summary based on departure time
            let affectedStr = '--';
            if (hasRouteWaypoints && hasCoords && window.Weather?.findAffectedWaypointsWithIndex) {
                const affected = window.Weather.findAffectedWaypointsWithIndex(sigmet, this.routeWaypoints, 30);
                if (affected.length > 0) {
                    // Format as range notation: "KALB(1)-SYR(3)"
                    affectedStr = window.Weather.formatAffectedWaypointsRange(affected);
                    // Truncate if too long
                    if (affectedStr.length > 25) {
                        affectedStr = affectedStr.substring(0, 22) + '...';
                    }
                }
            }

            const affectedCell = hasRouteWaypoints ? `
                <td style="text-align: left; color: ${affectedStr !== '--' ? 'var(--color-warning)' : '#666'}; font-size: 0.65rem; padding: 8px; border-bottom: 1px solid var(--border-color);">${affectedStr}</td>
            ` : '';

            return `
                <tr class="${hoverClass}" style="${clickStyle}" ${clickHandler}>
                    <td style="color: #888; font-size: 0.7rem; padding: 8px; border-bottom: 1px solid var(--border-color);">${type}</td>
                    <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-left: 3px solid ${hazardColor};">
                        <span style="color: ${hazardColor}; font-weight: 600;">${hazard}</span>
                    </td>
                    <td style="text-align: center; color: var(--color-metric); font-size: 0.7rem; padding: 8px; border-bottom: 1px solid var(--border-color);">${altStr}</td>
                    ${affectedCell}
                    <td style="text-align: right; color: var(--text-secondary); font-size: 0.7rem; padding: 8px; border-bottom: 1px solid var(--border-color);">${validFrom} - ${validTo}</td>
                    <td style="text-align: center; padding: 8px; border-bottom: 1px solid var(--border-color);">
                        ${hasCoords ? '<span style="color: var(--color-metric); font-size: 0.65rem;">MAP →</span>' : '<span style="color: #666; font-size: 0.65rem;">--</span>'}
                    </td>
                </tr>
            `;
        }).join('');

        const affectedHeader = hasRouteWaypoints ?
            '<th style="text-align: left; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">AFFECTS</th>' : '';

        container.innerHTML = `
            <div class="stats-card">
                <h3 class="stats-card-title">ACTIVE SIGMETs (${sigmets.length})</h3>
                <div style="padding: 8px 12px; color: var(--text-secondary); font-size: 0.7rem; border-bottom: 1px solid var(--border-color);">
                    Click any row to view area on map
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                    <thead>
                        <tr style="background: var(--bg-tertiary);">
                            <th style="text-align: left; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">TYPE</th>
                            <th style="text-align: left; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">HAZARD</th>
                            <th style="text-align: center; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">ALT (FT)</th>
                            ${affectedHeader}
                            <th style="text-align: right; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">VALID (Z)</th>
                            <th style="text-align: center; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">VIEW</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sigmetHTML}
                    </tbody>
                </table>
            </div>
            <style>
                .hazard-row-clickable:hover {
                    background: rgba(255, 102, 0, 0.1) !important;
                }
            </style>
        `;
    },

    /**
     * Render G-AIRMETs display - each area shown as clickable row
     */
    renderGAIRMETs() {
        const container = document.getElementById('wxGairmetDisplay');
        const gairmets = this.weatherData.gairmets || [];

        if (gairmets.length === 0) {
            container.innerHTML = `
                <div class="stats-card">
                    <h3 class="stats-card-title">G-AIRMETs</h3>
                    <div style="padding: 12px; color: var(--text-secondary); font-size: 0.75rem;">
                        No active G-AIRMETs found
                    </div>
                </div>
            `;
            return;
        }

        // Sort G-AIRMETs by product order (SIERRA, TANGO, ZULU) then by hazard
        const productOrder = { 'SIERRA': 1, 'TANGO': 2, 'ZULU': 3, 'OTHER': 4 };
        const sortedGairmets = [...gairmets].sort((a, b) => {
            const orderA = productOrder[a.product] || 4;
            const orderB = productOrder[b.product] || 4;
            if (orderA !== orderB) return orderA - orderB;
            return (a.hazard || '').localeCompare(b.hazard || '');
        });

        // Store gairmets in window for click handler access
        window._wxGairmets = sortedGairmets;

        // Format relative time from now
        const formatRelativeTime = (isoTime) => {
            if (!isoTime) return '';
            const validDate = new Date(isoTime);
            const now = new Date();
            const diffMs = validDate - now;
            const diffHours = Math.round(diffMs / (1000 * 60 * 60));

            if (diffHours > 0) {
                return `F+${diffHours}h`;
            } else if (diffHours < 0) {
                return `${Math.abs(diffHours)}h ago`;
            }
            return 'Now';
        };

        // Format valid time display
        const formatValidTime = (isoTime) => {
            if (!isoTime) return 'N/A';
            const d = new Date(isoTime);
            const day = d.getDate();
            const hours = d.getHours().toString().padStart(2, '0');
            const mins = d.getMinutes().toString().padStart(2, '0');
            return `${day}/${hours}:${mins}`;
        };

        // Check if we have route waypoints for affected analysis
        const hasRouteWaypoints = this.routeWaypoints && this.routeWaypoints.length > 0;

        // Render each G-AIRMET area as a clickable row
        const gairmetHTML = sortedGairmets.map((gairmet, index) => {
            const hazardColor = window.Weather.getHazardColor(gairmet.hazard);
            const hazardLabel = window.Weather.getHazardLabel(gairmet.hazard);
            const product = gairmet.product || 'OTHER';
            const validStr = formatValidTime(gairmet.validTime);
            const relativeStr = formatRelativeTime(gairmet.validTime);

            // Check if has valid coords for clicking
            const hasCoords = gairmet.coords && Array.isArray(gairmet.coords) && gairmet.coords.length >= 3;
            const clickStyle = hasCoords ? 'cursor: pointer;' : '';
            const clickHandler = hasCoords ? `onclick="WeatherController.showHazardOnMap('gairmet', ${index})"` : '';
            const hoverClass = hasCoords ? 'hazard-row-clickable' : '';

            // Calculate affected waypoints if route exists (with index for range formatting)
            // WX tab shows GEOGRAPHIC overlap only (no time filtering)
            // Time filtering is done in navlog HAZARDS summary based on departure time
            let affectedStr = '--';
            if (hasRouteWaypoints && hasCoords && window.Weather?.findAffectedWaypointsWithIndex) {
                const affected = window.Weather.findAffectedWaypointsWithIndex(gairmet, this.routeWaypoints, 30);
                if (affected.length > 0) {
                    // Format as range notation: "KALB(1)-SYR(3)"
                    affectedStr = window.Weather.formatAffectedWaypointsRange(affected);
                    // Truncate if too long
                    if (affectedStr.length > 25) {
                        affectedStr = affectedStr.substring(0, 22) + '...';
                    }
                }
            }

            const affectedCell = hasRouteWaypoints ? `
                <td style="text-align: left; color: ${affectedStr !== '--' ? 'var(--color-warning)' : '#666'}; font-size: 0.65rem; padding: 8px; border-bottom: 1px solid var(--border-color);">${affectedStr}</td>
            ` : '';

            return `
                <tr class="${hoverClass}" style="${clickStyle}" ${clickHandler}>
                    <td style="color: #888; font-size: 0.7rem; padding: 8px; border-bottom: 1px solid var(--border-color);">${product}</td>
                    <td style="padding: 8px; border-bottom: 1px solid var(--border-color); border-left: 3px solid ${hazardColor};">
                        <span style="color: ${hazardColor}; font-weight: 600;">${hazardLabel}</span>
                        ${gairmet.dueTo ? `<span style="color: var(--text-secondary); font-size: 0.65rem; margin-left: 6px;">${gairmet.dueTo}</span>` : ''}
                    </td>
                    ${affectedCell}
                    <td style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border-color);">
                        <span style="color: var(--text-secondary); font-size: 0.7rem;">${validStr}</span>
                        <span style="color: var(--color-metric); font-size: 0.65rem; margin-left: 4px;">${relativeStr}</span>
                    </td>
                    <td style="text-align: center; padding: 8px; border-bottom: 1px solid var(--border-color);">
                        ${hasCoords ? '<span style="color: var(--color-metric); font-size: 0.65rem;">MAP →</span>' : '<span style="color: #666; font-size: 0.65rem;">--</span>'}
                    </td>
                </tr>
            `;
        }).join('');

        const affectedHeader = hasRouteWaypoints ?
            '<th style="text-align: left; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">AFFECTS</th>' : '';

        container.innerHTML = `
            <div class="stats-card">
                <h3 class="stats-card-title">ACTIVE G-AIRMETs (${gairmets.length})</h3>
                <div style="padding: 8px 12px; color: var(--text-secondary); font-size: 0.7rem; border-bottom: 1px solid var(--border-color);">
                    Click any row to view area on map
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                    <thead>
                        <tr style="background: var(--bg-tertiary);">
                            <th style="text-align: left; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">TYPE</th>
                            <th style="text-align: left; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">HAZARD</th>
                            ${affectedHeader}
                            <th style="text-align: right; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">VALID</th>
                            <th style="text-align: center; padding: 6px 8px; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">VIEW</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gairmetHTML}
                    </tbody>
                </table>
            </div>
            <style>
                .hazard-row-clickable:hover {
                    background: rgba(255, 102, 0, 0.1) !important;
                }
            </style>
        `;
    },

    /**
     * Get flight category badge HTML
     */
    getFlightCategoryBadge(category) {
        const badges = {
            'VFR': '<span class="flight-category-badge" style="background: #00FF00; color: #000;">VFR</span>',
            'MVFR': '<span class="flight-category-badge" style="background: #0077FF; color: #000;">MVFR</span>',
            'IFR': '<span class="flight-category-badge" style="background: #FF0000; color: #000;">IFR</span>',
            'LIFR': '<span class="flight-category-badge" style="background: #FF00FF; color: #000;">LIFR</span>',
            'UNK': '<span class="flight-category-badge" style="background: #808080; color: #FFF;">UNK</span>'
        };
        return badges[category] || badges['UNK'];
    },

    /**
     * Show error message
     */
    showError(message) {
        document.getElementById('wxErrorText').textContent = message;
        this.hideElement('wxPlaceholder');
        this.hideElement('wxLoading');
        this.showElement('wxError');
    },

    /**
     * Fetch and display weather for ROUTE tab airport inputs
     * @param {string} icao - Airport ICAO code
     * @param {string} elementId - ID of weather display element
     */
    async displayRouteWeather(icao, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;

        // Check online status first
        if (!window.UIController?.isOnline?.()) {
            container.style.display = 'none';
            return;
        }

        // Validate ICAO
        if (!icao || icao.length !== 4) {
            container.style.display = 'none';
            return;
        }

        try {
            // Fetch METAR
            const metar = await WeatherAPI.fetchMETAR(icao);
            const flightCategory = WeatherAPI.getFlightCategoryFromMETAR(metar);

            // Format weather summary
            const wind = metar.wdir !== null && metar.wspd !== null
                ? `${metar.wdir.toString().padStart(3, '0')}° ${metar.wspd}KT`
                : 'Calm';
            const vis = metar.visib ? `${metar.visib}SM` : '--';
            const temp = metar.temp !== null ? `${metar.temp}°C` : '--';

            // Cloud layers
            let clouds = 'CLR';
            if (metar.clouds && metar.clouds.length > 0) {
                clouds = metar.clouds.map(c => {
                    const base = c.base ? c.base.toString().padStart(3, '0') : '';
                    return base ? `${c.cover}${base}` : c.cover;
                }).join(' ');
            }

            // Build HTML
            container.innerHTML = `
                <span class="wx-category-badge ${flightCategory.toLowerCase()}">${flightCategory}</span>
                <span class="wx-summary-line">
                    <span class="wx-summary-metric">${wind}</span> •
                    <span class="wx-summary-metric">${vis}</span> •
                    ${temp} • ${clouds}
                </span>
            `;

            container.className = `route-weather-summary ${flightCategory.toLowerCase()}`;
            container.style.display = 'block';

        } catch (error) {
            console.warn(`[WeatherController] Could not fetch weather for ${icao}:`, error.message);
            container.style.display = 'none';
        }
    },

    /**
     * Format cloud layers for human-readable display
     */
    formatClouds(clouds) {
        if (!clouds || !Array.isArray(clouds) || clouds.length === 0) return 'Clear';

        const cloudLayers = clouds.map(c => {
            if (c.cover === 'SKC' || c.cover === 'CLR') return 'Clear';

            const coverNames = {
                'FEW': 'Few',
                'SCT': 'Scattered',
                'BKN': 'Broken',
                'OVC': 'Overcast',
                'VV': 'Vertical Visibility'
            };

            const coverText = coverNames[c.cover] || c.cover;
            const baseText = c.base !== undefined ? ` at ${c.base} ft` : '';
            return `${coverText}${baseText}`;
        });

        return cloudLayers.join(', ');
    },

    /**
     * Decode weather string (present weather codes)
     */
    decodeWxString(wxString) {
        if (!wxString || wxString.trim() === '') return 'None reported';

        const wxCodes = {
            // Intensity
            '-': 'Light',
            '+': 'Heavy',
            'VC': 'Vicinity',

            // Descriptor
            'MI': 'Shallow',
            'PR': 'Partial',
            'BC': 'Patches',
            'DR': 'Low Drifting',
            'BL': 'Blowing',
            'SH': 'Showers',
            'TS': 'Thunderstorm',
            'FZ': 'Freezing',

            // Precipitation
            'DZ': 'Drizzle',
            'RA': 'Rain',
            'SN': 'Snow',
            'SG': 'Snow Grains',
            'IC': 'Ice Crystals',
            'PL': 'Ice Pellets',
            'GR': 'Hail',
            'GS': 'Small Hail',
            'UP': 'Unknown Precipitation',

            // Obscuration
            'BR': 'Mist',
            'FG': 'Fog',
            'FU': 'Smoke',
            'VA': 'Volcanic Ash',
            'DU': 'Dust',
            'SA': 'Sand',
            'HZ': 'Haze',
            'PY': 'Spray',

            // Other
            'PO': 'Dust Whirls',
            'SQ': 'Squalls',
            'FC': 'Funnel Cloud',
            'SS': 'Sandstorm',
            'DS': 'Duststorm'
        };

        let decoded = wxString;
        for (const [code, desc] of Object.entries(wxCodes)) {
            const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            decoded = decoded.replace(new RegExp(escapedCode, 'g'), desc);
        }

        return decoded;
    },

    /**
     * Helper functions
     */
    showElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    },

    hideElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }
};
