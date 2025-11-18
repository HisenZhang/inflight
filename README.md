# IN-FLIGHT

**Free, offline-capable flight planning web app. By pilots, for pilots.**

Try now: **[in-flight.org](https://in-flight.org)**

Just type the URL and start planning—no signup, no install, no subscription.

## Quick Start

```
npm install
npm start
```

Open `http://localhost:8000` → Click "LOAD DATA" → Enter route → Fly.

## What Makes This Different

- **Zero friction**: Type URL, load data once, use forever offline
- **Works everywhere**: Any device with a browser (phone, tablet, laptop)
- **Actually free**: No trial, no paywall, no "premium" features
- **Intelligent routing**: Auto-expands airways and procedures like an FMS
- **Blazing fast**: Pure JavaScript, no build step, instant load

## Core Features

- IFR route planning (airways, SIDs, STARs, procedures)
- Wind correction & fuel calculations
- GPS moving map with auto-waypoint advancement
- Automatic flight logging with GPX export
- 70,000+ airports, 10,000+ navaids worldwide
- Works 100% offline after initial database load

## Documentation

**For Pilots:** [User Guide](https://inflight-docs.pages.dev)

**For Developers:**
- [Architecture](docs/developer/ARCHITECTURE.md) - How it's built
- [Development Setup](docs/developer/SETUP.md) - Local development
- [Testing Guide](docs/developer/TESTING.md) - Run tests
- [Deployment](docs/developer/CLOUDFLARE_DEPLOYMENT.md) - Host your own

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), no frameworks
- **Storage**: IndexedDB for 70k+ waypoints
- **Offline**: Service Worker PWA
- **Geodesy**: Vincenty's formulae on WGS84 ellipsoid
- **Magnetic Variation**: WMM2025 (NOAA)

## Testing

```bash
npm test              # Run all tests
npm run test:browser  # Interactive browser tests
```

50+ automated tests with GitHub Actions CI/CD.

## Architecture

Three-engine design: **Data** (IndexedDB CRUD) → **Compute** (routing algorithms) → **Display** (UI rendering).

No build tools. No bundlers. Just JavaScript that runs in any browser.

See [ARCHITECTURE.md](docs/developer/ARCHITECTURE.md) for details.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](docs/CONTRIBUTING.md).

## License

MIT License. Data from [OurAirports](https://ourairports.com/) (public domain).

---

**Made with ❤️ for aviation enthusiasts**
