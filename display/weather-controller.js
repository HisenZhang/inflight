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
            const [metar, taf, pireps, sigmets, gairmets] = await Promise.allSettled([
                WeatherAPI.fetchMETAR(icao),
                WeatherAPI.fetchTAF(icao),
                WeatherAPI.fetchPIREPs(icao, 100, 6),
                WeatherAPI.fetchSIGMETs(),
                WeatherAPI.fetchGAIRMETs()
            ]);

            this.weatherData = {
                icao,
                metar: metar.status === 'fulfilled' ? metar.value : null,
                taf: taf.status === 'fulfilled' ? taf.value : null,
                pireps: pireps.status === 'fulfilled' ? pireps.value : [],
                sigmets: sigmets.status === 'fulfilled' ? sigmets.value : [],
                gairmets: gairmets.status === 'fulfilled' ? gairmets.value : []
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
     * Render G-AIRMETs display
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

        const gairmetHTML = gairmets.map(gairmet => {
            const hazard = gairmet.hazard || 'UNKNOWN';
            const validFrom = gairmet.validTimeFrom
                ? new Date(gairmet.validTimeFrom).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'N/A';
            const validTo = gairmet.validTimeTo
                ? new Date(gairmet.validTimeTo).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'N/A';

            // Determine hazard color based on type
            let hazardColor = '#FFFF00'; // Default yellow
            if (hazard.includes('TURB') || hazard.includes('TURBULENCE')) {
                hazardColor = '#FFA500'; // Orange for turbulence
            } else if (hazard.includes('ICE') || hazard.includes('ICING')) {
                hazardColor = '#00FFFF'; // Cyan for icing
            } else if (hazard.includes('IFR') || hazard.includes('MTN OBSCN')) {
                hazardColor = '#FF0000'; // Red for IFR/mountain obscuration
            }

            return `
                <div class="stats-card" style="margin-top: 8px; border-left: 3px solid ${hazardColor};">
                    <div style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color);">
                        <span style="font-weight: 700; color: ${hazardColor};">${hazard}</span>
                    </div>
                    <div style="padding: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
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
                            ${gairmet.rawGAirmet || gairmet.hazard || 'N/A'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="stats-card">
                <h3 class="stats-card-title">ACTIVE G-AIRMETs (${gairmets.length})</h3>
                <div style="padding: 12px; color: var(--text-secondary); font-size: 0.75rem;">
                    Graphical Airmen's Meteorological Information
                </div>
            </div>
            ${gairmetHTML}
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
