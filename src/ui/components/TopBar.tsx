/**
 * Top Bar — Search bar, system title, and quick-access buttons.
 */
import { useStore } from '../../store'

export function TopBar() {
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const toggleLeftPanel = useStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useStore((s) => s.toggleRightPanel)
  const shaderMode = useStore((s) => s.shaderMode)

  return (
    <div className="absolute top-0 left-0 right-0 h-10 flex items-center gap-3 px-3 z-30 bg-[rgba(0,0,0,0.9)] border-b border-[var(--color-hud-border)] pointer-events-auto">
      {/* Toggle left panel */}
      <button
        onClick={toggleLeftPanel}
        className="text-[var(--color-hud-green)] hover:text-white text-xs transition-colors"
        title="Toggle layers panel"
      >
        ☰
      </button>

      {/* System title */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-hud-green)] text-xs font-bold hud-glow tracking-wider">
          WELTHERRBLICK
        </span>
        <span className="text-gray-600 text-[9px]">
          GEOINT DASHBOARD
        </span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md mx-auto relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="SEARCH // city / landmark / NORAD ID / callsign"
          className="w-full bg-[rgba(0,20,5,0.8)] border border-[var(--color-hud-border)] text-[var(--color-hud-green)] text-[10px] px-3 py-1.5 rounded-sm placeholder-gray-600 focus:outline-none focus:border-[var(--color-hud-green)]"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 text-[9px]">
          /
        </span>
      </div>

      {/* Active mode indicator */}
      <div className="text-[9px] text-gray-500">
        MODE: <span className="text-[var(--color-hud-green)]">{shaderMode.toUpperCase()}</span>
      </div>

      {/* Toggle right panel */}
      <button
        onClick={toggleRightPanel}
        className="text-[var(--color-hud-green)] hover:text-white text-xs transition-colors"
        title="Toggle shader controls"
      >
        ◆
      </button>
    </div>
  )
}
