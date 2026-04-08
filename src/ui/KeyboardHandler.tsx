/**
 * KeyboardHandler — Global keyboard shortcuts.
 *
 * 1-5: Switch shader modes
 * Q/W/E/R/T: Cycle through POIs in current city
 * Tab: Toggle shader panel
 * Escape: Clear tracking
 * /: Focus search
 */
import { useEffect } from 'react'
import { useStore, type ShaderMode } from '../store'
import { getPOIsForCity } from '../presets/poi-database'

const MODE_MAP: Record<string, ShaderMode> = {
  '1': 'standard',
  '2': 'crt',
  '3': 'nightvision',
  '4': 'flir',
  '5': 'pixelated',
}

const POI_KEYS = ['q', 'w', 'e', 'r', 't']

export function KeyboardHandler() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const key = e.key.toLowerCase()

      // Shader mode shortcuts
      if (MODE_MAP[key]) {
        e.preventDefault()
        useStore.getState().setShaderMode(MODE_MAP[key])
        return
      }

      // POI cycling
      const poiIndex = POI_KEYS.indexOf(key)
      if (poiIndex !== -1) {
        e.preventDefault()
        const city = useStore.getState().currentCity
        const pois = getPOIsForCity(city)
        if (pois.length > 0) {
          useStore.getState().setCurrentPOIIndex(poiIndex % pois.length)
        }
        return
      }

      // Tab — toggle shader panel
      if (key === 'tab') {
        e.preventDefault()
        useStore.getState().toggleRightPanel()
        return
      }

      // Escape — clear tracking
      if (key === 'escape') {
        e.preventDefault()
        useStore.getState().setTrackedEntity(null)
        return
      }

      // / — focus search
      if (key === '/') {
        e.preventDefault()
        const input = document.querySelector('input[type="text"]') as HTMLInputElement
        input?.focus()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return null
}
