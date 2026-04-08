/**
 * Layer Manager — Orchestrates all data source layers.
 * Listens to store changes and starts/stops layers accordingly.
 * Provides a single point of access for all layer instances.
 */
import type * as Cesium from 'cesium'
import { useStore, type LayerName } from '../store'
import { BaseDataLayer, type DataLayerOptions } from '../data-sources/base-layer'
import { SatelliteLayer } from '../data-sources/satellites'
import { CivilianFlightLayer, MilitaryFlightLayer } from '../data-sources/flights'
import { EarthquakeLayer } from '../data-sources/earthquakes'
import { CCTVLayer } from '../data-sources/cctv'
import { TrafficLayer } from '../data-sources/traffic'

export class LayerManager {
  private viewer: Cesium.Viewer
  private layers: Map<LayerName, BaseDataLayer> = new Map()
  private unsubscribe: (() => void) | null = null

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer
    this.initLayers()
    this.subscribeToStore()
  }

  private initLayers() {
    const makeOpts = (name: LayerName): DataLayerOptions => ({
      viewer: this.viewer,
      layerName: name,
      onCountUpdate: (count) => useStore.getState().updateLayerCount(name, count),
      onStatusUpdate: (status) => useStore.getState().updateLayerStatus(name, status),
    })

    this.layers.set('satellites', new SatelliteLayer(makeOpts('satellites')))
    this.layers.set('civilianFlights', new CivilianFlightLayer(makeOpts('civilianFlights')))
    this.layers.set('militaryFlights', new MilitaryFlightLayer(makeOpts('militaryFlights')))
    this.layers.set('earthquakes', new EarthquakeLayer(makeOpts('earthquakes')))
    this.layers.set('cctv', new CCTVLayer(makeOpts('cctv')))
    this.layers.set('traffic', new TrafficLayer(makeOpts('traffic')))
  }

  private subscribeToStore() {
    // Snapshot only the `enabled` booleans so that status/count updates
    // from layers don't re-trigger this subscriber (which caused the
    // infinite stop() → onStatusUpdate → subscribe → stop() loop).
    let prevEnabled: Record<LayerName, boolean> = {} as Record<LayerName, boolean>
    for (const [name] of this.layers) {
      prevEnabled[name] = useStore.getState().layers[name].enabled
    }

    this.unsubscribe = useStore.subscribe((state) => {
      for (const [name, layer] of this.layers) {
        const was = prevEnabled[name]
        const now = state.layers[name].enabled
        if (was !== now) {
          prevEnabled = { ...prevEnabled, [name]: now }
          if (now) {
            layer.start()
          } else {
            layer.stop()
          }
        }
      }
    })
  }

  getLayer(name: LayerName): BaseDataLayer | undefined {
    return this.layers.get(name)
  }

  dispose() {
    for (const layer of this.layers.values()) {
      layer.stop()
    }
    this.layers.clear()
    this.unsubscribe?.()
  }
}
