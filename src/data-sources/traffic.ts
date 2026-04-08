/**
 * Traffic Simulation Layer — GPU particle system flowing along road networks.
 *
 * Data source: OpenStreetMap via Overpass API
 * Endpoint: https://overpass-api.de/api/interpreter
 * Strategy: Sequential loading — highways first, then arterials, then local roads
 * Refresh: Road network loaded once per area; particles animate continuously
 * Rate limit: Overpass has soft limits; we cache road data aggressively
 *
 * Renders traffic as animated polylines with flowing color gradients
 * to simulate vehicle movement along road segments.
 */
import * as Cesium from 'cesium'
import { BaseDataLayer, type DataLayerOptions } from './base-layer'

interface RoadSegment {
  id: number
  type: 'highway' | 'arterial' | 'local'
  coords: Array<[number, number]> // [lon, lat]
  length: number // total segment length in degrees (approx)
}

interface TrafficParticle {
  roadIdx: number
  progress: number // 0-1 along the road
  speed: number    // progress units per frame
}

const OVERPASS_URL = '/api/overpass/api/interpreter'

export class TrafficLayer extends BaseDataLayer {
  private roads: RoadSegment[] = []
  private entities: Cesium.Entity[] = []
  private particles: TrafficParticle[] = []
  private particleCollection: Cesium.PointPrimitiveCollection | null = null
  private loadPhase = 0
  private animFrameId: number | null = null

  constructor(options: DataLayerOptions) {
    super(options)
  }

  async init() {
    // Get current camera center for area query
    const center = this.getCameraCenter()
    if (!center) {
      console.warn('[Traffic] No camera center available')
      this.onStatusUpdate('error')
      return
    }

    // Sequential loading to avoid browser crash
    await this.loadRoads(center, 'highway')
    this.renderRoads()
    this.loadPhase = 1

    // Load arterials after a short delay
    setTimeout(async () => {
      if (!this.active) return
      await this.loadRoads(center, 'arterial')
      this.renderRoads()
      this.loadPhase = 2
    }, 3000)

    // Load local roads after another delay
    setTimeout(async () => {
      if (!this.active) return
      await this.loadRoads(center, 'local')
      this.renderRoads()
      this.loadPhase = 3
    }, 8000)

    // Animate traffic flow
    this.startAnimation()
  }

  update(_dt: number) {}

  dispose() {
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []
    this.roads = []
    this.particles = []
    if (this.particleCollection) {
      this.viewer.scene.primitives.remove(this.particleCollection)
      this.particleCollection = null
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }

  private getCameraCenter(): { lat: number; lon: number } | null {
    const camera = this.viewer.camera
    const ray = camera.getPickRay(new Cesium.Cartesian2(
      this.viewer.canvas.width / 2,
      this.viewer.canvas.height / 2
    ))
    if (!ray) return null

    const position = this.viewer.scene.globe.pick(ray, this.viewer.scene)
    if (!position) return null

    const carto = Cesium.Cartographic.fromCartesian(position)
    return {
      lat: Cesium.Math.toDegrees(carto.latitude),
      lon: Cesium.Math.toDegrees(carto.longitude),
    }
  }

  private async loadRoads(center: { lat: number; lon: number }, type: 'highway' | 'arterial' | 'local') {
    const radius = type === 'highway' ? 0.15 : type === 'arterial' ? 0.08 : 0.04
    const bbox = `${center.lat - radius},${center.lon - radius},${center.lat + radius},${center.lon + radius}`

    let wayFilter: string
    switch (type) {
      case 'highway':
        wayFilter = '["highway"~"motorway|trunk|primary"]'
        break
      case 'arterial':
        wayFilter = '["highway"~"secondary|tertiary"]'
        break
      case 'local':
        wayFilter = '["highway"~"residential|unclassified"]'
        break
    }

    const query = `[out:json][timeout:15];way${wayFilter}(${bbox});out geom;`

    try {
      const resp = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()

      const newRoads: RoadSegment[] = data.elements
        .filter((e: Record<string, unknown>) => e.type === 'way' && e.geometry)
        .map((e: Record<string, unknown>): RoadSegment => {
          const coords = (e.geometry as Array<{ lon: number; lat: number }>)
            .map((g) => [g.lon, g.lat] as [number, number])
          let length = 0
          for (let i = 1; i < coords.length; i++) {
            const dx = coords[i][0] - coords[i-1][0]
            const dy = coords[i][1] - coords[i-1][1]
            length += Math.sqrt(dx*dx + dy*dy)
          }
          return { id: e.id as number, type, coords, length }
        })

      const startIdx = this.roads.length
      this.roads.push(...newRoads)
      this.spawnParticles(startIdx, newRoads.length)
      this.onCountUpdate(this.roads.length)
    } catch (e) {
      console.warn(`[Traffic] Failed to load ${type} roads:`, e)
    }
  }

  private renderRoads() {
    // Clear existing
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []

    for (const road of this.roads) {
      const positions = road.coords.flatMap(([lon, lat]) => [lon, lat, 5])
      const color = road.type === 'highway'
        ? Cesium.Color.fromCssColorString('#00ff41').withAlpha(0.6)
        : road.type === 'arterial'
          ? Cesium.Color.fromCssColorString('#00d4ff').withAlpha(0.4)
          : Cesium.Color.fromCssColorString('#00ff41').withAlpha(0.2)

      const width = road.type === 'highway' ? 3 : road.type === 'arterial' ? 2 : 1

      const entity = this.viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
          width,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color,
          }),
          clampToGround: false,
        },
      })
      this.entities.push(entity)
    }
  }

  private spawnParticles(startIdx: number, count: number) {
    // Spawn ~1 particle per road segment (more for highways)
    for (let i = 0; i < count; i++) {
      const roadIdx = startIdx + i
      const road = this.roads[roadIdx]
      if (road.coords.length < 2) continue
      const density = road.type === 'highway' ? 3 : road.type === 'arterial' ? 2 : 1
      for (let j = 0; j < density; j++) {
        this.particles.push({
          roadIdx,
          progress: Math.random(),
          speed: (0.001 + Math.random() * 0.002) * (road.type === 'highway' ? 2 : road.type === 'arterial' ? 1.5 : 1),
        })
      }
    }
  }

  /** Interpolate position along a road at progress [0,1] */
  private interpolateRoad(road: RoadSegment, progress: number): [number, number] {
    const totalLen = road.length
    let target = progress * totalLen
    for (let i = 1; i < road.coords.length; i++) {
      const dx = road.coords[i][0] - road.coords[i-1][0]
      const dy = road.coords[i][1] - road.coords[i-1][1]
      const segLen = Math.sqrt(dx*dx + dy*dy)
      if (target <= segLen || i === road.coords.length - 1) {
        const t = segLen > 0 ? target / segLen : 0
        return [
          road.coords[i-1][0] + dx * t,
          road.coords[i-1][1] + dy * t,
        ]
      }
      target -= segLen
    }
    return road.coords[road.coords.length - 1]
  }

  private startAnimation() {
    if (!this.particleCollection) {
      this.particleCollection = new Cesium.PointPrimitiveCollection()
      this.viewer.scene.primitives.add(this.particleCollection)
    }

    const animate = () => {
      if (!this.active) return

      this.particleCollection!.removeAll()
      for (const p of this.particles) {
        p.progress += p.speed
        if (p.progress > 1) p.progress -= 1

        const road = this.roads[p.roadIdx]
        if (!road || road.coords.length < 2) continue
        const [lon, lat] = this.interpolateRoad(road, p.progress)

        this.particleCollection!.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 8),
          pixelSize: road.type === 'highway' ? 3 : 2,
          color: Cesium.Color.fromCssColorString('#00ff41').withAlpha(0.9),
        })
      }

      this.animFrameId = requestAnimationFrame(animate)
    }
    this.animFrameId = requestAnimationFrame(animate)
  }
}
