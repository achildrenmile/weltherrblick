/**
 * ShaderSync — Syncs Zustand shader state to the Cesium PostProcessStage pipeline.
 * Renders nothing; just subscribes to store and updates shaders.
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { ShaderPipeline } from '../shaders/shader-pipeline'

export function ShaderSync() {
  const viewer = useStore((s) => s.viewer)
  const shaderMode = useStore((s) => s.shaderMode)
  const shaderSettings = useStore((s) => s.shaderSettings)
  const pipelineRef = useRef<ShaderPipeline | null>(null)

  // Initialize pipeline when viewer is ready
  useEffect(() => {
    if (!viewer) return

    const pipeline = new ShaderPipeline(viewer)
    pipelineRef.current = pipeline

    return () => {
      pipeline.dispose()
      pipelineRef.current = null
    }
  }, [viewer])

  // Apply mode changes
  useEffect(() => {
    if (!pipelineRef.current) return
    pipelineRef.current.setMode(shaderMode, shaderSettings[shaderMode])
  }, [shaderMode, shaderSettings])

  // Update settings in real-time
  useEffect(() => {
    if (!pipelineRef.current) return
    pipelineRef.current.updateSettings(shaderSettings[shaderMode])
  }, [shaderSettings, shaderMode])

  return null
}
