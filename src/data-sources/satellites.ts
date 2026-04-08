/**
 * Satellite Layer — Real-time satellite tracking using TLE data.
 *
 * Data source: CelesTrak (https://celestrak.org)
 * Propagation: satellite.js SGP4 algorithm
 * Refresh: TLE data refreshed every 4 hours (orbital elements don't change fast)
 * Rate limit: CelesTrak has no strict rate limit but requests are cached aggressively
 *
 * Displays all active satellites as point primitives with orbit classification:
 * - LEO (<2000km): cyan
 * - MEO (2000-35786km): yellow
 * - GEO (>35786km): magenta
 *
 * Click a satellite to render its full orbital path and lock camera.
 */
import * as Cesium from 'cesium'
import * as satellite from 'satellite.js'
import { BaseDataLayer, type DataLayerOptions } from './base-layer'

interface SatRecord {
  name: string
  satrec: satellite.SatRec
  noradId: string
  orbitClass: 'LEO' | 'MEO' | 'GEO'
}

// TLE sources from CelesTrak — these are publicly available, no auth required
// Proxied through Vite dev server to avoid CORS issues
const TLE_URLS = [
  '/api/celestrak/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
]

const TLE_FALLBACK = '/api/celestrak/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle'

export class SatelliteLayer extends BaseDataLayer {
  private satellites: SatRecord[] = []
  private pointCollection: Cesium.PointPrimitiveCollection | null = null
  private orbitEntity: Cesium.Entity | null = null
  private tleCache: string | null = null
  private tleCacheTime = 0
  private readonly TLE_CACHE_DURATION = 4 * 60 * 60 * 1000 // 4 hours

  constructor(options: DataLayerOptions) {
    super(options)
  }

  async init() {
    const tleText = await this.fetchTLEs()
    this.satellites = this.parseTLEs(tleText)

    // Limit to first 5000 for performance
    if (this.satellites.length > 5000) {
      this.satellites = this.satellites.slice(0, 5000)
    }

    this.onCountUpdate(this.satellites.length)

    // Create point primitives
    this.pointCollection = new Cesium.PointPrimitiveCollection()
    this.viewer.scene.primitives.add(this.pointCollection)

    // Initial positions
    this.updatePositions()

    // Update positions every 2 seconds
    this.intervalId = setInterval(() => {
      if (this.active) this.updatePositions()
    }, 2000)
  }

  update(_dt: number) {
    // Positions are updated via interval
  }

  dispose() {
    if (this.pointCollection) {
      this.viewer.scene.primitives.remove(this.pointCollection)
      this.pointCollection = null
    }
    this.clearOrbitPath()
    this.satellites = []
  }

  /** Render a full orbit path for a satellite by NORAD ID */
  showOrbitPath(noradId: string) {
    this.clearOrbitPath()
    const sat = this.satellites.find((s) => s.noradId === noradId)
    if (!sat) return

    const now = new Date()
    // Compute orbital period from mean motion (rev/day)
    const meanMotion = sat.satrec.no * (1440 / (2 * Math.PI))
    const periodMinutes = 1440 / meanMotion
    const steps = 180 // sample points around the orbit
    const positions: Cesium.Cartesian3[] = []

    for (let i = 0; i <= steps; i++) {
      const t = new Date(now.getTime() + (i / steps) * periodMinutes * 60 * 1000)
      try {
        const posVel = satellite.propagate(sat.satrec, t)
        if (!posVel.position || typeof posVel.position === 'boolean') continue
        const gmst = satellite.gstime(t)
        const geo = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst)
        positions.push(Cesium.Cartesian3.fromDegrees(
          satellite.degreesLong(geo.longitude),
          satellite.degreesLat(geo.latitude),
          geo.height * 1000
        ))
      } catch { /* skip */ }
    }

    if (positions.length > 2) {
      this.orbitEntity = this.viewer.entities.add({
        polyline: {
          positions,
          width: 1.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.CYAN.withAlpha(0.5),
          }),
        },
      })
    }
  }

  clearOrbitPath() {
    if (this.orbitEntity) {
      this.viewer.entities.remove(this.orbitEntity)
      this.orbitEntity = null
    }
  }

  private async fetchTLEs(): Promise<string> {
    // Use cache if fresh
    if (this.tleCache && Date.now() - this.tleCacheTime < this.TLE_CACHE_DURATION) {
      return this.tleCache
    }

    try {
      const resp = await fetch(TLE_URLS[0])
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const text = await resp.text()
      this.tleCache = text
      this.tleCacheTime = Date.now()
      return text
    } catch (e) {
      console.warn('[Satellites] Full catalog failed, trying fallback:', e)
      const resp = await fetch(TLE_FALLBACK)
      const text = await resp.text()
      this.tleCache = text
      this.tleCacheTime = Date.now()
      return text
    }
  }

  private parseTLEs(text: string): SatRecord[] {
    const lines = text.trim().split('\n').map((l) => l.trim())
    const sats: SatRecord[] = []

    for (let i = 0; i < lines.length - 2; i += 3) {
      const name = lines[i]
      const line1 = lines[i + 1]
      const line2 = lines[i + 2]

      if (!line1?.startsWith('1 ') || !line2?.startsWith('2 ')) continue

      try {
        const satrec = satellite.twoline2satrec(line1, line2)
        const noradId = line1.substring(2, 7).trim()

        // Determine orbit class from mean motion (revs/day)
        const meanMotion = satrec.no * (1440 / (2 * Math.PI)) // rad/min to rev/day
        let orbitClass: SatRecord['orbitClass'] = 'LEO'
        if (meanMotion < 2.1 && meanMotion > 0.9) orbitClass = 'MEO'
        if (meanMotion < 1.1) orbitClass = 'GEO'

        sats.push({ name, satrec, noradId, orbitClass })
      } catch {
        // Skip malformed TLEs
      }
    }

    return sats
  }

  private updatePositions() {
    if (!this.pointCollection) return

    this.pointCollection.removeAll()
    const now = new Date()

    for (const sat of this.satellites) {
      try {
        const posVel = satellite.propagate(sat.satrec, now)
        if (!posVel.position || typeof posVel.position === 'boolean') continue

        const gmst = satellite.gstime(now)
        const geo = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst)

        const lon = satellite.degreesLong(geo.longitude)
        const lat = satellite.degreesLat(geo.latitude)
        const alt = geo.height * 1000 // km to m

        const color = sat.orbitClass === 'LEO'
          ? Cesium.Color.CYAN.withAlpha(0.7)
          : sat.orbitClass === 'MEO'
            ? Cesium.Color.YELLOW.withAlpha(0.7)
            : Cesium.Color.MAGENTA.withAlpha(0.7)

        this.pointCollection.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
          pixelSize: sat.orbitClass === 'GEO' ? 3 : 2,
          color,
          id: `sat-${sat.noradId}`,
        } as Cesium.PointPrimitive)
      } catch {
        // Skip propagation failures
      }
    }
  }

  /** Get satellite info by NORAD ID for tracking HUD */
  getSatelliteInfo(noradId: string) {
    const sat = this.satellites.find((s) => s.noradId === noradId)
    if (!sat) return null

    const now = new Date()
    const posVel = satellite.propagate(sat.satrec, now)
    if (!posVel.position || typeof posVel.position === 'boolean') return null

    const gmst = satellite.gstime(now)
    const geo = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst)
    const vel = posVel.velocity as satellite.EciVec3<number>

    return {
      name: sat.name,
      noradId: sat.noradId,
      orbitClass: sat.orbitClass,
      lat: satellite.degreesLat(geo.latitude),
      lon: satellite.degreesLong(geo.longitude),
      alt: geo.height,
      speed: Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2),
    }
  }
}
