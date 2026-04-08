/**
 * Bottom Bar — Data source status lights, camera info, and keyboard hints.
 */
import { useStore, type LayerName } from '../../store'

const STATUS_ITEMS: Array<{ name: LayerName; label: string }> = [
  { name: 'satellites', label: 'SAT' },
  { name: 'civilianFlights', label: 'CIV' },
  { name: 'militaryFlights', label: 'MIL' },
  { name: 'earthquakes', label: 'SEI' },
  { name: 'cctv', label: 'CAM' },
  { name: 'traffic', label: 'TRF' },
]

function getStatusColor(status: string, enabled: boolean): string {
  if (!enabled) return 'bg-gray-700'
  switch (status) {
    case 'active': return 'bg-[var(--color-hud-green)]'
    case 'loading': return 'bg-[var(--color-hud-amber)] status-blink'
    case 'error': return 'bg-[var(--color-hud-red)]'
    default: return 'bg-gray-600'
  }
}

export function BottomBar() {
  const layers = useStore((s) => s.layers)
  const trackedEntity = useStore((s) => s.trackedEntity)

  return (
    <div className="absolute bottom-0 left-0 right-0 h-10 flex items-center gap-4 px-4 z-30 bg-[rgba(0,0,0,0.9)] border-t border-[var(--color-hud-border)] pointer-events-auto">
      {/* Data source status lights */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] text-gray-600 tracking-widest">SRC</span>
        {STATUS_ITEMS.map(({ name, label }) => (
          <div key={name} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(layers[name].status, layers[name].enabled)}`} />
            <span className="text-[9px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex-1" />

      {/* Tracked entity telemetry */}
      {trackedEntity && (
        <div className="flex items-center gap-3 text-[9px]">
          <span className="text-[var(--color-hud-amber)]">TRACKING</span>
          <span className="text-gray-300">{trackedEntity.name}</span>
          {trackedEntity.altitude != null && (
            <span className="text-gray-500">ALT {(trackedEntity.altitude / 1000).toFixed(1)}km</span>
          )}
          {trackedEntity.speed != null && (
            <span className="text-gray-500">SPD {trackedEntity.speed.toFixed(0)}m/s</span>
          )}
          {trackedEntity.heading != null && (
            <span className="text-gray-500">HDG {trackedEntity.heading.toFixed(0)}°</span>
          )}
        </div>
      )}

      {/* Keyboard hints */}
      <div className="flex items-center gap-2 text-[9px] text-gray-600">
        <span>1-5:MODE</span>
        <span>Q-T:POI</span>
        <span>TAB:SHADER</span>
        <span>ESC:UNTRACK</span>
      </div>

      {/* UTC clock */}
      <Clock />
    </div>
  )
}

function Clock() {
  // Simple clock that updates every second
  const now = new Date()
  const utc = now.toISOString().slice(11, 19)

  return (
    <span className="text-[10px] text-[var(--color-hud-green)] hud-glow tabular-nums font-bold">
      {utc}Z
    </span>
  )
}
