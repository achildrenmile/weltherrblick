/**
 * CCTV Layer — Live traffic camera feeds from multiple cities worldwide.
 *
 * Data sources:
 *   Austin TX — data.austintexas.gov (Socrata open data, no auth)
 *   California (LA, SF, San Diego, Sacramento, etc.) — Caltrans CWWP2 (no auth)
 *     Districts: D3 (Sacramento), D4 (SF Bay), D5 (Central Coast),
 *                D7 (LA), D8 (San Bernardino), D11 (San Diego), D12 (Orange County)
 *
 * All image URLs proxied through Vite dev server to avoid CORS.
 */
import * as Cesium from 'cesium'
import { BaseDataLayer, type DataLayerOptions } from './base-layer'

export interface CCTVCamera {
  id: string
  name: string
  lat: number
  lon: number
  imageUrl: string
  region: string
}

// ── Data source configs ──

const AUSTIN_API = '/api/austin/resource/b4k4-adkb.json?$limit=200'

// Caltrans districts with traffic cameras
const CALTRANS_DISTRICTS = [
  { id: '3', label: 'Sacramento' },
  { id: '4', label: 'SF Bay Area' },
  { id: '5', label: 'Central Coast' },
  { id: '7', label: 'Los Angeles' },
  { id: '8', label: 'San Bernardino' },
  { id: '11', label: 'San Diego' },
  { id: '12', label: 'Orange County' },
]

export class CCTVLayer extends BaseDataLayer {
  private cameras: CCTVCamera[] = []
  private entities: Cesium.Entity[] = []
  private imageRefreshId: ReturnType<typeof setInterval> | null = null

  constructor(options: DataLayerOptions) {
    super(options)
  }

  async init() {
    // Fetch all sources in parallel
    const results = await Promise.allSettled([
      this.fetchAustin(),
      ...CALTRANS_DISTRICTS.map(d => this.fetchCaltrans(d.id, d.label)),
    ])

    // Merge all cameras
    this.cameras = results
      .filter((r): r is PromiseFulfilledResult<CCTVCamera[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    this.onCountUpdate(this.cameras.length)
    this.renderCameras()

    // Refresh images every 8 seconds
    this.imageRefreshId = setInterval(() => {
      if (!this.active) return
      this.refreshImages()
    }, 8000)
  }

  update(_dt: number) {}

  dispose() {
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []
    this.cameras = []
    if (this.imageRefreshId) {
      clearInterval(this.imageRefreshId)
      this.imageRefreshId = null
    }
  }

  // ── Austin TX ──
  private async fetchAustin(): Promise<CCTVCamera[]> {
    try {
      const resp = await fetch(AUSTIN_API)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()

      return data
        .filter((c: Record<string, unknown>) => {
          const loc = c.location as { coordinates?: number[] } | undefined
          return loc?.coordinates && loc.coordinates.length >= 2 && c.camera_status === 'TURNED_ON'
        })
        .map((c: Record<string, unknown>): CCTVCamera => {
          const loc = c.location as { coordinates: number[] }
          const rawUrl = (c.screenshot_address as string) || ''
          const imageUrl = rawUrl.includes('cctv.austinmobility.io')
            ? rawUrl.replace('https://cctv.austinmobility.io', '/api/cctv-img')
            : rawUrl
          return {
            id: `ATX-${c.camera_id || Math.random()}`,
            name: (c.location_name as string) || 'Unknown',
            lon: loc.coordinates[0],
            lat: loc.coordinates[1],
            imageUrl,
            region: 'Austin, TX',
          }
        })
        .filter((c: CCTVCamera) => !isNaN(c.lat) && !isNaN(c.lon) && c.imageUrl)
    } catch (e) {
      console.warn('[CCTV] Austin fetch failed:', e)
      return []
    }
  }

  // ── Caltrans California ──
  private async fetchCaltrans(district: string, label: string): Promise<CCTVCamera[]> {
    try {
      const url = `/api/caltrans/data/d${district}/cctv/cctvStatusD${district.padStart(2, '0')}.json`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const text = await resp.text()

      // Caltrans JSON can be malformed/truncated — parse carefully
      let parsed: { data?: Array<{ cctv: CaltransEntry }> }
      try {
        parsed = JSON.parse(text)
      } catch {
        // Try to fix truncated JSON by closing arrays/objects
        const fixed = text.replace(/,\s*$/, '') + ']}'
        try { parsed = JSON.parse(fixed) } catch { return [] }
      }

      if (!parsed?.data) return []

      return parsed.data
        .filter(entry => {
          const c = entry.cctv
          return c?.inService === 'true' &&
            c?.location?.latitude && c?.location?.longitude &&
            c?.imageData?.static?.currentImageURL
        })
        .slice(0, 100) // Limit per district for performance
        .map(entry => {
          const c = entry.cctv
          const rawUrl = c.imageData.static.currentImageURL
          return {
            id: `CA${district}-${c.index}`,
            name: c.location.locationName,
            lat: parseFloat(c.location.latitude),
            lon: parseFloat(c.location.longitude),
            imageUrl: `/api/caltrans-img${new URL(rawUrl, 'https://cwwp2.dot.ca.gov').pathname}`,
            region: `California — ${label}`,
          }
        })
        .filter((c: CCTVCamera) => !isNaN(c.lat) && !isNaN(c.lon))
    } catch (e) {
      console.warn(`[CCTV] Caltrans D${district} failed:`, e)
      return []
    }
  }

  private renderCameras() {
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []

    for (const cam of this.cameras) {
      const entity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 15),
        point: {
          pixelSize: 6,
          color: Cesium.Color.fromCssColorString('#ff3333').withAlpha(0.9),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
          outlineWidth: 1,
        },
        label: {
          text: cam.name,
          font: '9px JetBrains Mono',
          fillColor: Cesium.Color.fromCssColorString('#ff3333'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          scale: 0.8,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 20000),
        },
        properties: new Cesium.PropertyBag({
          type: 'cctv',
          id: cam.id,
          name: cam.name,
          imageUrl: cam.imageUrl,
          region: cam.region,
        }),
      })
      this.entities.push(entity)
    }
  }

  private refreshImages() {
    // Billboard image refresh handled by the monitor UI via cache-busting
  }

  getCameras(): CCTVCamera[] {
    return this.cameras
  }
}

// Type for Caltrans API response
interface CaltransEntry {
  index: string
  inService: string
  location: {
    locationName: string
    latitude: string
    longitude: string
    district: string
    route: string
    nearbyPlace: string
  }
  imageData: {
    static: {
      currentImageURL: string
      currentImageUpdateFrequency: string
    }
  }
}
