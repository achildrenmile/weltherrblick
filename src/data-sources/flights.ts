/**
 * Flight Layers — Real-time civilian and military aircraft tracking.
 *
 * Civilian flights:
 *   Data source: OpenSky Network REST API (anonymous tier)
 *   Endpoint: https://opensky-network.org/api/states/all
 *   Refresh: Every 10 seconds (OpenSky updates every ~10s)
 *   Rate limit: Anonymous — 10 req/min for /states/all
 *   Terms: https://opensky-network.org/about/terms-of-use
 *
 * Military flights:
 *   Data source: adsb.lol public feed (no auth required)
 *   Endpoint: https://api.adsb.lol/v2/mil
 *   Refresh: Every 10 seconds
 *   Terms: Open data, community project
 */
import * as Cesium from 'cesium'
import { BaseDataLayer, type DataLayerOptions } from './base-layer'

interface FlightRecord {
  icao24: string
  callsign: string
  originCountry: string
  lon: number
  lat: number
  altitude: number // meters
  velocity: number // m/s
  heading: number // degrees
  onGround: boolean
  isMilitary: boolean
}

export class CivilianFlightLayer extends BaseDataLayer {
  private flights: FlightRecord[] = []
  private entities: Cesium.Entity[] = []
  private lastFetchTime = 0
  private readonly FETCH_INTERVAL = 10000 // 10s

  constructor(options: DataLayerOptions) {
    super(options)
  }

  async init() {
    await this.fetchFlights()
    this.renderFlights()

    this.intervalId = setInterval(async () => {
      if (!this.active) return
      await this.fetchFlights()
      this.renderFlights()
    }, this.FETCH_INTERVAL)
  }

  update(_dt: number) {}

  dispose() {
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []
    this.flights = []
  }

  private async fetchFlights() {
    // Rate limit: don't fetch more than once per 6 seconds
    if (Date.now() - this.lastFetchTime < 6000) return

    try {
      const resp = await fetch('/api/opensky/states/all')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      this.lastFetchTime = Date.now()

      if (!data.states) {
        this.flights = []
        return
      }

      this.flights = data.states
        .filter((s: unknown[]) => s[5] != null && s[6] != null && !s[8]) // has position, not on ground
        .slice(0, 3000) // limit for performance
        .map((s: unknown[]): FlightRecord => ({
          icao24: (s[0] as string) || '',
          callsign: ((s[1] as string) || '').trim(),
          originCountry: (s[2] as string) || '',
          lon: s[5] as number,
          lat: s[6] as number,
          altitude: ((s[7] as number) || 0),
          velocity: ((s[9] as number) || 0),
          heading: ((s[10] as number) || 0),
          onGround: s[8] as boolean,
          isMilitary: false,
        }))

      this.onCountUpdate(this.flights.length)
    } catch (e) {
      console.warn('[CivilianFlights] Fetch failed:', e)
      this.onStatusUpdate('error')
    }
  }

  private renderFlights() {
    // Remove old entities
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []

    for (const f of this.flights) {
      const entity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, f.altitude),
        billboard: {
          image: '/plane-icon.svg',
          width: 20,
          height: 20,
          color: Cesium.Color.fromCssColorString('#00d4ff').withAlpha(0.9),
          rotation: -Cesium.Math.toRadians(f.heading),
          alignedAxis: Cesium.Cartesian3.UNIT_Z,
          scaleByDistance: new Cesium.NearFarScalar(1e5, 1.0, 1e7, 0.3),
        },
        label: {
          text: f.callsign || f.icao24,
          font: '10px JetBrains Mono',
          fillColor: Cesium.Color.fromCssColorString('#00d4ff'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          scale: 0.8,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2000000),
          show: true,
        },
        properties: new Cesium.PropertyBag({
          type: 'civilian-flight',
          icao24: f.icao24,
          callsign: f.callsign,
          altitude: f.altitude,
          velocity: f.velocity,
          heading: f.heading,
          originCountry: f.originCountry,
        }),
      })
      this.entities.push(entity)
    }
  }

  getFlights(): FlightRecord[] {
    return this.flights
  }
}

export class MilitaryFlightLayer extends BaseDataLayer {
  private flights: FlightRecord[] = []
  private entities: Cesium.Entity[] = []
  private readonly FETCH_INTERVAL = 10000

  constructor(options: DataLayerOptions) {
    super(options)
  }

  async init() {
    await this.fetchFlights()
    this.renderFlights()

    this.intervalId = setInterval(async () => {
      if (!this.active) return
      await this.fetchFlights()
      this.renderFlights()
    }, this.FETCH_INTERVAL)
  }

  update(_dt: number) {}

  dispose() {
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []
    this.flights = []
  }

  private async fetchFlights() {
    try {
      const resp = await fetch('/api/adsb/v2/mil')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()

      if (!data.ac) {
        this.flights = []
        return
      }

      this.flights = data.ac
        .filter((a: Record<string, unknown>) => a.lat != null && a.lon != null)
        .slice(0, 1000)
        .map((a: Record<string, unknown>): FlightRecord => ({
          icao24: (a.hex as string) || '',
          callsign: ((a.flight as string) || '').trim(),
          originCountry: (a.r as string) || '',
          lon: a.lon as number,
          lat: a.lat as number,
          altitude: ((a.alt_baro as number) || 0) * 0.3048, // ft to m
          velocity: ((a.gs as number) || 0) * 0.514444, // knots to m/s
          heading: (a.track as number) || 0,
          onGround: false,
          isMilitary: true,
        }))

      this.onCountUpdate(this.flights.length)
    } catch (e) {
      console.warn('[MilitaryFlights] Fetch failed:', e)
      this.onStatusUpdate('error')
    }
  }

  private renderFlights() {
    for (const e of this.entities) {
      this.viewer.entities.remove(e)
    }
    this.entities = []

    for (const f of this.flights) {
      const entity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, f.altitude),
        billboard: {
          image: '/jet-icon.svg',
          width: 22,
          height: 22,
          color: Cesium.Color.fromCssColorString('#ffb000').withAlpha(0.9),
          rotation: -Cesium.Math.toRadians(f.heading),
          alignedAxis: Cesium.Cartesian3.UNIT_Z,
          scaleByDistance: new Cesium.NearFarScalar(1e5, 1.0, 1e7, 0.3),
        },
        label: {
          text: f.callsign || f.icao24,
          font: '10px JetBrains Mono',
          fillColor: Cesium.Color.fromCssColorString('#ffb000'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          scale: 0.8,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2000000),
          show: true,
        },
        properties: new Cesium.PropertyBag({
          type: 'military-flight',
          icao24: f.icao24,
          callsign: f.callsign,
          altitude: f.altitude,
          velocity: f.velocity,
          heading: f.heading,
          originCountry: f.originCountry,
        }),
      })
      this.entities.push(entity)
    }
  }
}
