/**
 * Base class for all data-source layers.
 * Each layer is a self-contained module with init(), update(dt), dispose(),
 * and a settings schema. Adding a new feed means implementing this interface.
 */
import type * as Cesium from 'cesium'
import type { LayerName } from '../store'

export interface DataLayerOptions {
  viewer: Cesium.Viewer
  layerName: LayerName
  onCountUpdate: (count: number) => void
  onStatusUpdate: (status: 'idle' | 'loading' | 'active' | 'error') => void
}

export abstract class BaseDataLayer {
  protected viewer: Cesium.Viewer
  protected layerName: LayerName
  protected onCountUpdate: (count: number) => void
  protected onStatusUpdate: (status: 'idle' | 'loading' | 'active' | 'error') => void
  protected active = false
  protected intervalId: ReturnType<typeof setInterval> | null = null

  constructor(options: DataLayerOptions) {
    this.viewer = options.viewer
    this.layerName = options.layerName
    this.onCountUpdate = options.onCountUpdate
    this.onStatusUpdate = options.onStatusUpdate
  }

  abstract init(): Promise<void>
  abstract update(dt: number): void
  abstract dispose(): void

  async start() {
    if (this.active) return
    this.active = true
    this.onStatusUpdate('loading')
    try {
      await this.init()
      this.onStatusUpdate('active')
    } catch (e) {
      console.error(`[${this.layerName}] Init failed:`, e)
      this.onStatusUpdate('error')
    }
  }

  stop() {
    this.active = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.dispose()
    this.onStatusUpdate('idle')
    this.onCountUpdate(0)
  }
}
