/**
 * LayerSync — Initializes the LayerManager when the Cesium viewer is ready.
 * Renders nothing. Manages layer lifecycle.
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { LayerManager } from '../layers/layer-manager'

export function LayerSync() {
  const viewer = useStore((s) => s.viewer)
  const managerRef = useRef<LayerManager | null>(null)

  useEffect(() => {
    if (!viewer) return

    const manager = new LayerManager(viewer)
    managerRef.current = manager

    return () => {
      manager.dispose()
      managerRef.current = null
    }
  }, [viewer])

  return null
}
