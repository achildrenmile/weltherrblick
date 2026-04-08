import { useEffect, useRef, useState, useCallback } from 'react'
import * as Cesium from 'cesium'
import { useStore } from './store'
import { getPOIsForCity, CITIES, HQ_LOCATIONS } from './presets/poi-database'
import { ShaderPipeline } from './shaders/shader-pipeline'
import { LayerManager } from './layers/layer-manager'
import { SatelliteLayer } from './data-sources/satellites'
import { CCTVLayer } from './data-sources/cctv'
import type { ShaderMode, ShaderSettings, LayerName, TrackedEntity, POI } from './store'

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const pipelineRef = useRef<ShaderPipeline | null>(null)
  const managerRef = useRef<LayerManager | null>(null)
  const [ready, setReady] = useState(false)
  const [activePOI, setActivePOI] = useState<POI | null>(null)

  // Store selectors
  const setViewer = useStore((s) => s.setViewer)
  const shaderMode = useStore((s) => s.shaderMode)
  const setShaderMode = useStore((s) => s.setShaderMode)
  const shaderSettings = useStore((s) => s.shaderSettings)
  const updateShaderSetting = useStore((s) => s.updateShaderSetting)
  const layers = useStore((s) => s.layers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const currentCity = useStore((s) => s.currentCity)
  const setCurrentCity = useStore((s) => s.setCurrentCity)
  const currentPOIIndex = useStore((s) => s.currentPOIIndex)
  const setCurrentPOIIndex = useStore((s) => s.setCurrentPOIIndex)
  const detectionMode = useStore((s) => s.detectionMode)
  const setDetectionMode = useStore((s) => s.setDetectionMode)
  const trackedEntity = useStore((s) => s.trackedEntity)
  const setTrackedEntity = useStore((s) => s.setTrackedEntity)
  const leftPanelOpen = useStore((s) => s.leftPanelOpen)
  const toggleLeftPanel = useStore((s) => s.toggleLeftPanel)
  const rightPanelOpen = useStore((s) => s.rightPanelOpen)
  const toggleRightPanel = useStore((s) => s.toggleRightPanel)

  // Init Cesium
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN || ''
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken
      Cesium.Ion.defaultServer = new Cesium.Resource({ url: '/api/cesium-ion/' })
    }

    const opts: Cesium.Viewer.ConstructorOptions = {
      animation: false, baseLayerPicker: false, fullscreenButton: false,
      vrButton: false, geocoder: false, homeButton: false, infoBox: false,
      sceneModePicker: false, selectionIndicator: false, timeline: false,
      navigationHelpButton: false,
      creditContainer: document.createElement('div'),
      msaaSamples: 2,
    }
    if (!ionToken) {
      // Use bundled NaturalEarthII textures (local, no network) as base
      opts.imageryProvider = new Cesium.TileMapServiceImageryProvider({
        url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
      })
    }
    const viewer = new Cesium.Viewer(containerRef.current, opts)

    // Add dark-themed map tiles on top for detail when zoomed in
    if (!ionToken) {
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: '/api/carto-tiles/dark_all/{z}/{x}/{y}.png',
          credit: 'CartoDB',
          minimumLevel: 2,
          maximumLevel: 18,
        })
      )
    }
    viewer.scene.globe.enableLighting = false
    viewer.scene.fog.enabled = true
    viewer.scene.fog.density = 0.0002
    viewer.scene.sun.show = false
    viewer.scene.moon.show = false
    viewer.scene.highDynamicRange = false
    viewer.scene.globe.depthTestAgainstTerrain = false
    viewer.scene.backgroundColor = Cesium.Color.BLACK

    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (googleKey) {
      Cesium.Cesium3DTileset.fromUrl(
        `/api/google-tiles/v1/3dtiles/root.json?key=${googleKey}`,
        { maximumScreenSpaceError: 8 }
      ).then(t => viewer.scene.primitives.add(t)).catch(console.warn)
    } else if (ionToken) {
      Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
        requestWaterMask: true, requestVertexNormals: true,
      }).then(t => { viewer.terrainProvider = t }).catch(console.warn)
    }

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-74.0, 40.7, 15000000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    })

    viewerRef.current = viewer
    setViewer(viewer)
    pipelineRef.current = new ShaderPipeline(viewer)
    managerRef.current = new LayerManager(viewer)
    setReady(true)

    return () => {
      managerRef.current?.dispose()
      pipelineRef.current?.dispose()
      viewer.destroy()
      viewerRef.current = null
      setViewer(null)
    }
  }, [setViewer])

  // ── Click-to-track handler ──
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !ready) return

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      // Check entities first (flights, cctv)
      const picked = viewer.scene.pick(click.position)
      if (picked?.id && picked.id instanceof Cesium.Entity) {
        const entity = picked.id
        const props = entity.properties
        if (props) {
          const type = props.type?.getValue(Cesium.JulianDate.now())
          if (type === 'civilian-flight' || type === 'military-flight') {
            const pos = entity.position?.getValue(Cesium.JulianDate.now())
            let lat = 0, lon = 0, alt = 0
            if (pos) {
              const carto = Cesium.Cartographic.fromCartesian(pos)
              lat = Cesium.Math.toDegrees(carto.latitude)
              lon = Cesium.Math.toDegrees(carto.longitude)
              alt = carto.height
            }
            const tracked: TrackedEntity = {
              id: props.icao24?.getValue(Cesium.JulianDate.now()) || '',
              type: 'flight',
              name: props.callsign?.getValue(Cesium.JulianDate.now()) || props.icao24?.getValue(Cesium.JulianDate.now()) || 'Unknown',
              position: { lat, lon, alt },
              speed: props.velocity?.getValue(Cesium.JulianDate.now()),
              heading: props.heading?.getValue(Cesium.JulianDate.now()),
              extra: { ORIGIN: props.originCountry?.getValue(Cesium.JulianDate.now()) || '' },
            }
            useStore.getState().setTrackedEntity(tracked)
            // Clear satellite orbit when switching to flight
            const satLayer = managerRef.current?.getLayer('satellites') as SatelliteLayer | undefined
            satLayer?.clearOrbitPath()
            return
          }
          if (type === 'cctv') {
            const camName = props.name?.getValue(Cesium.JulianDate.now()) || 'Camera'
            const pos = entity.position?.getValue(Cesium.JulianDate.now())
            let lat = 0, lon = 0
            if (pos) {
              const carto = Cesium.Cartographic.fromCartesian(pos)
              lat = Cesium.Math.toDegrees(carto.latitude)
              lon = Cesium.Math.toDegrees(carto.longitude)
            }
            useStore.getState().setTrackedEntity({
              id: props.id?.getValue(Cesium.JulianDate.now()) || '',
              type: 'vehicle',
              name: `📹 ${camName}`,
              position: { lat, lon, alt: 15 },
            })
            return
          }
        }
      }
      // Check point primitives (satellites)
      if (picked?.primitive && picked.id && typeof picked.id === 'string' && picked.id.startsWith('sat-')) {
        const noradId = picked.id.replace('sat-', '')
        const satLayer = managerRef.current?.getLayer('satellites') as SatelliteLayer | undefined
        if (satLayer) {
          const info = satLayer.getSatelliteInfo(noradId)
          if (info) {
            useStore.getState().setTrackedEntity({
              id: noradId,
              type: 'satellite',
              name: info.name,
              position: { lat: info.lat, lon: info.lon, alt: info.alt * 1000 },
              speed: info.speed,
              extra: { NORAD: noradId, CLASS: info.orbitClass },
            })
            satLayer.showOrbitPath(noradId)
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    return () => handler.destroy()
  }, [ready])

  // ── Real-time telemetry updates for tracked entity ──
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => {
      const { trackedEntity: te, setTrackedEntity } = useStore.getState()
      if (!te) return

      if (te.type === 'satellite') {
        const satLayer = managerRef.current?.getLayer('satellites') as SatelliteLayer | undefined
        if (satLayer) {
          const info = satLayer.getSatelliteInfo(te.id)
          if (info) {
            setTrackedEntity({
              ...te,
              position: { lat: info.lat, lon: info.lon, alt: info.alt * 1000 },
              speed: info.speed,
            })
          }
        }
      }
      // Flights update via data refresh — positions are latest from API
    }, 2000)
    return () => clearInterval(id)
  }, [ready])

  // ── Clear orbit path when entity is untracked ──
  const prevTracked = useRef<TrackedEntity | null>(null)
  useEffect(() => {
    if (prevTracked.current && !trackedEntity) {
      const satLayer = managerRef.current?.getLayer('satellites') as SatelliteLayer | undefined
      satLayer?.clearOrbitPath()
    }
    prevTracked.current = trackedEntity
  }, [trackedEntity])

  // Direct fly-to + marker function
  const activeMarkerRef = useRef<Cesium.Entity | null>(null)
  const hqMarkersRef = useRef<Cesium.Entity[]>([])

  const flyToPOI = useCallback((poi: POI) => {
    const viewer = viewerRef.current
    if (!viewer) return

    // Show info card
    setActivePOI(poi)

    // Remove previous active marker
    if (activeMarkerRef.current) {
      viewer.entities.remove(activeMarkerRef.current)
      activeMarkerRef.current = null
    }

    // Fly camera — look AT the point, not past it
    const target = Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, 0)
    const offset = new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(30),
      Cesium.Math.toRadians(-45),
      poi.alt
    )
    viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(target, 0),
      { offset, duration: 2.5, easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT }
    )

    // Drop a marker at the destination
    if (poi.name) {
      const isHQ = poi.isHQ === true
      const color = isHQ ? '#ffb000' : '#00ff41'
      activeMarkerRef.current = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, 100),
        point: {
          pixelSize: isHQ ? 14 : 10,
          color: Cesium.Color.fromCssColorString(color),
          outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.4),
          outlineWidth: 4,
          scaleByDistance: new Cesium.NearFarScalar(1000, 1.5, 500000, 0.5),
        },
        label: {
          text: (isHQ ? '◆ ' : '▼ ') + poi.name,
          font: `bold ${isHQ ? 13 : 12}px JetBrains Mono`,
          fillColor: Cesium.Color.fromCssColorString(color),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 4,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -24),
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
          backgroundPadding: new Cesium.Cartesian2(6, 4),
          scaleByDistance: new Cesium.NearFarScalar(1000, 1.2, 500000, 0.4),
        },
      })
    }
  }, [])

  // Place persistent HQ markers on init
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !ready) return

    // Clear old HQ markers
    for (const e of hqMarkersRef.current) viewer.entities.remove(e)
    hqMarkersRef.current = []

    for (const hq of HQ_LOCATIONS) {
      const e = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(hq.lon, hq.lat, 100),
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString('#ffb000'),
          outlineColor: Cesium.Color.fromCssColorString('#ffb000').withAlpha(0.4),
          outlineWidth: 4,
          scaleByDistance: new Cesium.NearFarScalar(1000, 1.5, 2000000, 0.3),
        },
        label: {
          text: '◆ ' + hq.name,
          font: 'bold 13px JetBrains Mono',
          fillColor: Cesium.Color.fromCssColorString('#ffb000'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 4,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -24),
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
          backgroundPadding: new Cesium.Cartesian2(6, 4),
          scaleByDistance: new Cesium.NearFarScalar(1000, 1.2, 2000000, 0.3),
        },
      })
      hqMarkersRef.current.push(e)
    }
  }, [ready])

  // Auto fly when city changes (skip initial load)
  const hasInteracted = useRef(false)
  useEffect(() => {
    if (!hasInteracted.current) { hasInteracted.current = true; return }
    const pois = getPOIsForCity(currentCity)
    if (!pois.length) return
    const poi = pois[currentPOIIndex % pois.length]
    flyToPOI(poi)
  }, [currentCity, currentPOIIndex, flyToPOI])

  // Shader sync
  useEffect(() => {
    pipelineRef.current?.setMode(shaderMode, shaderSettings[shaderMode])
  }, [shaderMode, shaderSettings])

  // Keyboard shortcuts
  useEffect(() => {
    const modeMap: Record<string, ShaderMode> = { '1':'standard','2':'crt','3':'nightvision','4':'flir','5':'pixelated' }
    const poiKeys = ['q','w','e','r','t']
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      if (modeMap[k]) { e.preventDefault(); setShaderMode(modeMap[k]); return }
      const pi = poiKeys.indexOf(k)
      if (pi !== -1) { e.preventDefault(); const ps = getPOIsForCity(currentCity); if (ps.length) { const idx = pi % ps.length; setCurrentPOIIndex(idx); flyToPOI({ ...ps[idx] }) }; return }
      if (k === 'tab') { e.preventDefault(); toggleRightPanel(); return }
      if (k === 'escape') { e.preventDefault(); setTrackedEntity(null); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentCity, setShaderMode, setCurrentPOIIndex, toggleRightPanel, setTrackedEntity])

  const pois = getPOIsForCity(currentCity)
  const curSettings = shaderSettings[shaderMode]
  const LAYER_CFG: Array<{name:LayerName; label:string; color:string}> = [
    { name:'satellites', label:'SATELLITES', color:'#00d4ff' },
    { name:'civilianFlights', label:'CIV FLIGHTS', color:'#00d4ff' },
    { name:'militaryFlights', label:'MIL FLIGHTS', color:'#ffb000' },
    { name:'earthquakes', label:'SEISMIC', color:'#ff3333' },
    { name:'cctv', label:'CCTV FEEDS', color:'#ff3333' },
    { name:'traffic', label:'TRAFFIC SIM', color:'#00ff41' },
  ]
  const MODE_LABELS: Record<ShaderMode,string> = {
    standard:'01 STANDARD', crt:'02 CRT', nightvision:'03 NIGHTVISION', flir:'04 FLIR', pixelated:'05 SAT-RECON'
  }
  const SLIDER_KEYS: Array<keyof ShaderSettings> = ['intensity','pixelation','noise','bloom','sharpen','vignette','scanlineDensity']

  const statusColor = (s: string, en: boolean) => !en ? '#444' : s==='active' ? '#00ff41' : s==='loading' ? '#ffb000' : s==='error' ? '#ff3333' : '#666'
  const fmtCount = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n)

  const S: Record<string, React.CSSProperties> = {
    root: { width:'100vw', height:'100vh', position:'relative', background:'#000', fontFamily:"'JetBrains Mono',monospace" },
    globe: { width:'100%', height:'100%', position:'absolute', top:0, left:0 },
    hud: { position:'absolute', inset:0, pointerEvents:'none', zIndex:9999 },
    topBar: { position:'absolute',top:0,left:0,right:0,height:40,display:'flex',alignItems:'center',gap:12,padding:'0 12px',background:'rgba(0,0,0,0.92)',borderBottom:'1px solid rgba(0,255,65,0.3)',pointerEvents:'auto',zIndex:30 },
    bottomBar: { position:'absolute',bottom:0,left:0,right:0,height:36,display:'flex',alignItems:'center',gap:16,padding:'0 16px',background:'rgba(0,0,0,0.92)',borderTop:'1px solid rgba(0,255,65,0.3)',pointerEvents:'auto',zIndex:30 },
    leftPanel: { position:'absolute',top:44,left:8,bottom:40,width:240,background:'rgba(0,10,2,0.92)',border:'1px solid rgba(0,255,65,0.3)',borderRadius:2,overflowY:'auto' as const,pointerEvents:'auto',zIndex:20 },
    rightPanel: { position:'absolute',top:44,right:8,bottom:40,width:220,background:'rgba(0,10,2,0.92)',border:'1px solid rgba(0,255,65,0.3)',borderRadius:2,overflowY:'auto' as const,pointerEvents:'auto',zIndex:20 },
    sectionHead: { fontSize:9,color:'#666',letterSpacing:2,padding:'8px 10px 4px',textTransform:'uppercase' as const },
    btn: { width:'100%',display:'flex',alignItems:'center',gap:6,padding:'5px 8px',border:'1px solid transparent',borderRadius:2,background:'none',cursor:'pointer',fontSize:10,textAlign:'left' as const },
    sliderRow: { display:'flex',alignItems:'center',gap:6,padding:'2px 10px' },
    sliderLabel: { fontSize:9,color:'#666',width:64,flexShrink:0 },
    slider: { flex:1,height:4,accentColor:'#00ff41',cursor:'pointer' },
    sliderVal: { fontSize:9,color:'#00ff41',width:30,textAlign:'right' as const },
    trackHud: { position:'absolute',bottom:44,right:8,width:200,background:'rgba(0,10,2,0.95)',border:'1px solid rgba(0,255,65,0.3)',borderRadius:2,padding:10,pointerEvents:'auto',zIndex:20 },
  }

  return (
    <div style={S.root}>
      <div ref={containerRef} style={S.globe} />

      <div style={S.hud}>
        {/* ─── TOP BAR ─── */}
        <div style={S.topBar}>
          <button onClick={toggleLeftPanel} style={{color:'#00ff41',background:'none',border:'none',cursor:'pointer',fontSize:14}}>☰</button>
          <span style={{color:'#00ff41',fontSize:12,fontWeight:700,textShadow:'0 0 8px #00ff41'}}>WELTHERRBLICK</span>
          <span style={{color:'#555',fontSize:9}}>GEOINT DASHBOARD</span>
          <div style={{flex:1}} />
          <span style={{color:'#555',fontSize:9}}>MODE: <span style={{color:'#00ff41'}}>{shaderMode.toUpperCase()}</span></span>
          <button onClick={toggleRightPanel} style={{color:'#00ff41',background:'none',border:'none',cursor:'pointer',fontSize:12}}>◆</button>
        </div>

        {/* ─── BOTTOM BAR ─── */}
        <div style={S.bottomBar}>
          <span style={{fontSize:9,color:'#555'}}>SRC</span>
          {LAYER_CFG.map(l => (
            <span key={l.name} style={{display:'flex',alignItems:'center',gap:3}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:statusColor(layers[l.name].status,layers[l.name].enabled),display:'inline-block'}} />
              <span style={{fontSize:9,color:'#666'}}>{l.label.slice(0,3)}</span>
            </span>
          ))}
          <div style={{flex:1}} />
          {trackedEntity && <span style={{fontSize:9,color:'#ffb000'}}>TRACKING: {trackedEntity.name}</span>}
          <span style={{fontSize:9,color:'#555'}}>1-5:MODE Q-T:POI TAB:SHADER ESC:UNTRACK</span>
          <UTCClock />
        </div>

        {/* ─── LEFT PANEL ─── */}
        {leftPanelOpen && (
          <div style={S.leftPanel}>
            <div style={S.sectionHead}>LAYERS</div>
            {LAYER_CFG.map(cfg => {
              const ly = layers[cfg.name]
              return (
                <button key={cfg.name} onClick={() => toggleLayer(cfg.name)}
                  style={{...S.btn, borderColor: ly.enabled ? 'rgba(0,255,65,0.3)' : 'transparent',
                    background: ly.enabled ? 'rgba(0,255,65,0.08)' : 'transparent'}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:statusColor(ly.status,ly.enabled),flexShrink:0}} />
                  <span style={{color: ly.enabled ? cfg.color : '#555', flex:1}}>{cfg.label}</span>
                  {ly.entityCount > 0 && <span style={{fontSize:9,color:'#00ff41'}}>{fmtCount(ly.entityCount)}</span>}
                </button>
              )
            })}
            <div style={S.sectionHead}>DETECTION</div>
            <div style={{display:'flex',gap:4,padding:'0 10px 8px'}}>
              {(['sparse','full'] as const).map(m => (
                <button key={m} onClick={() => setDetectionMode(m)} style={{
                  flex:1,fontSize:9,padding:'3px 0',border:`1px solid ${detectionMode===m?'#00ff41':'#444'}`,
                  borderRadius:2,background:detectionMode===m?'rgba(0,255,65,0.1)':'transparent',
                  color:detectionMode===m?'#00ff41':'#666',cursor:'pointer'
                }}>{m.toUpperCase()}</button>
              ))}
            </div>
            {/* HQ Locations — highlighted */}
            {HQ_LOCATIONS.length > 0 && (
              <>
                <div style={{fontSize:9,color:'#ffb000',letterSpacing:2,padding:'8px 10px 4px',textTransform:'uppercase',textShadow:'0 0 6px rgba(255,176,0,0.4)'}}>
                  ◆ HQ LOCATIONS
                </div>
                {HQ_LOCATIONS.map(hq => (
                  <button key={hq.name} onClick={() => { setCurrentCity(hq.city); flyToPOI({ ...hq, isHQ: true }) }}
                    style={{...S.btn,fontSize:9,padding:'4px 10px',
                      color:'#ffb000',
                      borderColor:'rgba(255,176,0,0.4)',
                      background:'rgba(255,176,0,0.08)',
                      textShadow:'0 0 4px rgba(255,176,0,0.3)'}}>
                    <span style={{fontSize:7,marginRight:2}}>◆</span>
                    {hq.name}
                    <span style={{fontSize:7,color:'#886600',marginLeft:'auto'}}>{hq.city}</span>
                  </button>
                ))}
              </>
            )}
            <div style={S.sectionHead}>NAVIGATION</div>
            <select value={currentCity} onChange={e => setCurrentCity(e.target.value)}
              style={{width:'calc(100% - 20px)',margin:'0 10px 6px',background:'#000',border:'1px solid rgba(0,255,65,0.3)',color:'#00ff41',fontSize:10,padding:4,borderRadius:2}}>
              {CITIES.map(c => {
                const hasHQ = HQ_LOCATIONS.some(h => h.city === c)
                return <option key={c} value={c}>{hasHQ ? '◆ ' : ''}{c}</option>
              })}
            </select>
            {pois.map((poi,i) => (
              <button key={poi.name} onClick={() => { setCurrentPOIIndex(i); flyToPOI({ ...poi }) }}
                style={{...S.btn,fontSize:9,padding:'3px 10px',
                  color: poi.isHQ ? '#ffb000' : i===currentPOIIndex%pois.length ? '#00ff41' : '#666',
                  background: poi.isHQ ? 'rgba(255,176,0,0.06)' : i===currentPOIIndex%pois.length ? 'rgba(0,255,65,0.06)' : 'transparent',
                  borderColor: poi.isHQ ? 'rgba(255,176,0,0.3)' : 'transparent',
                  textShadow: poi.isHQ ? '0 0 4px rgba(255,176,0,0.3)' : 'none'}}>
                {poi.isHQ && <span style={{fontSize:7,marginRight:3}}>◆</span>}
                {poi.name}
              </button>
            ))}
            <div style={{fontSize:8,color:'#444',padding:'6px 10px'}}>Q/W/E/R/T — cycle POIs</div>
            {layers.cctv.enabled && layers.cctv.entityCount > 0 && (
              <CCTVCameraList manager={managerRef.current} viewer={viewerRef.current} />
            )}
          </div>
        )}

        {/* ─── RIGHT PANEL ─── */}
        {rightPanelOpen && (
          <div style={S.rightPanel}>
            <div style={S.sectionHead}>VISUAL MODES</div>
            {(Object.keys(MODE_LABELS) as ShaderMode[]).map(m => (
              <button key={m} onClick={() => setShaderMode(m)}
                style={{...S.btn,fontSize:9,
                  color: shaderMode===m ? '#00ff41' : '#666',
                  borderColor: shaderMode===m ? '#00ff41' : 'transparent',
                  background: shaderMode===m ? 'rgba(0,255,65,0.08)' : 'transparent'}}>
                {MODE_LABELS[m]}
              </button>
            ))}
            {shaderMode !== 'standard' && (
              <>
                <div style={S.sectionHead}>PARAMETERS</div>
                {SLIDER_KEYS.map(k => (
                  <div key={k} style={S.sliderRow}>
                    <span style={S.sliderLabel}>{k.toUpperCase()}</span>
                    <input type="range" min={0} max={1} step={0.01} value={curSettings[k]}
                      onChange={e => updateShaderSetting(shaderMode, k, parseFloat(e.target.value))}
                      style={S.slider} />
                    <span style={S.sliderVal}>{(curSettings[k]*100).toFixed(0)}%</span>
                  </div>
                ))}
              </>
            )}
            <div style={{fontSize:8,color:'#444',padding:'8px 10px'}}>1-5 switch mode · TAB toggle</div>
          </div>
        )}

        {/* ─── POI INFO CARD ─── */}
        {activePOI && <POIInfoCard poi={activePOI} onClose={() => setActivePOI(null)} />}

        {/* ─── TRACKING HUD ─── */}
        {trackedEntity && (
          <div style={S.trackHud}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:10,color:'#ffb000'}}>◎ TRACKING</span>
              <button onClick={() => setTrackedEntity(null)} style={{fontSize:8,color:'#666',background:'none',border:'none',cursor:'pointer'}}>[ESC]</button>
            </div>
            <div style={{fontSize:11,color:'#fff',fontWeight:700,marginBottom:6}}>{trackedEntity.name}</div>
            {trackedEntity.position && <>
              <TRow label="LAT" value={trackedEntity.position.lat.toFixed(4)+'°'} />
              <TRow label="LON" value={trackedEntity.position.lon.toFixed(4)+'°'} />
              <TRow label="ALT" value={(trackedEntity.position.alt/1000).toFixed(1)+' km'} />
            </>}
            {trackedEntity.speed != null && <TRow label="SPD" value={trackedEntity.speed.toFixed(1)+' m/s'} />}
            {trackedEntity.heading != null && <TRow label="HDG" value={trackedEntity.heading.toFixed(1)+'°'} />}
          </div>
        )}

        {/* ─── LIVE CCTV MONITOR ─── */}
        {layers.cctv.enabled && layers.cctv.entityCount > 0 && (
          <CCTVMonitor manager={managerRef.current} viewer={viewerRef.current} />
        )}
      </div>
    </div>
  )
}

/** POI info card — shows image, name, description when a POI is selected */
function POIInfoCard({ poi, onClose }: { poi: POI; onClose: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const isHQ = poi.isHQ === true
  const accent = isHQ ? '#ffb000' : '#00ff41'

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    const id = setTimeout(onClose, 12000)
    return () => clearTimeout(id)
  }, [poi, onClose])

  return (
    <div style={{
      position: 'absolute',
      bottom: 48,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 380,
      background: 'rgba(0,0,0,0.95)',
      border: `1px solid ${isHQ ? 'rgba(255,176,0,0.6)' : 'rgba(0,255,65,0.4)'}`,
      borderRadius: 3,
      overflow: 'hidden',
      pointerEvents: 'auto',
      zIndex: 30,
      boxShadow: `0 0 30px ${isHQ ? 'rgba(255,176,0,0.15)' : 'rgba(0,255,65,0.1)'}, 0 4px 20px rgba(0,0,0,0.8)`,
      animation: 'poiSlideIn 0.4s ease-out',
    }}>
      {/* Image */}
      {poi.image && !imgError && (
        <div style={{ position: 'relative', width: '100%', height: 160, background: '#111', overflow: 'hidden' }}>
          <img
            src={poi.image}
            alt={poi.name}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              opacity: imgLoaded ? 0.85 : 0,
              filter: isHQ ? 'sepia(0.2) saturate(1.3)' : 'saturate(0.6) brightness(0.8)',
              transition: 'opacity 0.5s',
            }}
          />
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(transparent 40%, rgba(0,0,0,0.95) 100%)`,
          }} />
          {/* Scanline overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 6px)',
            pointerEvents: 'none',
          }} />
          {/* Classification tag */}
          <div style={{
            position: 'absolute', top: 8, left: 8,
            fontSize: 8, letterSpacing: 2, color: accent,
            background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 2,
            border: `1px solid ${accent}40`,
          }}>
            {isHQ ? '◆ HQ LOCATION' : '▼ POINT OF INTEREST'}
          </div>
          {/* Close */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 6, right: 8,
            fontSize: 10, color: '#666', background: 'rgba(0,0,0,0.6)',
            border: 'none', cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
          }}>✕</button>
        </div>
      )}

      {/* Info */}
      <div style={{ padding: '10px 14px 12px' }}>
        {/* Name */}
        <div style={{
          fontSize: 14, fontWeight: 700, color: accent,
          textShadow: `0 0 8px ${accent}60`,
          marginBottom: 4,
        }}>
          {isHQ ? '◆ ' : ''}{poi.name}
        </div>

        {/* Description */}
        {poi.desc && (
          <div style={{ fontSize: 10, color: '#999', marginBottom: 8, lineHeight: 1.4 }}>
            {poi.desc}
          </div>
        )}

        {/* Coordinates bar */}
        <div style={{
          display: 'flex', gap: 12,
          fontSize: 9, color: '#555',
          borderTop: `1px solid ${accent}20`,
          paddingTop: 6,
        }}>
          <span>LAT <span style={{ color: accent }}>{poi.lat.toFixed(4)}°</span></span>
          <span>LON <span style={{ color: accent }}>{poi.lon.toFixed(4)}°</span></span>
          <span>CITY <span style={{ color: accent }}>{poi.city.toUpperCase()}</span></span>
          <span style={{ marginLeft: 'auto', color: '#444' }}>ALT {poi.alt}m</span>
        </div>
      </div>
    </div>
  )
}

function TRow({label,value}: {label:string;value:string}) {
  return <div style={{display:'flex',justifyContent:'space-between',fontSize:9,marginBottom:2}}>
    <span style={{color:'#666'}}>{label}</span>
    <span style={{color:'#00ff41'}}>{value}</span>
  </div>
}

/** Camera list in left panel — grouped by region */
function CCTVCameraList({ manager, viewer }: { manager: LayerManager | null; viewer: Cesium.Viewer | null }) {
  const [cameras, setCameras] = useState<Array<{ id: string; name: string; lat: number; lon: number; region: string }>>([])
  const [regionFilter, setRegionFilter] = useState<string>('all')
  useEffect(() => {
    if (!manager) return
    const load = () => {
      const layer = manager.getLayer('cctv') as CCTVLayer | undefined
      if (layer) setCameras(layer.getCameras().map(c => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon, region: c.region })))
    }
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [manager])

  const jumpTo = useCallback((lat: number, lon: number, name: string, id: string) => {
    if (!viewer) return
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, 800),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
      duration: 1.5,
    })
    useStore.getState().setTrackedEntity({
      id, type: 'vehicle', name: `CAM ${name}`, position: { lat, lon, alt: 15 },
    })
  }, [viewer])

  if (cameras.length === 0) return null

  const regions = [...new Set(cameras.map(c => c.region))].sort()
  const filtered = regionFilter === 'all' ? cameras : cameras.filter(c => c.region === regionFilter)

  return (
    <>
      <div style={{fontSize:9,color:'#666',letterSpacing:2,padding:'8px 10px 4px',textTransform:'uppercase'}}>
        CCTV FEEDS ({cameras.length})
      </div>
      <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
        style={{width:'calc(100% - 20px)',margin:'0 10px 4px',background:'#000',border:'1px solid rgba(255,51,51,0.3)',color:'#ff3333',fontSize:9,padding:3,borderRadius:2}}>
        <option value="all">ALL REGIONS</option>
        {regions.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
      </select>
      <div style={{maxHeight:140,overflowY:'auto'}}>
        {filtered.slice(0, 40).map(c => (
          <button key={c.id} onClick={() => jumpTo(c.lat, c.lon, c.name, c.id)}
            style={{width:'100%',display:'flex',alignItems:'center',gap:4,padding:'2px 8px',border:'none',background:'none',cursor:'pointer',fontSize:8,color:'#ff3333',textAlign:'left'}}>
            <span style={{color:'#ff3333',fontSize:6}}>●</span>
            <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{c.name}</span>
          </button>
        ))}
        {filtered.length > 40 && <div style={{fontSize:7,color:'#555',padding:'2px 10px'}}>+{filtered.length - 40} more</div>}
      </div>
    </>
  )
}

/** Live CCTV surveillance monitor — shows camera feeds on screen */
function CCTVMonitor({ manager, viewer }: { manager: LayerManager | null; viewer: Cesium.Viewer | null }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedCam, setSelectedCam] = useState<number>(0)
  const [cameras, setCameras] = useState<Array<{ id: string; name: string; lat: number; lon: number; imageUrl: string; region: string }>>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!manager) return
    const load = () => {
      const layer = manager.getLayer('cctv') as CCTVLayer | undefined
      if (layer) {
        const cams = layer.getCameras().filter(c => c.imageUrl)
        setCameras(cams.map(c => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon, imageUrl: c.imageUrl, region: c.region })))
      }
    }
    load()
    const id = setInterval(() => { load(); setTick(t => t + 1) }, 8000)
    return () => clearInterval(id)
  }, [manager])

  const jumpTo = useCallback((cam: typeof cameras[0]) => {
    if (!viewer) return
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 500),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-50), roll: 0 },
      duration: 1.2,
    })
  }, [viewer])

  if (cameras.length === 0) return null

  const cacheBust = `?_t=${tick}`
  const gridCams = cameras.slice(0, expanded ? 12 : 4)
  const mainCam = cameras[selectedCam % cameras.length]

  return (
    <div style={{
      position:'absolute',
      bottom: 44,
      left: expanded ? 260 : 260,
      width: expanded ? 640 : 320,
      background:'rgba(0,0,0,0.95)',
      border:'1px solid rgba(255,51,51,0.5)',
      borderRadius:2,
      pointerEvents:'auto',
      zIndex:25,
      transition:'width 0.3s',
    }}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',borderBottom:'1px solid rgba(255,51,51,0.3)'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#ff3333',display:'inline-block',animation:'blink 1s infinite'}} />
          <span style={{fontSize:9,color:'#ff3333',letterSpacing:2}}>LIVE SURVEILLANCE</span>
          <span style={{fontSize:8,color:'#666'}}>{cameras.length} FEEDS</span>
        </div>
        <div style={{display:'flex',gap:4}}>
          <button onClick={() => setExpanded(!expanded)} style={{fontSize:8,color:'#666',background:'none',border:'1px solid #444',borderRadius:2,cursor:'pointer',padding:'1px 4px'}}>
            {expanded ? 'COMPACT' : 'EXPAND'}
          </button>
        </div>
      </div>

      {/* Main feed */}
      <div style={{position:'relative',padding:4}}>
        <div style={{position:'relative',width:'100%',aspectRatio: expanded ? '16/7' : '16/9',background:'#111',overflow:'hidden',borderRadius:1}}>
          <img
            key={mainCam.id + tick}
            src={mainCam.imageUrl + cacheBust}
            alt={mainCam.name}
            style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.9,filter:'contrast(1.1) brightness(0.9)'}}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {/* Scanline overlay */}
          <div style={{position:'absolute',inset:0,background:'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',pointerEvents:'none'}} />
          {/* Camera info overlay */}
          <div style={{position:'absolute',top:4,left:6,fontSize:8,color:'#ff3333',textShadow:'0 0 4px #000'}}>
            CAM {mainCam.id} — {mainCam.name}
            <span style={{display:'block',fontSize:7,color:'#888',marginTop:1}}>{mainCam.region}</span>
          </div>
          <div style={{position:'absolute',top:4,right:6,fontSize:8,color:'#ff3333',textShadow:'0 0 4px #000'}}>
            REC ●
          </div>
          <div style={{position:'absolute',bottom:4,left:6,fontSize:7,color:'#888',textShadow:'0 0 4px #000'}}>
            {mainCam.lat.toFixed(4)}N {Math.abs(mainCam.lon).toFixed(4)}{mainCam.lon < 0 ? 'W' : 'E'}
          </div>
          <div style={{position:'absolute',bottom:4,right:6,fontSize:7,color:'#888',textShadow:'0 0 4px #000'}}>
            <UTCStamp />
          </div>
        </div>
      </div>

      {/* Thumbnail grid */}
      <div style={{display:'grid',gridTemplateColumns: expanded ? 'repeat(6,1fr)' : 'repeat(4,1fr)',gap:2,padding:'0 4px 4px'}}>
        {gridCams.map((cam, i) => (
          <div key={cam.id}
            onClick={() => { setSelectedCam(cameras.indexOf(cam)); jumpTo(cam) }}
            style={{
              position:'relative',cursor:'pointer',aspectRatio:'4/3',background:'#111',overflow:'hidden',borderRadius:1,
              border: cameras.indexOf(cam) === selectedCam % cameras.length ? '1px solid #ff3333' : '1px solid #333',
            }}>
            <img
              key={cam.id + tick}
              src={cam.imageUrl + cacheBust}
              alt={cam.name}
              style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.8}}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'1px 2px',background:'rgba(0,0,0,0.8)',fontSize:6,color:'#ff3333',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {cam.id}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div style={{display:'flex',justifyContent:'center',gap:8,padding:'2px 0 4px'}}>
        <button onClick={() => setSelectedCam(s => (s - 1 + cameras.length) % cameras.length)}
          style={{fontSize:9,color:'#666',background:'none',border:'none',cursor:'pointer'}}>◀ PREV</button>
        <span style={{fontSize:8,color:'#555'}}>{(selectedCam % cameras.length) + 1}/{cameras.length}</span>
        <button onClick={() => setSelectedCam(s => (s + 1) % cameras.length)}
          style={{fontSize:9,color:'#666',background:'none',border:'none',cursor:'pointer'}}>NEXT ▶</button>
      </div>
    </div>
  )
}

function UTCStamp() {
  const [t, setT] = useState(new Date().toISOString().replace('T',' ').slice(0,19))
  useEffect(() => {
    const id = setInterval(() => setT(new Date().toISOString().replace('T',' ').slice(0,19)), 1000)
    return () => clearInterval(id)
  }, [])
  return <>{t}Z</>
}

function UTCClock() {
  const [t, setT] = useState(new Date().toISOString().slice(11,19))
  useEffect(() => {
    const id = setInterval(() => setT(new Date().toISOString().slice(11,19)), 1000)
    return () => clearInterval(id)
  }, [])
  return <span style={{fontSize:10,color:'#00ff41',fontWeight:700,textShadow:'0 0 6px #00ff41'}}>{t}Z</span>
}
