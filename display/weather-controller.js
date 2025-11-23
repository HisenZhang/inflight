/**
 * Weather Controller
 * Handles the WX tab display and weather data visualization
 */

window.WeatherController = {
    currentIcao: null,
    currentSubtab: 'metar',
    weatherData: null,

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
     * Fetch weather data for an airport
     */
    async fetchWeather() {
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

            // Fetch all weather data in parallel
            const [metar, taf, pireps, sigmets] = await Promise.allSettled([
                WeatherAPI.fetchMETAR(icao),
                WeatherAPI.fetchTAF(icao),
                WeatherAPI.fetchPIREPs(icao, 100, 6),
                WeatherAPI.fetchSIGMETs()
            ]);

            this.weatherData = {
                icao,
                metar: metar.status === 'fulfilled' ? metar.value : null,
                taf: taf.status === 'fulfilled' ? taf.value : null,
                pireps: pireps.status === 'fulfilled' ? pireps.value : [],
                sigmets: sigmets.status === 'fulfilled' ? sigmets.value : []
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
            sigmet: 'wxSigmetView'
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

        // Extract cloud layers
        let cloudLayers = 'Unknown';
        if (metar.clouds && Array.isArray(metar.clouds)) {
            cloudLayers = metar.clouds.map(cloud => {
                const cover = cloud.cover || '';
                const base = cloud.base ? cloud.base.toString().padStart(3, '0') : '';
                return base ? `${cover}${base}` : cover;
            }).join(' ') || 'Clear';
        }

        // Wind information
        const windDir = metar.wdir !== null && metar.wdir !== undefined ? `${metar.wdir.toString().padStart(3, '0')}°` : 'VRB';
        const windSpd = metar.wspd !== null && metar.wspd !== undefined ? `${metar.wspd} KT` : '0 KT';
        const windGust = metar.wgst ? ` G${metar.wgst} KT` : '';

        // Temperature and dewpoint
        const temp = metar.temp !== null && metar.temp !== undefined ? `${metar.temp}°C` : '--';
        const dewp = metar.dewp !== null && metar.dewp !== undefined ? `${metar.dewp}°C` : '--';

        // Altimeter
        const altim = metar.altim ? `${metar.altim.toFixed(2)}" Hg` : '--';

        // Visibility
        const visib = metar.visib ? `${metar.visib} SM` : '--';

        // Weather string
        const wx = metar.wxString || 'None';

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
                        <span class="stat-label">VIS</span>
                        <span class="stat-value text-metric">${visib}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">TEMP</span>
                        <span class="stat-value text-metric">${temp}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">DEWPT</span>
                        <span class="stat-value text-metric">${dewp}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">ALTIM</span>
                        <span class="stat-value text-metric">${altim}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">CLOUDS</span>
                        <span class="stat-value text-secondary">${cloudLayers}</span>
                    </div>
                </div>
            </div>

            ${wx !== 'None' ? `
            <div class="stats-card">
                <h3 class="stats-card-title">WEATHER</h3>
                <div class="stats-grid-compact">
                    <div class="stat-item" style="grid-column: 1 / -1;">
                        <span class="stat-value text-warning">${wx}</span>
                    </div>
                </div>
            </div>
            ` : ''}

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
     * Render TAF display
     */
    renderTAF() {
        const container = document.getElementById('wxTafDisplay');
        const taf = this.weatherData.taf;

        if (!taf) {
            container.innerHTML = '<div class="error-panel"><div class="error-text">No TAF data available</div></div>';
            return;
        }

        // Format valid times
        const validFrom = taf.validTimeFrom ? new Date(taf.validTimeFrom * 1000).toUTCString() : 'Unknown';
        const validTo = taf.validTimeTo ? new Date(taf.validTimeTo * 1000).toUTCString() : 'Unknown';

        // Build forecast groups
        let forecastHTML = '';
        if (taf.fcsts && Array.isArray(taf.fcsts)) {
            forecastHTML = taf.fcsts.map(fcst => {
                const timeFrom = fcst.timeFrom ? new Date(fcst.timeFrom * 1000).toUTCString().substring(17, 22) : '??:??';
                const changeType = fcst.fcstChange || 'FM';

                const windDir = fcst.wdir !== null && fcst.wdir !== undefined ? `${fcst.wdir.toString().padStart(3, '0')}°` : 'VRB';
                const windSpd = fcst.wspd !== null && fcst.wspd !== undefined ? `${fcst.wspd} KT` : '0 KT';
                const windGust = fcst.wgst ? ` G${fcst.wgst}` : '';

                const visib = fcst.visib || '--';
                const wx = fcst.wxString || 'None';

                let clouds = 'Unknown';
                if (fcst.clouds && Array.isArray(fcst.clouds)) {
                    clouds = fcst.clouds.map(cloud => {
                        const cover = cloud.cover || '';
                        const base = cloud.base ? cloud.base.toString().padStart(3, '0') : '';
                        return base ? `${cover}${base}` : cover;
                    }).join(' ') || 'Clear';
                }

                return `
                    <div class="stats-card" style="margin-bottom: 8px;">
                        <h3 class="stats-card-title">${changeType} ${timeFrom}Z</h3>
                        <div class="stats-grid-compact">
                            <div class="stat-item">
                                <span class="stat-label">WIND</span>
                                <span class="stat-value text-metric">${windDir} ${windSpd}${windGust}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">VIS</span>
                                <span class="stat-value text-metric">${visib} SM</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">WX</span>
                                <span class="stat-value text-secondary">${wx}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">CLOUDS</span>
                                <span class="stat-value text-secondary">${clouds}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = `
            <div class="stats-card">
                <h3 class="stats-card-title">${this.weatherData.icao} TAF</h3>
                <div class="stats-grid-compact">
                    <div class="stat-item">
                        <span class="stat-label">VALID FROM</span>
                        <span class="stat-value text-secondary" style="font-size: 0.7rem;">${validFrom}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">VALID TO</span>
                        <span class="stat-value text-secondary" style="font-size: 0.7rem;">${validTo}</span>
                    </div>
                </div>
            </div>

            ${forecastHTML}

            <div class="stats-card">
                <h3 class="stats-card-title">RAW TAF</h3>
                <div style="padding: 12px;">
                    <div style="font-family: 'Roboto Mono', monospace; color: #00FF00; font-size: 0.8rem; line-height: 1.4; word-break: break-all;">
                        ${taf.rawTAF || 'N/A'}
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

        const pirepHTML = pireps.map(pirep => {
            const hazards = WeatherAPI.parsePIREPHazards(pirep);
            const obsTime = pirep.obsTime ? new Date(pirep.obsTime * 1000).toUTCString() : 'Unknown';

            // Hazard badges
            let hazardBadges = '';
            if (hazards.hasIcing) {
                hazardBadges += `<span class="flight-category-badge" style="background: cyan; color: black; margin-right: 4px;">ICE</span>`;
            }
            if (hazards.hasTurbulence) {
                hazardBadges += `<span class="flight-category-badge" style="background: orange; color: black; margin-right: 4px;">TURB</span>`;
            }
            if (hazards.severity) {
                const severityColor = hazards.severity === 'SEVERE' ? 'red' : hazards.severity === 'MODERATE' ? 'orange' : 'yellow';
                hazardBadges += `<span class="flight-category-badge" style="background: ${severityColor}; color: black;">${hazards.severity}</span>`;
            }

            return `
                <div class="stats-card" style="margin-bottom: 8px;">
                    <h3 class="stats-card-title">
                        ${pirep.reportType || 'PIREP'}
                        ${hazardBadges}
                    </h3>
                    <div class="stats-grid-compact">
                        <div class="stat-item">
                            <span class="stat-label">TIME</span>
                            <span class="stat-value text-secondary" style="font-size: 0.65rem;">${obsTime}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">ALT</span>
                            <span class="stat-value text-metric">${pirep.fltlvl ? `FL${pirep.fltlvl}` : '--'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">A/C</span>
                            <span class="stat-value text-secondary">${pirep.acType || '--'}</span>
                        </div>
                    </div>
                    <div style="padding: 12px; margin-top: 8px; background: #0a0a0a; border-radius: 4px;">
                        <div style="font-family: 'Roboto Mono', monospace; color: #00FFFF; font-size: 0.75rem; line-height: 1.4; word-break: break-all;">
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
     * Render SIGMETs display
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

        const sigmetHTML = sigmets.map(sigmet => {
            const validFrom = sigmet.validTimeFrom ? new Date(sigmet.validTimeFrom * 1000).toUTCString() : 'Unknown';
            const validTo = sigmet.validTimeTo ? new Date(sigmet.validTimeTo * 1000).toUTCString() : 'Unknown';

            // Hazard type badge
            const hazardType = sigmet.hazard || 'UNKNOWN';
            let hazardColor = '#888888';
            if (hazardType.includes('TURB')) hazardColor = 'orange';
            else if (hazardType.includes('ICE')) hazardColor = 'cyan';
            else if (hazardType.includes('IFR')) hazardColor = 'red';
            else if (hazardType.includes('TS')) hazardColor = 'yellow';

            return `
                <div class="stats-card" style="margin-bottom: 8px;">
                    <h3 class="stats-card-title">
                        ${sigmet.airsigmetType || 'SIGMET'}
                        <span class="flight-category-badge" style="background: ${hazardColor}; color: black; margin-left: 8px;">${hazardType}</span>
                    </h3>
                    <div class="stats-grid-compact">
                        <div class="stat-item">
                            <span class="stat-label">AREA</span>
                            <span class="stat-value text-secondary">${sigmet.firId || '--'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">ALT</span>
                            <span class="stat-value text-metric">${sigmet.altitudeLow || '--'} - ${sigmet.altitudeHi || '--'} FT</span>
                        </div>
                    </div>
                    <div class="stats-grid-compact" style="margin-top: 8px;">
                        <div class="stat-item">
                            <span class="stat-label">VALID FROM</span>
                            <span class="stat-value text-secondary" style="font-size: 0.65rem;">${validFrom}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">VALID TO</span>
                            <span class="stat-value text-secondary" style="font-size: 0.65rem;">${validTo}</span>
                        </div>
                    </div>
                    <div style="padding: 12px; margin-top: 8px; background: #0a0a0a; border-radius: 4px;">
                        <div style="font-family: 'Roboto Mono', monospace; color: #FFFF00; font-size: 0.75rem; line-height: 1.4; word-break: break-all;">
                            ${sigmet.rawAirSigmet || sigmet.hazard || 'N/A'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="stats-card">
                <h3 class="stats-card-title">ACTIVE SIGMETS (${sigmets.length})</h3>
                <div style="padding: 12px; color: var(--text-secondary); font-size: 0.75rem;">
                    Significant meteorological information
                </div>
            </div>
            ${sigmetHTML}
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
