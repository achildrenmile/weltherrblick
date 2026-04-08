/**
 * Earthquake Layer — Real-time seismic event visualization.
 *
 * Data source: USGS Earthquake Hazards Program GeoJSON Feed
 * Endpoint: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/
 * Available feeds: significant_hour, all_day, all_week, all_month
 * Refresh: Every 60 seconds
 * Rate limit: No strict limit; USGS requests reasonable usage
 * Terms: Public domain (USGS)
 *
 * Displays earthquakes as pulsing circle markers sized by magnitude.
 * Color: green (< 3.0) → amber (3.0-5.0) → red (> 5.0)
 */
import * as Cesium from 'cesium'
import { BaseDataLayer, type DataLayerOptions } from './base-layer'

interface QuakeRecord {
  id: string
  mag: number
  place: string
  time: number
  lat: number
  lon: number
  depth: number
}

const FEED_URL = '/api/usgs/earthquakes/feed/v1.0/summary/all_day.geojson'

export class EarthquakeLayer extends BaseDataLayer {
  private quakes: QuakeRecord[] = []
  private entities: Cesium.Entity[] = []

  constructor(options: DataLayerOptions) {
    super(options)
  }

  async init() {
    await this.fetchQuakes()
    this.renderQuakes()

    this.intervalId = setInterval(async () => {
      if (!this.active) return
      await this.fetchQuakes()
      this.renderQuakes()
    }, 60000)
  }

  update(_dt: number) {}

  dispose() {
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []
    this.quakes = []
  }

  private async fetchQuakes() {
    try {
      const resp = await fetch(FEED_URL)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()

      this.quakes = data.features.map((f: Record<string, unknown>): QuakeRecord => {
        const props = f.properties as Record<string, unknown>
        const geom = f.geometry as { coordinates: number[] }
        return {
          id: f.id as string,
          mag: (props.mag as number) || 0,
          place: (props.place as string) || 'Unknown',
          time: props.time as number,
          lon: geom.coordinates[0],
          lat: geom.coordinates[1],
          depth: geom.coordinates[2],
        }
      })

      this.onCountUpdate(this.quakes.length)
    } catch (e) {
      console.warn('[Earthquakes] Fetch failed:', e)
      this.onStatusUpdate('error')
    }
  }

  private renderQuakes() {
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []

    for (const q of this.quakes) {
      const color = q.mag >= 5.0
        ? Cesium.Color.fromCssColorString('#ff3333')
        : q.mag >= 3.0
          ? Cesium.Color.fromCssColorString('#ffb000')
          : Cesium.Color.fromCssColorString('#00ff41')

      const size = Math.max(4, Math.min(20, q.mag * 3))

      const entity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(q.lon, q.lat, 0),
        ellipse: {
          semiMinorAxis: size * 5000,
          semiMajorAxis: size * 5000,
          material: color.withAlpha(0.5),
          outline: true,
          outlineColor: color.withAlpha(0.8),
          outlineWidth: 1,
          height: 0,
        },
        point: {
          pixelSize: size,
          color: color.withAlpha(0.9),
          outlineColor: color.withAlpha(0.4),
          outlineWidth: 2,
        },
        label: {
          text: `M${q.mag.toFixed(1)}`,
          font: '10px JetBrains Mono',
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -size - 8),
          scale: 0.8,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
        },
        properties: new Cesium.PropertyBag({
          type: 'earthquake',
          id: q.id,
          mag: q.mag,
          place: q.place,
          depth: q.depth,
          time: q.time,
        }),
      })

      this.entities.push(entity)
    }
  }
}
