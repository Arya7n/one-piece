import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import {
  createLuffy,
  createZoro,
  createSlashVfx,
  setGear5,
  triggerRubberPunch,
  triggerSlash,
  updateCharacterAnim,
} from './characters.js'

const canvas = document.querySelector('#canvas')

const WORLD = {
  size: 90,
  segments: 120,
  radius: 32,
  walkRadius: 27,
}

const keys = { w: false, a: false, s: false, d: false, shift: false }

let active = 'luffy'
let bloomEnabled = true
let onShip = false
let boardHintShown = false

const clock = new THREE.Clock()
const moveDir = new THREE.Vector3()
const camForward = new THREE.Vector3()
const camRight = new THREE.Vector3()
const lookAt = new THREE.Vector3()
const followTarget = new THREE.Vector3()
const shipForward = new THREE.Vector3()
const tmp = new THREE.Vector3()

// --- Scene ---
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x7ec8e8)
scene.fog = new THREE.Fog(0xa8d8f0, 40, 110)

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  300,
)
camera.position.set(6, 7, 14)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.enablePan = false
controls.minDistance = 4
controls.maxDistance = 28
controls.maxPolarAngle = Math.PI * 0.47
controls.target.set(0, 1.4, 0)

scene.add(new THREE.HemisphereLight(0xfff1c9, 0x3d8f7a, 0.75))
const sun = new THREE.DirectionalLight(0xfff3d0, 1.55)
sun.position.set(20, 35, 12)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 90
sun.shadow.camera.left = -45
sun.shadow.camera.right = 45
sun.shadow.camera.top = 45
sun.shadow.camera.bottom = -45
scene.add(sun)

const gearLight = new THREE.PointLight(0xffffff, 0, 18, 2)
scene.add(gearLight)

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.25,
  0.4,
  0.75,
)
composer.addPass(bloomPass)

// HUD
const hint = document.createElement('div')
hint.id = 'hud-hint'
hint.innerHTML = `
  <strong>Grand Line Isle</strong>
  <span>WASD · Shift run · F attack · G Gear 5 · E board ship · 1/2 switch</span>
  <em id="active-char">Playing: Luffy</em>
  <em id="status-line"></em>
`
document.body.appendChild(hint)
const activeLabel = hint.querySelector('#active-char')
const statusLine = hint.querySelector('#status-line')

function setStatus(text) {
  statusLine.textContent = text || ''
}

// --- Height ---
function islandHeight(x, z) {
  const dist = Math.hypot(x, z)
  const edge = THREE.MathUtils.clamp(1 - dist / WORLD.radius, 0, 1)
  const falloff = edge * edge * (3 - 2 * edge)
  const hills =
    Math.sin(x * 0.12) * Math.cos(z * 0.1) * 1.4 +
    Math.sin(x * 0.28 + 1.2) * Math.sin(z * 0.24) * 0.7
  const plateau = Math.exp(-(x * x + z * z) * 0.0035) * 0.5
  return hills * falloff + plateau * falloff - (1 - falloff) * 4
}

function groundY(x, z) {
  return islandHeight(x, z)
}

// --- Terrain ---
const terrainGeo = new THREE.PlaneGeometry(
  WORLD.size,
  WORLD.size,
  WORLD.segments,
  WORLD.segments,
)
terrainGeo.rotateX(-Math.PI / 2)
{
  const pos = terrainGeo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const cGrass = new THREE.Color(0x4caf50)
  const cBright = new THREE.Color(0x81c784)
  const cSand = new THREE.Color(0xf5e6b8)
  const cDirt = new THREE.Color(0xc4a574)
  const c = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = islandHeight(x, z)
    pos.setY(i, y)
    const dist = Math.hypot(x, z)
    if (y < 0.35) c.copy(cSand)
    else if (dist > WORLD.radius * 0.7) c.copy(cSand).lerp(cDirt, 0.25)
    else c.copy(cGrass).lerp(cBright, (Math.sin(x * 0.4) + 1) * 0.25)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  pos.needsUpdate = true
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  terrainGeo.computeVertexNormals()
}

const terrain = new THREE.Mesh(
  terrainGeo,
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
  }),
)
terrain.receiveShadow = true
scene.add(terrain)

const water = new THREE.Mesh(
  new THREE.CircleGeometry(90, 64),
  new THREE.MeshStandardMaterial({
    color: 0x1e90c8,
    roughness: 0.2,
    metalness: 0.25,
    transparent: true,
    opacity: 0.88,
  }),
)
water.rotation.x = -Math.PI / 2
water.position.y = 0.02
scene.add(water)

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(130, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x3d8fd1) },
      midColor: { value: new THREE.Color(0x8ec8ef) },
      bottomColor: { value: new THREE.Color(0xf7f3e8) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        vec3 col = mix(bottomColor, midColor, smoothstep(-0.05, 0.25, h));
        col = mix(col, topColor, smoothstep(0.2, 0.9, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }),
)
scene.add(sky)

const cloudMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 1,
  transparent: true,
  opacity: 0.92,
})
function makeCloud(x, y, z, s = 1) {
  const g = new THREE.Group()
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(1.2 + Math.random() * 0.8, 10, 8),
      cloudMat,
    )
    puff.position.set((i - 2) * 1.3 * s, Math.random() * 0.6, (Math.random() - 0.5) * 1.5)
    puff.scale.setScalar(s * (0.7 + Math.random() * 0.5))
    g.add(puff)
  }
  g.position.set(x, y, z)
  scene.add(g)
  return g
}
const clouds = [
  makeCloud(-25, 28, -20, 1.4),
  makeCloud(18, 32, -30, 1.8),
  makeCloud(5, 26, 35, 1.2),
  makeCloud(-40, 30, 10, 1.6),
]

const matWood = new THREE.MeshStandardMaterial({ color: 0x8d6e4c, roughness: 0.85 })
const matWoodDark = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 })
const matPalm = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 })
const matTrunk = new THREE.MeshStandardMaterial({ color: 0x6d4c2f, roughness: 0.95 })
const matSail = new THREE.MeshStandardMaterial({
  color: 0xfff8e7,
  roughness: 0.95,
  side: THREE.DoubleSide,
})
const matRed = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.7 })

function placeOnGround(obj, x, z, yOff = 0) {
  obj.position.set(x, groundY(x, z) + yOff, z)
  return obj
}

function makePalm(scale = 1) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 3.2 * scale, 7),
    matTrunk,
  )
  trunk.position.y = 1.6 * scale
  trunk.rotation.z = 0.12
  trunk.castShadow = true
  g.add(trunk)
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.35 * scale, 2.2 * scale, 4),
      matPalm,
    )
    leaf.position.set(0, 3.1 * scale, 0)
    leaf.rotation.set(0.9, (i / 6) * Math.PI * 2, 0)
    leaf.castShadow = true
    g.add(leaf)
  }
  return g
}

;[
  [-14, 8],
  [-18, -2],
  [-12, -12],
  [15, 6],
  [18, -8],
  [10, 14],
  [-8, 16],
  [12, 10],
].forEach(([x, z]) => {
  const palm = makePalm(0.9 + Math.random() * 0.4)
  placeOnGround(palm, x, z)
  palm.rotation.y = Math.random() * Math.PI
  scene.add(palm)
})

// Pier toward ship
const pier = new THREE.Group()
for (let i = 0; i < 10; i++) {
  const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 1.1), matWood)
  plank.position.set(12 + i * 0.08, 0.45, 8 + i * 1.1)
  plank.castShadow = true
  plank.receiveShadow = true
  pier.add(plank)
}
scene.add(pier)

;[
  [4, 3],
  [5.2, 2.4],
  [-3, 5],
].forEach(([x, z], i) => {
  const obj =
    i === 2
      ? new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), matWood)
      : new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.9, 10), matWoodDark)
  obj.castShadow = true
  placeOnGround(obj, x, z, 0.45)
  scene.add(obj)
})

const meat = new THREE.Group()
const bone = new THREE.Mesh(
  new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6),
  new THREE.MeshStandardMaterial({ color: 0xfff8e1 }),
)
bone.rotation.z = Math.PI / 2
meat.add(bone)
const steak = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 10, 8),
  new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.7 }),
)
steak.scale.set(1.4, 0.7, 1)
meat.add(steak)
placeOnGround(meat, 2.5, -1.5, 0.35)
scene.add(meat)

// --- Going Merry (boardable) ---
function makePirateShip() {
  const ship = new THREE.Group()
  ship.name = 'GoingMerry'

  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.8, 12), matWood)
  hull.position.y = 0.4
  hull.castShadow = true
  ship.add(hull)

  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4, 4), matWood)
  bow.rotation.x = -Math.PI / 2
  bow.position.set(0, 0.5, -7)
  ship.add(bow)

  const deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.15, 11), matWoodDark)
  deck.position.y = 1.35
  deck.receiveShadow = true
  ship.add(deck)

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 9, 8),
    matWoodDark,
  )
  mast.position.set(0, 5.5, 0)
  ship.add(mast)

  const sail = new THREE.Mesh(new THREE.PlaneGeometry(5, 4.5), matSail)
  sail.position.set(0, 5.2, 0.8)
  ship.add(sail)

  const jolly = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), matRed)
  jolly.position.set(0, 5.5, 0.85)
  ship.add(jolly)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xf5f0e6 }),
  )
  head.position.set(0, 1.8, -8.2)
  ship.add(head)
  const snout = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffc0cb }),
  )
  snout.position.set(0, 1.55, -8.7)
  ship.add(snout)

  // Railings
  for (const x of [-2.4, 2.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 10), matWoodDark)
    rail.position.set(x, 1.7, 0)
    ship.add(rail)
  }

  // Boarding markers (local deck seats)
  const seatLuffy = new THREE.Object3D()
  seatLuffy.position.set(-1.1, 1.45, 1.5)
  ship.add(seatLuffy)
  const seatZoro = new THREE.Object3D()
  seatZoro.position.set(1.1, 1.45, 1.5)
  ship.add(seatZoro)

  // Gangplank toward pier
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 4.5), matWood)
  plank.position.set(-0.2, 1.0, 7.2)
  plank.rotation.x = -0.25
  ship.add(plank)

  ship.position.set(16, 0.15, 18)
  ship.rotation.y = -0.85
  ship.scale.setScalar(0.9)

  ship.userData = {
    seatLuffy,
    seatZoro,
    sail,
    speed: 0,
    yawSpeed: 0,
  }
  return ship
}

const ship = makePirateShip()
scene.add(ship)

const flagPole = new THREE.Group()
const pole = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.08, 3.5, 6),
  matWoodDark,
)
pole.position.y = 1.75
flagPole.add(pole)
const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), matRed)
flag.position.set(0.7, 3.1, 0)
flagPole.add(flag)
placeOnGround(flagPole, -2, 2)
scene.add(flagPole)

// Characters + VFX
const luffy = createLuffy()
const zoro = createZoro()
placeOnGround(luffy, 0, 2)
placeOnGround(zoro, 2.2, 1.2)
luffy.rotation.y = Math.PI
zoro.rotation.y = Math.PI * 0.9
scene.add(luffy, zoro)

const slashVfx = createSlashVfx()
scene.add(slashVfx)

const characters = { luffy, zoro }

function setActive(name) {
  if (onShip) return
  active = name
  refreshActiveLabel()
}

function refreshActiveLabel() {
  const gear = luffy.userData.gear5 ? ' · GEAR 5!' : ''
  const shipTag = onShip ? ' · On Merry' : ''
  activeLabel.textContent = `Playing: ${characters[active].userData.displayName}${gear}${shipTag}`
}

function getPlayer() {
  return characters[active]
}
function getBuddy() {
  return active === 'luffy' ? zoro : luffy
}

function nearShip(player) {
  ship.updateMatrixWorld(true)
  const deck = new THREE.Vector3()
  ship.userData.seatLuffy.getWorldPosition(deck)
  return player.position.distanceTo(deck) < 6.5
}

function boardShip() {
  if (onShip) return
  onShip = true
  ship.attach(luffy)
  ship.attach(zoro)
  luffy.position.copy(ship.userData.seatLuffy.position)
  zoro.position.copy(ship.userData.seatZoro.position)
  luffy.rotation.set(0, Math.PI, 0)
  zoro.rotation.set(0, Math.PI, 0)
  ship.userData.speed = 0
  refreshActiveLabel()
  setStatus('Aboard Going Merry! WASD sail · E to dock/leave')
}

function leaveShip() {
  if (!onShip) return
  onShip = false
  scene.attach(luffy)
  scene.attach(zoro)

  // Disembark toward island center from ship
  ship.updateMatrixWorld(true)
  const exit = new THREE.Vector3()
  ship.getWorldPosition(exit)
  const towardIsland = exit.clone().multiplyScalar(-1).setY(0)
  if (towardIsland.lengthSq() < 0.01) towardIsland.set(-1, 0, -1)
  towardIsland.normalize()

  luffy.position.copy(exit).addScaledVector(towardIsland, 8)
  zoro.position.copy(luffy.position).add(new THREE.Vector3(1.5, 0, 0.5))
  luffy.position.y = groundY(luffy.position.x, luffy.position.z)
  zoro.position.y = groundY(zoro.position.x, zoro.position.z)
  clampToIsland(luffy)
  clampToIsland(zoro)

  ship.userData.speed = 0
  refreshActiveLabel()
  setStatus('Back on the island!')
  setTimeout(() => setStatus(''), 2000)
}

function tryBoardToggle() {
  if (onShip) {
    leaveShip()
    return
  }
  if (nearShip(getPlayer())) boardShip()
  else setStatus('Get closer to Going Merry (follow the pier)')
}

function doAttack() {
  if (onShip) return
  const player = getPlayer()
  if (active === 'luffy') {
    if (triggerRubberPunch(luffy)) {
      setStatus(luffy.userData.gear5 ? 'Gomu Gomu no… BAJRANE!' : 'Gomu Gomu no Pistol!')
      setTimeout(() => setStatus(''), 900)
    }
  } else if (triggerSlash(zoro)) {
    slashVfx.visible = true
    slashVfx.userData.t = 0
    zoro.updateMatrixWorld(true)
    slashVfx.position.copy(zoro.position)
    slashVfx.rotation.y = zoro.rotation.y
    setStatus('Three Sword Style!')
    setTimeout(() => setStatus(''), 700)
  }
}

function toggleGear5() {
  if (active !== 'luffy' && !luffy.userData.gear5) {
    setStatus('Switch to Luffy (1) for Gear 5')
    return
  }
  const next = !luffy.userData.gear5
  setGear5(luffy, next)
  bloomPass.strength = next ? 0.85 : 0.25
  renderer.toneMappingExposure = next ? 1.35 : 1.15
  refreshActiveLabel()
  setStatus(next ? 'GEAR FIFTH!!!' : 'Gear 5 off')
  setTimeout(() => setStatus(''), 1200)
}

// Input
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k in keys) keys[k] = true
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true
  if (e.repeat) return
  if (k === '1') setActive('luffy')
  if (k === '2') setActive('zoro')
  if (k === 'b') {
    bloomEnabled = !bloomEnabled
    bloomPass.enabled = bloomEnabled
  }
  if (k === 'g') toggleGear5()
  if (k === 'e') tryBoardToggle()
  if (k === 'f' || k === ' ') {
    e.preventDefault()
    doAttack()
  }
})
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase()
  if (k in keys) keys[k] = false
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false
})

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

function clampToIsland(obj) {
  const dist = Math.hypot(obj.position.x, obj.position.z)
  if (dist > WORLD.walkRadius) {
    const s = WORLD.walkRadius / dist
    obj.position.x *= s
    obj.position.z *= s
  }
  obj.position.y = groundY(obj.position.x, obj.position.z)
}

function updateShip(delta) {
  const data = ship.userData
  // W/S throttle, A/D steer
  if (keys.w) data.speed = Math.min(12, data.speed + 8 * delta)
  else if (keys.s) data.speed = Math.max(-5, data.speed - 8 * delta)
  else data.speed *= 1 - 1.8 * delta

  if (keys.a) ship.rotation.y += 0.9 * delta
  if (keys.d) ship.rotation.y -= 0.9 * delta

  shipForward.set(Math.sin(ship.rotation.y), 0, Math.cos(ship.rotation.y))
  ship.position.addScaledVector(shipForward, data.speed * delta)

  // Bob on waves
  ship.position.y = 0.15 + Math.sin(clock.elapsedTime * 1.4) * 0.08
  ship.rotation.z = Math.sin(clock.elapsedTime * 1.1) * 0.03
  ship.rotation.x = Math.sin(clock.elapsedTime * 0.9) * 0.02

  // Soft world bounds for sailing
  const r = Math.hypot(ship.position.x, ship.position.z)
  if (r > 70) {
    ship.position.multiplyScalar(70 / r)
    data.speed *= -0.3
  }

  // Keep crew seated + idle anim
  const t = clock.elapsedTime
  updateCharacterAnim(luffy, false, false, t, { delta })
  updateCharacterAnim(zoro, false, false, t, { delta })

  ship.updateMatrixWorld(true)
  ship.userData.seatLuffy.getWorldPosition(lookAt)
  lookAt.y += 1.2
  controls.target.lerp(lookAt, 1 - Math.exp(-6 * delta))
}

function updatePlayer(delta, t) {
  const player = getPlayer()
  moveDir.set(0, 0, 0)
  camera.getWorldDirection(camForward)
  camForward.y = 0
  if (camForward.lengthSq() > 1e-6) camForward.normalize()
  camRight.set(-camForward.z, 0, camForward.x)

  if (keys.w) moveDir.add(camForward)
  if (keys.s) moveDir.sub(camForward)
  if (keys.a) moveDir.sub(camRight)
  if (keys.d) moveDir.add(camRight)

  const moving = moveDir.lengthSq() > 1e-6
  const running = moving && keys.shift
  let base = active === 'luffy' ? 4.2 : 3.6
  if (active === 'luffy' && luffy.userData.gear5) base *= 1.35
  const speed = running ? base * 2.1 : base

  const busy =
    (player.userData.punchT ?? -1) >= 0 || (player.userData.slashT ?? -1) >= 0

  if (moving && !busy) {
    moveDir.normalize()
    player.position.x += moveDir.x * speed * delta
    player.position.z += moveDir.z * speed * delta
    clampToIsland(player)
    player.rotation.y = Math.atan2(moveDir.x, moveDir.z)
  } else {
    player.position.y = groundY(player.position.x, player.position.z)
  }

  updateCharacterAnim(player, moving, running, t, { delta })

  lookAt.copy(player.position).add(new THREE.Vector3(0, 1.4, 0))
  controls.target.lerp(lookAt, 1 - Math.exp(-8 * delta))
}

function updateBuddy(delta, t) {
  const player = getPlayer()
  const buddy = getBuddy()

  followTarget
    .copy(player.position)
    .add(
      new THREE.Vector3(
        Math.sin(player.rotation.y + Math.PI * 0.5) * 1.6,
        0,
        Math.cos(player.rotation.y + Math.PI * 0.5) * 1.6,
      ),
    )

  tmp.copy(followTarget).sub(buddy.position)
  tmp.y = 0
  const dist = tmp.length()
  let moving = false
  let running = false

  if (
    dist > 1.2 &&
    (buddy.userData.punchT ?? -1) < 0 &&
    (buddy.userData.slashT ?? -1) < 0
  ) {
    moving = true
    running = dist > 5
    tmp.normalize()
    const speed = running ? 7 : 3.5
    buddy.position.x += tmp.x * speed * delta
    buddy.position.z += tmp.z * speed * delta
    clampToIsland(buddy)
    buddy.rotation.y = Math.atan2(tmp.x, tmp.z)
  } else {
    buddy.position.y = groundY(buddy.position.x, buddy.position.z)
  }

  updateCharacterAnim(buddy, moving, running, t, { delta })
}

function updateSlashVfx(delta) {
  if (!slashVfx.visible) return
  slashVfx.userData.t = (slashVfx.userData.t || 0) + delta
  const t = slashVfx.userData.t
  const scale = 1 + t * 4
  slashVfx.scale.setScalar(scale)
  slashVfx.children.forEach((arc, i) => {
    arc.material.opacity = Math.max(0, 0.9 - t * 2.2 - i * 0.05)
  })
  if (t > 0.45) {
    slashVfx.visible = false
    slashVfx.scale.setScalar(1)
  }
}

function animate() {
  requestAnimationFrame(animate)
  const delta = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  if (onShip) updateShip(delta)
  else {
    updatePlayer(delta, t)
    updateBuddy(delta, t)

    if (nearShip(getPlayer())) {
      if (!boardHintShown) {
        setStatus('Press E to board Going Merry')
        boardHintShown = true
      }
    } else if (boardHintShown && !statusLine.textContent.includes('Gomu') && !statusLine.textContent.includes('Sword') && !statusLine.textContent.includes('GEAR')) {
      boardHintShown = false
      if (statusLine.textContent.includes('board')) setStatus('')
    }
  }

  updateSlashVfx(delta)

  // Gear 5 light follow
  if (luffy.userData.gear5) {
    luffy.getWorldPosition(tmp)
    gearLight.position.copy(tmp).add(new THREE.Vector3(0, 2, 0))
    gearLight.intensity = 2.2 + Math.sin(t * 8) * 0.6
  } else {
    gearLight.intensity = 0
  }

  water.material.opacity = 0.84 + Math.sin(t * 0.7) * 0.04
  for (const c of clouds) {
    c.position.x += Math.sin(t * 0.05 + c.position.z) * 0.002
  }
  flagPole.children[1].rotation.y = Math.sin(t * 2) * 0.15
  if (ship.userData.sail) {
    ship.userData.sail.rotation.y = Math.sin(t * 1.3) * 0.05
  }

  controls.update()
  if (bloomEnabled) composer.render()
  else renderer.render(scene, camera)
}

animate()
