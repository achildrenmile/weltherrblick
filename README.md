# WELTHERRBLICK

> *"The same thing we do every night, Pinky — try to take over the world!"*

Real-time geospatial intelligence dashboard. Think Google Earth meets a Bond villain's command center.

![CesiumJS](https://img.shields.io/badge/CesiumJS-1.140-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)
![License](https://img.shields.io/badge/License-MIT-green)

## What it does

A browser-based 3D globe dashboard that aggregates live data feeds onto a CesiumJS globe with a military-HUD aesthetic:

- **Live Flights** — Real-time commercial and military aircraft from OpenSky Network and ADSB.lol
- **Satellites** — LEO satellite tracking with SGP4 orbital propagation and orbit path visualization (CelesTrak TLE data)
- **Earthquakes** — USGS real-time earthquake feed with magnitude-scaled markers
- **Traffic** — OpenStreetMap road data with animated particle flow
- **CCTV Surveillance** — Live camera feeds from Austin TX and California Caltrans with multi-region browsing
- **Points of Interest** — 44 landmarks across 12 cities with images, fly-to navigation, and info cards
- **Configurable HQ** — Define your own base locations via environment variable

## Features

- Full 3D globe with CartoDB dark tiles, optional Google Photorealistic 3D Tiles, or Cesium Ion terrain
- Click-to-track any entity (aircraft, satellite, CCTV camera)
- Real-time telemetry readout for tracked objects
- Satellite orbit path rendering with SGP4 propagation
- POI info cards with images and scanline overlay
- CCTV monitor panel with thumbnail grid and region filtering
- All assets self-contained (fonts, images, no external CDN calls)
- All external API calls proxied through the server (no direct browser-to-external requests)
- JetBrains Mono font (bundled via @fontsource)
- Configurable HQ locations via `VITE_HQ_LOCATIONS` env variable

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Globe | CesiumJS 1.140 |
| UI | React 19, Zustand |
| Language | TypeScript 6 |
| Build | Vite 8 |
| Font | JetBrains Mono (bundled) |
| Orbital Math | satellite.js (SGP4) |
| Production | Docker + nginx |

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Production (Docker)

```bash
docker compose up -d
```

The app runs on port 80 inside the container. All API proxying is handled by nginx.

### Deploy to Remote

```bash
./deploy.sh          # Full deploy: sync, build, start
./deploy.sh status   # Check container status
./deploy.sh logs     # Tail container logs
./deploy.sh stop     # Stop container
./deploy.sh restart  # Restart container
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_CESIUM_ION_TOKEN` | Cesium Ion access token (enables terrain) | No |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key (enables 3D tiles) | No |
| `VITE_HQ_LOCATIONS` | Custom HQ locations (see format below) | No |

### HQ Location Format

```
name|lat|lon|alt|city;name2|lat2|lon2|alt2|city2
```

Example:
```bash
VITE_HQ_LOCATIONS="Kärnten Funkt HQ|46.6103|13.8558|5000|Villach;Berlin Office|52.52|13.405|8000|Berlin"
```

## Data Sources

All data is fetched through server-side proxies (nginx in production, Vite in development). No direct external requests from the browser.

| Feed | Source | Update Interval |
|------|--------|----------------|
| Commercial flights | OpenSky Network | 10s |
| Military flights | ADSB.lol | 10s |
| Satellites | CelesTrak TLE | On load |
| Earthquakes | USGS GeoJSON | 60s |
| Traffic roads | Overpass API (OSM) | On city change |
| CCTV cameras | Austin TX / Caltrans CA | On load |
| Map tiles | CartoDB / OSM | On demand |

## Project Structure

```
src/
├── App.tsx                  # Main app component
├── main.tsx                 # Entry point, global styles
├── store/index.ts           # Zustand state management
├── data-sources/
│   ├── flights.ts           # OpenSky + ADSB flight tracking
│   ├── satellites.ts        # CelesTrak + SGP4 satellite tracking
│   ├── earthquakes.ts       # USGS earthquake feed
│   ├── traffic.ts           # OSM road data + particle animation
│   └── cctv.ts              # Austin + Caltrans CCTV cameras
├── presets/
│   └── poi-database.ts      # POI database with HQ config
└── ui/components/           # UI overlay components
public/
├── poi/                     # 44 POI images (Wikimedia Commons, CC)
└── kaernten-funkt-logo.svg  # HQ logo
```

## License

MIT

## Credits

- Globe rendering: [CesiumJS](https://cesium.com)
- Map tiles: [CartoDB](https://carto.com) / [OpenStreetMap](https://www.openstreetmap.org)
- Flight data: [OpenSky Network](https://opensky-network.org) / [ADSB.lol](https://adsb.lol)
- Satellite TLEs: [CelesTrak](https://celestrak.org)
- Earthquake data: [USGS](https://earthquake.usgs.gov)
- Road data: [OpenStreetMap](https://www.openstreetmap.org) via Overpass API
- CCTV feeds: Austin TX Open Data / Caltrans CWWP2
- POI images: Wikimedia Commons (Creative Commons licensed)
- Name inspiration: Pinky and the Brain — *"Narf!"*
