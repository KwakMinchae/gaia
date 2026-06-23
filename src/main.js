import * as THREE from 'three'
import { buildGlobe } from './globe.js'
import { JazzEngine } from './audio.js'

const W = () => window.innerWidth
const H = () => window.innerHeight
const canvas = document.getElementById('c')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(W(), H())
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 1000)
camera.position.z = 2.9

scene.add(new THREE.AmbientLight(0xffffff, 0.55))
const sun = new THREE.DirectionalLight(0xfff4e0, 0.9)
sun.position.set(5, 3, 4)
scene.add(sun)

const globeGroup = new THREE.Group()
scene.add(globeGroup)

buildGlobe().then(earthMesh => {
  globeGroup.add(earthMesh)
  globeGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.025, 48, 48),
    new THREE.MeshPhongMaterial({ color: 0x6699cc, transparent: true, opacity: 0.035, side: THREE.FrontSide, depthWrite: false })
  ))
})

// Stars
const sv = []
for (let i = 0; i < 2500; i++) {
  const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1), r = 70 + Math.random() * 30
  sv.push(r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p))
}
const sg = new THREE.BufferGeometry()
sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3))
scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.5 })))

// Event → instrument mapping
const CAT_MAP = {
  wildfires:    { col: 0xf97316, inst: 'sax' },
  volcanoes:    { col: 0xa855f7, inst: 'bass' },
  severeStorms: { col: 0x38bdf8, inst: 'drums' },
  earthquakes:  { col: 0xf43f5e, inst: 'piano' },
  floods:       { col: 0x34d399, inst: 'trumpet' },
  seaLakeIce:   { col: 0xcbd5e1, inst: 'vibe' },
  snow:         { col: 0xcbd5e1, inst: 'vibe' },
  dustHaze:     { col: 0xfbbf24, inst: 'guitar' },
  tempExtremes: { col: 0xfb923c, inst: 'clarinet' },
  drought:      { col: 0xd97706, inst: 'guitar' },
  manmade:      { col: 0xfb7185, inst: 'piano' }
}

function ll2v3(lat, lng, r = 1.015) {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lng + 180) * Math.PI / 180
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  )
}

function haversine(la1, lo1, la2, lo2) {
  const R = 6371
  const dL = (la2 - la1) * Math.PI / 180
  const dO = (lo2 - lo1) * Math.PI / 180
  const a = Math.sin(dL / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dO / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function catId(ev) { return ev.categories && ev.categories.length ? ev.categories[0].id : 'other' }

function rotatePoint(lat, lng, ry, rx) {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lng + 180) * Math.PI / 180
  let x = -Math.sin(phi) * Math.cos(theta)
  let y = Math.cos(phi)
  let z = Math.sin(phi) * Math.sin(theta)
  const cy = Math.cos(ry), sy = Math.sin(ry)
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy
  x = x1; z = z1
  const cx = Math.cos(rx), sx = Math.sin(rx)
  return { x, y: y * cx - z * sx, z: y * sx + z * cx }
}

let events = [], markers = []
let globeRotY = 0, globeRotX = 0
let listenerLat = 1.35, listenerLng = 103.82

async function fetchEvents() {
  try {
    const r = await fetch('/eonet/api/v3/events?status=open&limit=100')
    const data = await r.json()
    events = data.events.filter(e => e.geometry && e.geometry.length > 0)
  } catch (e) {
    events = demoEvents()
  }
  document.getElementById('cnt').textContent = `${events.length} live events`
  placeMarkers()
  if (audioEnabled) updateInstruments()
}

function demoEvents() {
  return [
    { id: 'd1',  title: 'Wildfire — California',        categories: [{ id: 'wildfires' }],    geometry: [{ coordinates: [-119, 36],      date: '2025-06-01' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd2',  title: 'Volcano — Etna, Sicily',       categories: [{ id: 'volcanoes' }],    geometry: [{ coordinates: [15, 37.7],      date: '2025-06-02' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd3',  title: 'Severe storm — Gulf of Mexico', categories: [{ id: 'severeStorms' }], geometry: [{ coordinates: [-90, 25],      date: '2025-06-03' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd4',  title: 'Flood — Bangladesh',            categories: [{ id: 'floods' }],       geometry: [{ coordinates: [90, 24],       date: '2025-06-01' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd5',  title: 'Sea ice — Arctic',              categories: [{ id: 'seaLakeIce' }],   geometry: [{ coordinates: [0, 80],        date: '2025-05-30' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd6',  title: 'Dust haze — Sahara',            categories: [{ id: 'dustHaze' }],     geometry: [{ coordinates: [15, 22],       date: '2025-06-02' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd7',  title: 'Volcano — Kīlauea, Hawaii',    categories: [{ id: 'volcanoes' }],    geometry: [{ coordinates: [-155.3, 19.4], date: '2025-06-03' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd8',  title: 'Wildfire — New South Wales',    categories: [{ id: 'wildfires' }],    geometry: [{ coordinates: [148, -33],     date: '2025-06-01' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd9',  title: 'Severe storm — Philippines',    categories: [{ id: 'severeStorms' }], geometry: [{ coordinates: [125, 14],      date: '2025-06-04' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd10', title: 'Snow — Himalayas',              categories: [{ id: 'snow' }],         geometry: [{ coordinates: [85, 28],       date: '2025-05-28' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd11', title: 'Earthquake — Japan',            categories: [{ id: 'earthquakes' }],  geometry: [{ coordinates: [140, 37],      date: '2025-06-03' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd12', title: 'Wildfire — Portugal',           categories: [{ id: 'wildfires' }],    geometry: [{ coordinates: [-8, 39.5],    date: '2025-06-04' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
    { id: 'd13', title: 'Temp extreme — India',          categories: [{ id: 'tempExtremes' }], geometry: [{ coordinates: [78, 22],       date: '2025-06-03' }], sources: [{ url: 'https://earthobservatory.nasa.gov' }] },
  ]
}

function placeMarkers() {
  markers.forEach(m => globeGroup.remove(m.group))
  markers = []
  events.forEach(ev => {
    const geo = ev.geometry[ev.geometry.length - 1]
    let coords = geo.coordinates
    if (geo.type === 'Polygon') coords = coords[0][0]
    const [lng, lat] = Array.isArray(coords[0]) ? coords[0] : coords
    if (isNaN(lat) || isNaN(lng)) return

    const cm = CAT_MAP[catId(ev)]
    const col = cm ? cm.col : 0xffffff
    const pos = ll2v3(lat, lng)
    const group = new THREE.Group()
    group.position.copy(pos)
    group.lookAt(new THREE.Vector3(0, 0, 0))
    group.rotateX(Math.PI)

    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.013, 18), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 }))
    const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.023, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide }))
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.029, 0.033, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, side: THREE.DoubleSide }))
    group.add(dot, ring1, ring2)
    globeGroup.add(group)
    markers.push({ group, ring1, ring2, dot, ev, lat, lng, phase: Math.random() * Math.PI * 2 })
  })
}

// ── Audio ─────────────────────────────────────────────────────────────────────
const jazz = new JazzEngine()
let audioEnabled = false

function updateInstruments() {
  if (!audioEnabled) return
  const instSet = new Set()
  events.forEach(ev => { const cm = CAT_MAP[catId(ev)]; if (cm) instSet.add(cm.inst) })
  jazz.setInstruments(instSet)
  updateSpatialAudio()
}

function updateSpatialAudio() {
  if (!audioEnabled) return

  // Group events by instrument
  const instData = {}
  events.forEach(ev => {
    const geo = ev.geometry[ev.geometry.length - 1]
    let coords = geo.coordinates
    if (geo.type === 'Polygon') coords = coords[0][0]
    const [lng, lat] = Array.isArray(coords[0]) ? coords[0] : coords
    if (isNaN(lat) || isNaN(lng)) return
    const cm = CAT_MAP[catId(ev)]
    if (!cm) return
    const inst = cm.inst
    if (!instData[inst]) instData[inst] = { pts: [], minDist: Infinity }
    const dist = haversine(listenerLat, listenerLng, lat, lng)
    const p = rotatePoint(lat, lng, globeRotY, globeRotX)
    instData[inst].pts.push(p)
    if (dist < instData[inst].minDist) instData[inst].minDist = dist
  })

  Object.entries(instData).forEach(([inst, { pts, minDist }]) => {
    let ax = 0, ay = 0, az = 0
    pts.forEach(p => { ax += p.x; ay += p.y; az += p.z })
    ax /= pts.length; ay /= pts.length; az /= pts.length

    // WIDE dynamic range: exponential falloff, very quiet when far
    // minDist in km: 0 = loud, 2000km = half, 6000km = very quiet, 12000km = silent
    const proximity = Math.pow(Math.max(0, 1 - minDist / 10000), 2.5)
    jazz.setInstPosition(inst, ax * 10, ay * 10, az * 10, proximity)
  })
}

// ── UI ────────────────────────────────────────────────────────────────────────
document.getElementById('abtn').addEventListener('click', async () => {
  if (!audioEnabled) {
    await jazz.start()
    if (jazz.ac.listener.positionX) {
      jazz.ac.listener.positionX.value = 0
      jazz.ac.listener.positionY.value = 0
      jazz.ac.listener.positionZ.value = 1
      jazz.ac.listener.forwardX.value = 0
      jazz.ac.listener.forwardY.value = 0
      jazz.ac.listener.forwardZ.value = -1
      jazz.ac.listener.upX.value = 0
      jazz.ac.listener.upY.value = 1
      jazz.ac.listener.upZ.value = 0
    } else {
      jazz.ac.listener.setPosition(0, 0, 1)
      jazz.ac.listener.setOrientation(0, 0, -1, 0, 1, 0)
    }
    audioEnabled = true
    document.getElementById('abtn').textContent = 'mute'
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        listenerLat = pos.coords.latitude
        listenerLng = pos.coords.longitude
        updateInstruments()
      }, () => updateInstruments())
    } else {
      updateInstruments()
    }
  } else {
    jazz.stop()
    audioEnabled = false
    document.getElementById('abtn').textContent = 'enable sound'
  }
})

document.getElementById('infobtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.toggle('on')
})
document.getElementById('overlay-close').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('on')
})
document.getElementById('pcl').addEventListener('click', () => {
  document.getElementById('pan').classList.remove('on')
})

// ── Globe interaction ─────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let dragging = false, prevMouse = { x: 0, y: 0 }, velX = 0, velY = 0, autoRotate = true

canvas.addEventListener('mousedown', e => {
  dragging = true; autoRotate = false
  prevMouse = { x: e.clientX, y: e.clientY }
})
canvas.addEventListener('mousemove', e => {
  if (!dragging) return
  velY = (e.clientX - prevMouse.x) * 0.005
  velX = (e.clientY - prevMouse.y) * 0.005
  globeRotY += velY; globeRotX += velX
  globeRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, globeRotX))
  globeGroup.rotation.y = globeRotY; globeGroup.rotation.x = globeRotX
  prevMouse = { x: e.clientX, y: e.clientY }
  updateSpatialAudio()
})
canvas.addEventListener('mouseup', e => {
  if (!dragging) return; dragging = false
  mouse.x = (e.clientX / W()) * 2 - 1
  mouse.y = -(e.clientY / H()) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(markers.map(m => m.dot))
  if (hits.length) {
    const mk = markers.find(m => m.dot === hits[0].object)
    if (mk) showPanel(mk.ev)
  }
})
canvas.addEventListener('wheel', e => {
  camera.position.z = Math.max(1.4, Math.min(5, camera.position.z + e.deltaY * 0.003))
}, { passive: true })
canvas.addEventListener('touchstart', e => {
  dragging = true; autoRotate = false
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY }
})
canvas.addEventListener('touchmove', e => {
  if (!dragging) return
  globeRotY += (e.touches[0].clientX - prevMouse.x) * 0.005
  globeRotX += (e.touches[0].clientY - prevMouse.y) * 0.005
  globeRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, globeRotX))
  globeGroup.rotation.y = globeRotY; globeGroup.rotation.x = globeRotX
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  updateSpatialAudio()
})
canvas.addEventListener('touchend', () => { dragging = false })

function showPanel(ev) {
  const cm = CAT_MAP[catId(ev)]
  const date = ev.geometry[ev.geometry.length - 1].date || 'active'
  const src = ev.sources && ev.sources.length ? ev.sources[0].url : null
  document.getElementById('ptl').textContent = ev.title
  let m = `Instrument: ${cm ? cm.inst : '—'}<br>Since: ${date ? date.slice(0, 10) : 'active'}`
  if (src) m += `<br><a href="${src}" target="_blank" style="color:rgba(120,180,255,0.7);font-size:10px">view source ↗</a>`
  document.getElementById('pmt').innerHTML = m
  document.getElementById('pan').classList.add('on')
}

window.addEventListener('resize', () => {
  renderer.setSize(W(), H())
  camera.aspect = W() / H()
  camera.updateProjectionMatrix()
})

let t = 0
;(function loop() {
  requestAnimationFrame(loop)
  t += 0.016
  if (autoRotate) {
    globeRotY += 0.0012
    globeGroup.rotation.y = globeRotY
    updateSpatialAudio()
  }
  if (!dragging && !autoRotate) {
    velX *= 0.88; velY *= 0.88
    if (Math.abs(velX) > 0.0001 || Math.abs(velY) > 0.0001) {
      globeRotY += velY; globeRotX += velX
      globeRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, globeRotX))
      globeGroup.rotation.y = globeRotY; globeGroup.rotation.x = globeRotX
      updateSpatialAudio()
    }
  }
  markers.forEach(m => {
    const s = 1 + 0.5 * Math.sin(t * 2.2 + m.phase)
    m.ring1.scale.setScalar(s)
    m.ring1.material.opacity = 0.2 + 0.35 * Math.abs(Math.sin(t * 1.8 + m.phase))
    m.ring2.scale.setScalar(1 + 0.8 * Math.sin(t * 1.4 + m.phase + 1))
    m.ring2.material.opacity = 0.05 + 0.18 * Math.abs(Math.sin(t * 1.2 + m.phase))
  })
  renderer.render(scene, camera)
})()

fetchEvents()
