/**
 * Filter Panel — Filtering controls for flights and satellites.
 * Shown inline within the left panel when relevant layers are active.
 */
import { useStore } from '../../store'

export function FilterPanel() {
  const filters = useStore((s) => s.filters)
  const updateFilter = useStore((s) => s.updateFilter)
  const layers = useStore((s) => s.layers)

  const showFlightFilters = layers.civilianFlights.enabled || layers.militaryFlights.enabled
  const showSatFilters = layers.satellites.enabled

  if (!showFlightFilters && !showSatFilters) return null

  return (
    <div className="p-2 border-t border-[var(--color-hud-border)]">
      <div className="text-[10px] text-gray-500 tracking-widest mb-2">FILTERS</div>

      {showFlightFilters && (
        <div className="space-y-2 mb-3">
          <div className="text-[9px] text-[var(--color-hud-cyan)]">FLIGHTS</div>

          <div className="flex gap-1">
            {(['all', 'civilian', 'military'] as const).map((type) => (
              <button
                key={type}
                onClick={() => updateFilter('flightType', type)}
                className={`flex-1 text-[9px] py-0.5 rounded-sm border transition-all
                  ${filters.flightType === type
                    ? 'border-[var(--color-hud-cyan)] text-[var(--color-hud-cyan)] bg-[rgba(0,212,255,0.1)]'
                    : 'border-gray-700 text-gray-600 hover:border-gray-500'
                  }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>

          <div>
            <label className="text-[9px] text-gray-500">ALT RANGE (ft)</label>
            <div className="flex gap-1 mt-0.5">
              <input
                type="number"
                value={filters.altitudeMin}
                onChange={(e) => updateFilter('altitudeMin', parseInt(e.target.value) || 0)}
                className="w-1/2 bg-black border border-gray-700 text-[9px] text-gray-300 px-1 py-0.5 rounded-sm"
                placeholder="MIN"
              />
              <input
                type="number"
                value={filters.altitudeMax}
                onChange={(e) => updateFilter('altitudeMax', parseInt(e.target.value) || 60000)}
                className="w-1/2 bg-black border border-gray-700 text-[9px] text-gray-300 px-1 py-0.5 rounded-sm"
                placeholder="MAX"
              />
            </div>
          </div>
        </div>
      )}

      {showSatFilters && (
        <div className="space-y-2">
          <div className="text-[9px] text-[var(--color-hud-cyan)]">SATELLITES</div>

          <div className="flex gap-1">
            {(['all', 'LEO', 'MEO', 'GEO'] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => updateFilter('satelliteOrbitClass', cls)}
                className={`flex-1 text-[9px] py-0.5 rounded-sm border transition-all
                  ${filters.satelliteOrbitClass === cls
                    ? 'border-[var(--color-hud-cyan)] text-[var(--color-hud-cyan)] bg-[rgba(0,212,255,0.1)]'
                    : 'border-gray-700 text-gray-600 hover:border-gray-500'
                  }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Geo Filter */}
      <div className="mt-3 space-y-1">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.geoFilterEnabled}
            onChange={(e) => updateFilter('geoFilterEnabled', e.target.checked)}
            className="accent-[var(--color-hud-green)]"
          />
          <span className="text-[9px] text-gray-400">GEO RADIUS FILTER</span>
        </label>
        {filters.geoFilterEnabled && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={filters.geoFilterRadiusKm}
              onChange={(e) => updateFilter('geoFilterRadiusKm', parseInt(e.target.value) || 500)}
              className="w-16 bg-black border border-gray-700 text-[9px] text-gray-300 px-1 py-0.5 rounded-sm"
            />
            <span className="text-[9px] text-gray-500">km from camera center</span>
          </div>
        )}
      </div>
    </div>
  )
}
