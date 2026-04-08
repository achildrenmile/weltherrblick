/**
 * Right Panel — Shader/style controls with per-mode sliders.
 * Toggled with Tab key or the visual style button in the top bar.
 */
import { useStore, type ShaderMode, type ShaderSettings } from '../../store'

const MODE_LABELS: Record<ShaderMode, string> = {
  standard: '01 // STANDARD',
  crt: '02 // CRT',
  nightvision: '03 // NIGHT VISION',
  flir: '04 // FLIR/THERMAL',
  pixelated: '05 // SAT-RECON',
}

const MODE_KEYS: Record<ShaderMode, string> = {
  standard: '1',
  crt: '2',
  nightvision: '3',
  flir: '4',
  pixelated: '5',
}

const SLIDER_LABELS: Record<keyof ShaderSettings, string> = {
  intensity: 'INTENSITY',
  pixelation: 'PIXELATION',
  noise: 'NOISE',
  bloom: 'BLOOM',
  sharpen: 'SHARPEN',
  vignette: 'VIGNETTE',
  scanlineDensity: 'SCANLINES',
}

function SliderControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-gray-500 w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 appearance-none bg-gray-800 rounded-sm accent-[var(--color-hud-green)] cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-[var(--color-hud-green)] [&::-webkit-slider-thumb]:rounded-sm"
      />
      <span className="text-[9px] text-[var(--color-hud-green)] w-8 text-right tabular-nums">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  )
}

export function RightPanel() {
  const rightPanelOpen = useStore((s) => s.rightPanelOpen)
  const shaderMode = useStore((s) => s.shaderMode)
  const setShaderMode = useStore((s) => s.setShaderMode)
  const shaderSettings = useStore((s) => s.shaderSettings)
  const updateShaderSetting = useStore((s) => s.updateShaderSetting)

  if (!rightPanelOpen) return null

  const currentSettings = shaderSettings[shaderMode]

  return (
    <div className="absolute top-12 right-3 bottom-16 w-60 hud-panel rounded-sm overflow-y-auto z-20 pointer-events-auto">
      {/* Header */}
      <div className="p-3 border-b border-[var(--color-hud-border)]">
        <div className="text-[10px] text-gray-500 tracking-widest">VISUAL // SHADERS</div>
        <div className="text-xs text-[var(--color-hud-green)] hud-glow mt-1">
          POST-PROCESSING
        </div>
      </div>

      {/* Mode selector */}
      <div className="p-2 space-y-1">
        {(Object.keys(MODE_LABELS) as ShaderMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setShaderMode(mode)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[10px] transition-all
              ${shaderMode === mode
                ? 'bg-[rgba(0,255,65,0.1)] border border-[var(--color-hud-green)] text-[var(--color-hud-green)]'
                : 'border border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}
          >
            <span className="text-gray-600">[{MODE_KEYS[mode]}]</span>
            <span>{MODE_LABELS[mode]}</span>
          </button>
        ))}
      </div>

      {/* Sliders */}
      {shaderMode !== 'standard' && (
        <div className="p-2 border-t border-[var(--color-hud-border)] space-y-2">
          <div className="text-[10px] text-gray-500 tracking-widest mb-1">
            PARAMETERS // {shaderMode.toUpperCase()}
          </div>
          {(Object.keys(SLIDER_LABELS) as Array<keyof ShaderSettings>).map((key) => (
            <SliderControl
              key={key}
              label={SLIDER_LABELS[key]}
              value={currentSettings[key]}
              onChange={(v) => updateShaderSetting(shaderMode, key, v)}
            />
          ))}
        </div>
      )}

      {/* Keyboard hints */}
      <div className="p-2 border-t border-[var(--color-hud-border)]">
        <div className="text-[9px] text-gray-600 space-y-0.5">
          <div>1-5 — switch visual mode</div>
          <div>TAB — toggle this panel</div>
        </div>
      </div>
    </div>
  )
}
