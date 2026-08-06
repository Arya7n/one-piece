import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import {
  CREW_ORDER,
  createCrew,
  createSlashVfx,
  createPelletVfx,
  setGear5,
  triggerRubberPunch,
  triggerSlash,
  triggerKick,
  triggerStaff,
  triggerShot,
  triggerBloom,
  triggerBeam,
  updateCharacterAnim,
} from './characters.js'
import {
  WORLD,
  buildWorld,
  applyTerrainOrSwim,
  groundY,
  WATER_SURFACE,
  SWIM_LAND_THRESHOLD,
} from './world.js'
import {
  createWeatherSystem,
  createDayNight,
  createBubbleSystem,
  createCannonBall,
} from './systems.js'
import { sfx } from './audio.js'
import { createMobileGamepad } from './gamepad.js'

const canvas = document.querySelector('#canvas')

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
  v: false,
  control: false,
}

let active = 'luffy'
let bloomEnabled = true
let onShip = false
let boardHintShown = false
let berryCount = 0
let chestsOpened = 0
let barrelsSmashed = 0
let playerHp = 100
let fruitBuff = null // { buff, label, until }
let cookBuff = null // { until, mul }
let padRun = false
let gathering = false
let aiming = false
let diveAir = 1
let crewBounty = 30_000_000
/** Crew ids currently attached to the ship */
const aboard = new Set()
const exposureRef = { current: 1.15 }

const GRAVITY = 22
const JUMP_V = 8.5

const clock = new THREE.Clock()
const moveDir = new THREE.Vector3()
const camForward = new THREE.Vector3()
const camRight = new THREE.Vector3()
const lookAt = new THREE.Vector3()
const followTarget = new THREE.Vector3()
const shipForward = new THREE.Vector3()
const tmp = new THREE.Vector3()
const attackOrigin = new THREE.Vector3()

// --- Scene ---
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x7ec8e8)
scene.fog = new THREE.Fog(0xa8d8f0, 80, 280)

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  400,
)
camera.position.set(8, 9, 16)
camera.far = 500
camera.updateProjectionMatrix()

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
controls.maxDistance = 48
controls.maxPolarAngle = Math.PI * 0.47
controls.target.set(0, 1.4, 0)

const hemi = new THREE.HemisphereLight(0xfff1c9, 0x3d8f7a, 0.75)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xfff3d0, 1.55)
sun.position.set(40, 55, 25)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 220
sun.shadow.camera.left = -110
sun.shadow.camera.right = 110
sun.shadow.camera.top = 110
sun.shadow.camera.bottom = -110
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

// Sky
const skyMat = new THREE.ShaderMaterial({
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
})
scene.add(new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), skyMat))

const world = buildWorld(scene)
const {
  ship,
  water,
  flagPole,
  campFlame,
  clouds,
  berries,
  chests,
  barrels,
  fruits,
  climbPoints,
  meat,
  bountyBoard,
  cookStation,
} = world

const weather = createWeatherSystem(scene)
const dayNight = createDayNight({
  sun,
  hemi,
  fog: scene.fog,
  skyMat,
  exposureRef,
})
const bubbles = createBubbleSystem(scene)
const cannonBall = createCannonBall()
scene.add(cannonBall)

// HUD — slim bar always visible; full info panel toggles open/closed
const hudRoot = document.createElement('div')
hudRoot.id = 'hud-root'
hudRoot.innerHTML = `
  <div id="hud-bar">
    <em id="active-char">Playing: Luffy</em>
    <span id="berry-count-mini">Berry: 0</span>
    <span id="hp-count-mini">HP: 100</span>
    <button type="button" id="hud-open" aria-expanded="false" aria-controls="hud-hint">Info</button>
    <em id="status-line"></em>
  </div>
  <div id="hud-hint" class="hud-closed" hidden>
    <div class="hud-panel-head">
      <strong>Grand Line Archipelago</strong>
      <button type="button" id="hud-close" aria-label="Close info">×</button>
    </div>
    <span>WASD · Space jump · F attack · V aim (Usopp) · Ctrl dive · C call · G Gear 5 · E cook/board · H recall</span>
    <em id="active-char-panel">Playing: Luffy</em>
    <div id="hud-stats">
      <span id="berry-count">Berry: 0</span>
      <span id="hp-count">HP: 100</span>
      <span id="chest-count">Chests: 0/6</span>
      <span id="barrel-count">Barrels: 0</span>
      <span id="bounty-count">Bounty: 30M</span>
      <span id="buff-count">Buff: —</span>
    </div>
    <div id="crew-strip"></div>
  </div>
`
document.body.appendChild(hudRoot)

const dayNightBtn = document.createElement('button')
dayNightBtn.type = 'button'
dayNightBtn.id = 'day-night-toggle'
dayNightBtn.title = 'Switch day / night'
dayNightBtn.setAttribute('aria-label', 'Switch day or night mode')
document.body.appendChild(dayNightBtn)

function refreshDayNightBtn() {
  const mode = dayNight.getMode()
  const isNight = mode === 'night'
  dayNightBtn.textContent = isNight ? 'Night' : 'Day'
  dayNightBtn.dataset.mode = mode
  dayNightBtn.setAttribute('aria-pressed', isNight ? 'true' : 'false')
}

dayNightBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  const mode = dayNight.toggle()
  refreshDayNightBtn()
  setStatus(mode === 'night' ? 'Night mode' : 'Day mode')
  setTimeout(() => setStatus(''), 1000)
})
refreshDayNightBtn()

const hint = hudRoot.querySelector('#hud-hint')
const hudOpenBtn = hudRoot.querySelector('#hud-open')
const hudCloseBtn = hudRoot.querySelector('#hud-close')
const activeLabel = hudRoot.querySelector('#active-char')
const activeLabelPanel = hudRoot.querySelector('#active-char-panel')
const statusLine = hudRoot.querySelector('#status-line')
const berryLabel = hudRoot.querySelector('#berry-count')
const berryMini = hudRoot.querySelector('#berry-count-mini')
const chestLabel = hudRoot.querySelector('#chest-count')
const barrelLabel = hudRoot.querySelector('#barrel-count')
const hpLabel = hudRoot.querySelector('#hp-count')
const hpMini = hudRoot.querySelector('#hp-count-mini')
const buffLabel = hudRoot.querySelector('#buff-count')
const bountyLabel = hudRoot.querySelector('#bounty-count')
const crewStrip = hudRoot.querySelector('#crew-strip')

function setHudOpen(open) {
  hint.classList.toggle('hud-closed', !open)
  hint.hidden = !open
  hudOpenBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
  hudOpenBtn.classList.toggle('hud-open-active', open)
}

hudOpenBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  setHudOpen(hint.hidden)
})
hudCloseBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  setHudOpen(false)
})
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !hint.hidden) {
    setHudOpen(false)
  }
})
document.addEventListener(
  'pointerdown',
  (e) => {
    if (hint.hidden) return
    if (hudRoot.contains(e.target)) return
    setHudOpen(false)
  },
  true,
)

function setStatus(text) {
  statusLine.textContent = text || ''
}

function formatBounty(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  return `${Math.round(n)}`
}

function addBounty(amount, reason) {
  crewBounty += amount
  bountyBoard?.userData.draw(crewBounty)
  bountyBoard.userData.bounty = crewBounty
  refreshStats()
  if (reason) {
    setStatus(`${reason} · Bounty ${formatBounty(crewBounty)}฿`)
    setTimeout(() => setStatus(''), 1400)
  }
}

function refreshStats() {
  const berry = `Berry: ${berryCount}`
  const hp = `HP: ${Math.max(0, Math.round(playerHp))}`
  berryLabel.textContent = berry
  berryMini.textContent = berry
  hpLabel.textContent = hp
  hpMini.textContent = hp
  chestLabel.textContent = `Chests: ${chestsOpened}/${chests.length}`
  barrelLabel.textContent = `Barrels: ${barrelsSmashed}`
  if (bountyLabel) bountyLabel.textContent = `Bounty: ${formatBounty(crewBounty)}฿`
  buffLabel.textContent = cookBuff
    ? 'Buff: All Blue feast'
    : fruitBuff
      ? `Buff: ${fruitBuff.label}`
      : 'Buff: —'
}

// Characters — spread across the archipelago; only the active one is controlled
const characters = createCrew()
const spawnSpots = {
  luffy: [0, 2],
  zoro: [8, -6],
  nami: [-12, -8],
  usopp: [92, -6],
  sanji: [-52, 82],
  chopper: [68, 72],
  robin: [-88, -42],
  franky: [18, -90],
  brook: [-40, -68],
  jinbe: [14, 14],
}
CREW_ORDER.forEach((id) => {
  const c = characters[id]
  const [sx, sz] = spawnSpots[id] || [0, 0]
  c.position.set(sx, groundY(sx, sz), sz)
  c.rotation.y = Math.PI * Math.random()
  c.userData.velY = 0
  c.userData.onGround = true
  c.userData.climbing = false
  c.userData._baseScale = c.scale.x
  c.userData.gathering = false
  // Light idle wander on their own island
  c.userData.idleTarget = null
  c.userData.idleWait = 1 + Math.random() * 3
  if (id === 'zoro') {
    c.userData.lost = false
    c.userData.lostUntil = 0
    c.userData.lostDir = new THREE.Vector3(1, 0, 0)
  }
  applyTerrainOrSwim(c)
  scene.add(c)
})

crewStrip.innerHTML =
  CREW_ORDER.map(
    (id, i) =>
      `<button type="button" class="crew-chip" data-id="${id}">${i + 1 <= 9 ? i + 1 : '0'}.${characters[id].userData.displayName}</button>`,
  ).join('') +
  `<button type="button" class="crew-chip crew-call" id="call-crew" title="Call all crew (C)">📣 Call</button>`
crewStrip.addEventListener('click', (e) => {
  const call = e.target.closest('#call-crew')
  if (call) {
    callCrew()
    return
  }
  const btn = e.target.closest('[data-id]')
  if (btn) setActive(btn.dataset.id)
})

const slashVfx = createSlashVfx()
scene.add(slashVfx)
const pellet = createPelletVfx()
scene.add(pellet)

function setActive(name) {
  if (onShip) {
    // Can only switch among crew currently aboard
    if (!aboard.has(name)) {
      setStatus('That crewmate is not on the ship')
      setTimeout(() => setStatus(''), 1200)
      return
    }
  }
  if (!characters[name]) return
  active = name
  characters[name].userData.gathering = false
  sfx.switch()
  refreshActiveLabel()
  refreshCrewStrip()
}

function cycleCrew(dir = 1) {
  if (onShip) return
  const i = CREW_ORDER.indexOf(active)
  const next = CREW_ORDER[(i + dir + CREW_ORDER.length) % CREW_ORDER.length]
  setActive(next)
}

function refreshCrewStrip() {
  crewStrip.querySelectorAll('.crew-chip').forEach((el) => {
    el.classList.toggle('crew-active', el.dataset.id === active)
  })
}

function refreshActiveLabel() {
  const gear = characters.luffy.userData.gear5 ? ' · GEAR 5!' : ''
  const shipTag = onShip ? ' · On Merry' : ''
  const lost =
    active !== 'zoro' && characters.zoro.userData.lost ? ' · Zoro is lost…' : ''
  const text = `Playing: ${characters[active].userData.displayName}${gear}${shipTag}${lost}`
  activeLabel.textContent = text
  if (activeLabelPanel) activeLabelPanel.textContent = text
}

function getPlayer() {
  return characters[active]
}

function getFollowers() {
  return CREW_ORDER.filter((id) => id !== active).map((id) => characters[id])
}

function callCrew() {
  if (onShip) {
    setStatus('Leave the ship to call the crew')
    return
  }
  gathering = true
  let n = 0
  for (const id of CREW_ORDER) {
    if (id === active) continue
    const c = characters[id]
    if (aboard.has(id)) continue
    c.userData.gathering = true
    c.userData.lost = false
    c.userData.idleTarget = null
    n++
  }
  sfx.board()
  setStatus(n ? `Calling crew! (${n} on the way)` : 'Crew already with you')
  setTimeout(() => setStatus(''), 1800)
}

function pickIdleTarget(buddy) {
  const ang = Math.random() * Math.PI * 2
  const dist = 2 + Math.random() * 6
  const x = buddy.position.x + Math.cos(ang) * dist
  const z = buddy.position.z + Math.sin(ang) * dist
  if (groundY(x, z) < SWIM_LAND_THRESHOLD + 0.05) return null
  return new THREE.Vector3(x, 0, z)
}

function nearShip(player) {
  ship.updateMatrixWorld(true)
  const deck = new THREE.Vector3()
  ship.userData.seatLuffy.getWorldPosition(deck)
  return (
    player.position.distanceTo(deck) < 11 ||
    player.position.distanceTo(ship.position) < 10
  )
}

function nearestClimb(player) {
  for (const cp of climbPoints) {
    const d = Math.hypot(player.position.x - cp.x, player.position.z - cp.z)
    if (d < cp.radius) return cp
  }
  return null
}

function recallShipHome() {
  if (onShip) {
    setStatus('Leave the ship first (E), then recall')
    return
  }
  const home = ship.userData.home
  ship.position.set(home.x, 0.35, home.z)
  ship.rotation.set(0, home.rot, 0)
  ship.userData.speed = 0
  setStatus('Going Merry returned to the pier!')
  setTimeout(() => setStatus(''), 1600)
}

function boardShip() {
  if (onShip) return
  const player = getPlayer()
  // Board active + anyone nearby (after a call / already close)
  const boarding = CREW_ORDER.filter((id) => {
    const c = characters[id]
    if (id === active) return true
    return c.position.distanceTo(player.position) < 8 || c.position.distanceTo(ship.position) < 12
  })

  onShip = true
  aboard.clear()
  sfx.board()

  // Boarding seats — slightly higher for new deck
  const seats = [
    [-1.2, 1.65, 0.5],
    [1.2, 1.65, 0.5],
    [-1.5, 1.65, -1.2],
    [1.5, 1.65, -1.2],
    [0, 1.65, -0.2],
    [-0.9, 1.65, 1.8],
    [0.9, 1.65, 1.8],
    [-1.6, 1.65, -2.2],
    [1.6, 1.65, -2.2],
    [0, 1.65, -3.0],
  ]

  boarding.forEach((id, i) => {
    const c = characters[id]
    c.userData.swimming = false
    c.userData.climbing = false
    c.userData.velY = 0
    c.userData.gathering = false
    if (c.userData.hips) c.userData.hips.rotation.x = 0
    ship.attach(c)
    const [x, y, z] = seats[i % seats.length]
    c.position.set(x, y, z)
    c.rotation.set(0, Math.PI, 0)
    aboard.add(id)
  })

  gathering = false
  ship.userData.speed = 0
  refreshActiveLabel()
  const leftBehind = CREW_ORDER.length - boarding.length
  setStatus(
    leftBehind
      ? `Aboard (${boarding.length})! ${leftBehind} left behind — Call (C) next time`
      : 'Full crew aboard! WASD sail · E leave',
  )
}

function leaveShip() {
  if (!onShip) return
  onShip = false
  ship.updateMatrixWorld(true)
  const exit = new THREE.Vector3()
  ship.getWorldPosition(exit)
  const side = new THREE.Vector3(
    Math.sin(ship.rotation.y + Math.PI),
    0,
    Math.cos(ship.rotation.y + Math.PI),
  )
  let i = 0
  for (const id of [...aboard]) {
    const c = characters[id]
    scene.attach(c)
    c.position
      .copy(exit)
      .addScaledVector(side, 5)
      .add(new THREE.Vector3((i % 5) * 0.7 - 1.4, 0, Math.floor(i / 5) * 0.8))
    applyTerrainOrSwim(c)
    c.userData.gathering = false
    c.userData.idleTarget = null
    c.userData.idleWait = 1 + Math.random() * 2
    i++
  }
  aboard.clear()
  ship.userData.speed = 0
  refreshActiveLabel()
  setStatus(
    getPlayer().userData.swimming
      ? 'Swimming! Shore or H to recall Merry'
      : 'Landed!',
  )
  setTimeout(() => setStatus(''), 2000)
}

function tryBoardToggle() {
  if (onShip) {
    leaveShip()
    return
  }
  if (nearShip(getPlayer())) boardShip()
}

function tryCook() {
  if (!cookStation) return false
  const player = getPlayer()
  if (player.position.distanceTo(cookStation.position) > 2.8) return false

  const isSanji = active === 'sanji'
  const cost = isSanji ? 5 : 3
  if (berryCount < cost) {
    setStatus(`Need ${cost} Berries to cook${isSanji ? ' (All Blue)' : ''}`)
    setTimeout(() => setStatus(''), 1400)
    return true
  }

  berryCount -= cost
  const heal = isSanji ? 80 : 50
  playerHp = Math.min(100, playerHp + heal)
  if (isSanji) {
    cookBuff = { until: clock.elapsedTime + 20, mul: 1.35 }
    sfx.cook()
    setStatus(`All Blue feast! +${heal} HP · ATK up 20s`)
  } else {
    sfx.heal()
    setStatus(`Sanji's kitchen leftovers! +${heal} HP`)
  }
  // Flash flame
  if (cookStation.userData.flame) {
    cookStation.userData.flame.scale.setScalar(1.6)
    setTimeout(() => cookStation.userData.flame.scale.setScalar(1), 400)
  }
  refreshStats()
  setTimeout(() => setStatus(''), 1600)
  return true
}

function tryInteract() {
  sfx.unlock()
  if (onShip) {
    tryBoardToggle()
    return
  }
  const player = getPlayer()

  if (tryCook()) return

  for (const chest of chests) {
    if (chest.userData.opened) continue
    if (player.position.distanceTo(chest.position) < 2.4) {
      chest.userData.opened = true
      chest.userData.lid.rotation.x = -1.1
      chest.userData.lid.position.z = -0.25
      berryCount += 5
      chestsOpened++
      addBounty(500_000, 'Chest claimed')
      refreshStats()
      sfx.chest()
      setStatus('Treasure! +5 Berry')
      setTimeout(() => setStatus(''), 1500)
      return
    }
  }

  if (meat && !meat.userData.taken && player.position.distanceTo(meat.position) < 2) {
    meat.userData.taken = true
    meat.visible = false
    playerHp = Math.min(100, playerHp + 35)
    // Meat respawns later at kitchen area vibe — store for respawn
    meat.userData.respawnAt = clock.elapsedTime + 45
    refreshStats()
    sfx.heal()
    setStatus('Meat! +35 HP')
    setTimeout(() => setStatus(''), 1400)
    return
  }

  if (nearShip(player)) {
    boardShip()
    return
  }

  setStatus('Nothing nearby — cook station, chests, Merry, meat, fruits')
  setTimeout(() => setStatus(''), 1400)
}

function damageMul() {
  let m = 1
  if (fruitBuff?.buff === 'stretch' || fruitBuff?.buff === 'bloom') m *= 1.5
  if (fruitBuff?.buff === 'charm') m *= 1.25
  if (active === 'luffy' && characters.luffy.userData.gear5) m *= 1.4
  if (cookBuff) m *= cookBuff.mul
  return m
}

function hitBarrels(origin, range, damage) {
  let hit = false
  const dmg = damage * damageMul()
  for (const barrel of barrels) {
    if (!barrel.visible || barrel.userData.hp <= 0) continue
    if (origin.distanceTo(barrel.position) > range) continue
    barrel.userData.hp -= dmg
    barrel.scale.y = 0.5 + 0.5 * (barrel.userData.hp / barrel.userData.maxHp)
    barrel.rotation.z += (Math.random() - 0.5) * 0.4
    hit = true
    if (barrel.userData.hp <= 0) {
      barrel.visible = false
      barrel.userData.respawnAt = clock.elapsedTime + 28 + Math.random() * 12
      barrelsSmashed++
      berryCount += 1
      addBounty(150_000)
      refreshStats()
      sfx.smash()
      setStatus('Barrel smashed! +1 Berry')
      setTimeout(() => setStatus(''), 900)
    }
  }
  return hit
}

function fireShipCannon() {
  const data = ship.userData
  if (!data.cannons?.length || data.cannonCooldown > 0) return
  if (cannonBall.userData.active) return
  data.cannonCooldown = 0.85
  // Alternate sides
  data._cannonIdx = ((data._cannonIdx || 0) + 1) % data.cannons.length
  const c = data.cannons[data._cannonIdx]
  ship.updateMatrixWorld(true)
  c.muzzle.getWorldPosition(cannonBall.position)
  const side = c.side
  // Fire sideways relative to ship heading
  cannonBall.userData.dir
    .set(
      Math.sin(ship.rotation.y) * 0.15 + Math.cos(ship.rotation.y) * side,
      0.08,
      Math.cos(ship.rotation.y) * 0.15 - Math.sin(ship.rotation.y) * side,
    )
    .normalize()
  cannonBall.userData.t = 0
  cannonBall.userData.active = true
  cannonBall.visible = true
  sfx.cannon()
  setStatus('Fire!!!')
  setTimeout(() => setStatus(''), 600)
}

function doAttack() {
  sfx.unlock()
  if (onShip) {
    fireShipCannon()
    return
  }
  const player = getPlayer()
  player.getWorldPosition(attackOrigin)
  attackOrigin.y += 1
  const kind = player.userData.kind

  if (kind === 'luffy') {
    if (triggerRubberPunch(player)) {
      const range = player.userData.gear5 || fruitBuff?.buff === 'stretch' ? 7 : 4.5
      setTimeout(() => hitBarrels(player.position, range, 2), 180)
      sfx.punch()
      setStatus(player.userData.gear5 ? 'Gomu Gomu no… BAJRANE!' : 'Gomu Gomu no Pistol!')
      setTimeout(() => setStatus(''), 900)
    }
  } else if (kind === 'zoro' || kind === 'brook') {
    if (triggerSlash(player)) {
      slashVfx.visible = true
      slashVfx.userData.t = 0
      player.updateMatrixWorld(true)
      slashVfx.position.copy(player.position)
      slashVfx.rotation.y = player.rotation.y
      hitBarrels(player.position, kind === 'brook' ? 3.2 : 3.5, kind === 'brook' ? 2.5 : 3)
      sfx.slash()
      setStatus(kind === 'brook' ? 'Soul Solid!' : 'Three Sword Style!')
      setTimeout(() => setStatus(''), 700)
    }
  } else if (kind === 'sanji' || kind === 'chopper') {
    if (triggerKick(player)) {
      hitBarrels(player.position, 3.2, kind === 'sanji' ? 3.2 : 2.2)
      sfx.kick()
      setStatus(kind === 'sanji' ? 'Diable Jambe!' : 'Heavy Point!')
      setTimeout(() => setStatus(''), 700)
    }
  } else if (kind === 'nami') {
    if (triggerStaff(player)) {
      hitBarrels(player.position, 4.2, 2.6)
      weather.trigger(player.position, 3.2)
      sfx.thunder()
      sfx.staff()
      setStatus('Clima-Tact — Thunderbolt Tempo!')
      setTimeout(() => setStatus(''), 1000)
    }
  } else if (kind === 'robin') {
    if (triggerBloom(player)) {
      hitBarrels(player.position, 4.5, 2.8)
      sfx.staff()
      setStatus('Dos Fleur!')
      setTimeout(() => setStatus(''), 700)
    }
  } else if (kind === 'usopp') {
    if (triggerShot(player)) {
      const sniper = aiming
      pellet.visible = true
      pellet.userData.t = 0
      pellet.userData.maxT = sniper ? 1.8 : 0.9
      pellet.userData.speed = sniper ? 48 : 28
      pellet.position.copy(player.position).add(new THREE.Vector3(0, 1.35, 0))
      // Aim along camera when sniping
      if (sniper) {
        camera.getWorldDirection(pellet.userData.dir)
        pellet.userData.dir.y *= 0.15
        pellet.userData.dir.normalize()
      } else {
        pellet.userData.dir
          .set(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y))
          .normalize()
      }
      sfx.shot()
      setStatus(sniper ? 'Usopp… SNIPER shot!' : 'Usopp… Pellèt!')
      setTimeout(() => setStatus(''), 700)
    }
  } else if (kind === 'franky') {
    if (triggerBeam(player)) {
      setTimeout(() => hitBarrels(player.position, 8, 3.5), 100)
      sfx.punch()
      setStatus('SUPERRR! Radical Beam!')
      setTimeout(() => setStatus(''), 800)
    }
  } else if (kind === 'jinbe') {
    const d = player.userData
    if (d.attackLock <= 0 && (d.punchT ?? -1) < 0) {
      d.punchT = 0
      d.attackLock = 0.55
      hitBarrels(player.position, 4, 3.5)
      sfx.punch()
      setStatus('Fish-Man Karate!')
      setTimeout(() => setStatus(''), 700)
    }
  }
}

function tryJump() {
  if (onShip) return
  const player = getPlayer()
  if (player.userData.diving) {
    // Surface from dive
    player.userData.diving = false
    diveAir = Math.min(1, diveAir + 0.3)
    sfx.splash()
    return
  }
  if (player.userData.swimming) return
  if (player.userData.climbing) {
    // leap off climb
    player.userData.climbing = false
    player.userData.velY = JUMP_V * 0.7
    player.userData.onGround = false
    sfx.jump()
    return
  }
  if (!player.userData.onGround) return
  player.userData.velY = JUMP_V
  player.userData.onGround = false
  sfx.jump()
}

function toggleGear5() {
  if (active !== 'luffy' && !characters.luffy.userData.gear5) {
    setStatus('Switch to Luffy for Gear 5')
    return
  }
  const next = !characters.luffy.userData.gear5
  setGear5(characters.luffy, next)
  bloomPass.strength = next ? 0.85 : 0.25
  renderer.toneMappingExposure = next ? 1.35 : 1.15
  sfx.gear()
  refreshActiveLabel()
  setStatus(next ? 'GEAR FIFTH!!!' : 'Gear 5 off')
  setTimeout(() => setStatus(''), 1200)
}

function updateBerries(t) {
  const player = getPlayer()
  for (const berry of berries) {
    // Respawn
    if (berry.userData.taken && berry.userData.respawnAt && t >= berry.userData.respawnAt) {
      berry.userData.taken = false
      berry.visible = true
      berry.position.x = berry.userData.homeX
      berry.position.z = berry.userData.homeZ
      berry.userData.respawnAt = 0
    }
    if (berry.userData.taken) continue
    berry.rotation.y = t * 2 + berry.userData.spin
    berry.position.y =
      groundY(berry.position.x, berry.position.z) +
      0.9 +
      Math.sin(t * 3 + berry.userData.spin) * 0.15

    if (!onShip && player.position.distanceTo(berry.position) < 1.4) {
      berry.userData.taken = true
      berry.visible = false
      berry.userData.respawnAt = t + 22 + Math.random() * 10
      berryCount++
      addBounty(25_000)
      refreshStats()
      sfx.berry()
      setStatus(`Berry +1  (total ${berryCount})`)
      setTimeout(() => setStatus(''), 700)
    }
  }
}

function updateBarrelRespawn(t) {
  for (const barrel of barrels) {
    if (
      !barrel.visible &&
      barrel.userData.respawnAt &&
      t >= barrel.userData.respawnAt
    ) {
      barrel.visible = true
      barrel.userData.hp = barrel.userData.maxHp
      barrel.scale.set(1, 1, 1)
      barrel.rotation.z = 0
      barrel.position.x = barrel.userData.homeX
      barrel.position.z = barrel.userData.homeZ
      barrel.position.y = groundY(barrel.userData.homeX, barrel.userData.homeZ) + 0.5
      barrel.userData.respawnAt = 0
    }
  }
  if (meat?.userData.taken && meat.userData.respawnAt && t >= meat.userData.respawnAt) {
    meat.userData.taken = false
    meat.visible = true
    meat.userData.respawnAt = 0
  }
}

function updateFruits(t) {
  const player = getPlayer()
  for (const fruit of fruits) {
    if (fruit.userData.taken) continue
    fruit.rotation.y = t * 1.5 + fruit.userData.spin
    fruit.position.y =
      groundY(fruit.position.x, fruit.position.z) +
      0.85 +
      Math.sin(t * 2.5 + fruit.userData.spin) * 0.12

    if (!onShip && player.position.distanceTo(fruit.position) < 1.6) {
      fruit.userData.taken = true
      fruit.visible = false
      fruitBuff = {
        buff: fruit.userData.buff,
        label: fruit.userData.label,
        until: t + 25,
      }
      // Devil Fruit users can't swim well — unless Jinbe
      if (active !== 'jinbe') {
        setStatus(`${fruit.userData.label}! Buff 25s — careful in water`)
      } else {
        setStatus(`${fruit.userData.label}! Buff 25s`)
      }
      sfx.fruit()
      refreshStats()
      setTimeout(() => setStatus(''), 2000)
    }
  }
  if (fruitBuff && t > fruitBuff.until) {
    fruitBuff = null
    refreshStats()
    setStatus('Devil Fruit power faded')
    setTimeout(() => setStatus(''), 1200)
  }
}

function updatePellet(delta) {
  if (!pellet.visible) return
  pellet.userData.t += delta
  const spd = pellet.userData.speed || 28
  pellet.position.addScaledVector(pellet.userData.dir, spd * delta)
  hitBarrels(pellet.position, aiming ? 1.6 : 1.2, aiming ? 3.2 : 2)
  if (pellet.userData.t > (pellet.userData.maxT || 0.9)) pellet.visible = false
}

function updateCannonBall(delta) {
  if (!cannonBall.userData.active) return
  cannonBall.userData.t += delta
  cannonBall.position.addScaledVector(cannonBall.userData.dir, 36 * delta)
  cannonBall.position.y -= 4 * delta * cannonBall.userData.t
  hitBarrels(cannonBall.position, 2.2, 4)
  if (cannonBall.userData.t > 1.4 || cannonBall.position.y < -2) {
    cannonBall.userData.active = false
    cannonBall.visible = false
  }
}

function updateAimZoom(delta) {
  aiming = !onShip && active === 'usopp' && !!keys.v
  const targetFov = aiming ? 28 : 58
  camera.fov += (targetFov - camera.fov) * Math.min(1, delta * 8)
  camera.updateProjectionMatrix()
  if (aiming && !statusLine.textContent) setStatus('Sniper aim — F to fire')
}

function updateLanterns(night) {
  const lights = ship.userData.lanternLights || []
  const intensity = night > 0.35 ? (night - 0.35) * 4.5 : 0
  for (const entry of lights) {
    entry.light.intensity = intensity
    if (entry.mesh?.material) {
      entry.mesh.material.emissiveIntensity = 0.35 + intensity * 0.4
    }
  }
}

// Mobile pad
const pad = createMobileGamepad({
  onAttack: () => doAttack(),
  onInteract: () => tryInteract(),
  onJump: () => tryJump(),
  onGear: () => toggleGear5(),
  onCycleChar: () => cycleCrew(1),
  onCall: () => callCrew(),
  onRun: (v) => {
    padRun = v
  },
})

// Input
window.addEventListener('keydown', (e) => {
  sfx.unlock()
  const k = e.key.toLowerCase()
  if (k in keys) keys[k] = true
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') keys.control = true
  if (e.repeat) return
  if (k === '1') setActive('luffy')
  if (k === '2') setActive('zoro')
  if (k === '3') setActive('nami')
  if (k === '4') setActive('usopp')
  if (k === '5') setActive('sanji')
  if (k === '6') setActive('chopper')
  if (k === '7') setActive('robin')
  if (k === '8') setActive('franky')
  if (k === '9') setActive('brook')
  if (k === '0') setActive('jinbe')
  if (k === ']' || k === '.') cycleCrew(1)
  if (k === '[' || k === ',') cycleCrew(-1)
  if (k === 'q') cycleCrew(-1)
  if (k === 'c') callCrew()
  if (k === 'b') {
    bloomEnabled = !bloomEnabled
    bloomPass.enabled = bloomEnabled
  }
  if (k === 'g') toggleGear5()
  if (k === 'e') tryInteract()
  if (k === 'h') recallShipHome()
  if (k === 'f') {
    e.preventDefault()
    doAttack()
  }
  if (k === ' ') {
    e.preventDefault()
    tryJump()
  }
})
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase()
  if (k in keys) keys[k] = false
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') keys.control = false
})
window.addEventListener('mousedown', (e) => {
  if (e.button === 2 && active === 'usopp') keys.v = true
})
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) keys.v = false
})
window.addEventListener('contextmenu', (e) => {
  if (active === 'usopp') e.preventDefault()
})

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  pad.showIfNeeded()
}
window.addEventListener('resize', onResize)

function updateShip(delta) {
  const data = ship.userData
  const mx = keys.w || pad.state.y > 0.3
  const ms = keys.s || pad.state.y < -0.3
  const ma = keys.a || pad.state.x < -0.3
  const md = keys.d || pad.state.x > 0.3

  if (mx) data.speed = Math.min(16, data.speed + 10 * delta)
  else if (ms) data.speed = Math.max(-7, data.speed - 10 * delta)
  else data.speed *= 1 - 1.5 * delta

  if (ma) ship.rotation.y += 1.05 * delta
  if (md) ship.rotation.y -= 1.05 * delta

  shipForward.set(Math.sin(ship.rotation.y), 0, Math.cos(ship.rotation.y))
  ship.position.addScaledVector(shipForward, data.speed * delta)

  ship.position.y = 0.2 + Math.sin(clock.elapsedTime * 1.4) * 0.08
  ship.rotation.z = Math.sin(clock.elapsedTime * 1.1) * 0.03
  ship.rotation.x = Math.sin(clock.elapsedTime * 0.9) * 0.02

  const r = Math.hypot(ship.position.x, ship.position.z)
  if (r > WORLD.sailRadius) {
    ship.position.multiplyScalar(WORLD.sailRadius / r)
    data.speed *= -0.35
  }

  const landUnder = groundY(ship.position.x, ship.position.z)
  if (landUnder > 0.6) {
    ship.position.addScaledVector(shipForward, -data.speed * delta * 1.5)
    data.speed *= -0.4
    setStatus('Too shallow — steer back to open water')
  }

  if (data.cannonCooldown > 0) data.cannonCooldown -= delta

  const t = clock.elapsedTime
  for (const id of aboard) {
    updateCharacterAnim(characters[id], false, false, t, {
      delta,
      swimming: false,
    })
  }

  ship.updateMatrixWorld(true)
  getPlayer().getWorldPosition(lookAt)
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

  // Mobile stick
  if (Math.hypot(pad.state.x, pad.state.y) > 0.15) {
    moveDir.addScaledVector(camForward, pad.state.y)
    moveDir.addScaledVector(camRight, pad.state.x)
  }

  const climbing = !!player.userData.climbing
  const cp = nearestClimb(player)
  // Hold W near climb point to ascend
  if (
    !player.userData.swimming &&
    cp &&
    (keys.w || pad.state.y > 0.4) &&
    player.position.y < cp.topY - 0.2
  ) {
    if (!climbing) setStatus('Climbing!')
    player.userData.climbing = true
    player.userData.onGround = false
    player.userData.velY = 0
    player.position.y += 3.2 * delta
    player.position.x += (cp.x - player.position.x) * 2 * delta
    player.position.z += (cp.z - player.position.z) * 2 * delta
    if (player.position.y >= cp.topY - 0.15) {
      player.position.y = cp.topY
      player.userData.climbing = false
      player.userData.onGround = true
      setStatus('Reached the top!')
      setTimeout(() => setStatus(''), 1000)
    }
  } else if (climbing && !cp) {
    player.userData.climbing = false
  }

  const moving = moveDir.lengthSq() > 1e-6 && !player.userData.climbing
  const swimming = !!player.userData.swimming
  const running =
    moving && (keys.shift || padRun || pad.state.run || pad.state.physRun) && !swimming
  let base = player.userData.moveSpeed ?? 4
  if (active === 'luffy' && characters.luffy.userData.gear5) base *= 1.35
  if (fruitBuff?.buff === 'speed') base *= 1.45
  if (swimming) {
    // Devil fruit weakness — except Jinbe
    base *= active === 'jinbe' ? 0.7 : fruitBuff ? 0.25 : 0.55
  }
  const speed = running ? base * 2.1 : base

  const busy =
    (player.userData.punchT ?? -1) >= 0 ||
    (player.userData.slashT ?? -1) >= 0 ||
    (player.userData.kickT ?? -1) >= 0 ||
    (player.userData.staffT ?? -1) >= 0 ||
    (player.userData.shotT ?? -1) >= 0

  if (moving && !busy && !player.userData.climbing) {
    moveDir.normalize()
    player.position.x += moveDir.x * speed * delta
    player.position.z += moveDir.z * speed * delta
    player.rotation.y = Math.atan2(moveDir.x, moveDir.z)
  }

  // Jump physics
  const wasSwim = player.userData.swimming
  if (!player.userData.climbing) {
    if (!player.userData.onGround) {
      player.userData.velY -= GRAVITY * delta
      player.position.y += player.userData.velY * delta
      const { land } = applyTerrainOrSwim(player, { airborne: true })
      const floor = land > SWIM_LAND_THRESHOLD ? land : WATER_SURFACE - 0.72
      if (player.position.y <= floor) {
        player.position.y = floor
        player.userData.velY = 0
        player.userData.onGround = true
        player.userData.swimming = land <= SWIM_LAND_THRESHOLD
        if (player.userData.swimming && !wasSwim) sfx.splash()
      }
    } else {
      const wantDive =
        keys.control &&
        (player.userData.swimming ||
          groundY(player.position.x, player.position.z) <= SWIM_LAND_THRESHOLD)
      applyTerrainOrSwim(player, { diving: wantDive && diveAir > 0.05 })
      if (player.userData.swimming && !wasSwim) sfx.splash()

      if (player.userData.diving) {
        diveAir = Math.max(0, diveAir - delta * 0.28)
        if (diveAir <= 0) {
          player.userData.diving = false
          applyTerrainOrSwim(player)
          setStatus('Out of breath!')
          setTimeout(() => setStatus(''), 900)
        } else if (!statusLine.textContent) {
          setStatus(`Diving… ${Math.round(diveAir * 100)}% air · Space to surface`)
        }
      } else if (player.userData.swimming) {
        diveAir = Math.min(1, diveAir + delta * 0.35)
      } else {
        diveAir = 1
      }
    }
  }

  bubbles.setDiving(!!player.userData.diving, player.position)

  updateCharacterAnim(player, moving, running, t, {
    delta,
    swimming: player.userData.swimming,
    climbing: player.userData.climbing,
  })

  lookAt
    .copy(player.position)
    .add(
      new THREE.Vector3(
        0,
        player.userData.diving ? 0.4 : swimming ? 0.9 : 1.4,
        0,
      ),
    )
  controls.target.lerp(lookAt, 1 - Math.exp(-8 * delta))
}

function updateIdleCrew(delta, t) {
  const player = getPlayer()
  let stillGathering = false

  for (const id of CREW_ORDER) {
    if (id === active) continue
    if (aboard.has(id)) continue
    const buddy = characters[id]

    // Gathering — run to the active player
    if (buddy.userData.gathering || gathering) {
      buddy.userData.gathering = true
      tmp.copy(player.position).sub(buddy.position)
      tmp.y = 0
      const dist = tmp.length()
      if (dist < 2.2) {
        buddy.userData.gathering = false
        buddy.userData.idleTarget = null
        buddy.userData.idleWait = 2 + Math.random() * 2
        applyTerrainOrSwim(buddy)
        updateCharacterAnim(buddy, false, false, t, {
          delta,
          swimming: buddy.userData.swimming,
        })
        continue
      }
      stillGathering = true
      tmp.normalize()
      const speed = buddy.userData.swimming ? 4.5 : 9
      buddy.position.x += tmp.x * speed * delta
      buddy.position.z += tmp.z * speed * delta
      buddy.rotation.y = Math.atan2(tmp.x, tmp.z)
      applyTerrainOrSwim(buddy)
      updateCharacterAnim(buddy, true, !buddy.userData.swimming, t, {
        delta,
        swimming: buddy.userData.swimming,
      })
      continue
    }

    // Zoro lost wander
    if (buddy.userData.kind === 'zoro') {
      if (!buddy.userData.lost && Math.random() < 0.0006 * (delta * 60)) {
        buddy.userData.lost = true
        buddy.userData.lostUntil = t + 5 + Math.random() * 6
        const a = Math.random() * Math.PI * 2
        buddy.userData.lostDir.set(Math.cos(a), 0, Math.sin(a))
        refreshActiveLabel()
        setStatus('Zoro wandered off…')
        setTimeout(() => setStatus(''), 1400)
      }
      if (buddy.userData.lost && t > buddy.userData.lostUntil) {
        buddy.userData.lost = false
        refreshActiveLabel()
      }
      if (buddy.userData.lost) {
        buddy.position.x += buddy.userData.lostDir.x * 2.8 * delta
        buddy.position.z += buddy.userData.lostDir.z * 2.8 * delta
        buddy.rotation.y = Math.atan2(
          buddy.userData.lostDir.x,
          buddy.userData.lostDir.z,
        )
        applyTerrainOrSwim(buddy)
        updateCharacterAnim(buddy, true, false, t, {
          delta,
          swimming: buddy.userData.swimming,
        })
        continue
      }
    }

    // Do their own thing — short idle walks around their spot
    let moving = false
    if (buddy.userData.idleWait > 0) {
      buddy.userData.idleWait -= delta
      if (buddy.userData.idleWait <= 0) {
        buddy.userData.idleTarget = pickIdleTarget(buddy)
        if (!buddy.userData.idleTarget) buddy.userData.idleWait = 2
      }
    } else if (buddy.userData.idleTarget) {
      tmp.copy(buddy.userData.idleTarget).sub(buddy.position)
      tmp.y = 0
      const dist = tmp.length()
      if (dist < 0.6) {
        buddy.userData.idleTarget = null
        buddy.userData.idleWait = 2 + Math.random() * 5
      } else {
        moving = true
        tmp.normalize()
        const speed = 1.6
        buddy.position.x += tmp.x * speed * delta
        buddy.position.z += tmp.z * speed * delta
        buddy.rotation.y = Math.atan2(tmp.x, tmp.z)
      }
    }

    applyTerrainOrSwim(buddy)
    updateCharacterAnim(buddy, moving, false, t, {
      delta,
      swimming: buddy.userData.swimming,
    })
  }

  if (gathering && !stillGathering) {
    gathering = false
    setStatus('Crew assembled!')
    setTimeout(() => setStatus(''), 1200)
  }
}

function updateSlashVfx(delta) {
  if (!slashVfx.visible) return
  slashVfx.userData.t = (slashVfx.userData.t || 0) + delta
  const t = slashVfx.userData.t
  slashVfx.scale.setScalar(1 + t * 4)
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

  pad.pollPhysical()

  const { night } = dayNight.update(t)
  if (!characters.luffy.userData.gear5) {
    renderer.toneMappingExposure = exposureRef.current
  }
  updateLanterns(night)
  weather.update(delta)
  bubbles.update(delta, getPlayer().position)
  updateAimZoom(delta)
  updateBarrelRespawn(t)
  updateCannonBall(delta)

  if (cookBuff && t > cookBuff.until) {
    cookBuff = null
    refreshStats()
    setStatus('Feast buff faded')
    setTimeout(() => setStatus(''), 1000)
  }

  if (onShip) updateShip(delta)
  else {
    updatePlayer(delta, t)
    updateIdleCrew(delta, t)
    updateBerries(t)
    updateFruits(t)
    updatePellet(delta)

    if (nearShip(getPlayer())) {
      if (!boardHintShown) {
        setStatus('Press E to board Going Merry')
        boardHintShown = true
      }
    } else {
      boardHintShown = false
    }

    for (const chest of chests) {
      if (chest.userData.opened) continue
      if (getPlayer().position.distanceTo(chest.position) < 2.4) {
        if (!statusLine.textContent) setStatus('Press E to open treasure chest')
        break
      }
    }

    if (
      meat &&
      !meat.userData.taken &&
      getPlayer().position.distanceTo(meat.position) < 2
    ) {
      if (!statusLine.textContent) setStatus('Press E to eat meat (+HP)')
    }

    if (
      cookStation &&
      getPlayer().position.distanceTo(cookStation.position) < 2.8
    ) {
      if (!statusLine.textContent) {
        setStatus(
          active === 'sanji'
            ? 'E: cook All Blue feast (5 Berries)'
            : 'E: cook at Sanji’s station (3 Berries)',
        )
      }
    }

    const cp = nearestClimb(getPlayer())
    if (cp && getPlayer().position.y < cp.topY - 0.5 && !getPlayer().userData.climbing) {
      if (!statusLine.textContent) setStatus('Hold W near structure to climb')
    }
  }

  updateSlashVfx(delta)

  if (characters.luffy.userData.gear5) {
    characters.luffy.getWorldPosition(tmp)
    gearLight.position.copy(tmp).add(new THREE.Vector3(0, 2, 0))
    gearLight.intensity = 2.2 + Math.sin(t * 8) * 0.6
  } else gearLight.intensity = 0

  // Water tint: darker when diving / night
  const dive = getPlayer().userData.diving
  water.material.opacity = dive ? 0.95 : 0.84 + Math.sin(t * 0.7) * 0.04
  water.material.color.setHex(dive ? 0x0a3a55 : night > 0.5 ? 0x1565a0 : 0x1e90c8)

  if (campFlame) {
    campFlame.scale.y = 0.9 + Math.sin(t * 9) * 0.15
    campFlame.rotation.y = t * 2
  }
  if (cookStation?.userData.flame) {
    cookStation.userData.flame.scale.y = 0.9 + Math.sin(t * 11) * 0.2
  }
  for (const c of clouds) {
    c.position.x += Math.sin(t * 0.04 + c.position.z * 0.01) * 0.003
  }
  flagPole.children[1].rotation.y = Math.sin(t * 2) * 0.15
  if (ship.userData.sail) {
    ship.userData.sail.rotation.y = Math.sin(t * 1.3) * 0.04
    ship.userData.sail.scale.x = 1 + Math.sin(t * 1.6) * 0.02
  }
  if (ship.userData.topSail) {
    ship.userData.topSail.rotation.y = Math.sin(t * 1.5 + 1) * 0.05
  }
  if (ship.userData.wheel) {
    ship.userData.wheel.rotation.z = Math.sin(t * 0.4) * 0.15
  }

  controls.update()
  if (bloomEnabled) composer.render()
  else renderer.render(scene, camera)
}

refreshStats()
refreshCrewStrip()
animate()
