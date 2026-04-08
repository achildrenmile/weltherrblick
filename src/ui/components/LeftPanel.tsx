/**
 * Left Panel — Layer toggles with live entity counts, city/POI selector,
 * detection mode toggle, and data source status lights.
 */
import { useStore, type LayerName } from '../../store'
import { CITIES, getPOIsForCity } from '../../presets/poi-database'

const LAYER_CONFIG: Array<{
  name: LayerName
  label: string
  icon: string
  color: string
}> = [
  { name: 'satellites', label: 'SATELLITES', icon: '🛰', color: 'text-[var(--color-hud-cyan)]' },
  { name: 'civilianFlights', label: 'CIV FLIGHTS', icon: '✈', color: 'text-[var(--color-hud-cyan)]' },
  { name: 'militaryFlights', label: 'MIL FLIGHTS', icon: '⚔', color: 'text-[var(--color-hud-amber)]' },
  { name: 'earthquakes', label: 'SEISMIC', icon: '◉', color: 'text-[var(--color-hud-red)]' },
  { name: 'cctv', label: 'CCTV FEEDS', icon: '📹', color: 'text-[var(--color-hud-red)]' },
  { name: 'traffic', label: 'TRAFFIC SIM', icon: '🚗', color: 'text-[var(--color-hud-green)]' },
  { name: 'weather', label: 'WEATHER', icon: '☁', color: 'text-gray-400' },
]

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'active' ? 'bg-[var(--color-hud-green)]' :
    status === 'loading' ? 'bg-[var(--color-hud-amber)] status-blink' :
    status === 'error' ? 'bg-[var(--color-hud-red)]' :
    'bg-gray-600'
  return <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export function LeftPanel() {
  const leftPanelOpen = useStore((s) => s.leftPanelOpen)
  const layers = useStore((s) => s.layers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const currentCity = useStore((s) => s.currentCity)
  const setCurrentCity = useStore((s) => s.setCurrentCity)
  const currentPOIIndex = useStore((s) => s.currentPOIIndex)
  const setCurrentPOIIndex = useStore((s) => s.setCurrentPOIIndex)
  const detectionMode = useStore((s) => s.detectionMode)
  const setDetectionMode = useStore((s) => s.setDetectionMode)

  if (!leftPanelOpen) return null

  const pois = getPOIsForCity(currentCity)

  return (
    <div className="absolute top-12 left-3 bottom-16 w-64 hud-panel rounded-sm overflow-y-auto z-20 pointer-events-auto">
      {/* Header */}
      <div className="p-3 border-b border-[var(--color-hud-border)]">
        <div className="text-[10px] text-gray-500 tracking-widest">SYSTEM // LAYERS</div>
        <div className="text-xs text-[var(--color-hud-green)] hud-glow mt-1">
          WELTHERRBLICK v1.0
        </div>
      </div>

      {/* Layer toggles */}
      <div className="p-2 space-y-1">
        {LAYER_CONFIG.map((cfg) => {
          const layer = layers[cfg.name]
          return (
            <button
              key={cfg.name}
              onClick={() => toggleLayer(cfg.name)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs transition-all
                ${layer.enabled
                  ? 'bg-[rgba(0,255,65,0.1)] border border-[var(--color-hud-border)]'
                  : 'bg-transparent border border-transparent hover:border-gray-700'
                }`}
            >
              <StatusDot status={layer.status} />
              <span className={`${layer.enabled ? cfg.color : 'text-gray-500'}`}>
                {cfg.icon}
              </span>
              <span className={`flex-1 text-left ${layer.enabled ? 'text-gray-200' : 'text-gray-500'}`}>
                {cfg.label}
              </span>
              {layer.entityCount > 0 && (
                <span className="text-[10px] text-[var(--color-hud-green)] tabular-nums">
                  {formatCount(layer.entityCount)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Detection Mode */}
      <div className="p-2 border-t border-[var(--color-hud-border)]">
        <div className="text-[10px] text-gray-500 tracking-widest mb-2">DETECTION MODE</div>
        <div className="flex gap-1">
          {(['sparse', 'full'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDetectionMode(mode)}
              className={`flex-1 text-[10px] py-1 rounded-sm border transition-all
                ${detectionMode === mode
                  ? 'border-[var(--color-hud-green)] text-[var(--color-hud-green)] bg-[rgba(0,255,65,0.1)]'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* City / POI selector */}
      <div className="p-2 border-t border-[var(--color-hud-border)]">
        <div className="text-[10px] text-gray-500 tracking-widest mb-2">NAVIGATION // POI</div>
        <select
          value={currentCity}
          onChange={(e) => setCurrentCity(e.target.value)}
          className="w-full bg-black border border-[var(--color-hud-border)] text-[var(--color-hud-green)] text-xs p-1.5 rounded-sm mb-2"
        >
          {CITIES.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        <div className="space-y-0.5">
          {pois.map((poi, i) => (
            <button
              key={poi.name}
              onClick={() => setCurrentPOIIndex(i)}
              className={`w-full text-left text-[10px] px-2 py-1 rounded-sm transition-all
                ${i === currentPOIIndex % pois.length
                  ? 'text-[var(--color-hud-green)] bg-[rgba(0,255,65,0.08)]'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              {poi.name}
            </button>
          ))}
        </div>
        <div className="text-[9px] text-gray-600 mt-2">
          Q/W/E/R/T — cycle POIs
        </div>
      </div>
    </div>
  )
}
