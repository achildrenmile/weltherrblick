/**
 * Global application store using Zustand.
 * Manages all UI state, layer toggles, shader settings, and tracking state.
 */
import { create } from 'zustand'
import type * as Cesium from 'cesium'

// ── Shader Mode Types ──
export type ShaderMode = 'standard' | 'crt' | 'nightvision' | 'flir' | 'pixelated'

export interface ShaderSettings {
  intensity: number
  pixelation: number
  noise: number
  bloom: number
  sharpen: number
  vignette: number
  scanlineDensity: number
}

const DEFAULT_SHADER_SETTINGS: ShaderSettings = {
  intensity: 0.5,
  pixelation: 0,
  noise: 0.3,
  bloom: 0.4,
  sharpen: 0.3,
  vignette: 0.5,
  scanlineDensity: 0.5,
}

// ── Layer Types ──
export interface LayerState {
  enabled: boolean
  entityCount: number
  status: 'idle' | 'loading' | 'active' | 'error'
  lastUpdate: number | null
}

export type LayerName = 'satellites' | 'civilianFlights' | 'militaryFlights' | 'cctv' | 'earthquakes' | 'traffic' | 'weather'

// ── Tracking Types ──
export interface TrackedEntity {
  id: string
  type: 'satellite' | 'flight' | 'vehicle'
  name: string
  position?: { lat: number; lon: number; alt: number }
  speed?: number
  heading?: number
  altitude?: number
  extra?: Record<string, string | number>
}

// ── POI Types ──
export interface POI {
  name: string
  lat: number
  lon: number
  alt: number
  city: string
  isHQ?: boolean
  image?: string
  desc?: string
}

// ── Filter Types ──
export interface Filters {
  flightType: 'all' | 'civilian' | 'military'
  altitudeMin: number
  altitudeMax: number
  countryOfOrigin: string
  satelliteOrbitClass: 'all' | 'LEO' | 'MEO' | 'GEO'
  satelliteCountry: string
  satelliteType: string
  geoFilterEnabled: boolean
  geoFilterCenter: { lat: number; lon: number } | null
  geoFilterRadiusKm: number
}

// ── Detection Mode ──
export type DetectionMode = 'sparse' | 'full'

// ── Store Interface ──
interface WorldViewStore {
  // Cesium viewer reference
  viewer: Cesium.Viewer | null
  setViewer: (viewer: Cesium.Viewer | null) => void

  // Shader state
  shaderMode: ShaderMode
  setShaderMode: (mode: ShaderMode) => void
  shaderSettings: Record<ShaderMode, ShaderSettings>
  updateShaderSetting: (mode: ShaderMode, key: keyof ShaderSettings, value: number) => void

  // Layer state
  layers: Record<LayerName, LayerState>
  toggleLayer: (name: LayerName) => void
  updateLayerStatus: (name: LayerName, status: LayerState['status']) => void
  updateLayerCount: (name: LayerName, count: number) => void

  // POI state
  currentCity: string
  setCurrentCity: (city: string) => void
  currentPOIIndex: number
  setCurrentPOIIndex: (index: number) => void

  // Tracking state
  trackedEntity: TrackedEntity | null
  setTrackedEntity: (entity: TrackedEntity | null) => void

  // Detection mode
  detectionMode: DetectionMode
  setDetectionMode: (mode: DetectionMode) => void

  // Filters
  filters: Filters
  updateFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void

  // UI state
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export const useStore = create<WorldViewStore>((set) => ({
  // Cesium viewer
  viewer: null,
  setViewer: (viewer) => set({ viewer }),

  // Shader state
  shaderMode: 'standard',
  setShaderMode: (mode) => set({ shaderMode: mode }),
  shaderSettings: {
    standard: { ...DEFAULT_SHADER_SETTINGS },
    crt: { ...DEFAULT_SHADER_SETTINGS, scanlineDensity: 0.7, vignette: 0.6, noise: 0.2 },
    nightvision: { ...DEFAULT_SHADER_SETTINGS, intensity: 0.7, noise: 0.4, bloom: 0.6 },
    flir: { ...DEFAULT_SHADER_SETTINGS, intensity: 0.8, bloom: 0.3, sharpen: 0.5 },
    pixelated: { ...DEFAULT_SHADER_SETTINGS, pixelation: 0.6, sharpen: 0.7 },
  },
  updateShaderSetting: (mode, key, value) =>
    set((state) => ({
      shaderSettings: {
        ...state.shaderSettings,
        [mode]: { ...state.shaderSettings[mode], [key]: value },
      },
    })),

  // Layer state
  layers: {
    satellites: { enabled: false, entityCount: 0, status: 'idle', lastUpdate: null },
    civilianFlights: { enabled: false, entityCount: 0, status: 'idle', lastUpdate: null },
    militaryFlights: { enabled: false, entityCount: 0, status: 'idle', lastUpdate: null },
    cctv: { enabled: false, entityCount: 0, status: 'idle', lastUpdate: null },
    earthquakes: { enabled: false, entityCount: 0, status: 'idle', lastUpdate: null },
    traffic: { enabled: false, entityCount: 0, status: 'idle', lastUpdate: null },
    weather: { enabled: false, entityCount: 0, status: 'idle', lastUpdate: null },
  },
  toggleLayer: (name) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [name]: { ...state.layers[name], enabled: !state.layers[name].enabled },
      },
    })),
  updateLayerStatus: (name, status) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [name]: { ...state.layers[name], status },
      },
    })),
  updateLayerCount: (name, count) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [name]: { ...state.layers[name], entityCount: count, lastUpdate: Date.now() },
      },
    })),

  // POI state
  currentCity: 'New York',
  setCurrentCity: (city) => set({ currentCity: city, currentPOIIndex: 0 }),
  currentPOIIndex: 0,
  setCurrentPOIIndex: (index) => set({ currentPOIIndex: index }),

  // Tracking
  trackedEntity: null,
  setTrackedEntity: (entity) => set({ trackedEntity: entity }),

  // Detection mode
  detectionMode: 'sparse',
  setDetectionMode: (mode) => set({ detectionMode: mode }),

  // Filters
  filters: {
    flightType: 'all',
    altitudeMin: 0,
    altitudeMax: 60000,
    countryOfOrigin: '',
    satelliteOrbitClass: 'all',
    satelliteCountry: '',
    satelliteType: '',
    geoFilterEnabled: false,
    geoFilterCenter: null,
    geoFilterRadiusKm: 500,
  },
  updateFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  // UI state
  leftPanelOpen: true,
  rightPanelOpen: false,
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
