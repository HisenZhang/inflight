---
layout: home
title: InFlight Documentation
titleTemplate: Flight Planning & Navigation

hero:
  name: InFlight
  text: Flight Planning & Navigation
  tagline: Lightweight, offline-first web application for professional flight planning
  actions:
    - theme: brand
      text: Quick Start
      link: /user-guide/quick-start
    - theme: alt
      text: User Guide
      link: /user-guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/HisenZhang/inflight

features:
  - icon: ✈️
    title: Offline-First
    details: Works completely offline after initial load with PWA support. Cache all aviation data locally.
  - icon: 🗺️
    title: Professional Navigation Log
    details: Airline-style navlog with comprehensive flight planning data, distances, bearings, and fuel calculations.
  - icon: 🛰️
    title: IFR Route Support
    details: Parse airways, STARs, DPs, coordinates, and direct routing. Full route validation and waypoint resolution.
  - icon: 📡
    title: Real-time GPS Tracking
    details: FMS-style moving map with live position updates, active leg indication, and ETA calculations.
  - icon: 🌍
    title: Global Database
    details: 70,000+ airports and 10,000+ navaids worldwide with frequencies, runways, and detailed information.
  - icon: 💨
    title: Wind Correction
    details: Calculate wind-corrected headings and ground speeds with WMM2025 magnetic variation model.
---

# InFlight Documentation

Welcome to the InFlight documentation! InFlight is a lightweight, offline-first flight planning web application with comprehensive navigation log and tactical display capabilities.

## Quick Links

### For Users
- [Quick Start Guide](user-guide/quick-start) - Get started with InFlight in minutes
- [User Guide](user-guide/README) - Complete guide to all features
- [FAQ](user-guide/faq) - Frequently asked questions
- [Troubleshooting](user-guide/troubleshooting) - Common issues and solutions

### For Developers
- [Architecture Overview](developer/ARCHITECTURE) - System design and structure
- [Setup Guide](developer/SETUP) - Development environment setup
- [Route Parser](developer/PARSER_ARCHITECTURE) - Route parsing internals
- [Route Grammar](developer/ROUTE_GRAMMAR) - Complete route syntax specification
- [Route Syntax Reference](developer/ROUTE_SYNTAX) - Quick syntax reference
- [Deployment Guide](developer/CLOUDFLARE_DEPLOYMENT) - Deploy to Cloudflare Pages

## What is InFlight?

InFlight is a professional flight planning and navigation tool that runs entirely in your web browser. It features:

- **Offline-First**: Works completely offline after initial load with PWA support
- **Comprehensive Database**: Global airports, navaids, runways, and frequencies
- **Professional Navigation Log**: Airline-style navlog with all flight planning data
- **IFR Route Support**: Airways, STARs, DPs, coordinates, and direct routing
- **Tactical Moving Map**: FMS-style display with real-time GPS tracking
- **Wind Correction**: Calculate wind-corrected headings and ground speeds
- **Mobile Optimized**: Touch-friendly interface for tablets and phones

## Features at a Glance

### Flight Planning
- Parse complex IFR routes with airways, procedures, and coordinates
- Calculate distances and bearings using WGS84 geodesy
- Display magnetic variation with WMM2025 model
- Export and import flight plans in JSON format
- Route validation and waypoint resolution

### Navigation
- Real-time GPS tracking with position updates
- Active leg indication with distance/bearing to next waypoint
- Estimated time en route (ETE) and time of arrival (ETA)
- Ground speed and track calculations
- Moving map display with tactical navigation

### Data Management
- 70,000+ airports worldwide (ICAO and IATA codes)
- 10,000+ navigation aids (VOR, NDB, DME, TACAN)
- Airport frequencies (Tower, Ground, ATIS, Approach, Departure)
- Runway information (identifiers, length, surface)
- Automatic database updates with offline caching

## Getting Started

1. **Install the App** (optional)
   - Open InFlight in your browser
   - Install as PWA for offline access
   - Available on desktop and mobile devices

2. **Load Flight Data**
   - Click "LOAD DATA" to fetch airport and navaid database
   - Data is cached offline indefinitely
   - Update weekly for the latest information

3. **Plan Your Route**
   - Enter route in the ROUTE tab
   - Use airports, navaids, airways, or coordinates
   - Click COMPUTE to calculate flight plan

4. **Navigate Your Flight**
   - Switch to MAP tab for tactical display
   - Enable GPS for real-time tracking
   - Monitor progress in NAVLOG tab

## Documentation Structure

This documentation is organized into two main sections:

### User Guide
Complete guide for pilots and flight planners using InFlight for flight planning and navigation.

- Getting started and quick start
- Tab-by-tab feature guides
- Keyboard shortcuts and tips
- Troubleshooting and FAQ

### Developer Guide
Technical documentation for developers contributing to InFlight or deploying their own instance.

- Architecture and design principles
- Development setup and testing
- Route parser implementation
- Deployment and configuration

## Open Source

InFlight is open source and available on GitHub. Contributions are welcome!

- Repository: [github.com/HisenZhang/inflight](https://github.com/HisenZhang/inflight)
- License: MIT
- Data Source: [OurAirports](https://ourairports.com/) (Public Domain)

## Support

- Report issues on [GitHub Issues](https://github.com/HisenZhang/inflight/issues)
- Read the [FAQ](user-guide/faq.md) for common questions
- Check [Troubleshooting](user-guide/troubleshooting.md) for solutions
