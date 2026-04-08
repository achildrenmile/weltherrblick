import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), cesium(), tailwindcss()],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Proxy to avoid CORS issues in dev
      '/api/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opensky/, '/api'),
      },
      '/api/adsb': {
        target: 'https://api.adsb.lol',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/adsb/, ''),
      },
      '/api/celestrak': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/celestrak/, ''),
      },
      '/api/usgs': {
        target: 'https://earthquake.usgs.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/usgs/, ''),
      },
      '/api/austin': {
        target: 'https://data.austintexas.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/austin/, ''),
      },
      '/api/overpass': {
        target: 'https://overpass-api.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/overpass/, ''),
      },
      '/api/cctv-img': {
        target: 'https://cctv.austinmobility.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cctv-img/, ''),
      },
      '/api/caltrans': {
        target: 'https://cwwp2.dot.ca.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/caltrans/, ''),
      },
      '/api/caltrans-img': {
        target: 'https://cwwp2.dot.ca.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/caltrans-img/, ''),
      },
      // Map tile proxies — no direct external calls from browser
      '/api/carto-tiles': {
        target: 'https://basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/carto-tiles/, ''),
      },
      '/api/osm-tiles': {
        target: 'https://tile.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/osm-tiles/, ''),
      },
      '/api/google-tiles': {
        target: 'https://tile.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google-tiles/, ''),
      },
      '/api/cesium-ion': {
        target: 'https://api.cesium.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cesium-ion/, ''),
      },
      '/api/cesium-assets': {
        target: 'https://assets.cesium.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cesium-assets/, ''),
      },
    },
  },
  worker: {
    format: 'es',
  },
})
