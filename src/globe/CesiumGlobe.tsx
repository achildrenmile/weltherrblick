/**
 * CesiumGlobe — Core 3D globe component.
 *
 * Imagery: OpenStreetMap tiles (no key), or Cesium Ion (with key), or Google 3D Tiles
 * Terrain: Cesium Ion (with key) or flat ellipsoid
 */
import { useEffect, useRef, useCallback } from 'react'
import * as Cesium from 'cesium'
import { useStore } from '../store'
import { getPOIsForCity } from '../presets/poi-database'

const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN || ''

export function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const setViewer = useStore((s) => s.setViewer)
  const currentCity = useStore((s) => s.currentCity)
  const currentPOIIndex = useStore((s) => s.currentPOIIndex)

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    if (ION_TOKEN) {
      Cesium.Ion.defaultAccessToken = ION_TOKEN
      Cesium.Ion.defaultServer = new Cesium.Resource({ url: '/api/cesium-ion/' })
    }

    const viewerOpts: Cesium.Viewer.ConstructorOptions = {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      creditContainer: document.createElement('div'),
      msaaSamples: 2,
      requestRenderMode: false,
      useBrowserRecommendedResolution: true,
    }

    // Use OSM tiles when no Ion token
    if (!ION_TOKEN) {
      viewerOpts.imageryProvider = new Cesium.OpenStreetMapImageryProvider({
        url: '/api/osm-tiles/',
      })
    }

    const viewer = new Cesium.Viewer(containerRef.current, viewerOpts)

    // Scene styling
    viewer.scene.backgroundColor = Cesium.Color.BLACK
    viewer.scene.globe.enableLighting = false
    viewer.scene.globe.showGroundAtmosphere = true
    viewer.scene.fog.enabled = true
    viewer.scene.fog.density = 0.0002
    viewer.scene.skyAtmosphere.show = true
    viewer.scene.sun.show = false
    viewer.scene.moon.show = false
    viewer.scene.highDynamicRange = false
    viewer.scene.globe.depthTestAgainstTerrain = false

    // Google 3D Tiles or Cesium terrain
    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (googleKey) {
      addGoogle3DTiles(viewer, googleKey)
    } else if (ION_TOKEN) {
      addCesiumTerrain(viewer)
    }

    // Initial camera — high above Earth
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-74.0, 40.7, 15000000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    })

    viewerRef.current = viewer
    setViewer(viewer)

    return () => {
      viewer.destroy()
      viewerRef.current = null
      setViewer(null)
    }
  }, [setViewer])

  const flyToPOI = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const pois = getPOIsForCity(currentCity)
    if (pois.length === 0) return
    const poi = pois[currentPOIIndex % pois.length]

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, poi.alt),
      orientation: {
        heading: Cesium.Math.toRadians(30),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
      duration: 2.5,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    })
  }, [currentCity, currentPOIIndex])

  useEffect(() => {
    flyToPOI()
  }, [flyToPOI])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  )
}

async function addGoogle3DTiles(viewer: Cesium.Viewer, apiKey: string) {
  try {
    const tileset = await Cesium.Cesium3DTileset.fromUrl(
      `/api/google-tiles/v1/3dtiles/root.json?key=${apiKey}`,
      { maximumScreenSpaceError: 8 }
    )
    viewer.scene.primitives.add(tileset)
  } catch (e) {
    console.warn('[Weltherrblick] Google 3D Tiles failed:', e)
  }
}

async function addCesiumTerrain(viewer: Cesium.Viewer) {
  try {
    const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
      requestWaterMask: true,
      requestVertexNormals: true,
    })
    viewer.terrainProvider = terrain
  } catch (e) {
    console.warn('[Weltherrblick] Cesium terrain failed:', e)
  }
}
