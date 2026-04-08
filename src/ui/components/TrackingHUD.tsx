/**
 * Tracking HUD — Displays when an entity is being tracked.
 * Shows telemetry data in an overlay near the bottom-right.
 */
import { useStore } from '../../store'

export function TrackingHUD() {
  const trackedEntity = useStore((s) => s.trackedEntity)
  const setTrackedEntity = useStore((s) => s.setTrackedEntity)

  if (!trackedEntity) return null

  return (
    <div className="absolute bottom-14 right-3 w-56 hud-panel rounded-sm z-20 p-3 pointer-events-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[var(--color-hud-amber)] tracking-widest hud-glow-amber">
          ◎ TRACKING
        </span>
        <button
          onClick={() => setTrackedEntity(null)}
          className="text-[9px] text-gray-500 hover:text-[var(--color-hud-red)] transition-colors"
        >
          [ESC]
        </button>
      </div>

      <div className="text-xs text-white font-bold mb-2">{trackedEntity.name}</div>

      <div className="space-y-1 text-[10px]">
        <TelemetryRow label="TYPE" value={trackedEntity.type.toUpperCase()} />
        <TelemetryRow label="ID" value={trackedEntity.id} />
        {trackedEntity.position && (
          <>
            <TelemetryRow label="LAT" value={trackedEntity.position.lat.toFixed(4) + '°'} />
            <TelemetryRow label="LON" value={trackedEntity.position.lon.toFixed(4) + '°'} />
            <TelemetryRow label="ALT" value={(trackedEntity.position.alt / 1000).toFixed(1) + ' km'} />
          </>
        )}
        {trackedEntity.speed != null && (
          <TelemetryRow label="SPD" value={trackedEntity.speed.toFixed(1) + ' m/s'} />
        )}
        {trackedEntity.heading != null && (
          <TelemetryRow label="HDG" value={trackedEntity.heading.toFixed(1) + '°'} />
        )}
        {trackedEntity.extra && Object.entries(trackedEntity.extra).map(([k, v]) => (
          <TelemetryRow key={k} label={k.toUpperCase()} value={String(v)} />
        ))}
      </div>
    </div>
  )
}

function TelemetryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-[var(--color-hud-green)] tabular-nums">{value}</span>
    </div>
  )
}
