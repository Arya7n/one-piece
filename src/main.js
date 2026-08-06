import './style.css'
import * as THREE from 'three'
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
  BOSS_ISLAND,
  setBossIslandUnlocked,
} from './world.js'
import {
  createWeatherSystem,
  createDayNight,
  createBubbleSystem,
  createCannonBall,
} from './systems.js'
import { createQuestSystem } from './gameui.js'
import { createOceanWater, sampleWaveHeight } from './water.js'
import { sfx } from './audio.js'
import { createMobileGamepad } from './gamepad.js'
import { createIntro, syncOrbitFromCamera } from './intro.js'

const canvas = document.querySelector('#canvas')

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
  v: false,
  control: false,
  space: false,
}

let active = 'luffy'
/** Free camera — no character control */
let spectating = false
const spectateFocus = new THREE.Vector3()
/** Optional crew id to orbit while spectating (null = free fly) */
let spectateFollowId = null
let bloomEnabled = false
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
/** After air runs out, block re-dive until Ctrl is released and air recovers */
let diveExhausted = false
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
const smoothLookAt = new THREE.Vector3()
const followTarget = new THREE.Vector3()
const shipForward = new THREE.Vector3()
const tmp = new THREE.Vector3()
const attackOrigin = new THREE.Vector3()
const desiredCam = new THREE.Vector3()
const playerVel = new THREE.Vector3()
const spectateVel = new THREE.Vector3()
let shipTurnVel = 0
let moveFacing = 0
let moveFacingInit = false
/** Soft camera look-height (avoids dive/surface pop) */
let camLookH = 1.4

// Third-person follow camera (mouse drag orbits; locked behind target)
let camYaw = Math.PI
let camPitch = 0.38
let camDist = 9
let camDragging = false
let camLastX = 0
let camLastY = 0
/** Active canvas pointers for orbit + pinch-zoom */
const camPointers = new Map()
let pinchStartDist = 0
let pinchStartCamDist = 9
let pinching = false

/** Opening fly-through tour (skippable) */
let intro = null

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
bloomPass.enabled = bloomEnabled

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
  bossBarrier,
  seaKing,
} = world

const ocean = createOceanWater()
scene.add(ocean.mesh)
const sunDir = new THREE.Vector3()

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

const bossShockwave = new THREE.Mesh(
  new THREE.RingGeometry(0.8, 1.15, 40),
  new THREE.MeshBasicMaterial({
    color: 0xffd180,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  }),
)
bossShockwave.rotation.x = -Math.PI / 2
bossShockwave.visible = false
bossShockwave.userData = { t: 0, active: false, didHit: false, radius: 0 }
scene.add(bossShockwave)

const bossBreath = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 1.05, 1, 14, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0x8be9ff,
    transparent: true,
    opacity: 0,
  }),
)
bossBreath.visible = false
bossBreath.userData = { t: 0, active: false, didHit: false, len: 0, dir: new THREE.Vector3() }
scene.add(bossBreath)

// HUD — slim bar always visible; full info panel toggles open/closed
const hudRoot = document.createElement('div')
hudRoot.id = 'hud-root'
hudRoot.innerHTML = `
  <div id="hud-bar">
    <em id="active-char">Playing: Luffy</em>
    <span id="berry-count-mini">Berry: 0</span>
    <span id="hp-count-mini">HP: 100</span>
    <span id="dive-air-mini" hidden>Dive: 100%</span>
    <button type="button" id="hud-spectate" title="Spectator mode (P)">Spec</button>
    <button type="button" id="hud-open" aria-expanded="false" aria-controls="hud-hint">Info</button>
    <em id="status-line"></em>
  </div>
  <div id="hud-hint" class="hud-closed" hidden>
    <div class="hud-panel-head">
      <strong>Grand Line Archipelago</strong>
      <button type="button" id="hud-close" aria-label="Close info">×</button>
    </div>
    <span>WASD · Drag look · Pinch/Scroll zoom · Space jump · F attack · V aim · Ctrl dive · C call · E interact · H recall · P spectator</span>
    <em id="quest-hint-line">Quest: open 3 chests to unlock Boss Island</em>
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

const bossHud = document.createElement('div')
bossHud.id = 'boss-hud'
bossHud.innerHTML = `
  <strong>Kaido</strong>
  <div id="boss-bar"><span id="boss-bar-fill"></span></div>
`
document.body.appendChild(bossHud)
const bossBarFill = bossHud.querySelector('#boss-bar-fill')

const hitFlashEl = document.createElement('div')
hitFlashEl.id = 'hit-flash'
document.body.appendChild(hitFlashEl)

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

const quest = createQuestSystem({
  onUnlockBoss() {
    setBossIslandUnlocked(true)
    if (bossBarrier) bossBarrier.visible = false
    if (seaKing) {
      seaKing.visible = true
      seaKing.userData.alive = true
      seaKing.userData.hp = seaKing.userData.maxHp
      seaKing.userData.phase = 'idle'
      seaKing.userData.cooldown = 1.8
      refreshBossHud()
    }
    sfx.gear()
    setStatus('BOSS ISLAND UNLOCKED — sail southwest!')
    setTimeout(() => setStatus(''), 2800)
    addBounty(2_000_000, 'World Government noticed…')
  },
  onBossDefeated() {
    addBounty(10_000_000, 'Kaido defeated!')
    setStatus('You cleared Boss Island!')
    refreshBossHud()
    setTimeout(() => setStatus(''), 2500)
  },
})

const hint = hudRoot.querySelector('#hud-hint')
const hudOpenBtn = hudRoot.querySelector('#hud-open')
const hudSpectateBtn = hudRoot.querySelector('#hud-spectate')
const hudCloseBtn = hudRoot.querySelector('#hud-close')
const activeLabel = hudRoot.querySelector('#active-char')
const activeLabelPanel = hudRoot.querySelector('#active-char-panel')
const statusLine = hudRoot.querySelector('#status-line')
const diveAirMini = hudRoot.querySelector('#dive-air-mini')
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
hudSpectateBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  toggleSpectator()
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
  if (getPlayer()?.userData?.diving && !text) return
  statusLine.textContent = text || ''
}

let lastDiveHud = ''
function refreshDiveHud() {
  const player = getPlayer()
  if (!diveAirMini) return
  const inWater = !!player?.userData?.swimming || !!player?.userData?.diving
  // Keep chip mounted in water so HUD layout doesn't reflow/flicker
  const pct = Math.round(diveAir * 100)
  const label = diveExhausted
    ? `Air: ${pct}% (rest)`
    : player?.userData?.diving
      ? `Dive: ${pct}%`
      : inWater
        ? `Air: ${pct}%`
        : ''
  if (label === lastDiveHud) return
  lastDiveHud = label
  diveAirMini.hidden = !label
  if (label) diveAirMini.textContent = label
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

function refreshBossHud() {
  const activeBoss = seaKing?.visible && seaKing.userData.alive
  bossHud.classList.toggle('boss-hud-visible', !!activeBoss)
  if (!activeBoss) return
  const pct = THREE.MathUtils.clamp(seaKing.userData.hp / seaKing.userData.maxHp, 0, 1)
  bossBarFill.style.width = `${pct * 100}%`
  bossHud.classList.toggle('boss-phase-rage', pct < 0.45)
}

function damagePlayer(amount, reason = 'Kaido strikes!', from = null) {
  if (spectating || intro?.isActive) return false
  const player = getPlayer()
  if (player.userData.damageLock > 0) return false
  player.userData.damageLock = 0.95
  playerHp = Math.max(0, playerHp - amount)
  refreshStats()
  hitFlashEl.classList.remove('hit-flash-on')
  void hitFlashEl.offsetWidth
  hitFlashEl.classList.add('hit-flash-on')
  if (from) {
    tmp.copy(player.position).sub(from)
    tmp.y = 0
    if (tmp.lengthSq() < 0.01) tmp.set(0, 0, 1)
    tmp.normalize()
    player.position.addScaledVector(tmp, 2.1)
    player.userData.velY = Math.max(player.userData.velY || 0, 3.8)
    player.userData.onGround = false
    playerVel.addScaledVector(tmp, 8)
  }
  setStatus(reason)
  setTimeout(() => setStatus(''), 900)
  if (playerHp <= 0) {
    const home = ship.userData.home
    playerHp = 100
    player.position.set(home.x - 5, groundY(home.x - 5, home.z), home.z + 3)
    playerVel.set(0, 0, 0)
    player.userData.velY = 0
    player.userData.onGround = true
    player.userData.swimming = false
    refreshStats()
    setStatus('Kaido crushed you... Respawned at the pier')
    setTimeout(() => setStatus(''), 1800)
  }
  return true
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
  `<button type="button" class="crew-chip crew-call" id="call-crew" title="Call all crew (C)">📣 Call</button>` +
  `<button type="button" class="crew-chip crew-spec" id="crew-spectate" title="Spectator (P)">👁 Spec</button>`
crewStrip.addEventListener('click', (e) => {
  const call = e.target.closest('#call-crew')
  if (call) {
    callCrew()
    return
  }
  if (e.target.closest('#crew-spectate')) {
    toggleSpectator()
    return
  }
  const btn = e.target.closest('[data-id]')
  if (btn) {
    if (spectating) {
      // Focus that crewmate in spectator (don't take control)
      spectateFollowId = btn.dataset.id
      characters[spectateFollowId].getWorldPosition(spectateFocus)
      refreshActiveLabel()
      refreshCrewStrip()
      setStatus(`Watching ${characters[spectateFollowId].userData.displayName} · P exit · WASD free fly`)
      setTimeout(() => setStatus(''), 1600)
      return
    }
    setActive(btn.dataset.id)
  }
})

const slashVfx = createSlashVfx()
scene.add(slashVfx)
const pellet = createPelletVfx()
scene.add(pellet)

function setActive(name) {
  if (spectating) exitSpectator()
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
  playerVel.set(0, 0, 0)
  moveFacing = characters[name].rotation.y
  moveFacingInit = true
  // Keep orbit yaw; camera already sits behind look direction
  sfx.switch()
  refreshActiveLabel()
  refreshCrewStrip()
}

function enterSpectator() {
  spectating = true
  spectateFollowId = null
  aiming = false
  keys.v = false
  if (onShip) {
    getPlayer().getWorldPosition(spectateFocus)
  } else {
    spectateFocus.copy(getPlayer().position)
  }
  camDist = THREE.MathUtils.clamp(Math.max(camDist, 14), 4, 48)
  camPitch = THREE.MathUtils.clamp(camPitch, 0.12, 1.35)
  document.body.classList.add('spectating')
  sfx.switch()
  refreshActiveLabel()
  refreshCrewStrip()
  setStatus('Spectator — drag look · pinch zoom · WASD fly · [/] watch crew · P play')
  setTimeout(() => setStatus(''), 2800)
}

function exitSpectator() {
  if (!spectating) return
  spectating = false
  spectateFollowId = null
  camDist = THREE.MathUtils.clamp(camDist, 4, 22)
  document.body.classList.remove('spectating')
  refreshActiveLabel()
  refreshCrewStrip()
}

function toggleSpectator() {
  if (spectating) {
    exitSpectator()
    setStatus(`Back to ${characters[active].userData.displayName}`)
    setTimeout(() => setStatus(''), 1200)
  } else {
    enterSpectator()
  }
}

function cycleCrew(dir = 1) {
  if (spectating) {
    const list = CREW_ORDER
    const cur = spectateFollowId ? list.indexOf(spectateFollowId) : -1
    const idx =
      cur < 0
        ? dir > 0
          ? 0
          : list.length - 1
        : (cur + dir + list.length) % list.length
    spectateFollowId = list[idx]
    characters[spectateFollowId].getWorldPosition(spectateFocus)
    refreshActiveLabel()
    refreshCrewStrip()
    setStatus(`Watching ${characters[spectateFollowId].userData.displayName}`)
    setTimeout(() => setStatus(''), 1200)
    return
  }
  if (onShip) return
  const i = CREW_ORDER.indexOf(active)
  const next = CREW_ORDER[(i + dir + CREW_ORDER.length) % CREW_ORDER.length]
  setActive(next)
}

function refreshCrewStrip() {
  crewStrip.querySelectorAll('.crew-chip').forEach((el) => {
    const id = el.dataset.id
    if (!id) {
      el.classList.toggle('crew-active', el.id === 'crew-spectate' && spectating)
      return
    }
    const focused = spectating
      ? id === spectateFollowId
      : id === active
    el.classList.toggle('crew-active', focused)
  })
}

function refreshActiveLabel() {
  if (spectating) {
    const who = spectateFollowId
      ? characters[spectateFollowId].userData.displayName
      : 'free cam'
    const text = `Spectator · ${who}`
    activeLabel.textContent = text
    if (activeLabelPanel) activeLabelPanel.textContent = text
    return
  }
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
  if (spectating) {
    setStatus('Exit spectator (P) to call the crew')
    setTimeout(() => setStatus(''), 1200)
    return
  }
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
  if (spectating) return
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
  if (spectating) return
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
      const unlocked = quest.onChestOpened(chestsOpened)
      if (!unlocked) {
        setStatus(`Treasure! +5 Berry (${chestsOpened}/3 quest)`)
        setTimeout(() => setStatus(''), 1500)
      }
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
  // Kaido boss
  if (
    seaKing?.visible &&
    seaKing.userData.alive &&
    origin.distanceTo(seaKing.position) < range + 2.5
  ) {
    if (seaKing.userData.invuln > 0) return hit
    seaKing.userData.hp -= dmg
    seaKing.rotation.y += 0.12
    seaKing.userData.hitFlash = 0.2
    seaKing.userData.invuln = 0.08
    hit = true
    refreshBossHud()
    setStatus(`Kaido HP ${Math.max(0, Math.ceil(seaKing.userData.hp))}`)
    if (seaKing.userData.hp <= 0) {
      seaKing.userData.alive = false
      seaKing.userData.phase = 'downed'
      berryCount += 25
      refreshStats()
      refreshBossHud()
      sfx.smash()
      quest.onBossDefeated()
    }
  }
  return hit
}

function enforceBossLock(obj) {
  if (quest.bossUnlocked) return
  const dx = obj.position.x - BOSS_ISLAND.x
  const dz = obj.position.z - BOSS_ISLAND.z
  const dist = Math.hypot(dx, dz)
  const limit = BOSS_ISLAND.r + 4
  if (dist < limit) {
    const s = limit / (dist || 0.01)
    obj.position.x = BOSS_ISLAND.x + dx * s
    obj.position.z = BOSS_ISLAND.z + dz * s
    if (obj === getPlayer() && !statusLine.textContent) {
      setStatus('Boss Island sealed — open 3 chests first')
    }
  }
}

function shortestAngle(from, to) {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

/** Third-person follow with soft position + look smoothing. */
function updateFollowCamera(target, delta, lookHeight = 1.4) {
  const cosP = Math.cos(camPitch)
  desiredCam.set(
    target.x + Math.sin(camYaw) * camDist * cosP,
    target.y + Math.sin(camPitch) * camDist + 1.2,
    target.z + Math.cos(camYaw) * camDist * cosP,
  )
  camera.position.lerp(desiredCam, 1 - Math.exp(-8 * delta))
  lookAt.set(target.x, target.y + lookHeight, target.z)
  smoothLookAt.lerp(lookAt, 1 - Math.exp(-10 * delta))
  camera.lookAt(smoothLookAt)
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
  if (spectating) return
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
  if (spectating || onShip) return
  const player = getPlayer()
  if (player.userData.diving) {
    // Surface from dive
    player.userData.diving = false
    diveAir = Math.min(1, diveAir + 0.3)
    if (diveAir >= 0.4) diveExhausted = false
    sfx.splash()
    refreshDiveHud()
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
  if (spectating) return
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
  onInteract: () => {
    if (spectating) {
      spectateFocus.y -= 2.5
      return
    }
    tryInteract()
  },
  onJump: () => {
    if (spectating) {
      spectateFocus.y += 2.5
      return
    }
    tryJump()
  },
  onGear: () => toggleGear5(),
  onCycleChar: () => cycleCrew(1),
  onCall: () => callCrew(),
  onSpectate: () => toggleSpectator(),
  onRun: (v) => {
    padRun = v
  },
})

// Input
window.addEventListener('keydown', (e) => {
  if (intro?.isActive) return

  const isCtrl =
    e.ctrlKey ||
    e.metaKey ||
    e.code === 'ControlLeft' ||
    e.code === 'ControlRight' ||
    e.code === 'MetaLeft' ||
    e.code === 'MetaRight'

  // Block browser shortcuts (zoom, bookmarks, find, refresh…) so they don't fight the game UI
  if (isCtrl) e.preventDefault()

  sfx.unlock()

  // Movement / dive flags — allow WASD while diving with Ctrl held
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
    keys.control = true
    return
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true
  if (e.code === 'Space') keys.space = true

  const k = e.key.toLowerCase()
  if (k === 'control' || k === 'meta' || k === 'alt') return

  // Always track move keys, even during Ctrl-dive
  if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'v') {
    keys[k] = true
  }

  // Block Ctrl/Cmd chords from firing game actions (bloom, crew switch, etc.)
  // that were making the HUD/scene flicker
  if (e.ctrlKey || e.metaKey) return

  if (e.repeat) return

  if (k === 'p') {
    toggleSpectator()
    return
  }
  if (spectating) {
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
    if (k === '[' || k === ',' || k === 'q') cycleCrew(-1)
    if (e.code === 'Space') e.preventDefault()
    return
  }
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
  if (e.ctrlKey || e.metaKey) e.preventDefault()
  const k = e.key.toLowerCase()
  if (k === 'control' || k === 'meta') {
    keys.control = false
    return
  }
  if (k in keys) keys[k] = false
  if (e.code === 'Space') keys.space = false
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') keys.control = false
})
// Stop Ctrl+wheel browser zoom from resizing the page and breaking the HUD
window.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault()
  },
  { passive: false },
)
window.addEventListener('mousedown', (e) => {
  if (e.button === 2 && active === 'usopp') keys.v = true
})
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) keys.v = false
})
window.addEventListener('contextmenu', (e) => {
  if (active === 'usopp') e.preventDefault()
})

function camPointerDist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function endCamPointer(e) {
  camPointers.delete(e.pointerId)
  if (camPointers.size < 2) {
    pinching = false
    pinchStartDist = 0
  }
  if (camPointers.size === 1) {
    const only = camPointers.values().next().value
    camDragging = true
    camLastX = only.x
    camLastY = only.y
  } else if (camPointers.size === 0) {
    camDragging = false
  }
}

// Third-person look + pinch zoom on canvas
canvas.addEventListener('pointerdown', (e) => {
  if (intro?.isActive) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (e.target !== canvas) return
  camPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  try {
    canvas.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  if (camPointers.size >= 2) {
    camDragging = false
    pinching = true
    const pts = [...camPointers.values()]
    pinchStartDist = camPointerDist(pts[0], pts[1])
    pinchStartCamDist = camDist
  } else {
    camDragging = true
    camLastX = e.clientX
    camLastY = e.clientY
  }
})
canvas.addEventListener('pointermove', (e) => {
  if (!camPointers.has(e.pointerId)) return
  camPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (camPointers.size >= 2) {
    const pts = [...camPointers.values()]
    const dist = camPointerDist(pts[0], pts[1])
    if (!pinching || pinchStartDist < 8) {
      pinching = true
      pinchStartDist = dist
      pinchStartCamDist = camDist
      return
    }
    // Pinch out → zoom in (closer); pinch in → zoom out
    const scale = pinchStartDist / Math.max(12, dist)
    const maxD = spectating ? 48 : 22
    camDist = THREE.MathUtils.clamp(pinchStartCamDist * scale, 4, maxD)
    return
  }

  if (!camDragging || pinching) return
  const dx = e.clientX - camLastX
  const dy = e.clientY - camLastY
  camLastX = e.clientX
  camLastY = e.clientY
  const sens = aiming ? 0.0016 : 0.0035
  camYaw -= dx * sens
  camPitch += dy * sens
  camPitch = THREE.MathUtils.clamp(camPitch, 0.08, 1.25)
})
canvas.addEventListener('pointerup', endCamPointer)
canvas.addEventListener('pointercancel', endCamPointer)
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    const maxD = spectating ? 48 : 22
    camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.01, 4, maxD)
  },
  { passive: false },
)
// Prevent browser page-zoom stealing the pinch on the game canvas
canvas.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length >= 2) e.preventDefault()
  },
  { passive: false },
)
canvas.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length >= 2) e.preventDefault()
  },
  { passive: false },
)

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  pad.showIfNeeded()
}
window.addEventListener('resize', onResize)

function updateSpectator(delta) {
  // Orbit a watched crewmate, or free-fly the look pivot
  if (spectateFollowId && characters[spectateFollowId]) {
    characters[spectateFollowId].getWorldPosition(tmp)
    spectateFocus.lerp(tmp, 1 - Math.exp(-5 * delta))
  }

  camForward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw))
  camRight.set(Math.cos(camYaw), 0, -Math.sin(camYaw))
  moveDir.set(0, 0, 0)
  if (keys.w) moveDir.add(camForward)
  if (keys.s) moveDir.sub(camForward)
  if (keys.a) moveDir.sub(camRight)
  if (keys.d) moveDir.add(camRight)
  if (Math.hypot(pad.state.x, pad.state.y) > 0.15) {
    moveDir.addScaledVector(camForward, pad.state.y)
    moveDir.addScaledVector(camRight, pad.state.x)
  }

  const fast = keys.shift || padRun || pad.state.run || pad.state.physRun
  const maxSpeed = fast ? 28 : 14
  const accel = 22

  if (moveDir.lengthSq() > 1e-6) {
    moveDir.normalize()
    spectateVel.x += moveDir.x * accel * delta
    spectateVel.z += moveDir.z * accel * delta
    if (spectateFollowId) {
      spectateFollowId = null
      refreshActiveLabel()
      refreshCrewStrip()
    }
  } else {
    spectateVel.x *= Math.exp(-5 * delta)
    spectateVel.z *= Math.exp(-5 * delta)
  }

  const hSpeed = Math.hypot(spectateVel.x, spectateVel.z)
  if (hSpeed > maxSpeed) {
    const s = maxSpeed / hSpeed
    spectateVel.x *= s
    spectateVel.z *= s
  }

  spectateFocus.x += spectateVel.x * delta
  spectateFocus.z += spectateVel.z * delta

  if (keys.space) spectateFocus.y += maxSpeed * 0.7 * delta
  if (keys.control) spectateFocus.y -= maxSpeed * 0.7 * delta

  // Soft world bounds
  const r = Math.hypot(spectateFocus.x, spectateFocus.z)
  if (r > WORLD.sailRadius + 20) {
    const s = (WORLD.sailRadius + 20) / r
    spectateFocus.x *= s
    spectateFocus.z *= s
  }
  spectateFocus.y = THREE.MathUtils.clamp(spectateFocus.y, -4, 40)

  updateFollowCamera(spectateFocus, delta, 0.2)
}

function updateShip(delta) {
  const data = ship.userData
  const t = clock.elapsedTime
  const mx = keys.w || pad.state.y > 0.3
  const ms = keys.s || pad.state.y < -0.3
  const ma = keys.a || pad.state.x < -0.3
  const md = keys.d || pad.state.x > 0.3

  const targetSpeed = mx ? 15 : ms ? -6.5 : 0
  data.speed += (targetSpeed - data.speed) * (1 - Math.exp(-(mx || ms ? 2.2 : 3.5) * delta))

  const turnTarget = (ma ? 1 : 0) + (md ? -1 : 0)
  shipTurnVel += (turnTarget * 1.05 - shipTurnVel) * (1 - Math.exp(-6 * delta))
  ship.rotation.y += shipTurnVel * delta

  // Merry's bow is local -Z (stern is +Z), so sail along -Z
  shipForward.set(-Math.sin(ship.rotation.y), 0, -Math.cos(ship.rotation.y))
  ship.position.addScaledVector(shipForward, data.speed * delta)

  const waveY = sampleWaveHeight(ship.position.x, ship.position.z, t)
  const waveYaw = sampleWaveHeight(ship.position.x + 1.2, ship.position.z, t)
  const waveRoll = sampleWaveHeight(ship.position.x, ship.position.z + 1.2, t)
  ship.position.y = 0.18 + waveY * 0.85
  ship.rotation.z = THREE.MathUtils.lerp(
    ship.rotation.z,
    (waveRoll - waveY) * 0.35 + Math.sin(t * 0.9) * 0.015,
    1 - Math.exp(-4 * delta),
  )
  ship.rotation.x = THREE.MathUtils.lerp(
    ship.rotation.x,
    (waveYaw - waveY) * 0.28 + Math.sin(t * 0.7) * 0.012,
    1 - Math.exp(-4 * delta),
  )

  const r = Math.hypot(ship.position.x, ship.position.z)
  if (r > WORLD.sailRadius) {
    ship.position.x *= WORLD.sailRadius / r
    ship.position.z *= WORLD.sailRadius / r
    data.speed *= -0.35
  }

  const landUnder = groundY(ship.position.x, ship.position.z)
  if (landUnder > 0.6) {
    ship.position.addScaledVector(shipForward, -data.speed * delta * 1.5)
    data.speed *= -0.4
    setStatus('Too shallow — steer back to open water')
  }

  if (data.cannonCooldown > 0) data.cannonCooldown -= delta

  for (const id of aboard) {
    updateCharacterAnim(characters[id], false, false, t, {
      delta,
      swimming: false,
    })
  }

  ship.updateMatrixWorld(true)
  enforceBossLock(ship)
  getPlayer().getWorldPosition(tmp)
  updateFollowCamera(tmp, delta, 1.6)
}

function updatePlayer(delta, t) {
  const player = getPlayer()
  player.userData.damageLock = Math.max(0, (player.userData.damageLock || 0) - delta)
  moveDir.set(0, 0, 0)
  // Use orbit yaw (not live camera matrix) so move never feeds camera spin
  camForward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw))
  camRight.set(Math.cos(camYaw), 0, -Math.sin(camYaw))

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
  const maxSpeed = running ? base * 2.1 : base

  const busy =
    (player.userData.punchT ?? -1) >= 0 ||
    (player.userData.slashT ?? -1) >= 0 ||
    (player.userData.kickT ?? -1) >= 0 ||
    (player.userData.staffT ?? -1) >= 0 ||
    (player.userData.shotT ?? -1) >= 0

  if (moving && !busy && !player.userData.climbing) {
    moveDir.normalize()
    const accel = running ? 28 : 18
    playerVel.x += moveDir.x * accel * delta
    playerVel.z += moveDir.z * accel * delta
    const targetYaw = Math.atan2(moveDir.x, moveDir.z)
    if (!moveFacingInit) {
      moveFacing = targetYaw
      moveFacingInit = true
    }
    moveFacing += shortestAngle(moveFacing, targetYaw) * (1 - Math.exp(-12 * delta))
    player.rotation.y = moveFacing
  } else {
    const damp = swimming ? 4.5 : 10
    playerVel.x *= Math.exp(-damp * delta)
    playerVel.z *= Math.exp(-damp * delta)
  }

  const spd = Math.hypot(playerVel.x, playerVel.z)
  if (spd > maxSpeed) {
    const s = maxSpeed / spd
    playerVel.x *= s
    playerVel.z *= s
  }

  if (!busy && !player.userData.climbing && spd > 0.02) {
    player.position.x += playerVel.x * delta
    player.position.z += playerVel.z * delta
  }

  const actuallyMoving = spd > 0.35 && !player.userData.climbing
  enforceBossLock(player)

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
      // Start dive needs air; once underwater, stay down until Ctrl release or 0%
      // (old diveAir > 0.12 check caused surface↔dive flicker near empty)
      const startDive =
        keys.control &&
        !!player.userData.swimming &&
        !player.userData.diving &&
        !diveExhausted &&
        diveAir >= 0.25
      const keepDive =
        !!player.userData.diving && keys.control && diveAir > 0 && !diveExhausted
      const wantDive = startDive || keepDive
      applyTerrainOrSwim(player, { diving: wantDive })
      if (player.userData.swimming && !wasSwim) sfx.splash()

      if (player.userData.diving) {
        // ~12s full tank (was ~3.5s)
        diveAir = Math.max(0, diveAir - delta * 0.085)
        if (diveAir <= 0) {
          diveAir = 0
          diveExhausted = true
          player.userData.diving = false
          applyTerrainOrSwim(player)
          refreshDiveHud()
          setStatus('Out of breath! Release Ctrl and recover')
          setTimeout(() => {
            if (statusLine.textContent.startsWith('Out of breath')) setStatus('')
          }, 1600)
        }
      } else if (player.userData.swimming) {
        diveAir = Math.min(1, diveAir + delta * 0.22)
        if (!keys.control && diveAir >= 0.35) diveExhausted = false
      } else {
        diveAir = 1
        if (!keys.control) diveExhausted = false
      }
      refreshDiveHud()
    }
  }

  bubbles.setDiving(!!player.userData.diving, player.position)

  updateCharacterAnim(player, actuallyMoving, running && actuallyMoving, t, {
    delta,
    swimming: player.userData.swimming,
    climbing: player.userData.climbing,
  })

  const targetLook = player.userData.diving ? 0.45 : swimming ? 0.9 : 1.4
  camLookH += (targetLook - camLookH) * (1 - Math.exp(-8 * delta))
  updateFollowCamera(player.position, delta, camLookH)
}

function updateIdleCrew(delta, t) {
  const player = getPlayer()
  let stillGathering = false

  for (const id of CREW_ORDER) {
    if (!intro?.isActive && id === active) continue
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

function updateBossFight(delta, t) {
  if (!seaKing?.visible) {
    bossShockwave.visible = false
    bossBreath.visible = false
    refreshBossHud()
    return
  }

  const boss = seaKing
  const data = boss.userData
  data.cooldown = Math.max(0, (data.cooldown || 0) - delta)
  data.attackT = Math.max(0, (data.attackT || 0) - delta)
  data.invuln = Math.max(0, (data.invuln || 0) - delta)
  data.hitFlash = Math.max(0, (data.hitFlash || 0) - delta)
  refreshBossHud()

  if (!data.alive) {
    boss.rotation.z = THREE.MathUtils.lerp(boss.rotation.z, -1.35, 1 - Math.exp(-3 * delta))
    boss.position.y = Math.max(groundY(boss.position.x, boss.position.z), boss.position.y - delta * 0.8)
    if (boss.rotation.z < -1.26) boss.visible = false
    bossBreath.visible = false
    bossShockwave.visible = false
    return
  }

  const player = getPlayer()
  const aggro =
    !spectating &&
    !intro?.isActive &&
    !onShip &&
    quest.bossUnlocked &&
    player.position.distanceTo(boss.position) < 34

  const rage = data.hp / data.maxHp < 0.45
  const moveSpeed = rage ? 4.4 : 3.1
  const dx = player.position.x - boss.position.x
  const dz = player.position.z - boss.position.z
  const dist = Math.hypot(dx, dz)
  const targetYaw = Math.atan2(dx, dz)
  boss.rotation.y += shortestAngle(boss.rotation.y, targetYaw) * (1 - Math.exp(-4 * delta))

  const pulse = 0.45 + Math.sin(t * (rage ? 9 : 6)) * 0.18
  data.chest.material.emissiveIntensity = 0.18 + data.hitFlash * 1.8 + pulse * 0.25

  if (!aggro) {
    boss.position.x += (data.home.x - boss.position.x) * Math.min(1, delta * 0.7)
    boss.position.z += (data.home.z - boss.position.z) * Math.min(1, delta * 0.7)
    data.phase = 'idle'
    data.armR.rotation.x += (0 - data.armR.rotation.x) * (1 - Math.exp(-5 * delta))
    data.armR.rotation.z += (0.15 - data.armR.rotation.z) * (1 - Math.exp(-5 * delta))
    bossBreath.visible = false
    bossShockwave.visible = false
    return
  }

  if (data.phase === 'idle' && data.cooldown <= 0) {
    if (dist < 5.2) {
      data.phase = 'swing'
      data.attackT = rage ? 0.82 : 0.95
      data.didHit = false
      setStatus('Kaido winds up Thunder Bagua!')
    } else if (dist < 16) {
      data.phase = 'breath'
      data.attackT = rage ? 1.35 : 1.55
      data.didHit = false
      bossBreath.visible = true
      bossBreath.material.opacity = 0.88
      setStatus('Kaido charges Boro Breath!')
    } else {
      data.cooldown = 0.2
    }
  }

  if (data.phase === 'idle' && dist > 4.3) {
    boss.position.x += Math.sin(boss.rotation.y) * moveSpeed * delta
    boss.position.z += Math.cos(boss.rotation.y) * moveSpeed * delta
  } else if (data.phase === 'swing') {
    const p = 1 - data.attackT / (rage ? 0.82 : 0.95)
    if (p < 0.45) {
      data.armR.rotation.x = -0.8 - p * 2.8
      data.armR.rotation.z = 0.35
    } else {
      data.armR.rotation.x = -2.05 + (p - 0.45) * 5.9
      data.armR.rotation.z = -0.15
      if (!bossShockwave.userData.active) {
        bossShockwave.visible = true
        bossShockwave.material.opacity = 0.85
        bossShockwave.position.set(boss.position.x, groundY(boss.position.x, boss.position.z) + 0.12, boss.position.z)
        bossShockwave.userData = { t: 0, active: true, didHit: false, radius: 2.2 }
      }
      if (!data.didHit && dist < 5.7) {
        damagePlayer(rage ? 22 : 16, 'Thunder Bagua!', boss.position)
        data.didHit = true
      }
    }
    if (data.attackT <= 0) {
      data.phase = 'idle'
      data.cooldown = rage ? 1.15 : 1.6
    }
  } else if (data.phase === 'breath') {
    const mouth = data.head.position.clone().applyMatrix4(boss.matrixWorld)
    const dir = tmp.copy(player.position).sub(mouth).setY(0.2).normalize()
    bossBreath.visible = true
    bossBreath.userData.active = true
    bossBreath.userData.dir.copy(dir)
    const len = THREE.MathUtils.clamp(dist, 6, 15)
    bossBreath.userData.len = len
    bossBreath.scale.set(1, len, 1)
    bossBreath.position.copy(mouth).addScaledVector(dir, len * 0.5)
    bossBreath.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    bossBreath.material.opacity = rage ? 0.92 : 0.8
    if (!data.didHit && data.attackT < (rage ? 0.82 : 0.95)) {
      const toPlayer = player.position.clone().sub(mouth)
      const along = toPlayer.dot(dir)
      const lateral = toPlayer.clone().sub(dir.clone().multiplyScalar(along)).length()
      if (along > 0 && along < len + 1 && lateral < 1.9) {
        damagePlayer(rage ? 18 : 12, 'Boro Breath scorched you!', mouth)
      }
      data.didHit = true
    }
    if (data.attackT <= 0) {
      data.phase = 'idle'
      data.cooldown = rage ? 1.0 : 1.45
      bossBreath.visible = false
      bossBreath.userData.active = false
    }
  }

  if (bossShockwave.userData.active) {
    bossShockwave.userData.t += delta
    bossShockwave.userData.radius += (rage ? 9 : 7) * delta
    bossShockwave.scale.setScalar(bossShockwave.userData.radius)
    bossShockwave.material.opacity = Math.max(0, 0.85 - bossShockwave.userData.t * 1.6)
    if (
      !bossShockwave.userData.didHit &&
      player.position.distanceTo(bossShockwave.position) < bossShockwave.userData.radius + 1.3
    ) {
      damagePlayer(rage ? 10 : 7, 'Shockwave clipped you!', boss.position)
      bossShockwave.userData.didHit = true
    }
    if (bossShockwave.userData.t > 0.6) {
      bossShockwave.visible = false
      bossShockwave.userData.active = false
    }
  }

  if (!bossBreath.visible) {
    bossBreath.material.opacity = 0
  }
}

function updateIntroAmbient(delta, t) {
  const wy = sampleWaveHeight(ship.position.x, ship.position.z, t)
  ship.position.y = 0.18 + wy * 0.85
  ship.rotation.z = Math.sin(t * 0.9) * 0.02
  ship.rotation.x = Math.sin(t * 0.7) * 0.015
  updateIdleCrew(delta, t)
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
  bubbles.update(delta, spectating ? spectateFocus : getPlayer().position)
  updateAimZoom(delta)
  updateBarrelRespawn(t)
  updateCannonBall(delta)

  if (cookBuff && t > cookBuff.until) {
    cookBuff = null
    refreshStats()
    setStatus('Feast buff faded')
    setTimeout(() => setStatus(''), 1000)
  }

  updateBossFight(delta, t)

  if (intro?.isActive) {
    intro.update(delta)
    updateIntroAmbient(delta, t)
    updateSlashVfx(delta)
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
    sunDir.copy(sun.position).normalize()
    ocean.update(t, { night, dive: false, sunDir })
    if (bloomEnabled) composer.render()
    else renderer.render(scene, camera)
    return
  }

  if (spectating) {
    // Freeze sailing input; keep wave bob if already aboard
    if (onShip) {
      ship.userData.speed = 0
      const wy = sampleWaveHeight(ship.position.x, ship.position.z, t)
      ship.position.y = 0.18 + wy * 0.85
      ship.rotation.z = Math.sin(t * 0.9) * 0.02
      ship.rotation.x = Math.sin(t * 0.7) * 0.015
      ship.updateMatrixWorld(true)
      for (const id of aboard) {
        updateCharacterAnim(characters[id], false, false, t, {
          delta,
          swimming: false,
        })
      }
    } else {
      updateIdleCrew(delta, t)
      updateBerries(t)
      updateFruits(t)
      updatePellet(delta)
    }
    updateSpectator(delta)
  } else if (onShip) updateShip(delta)
  else {
    updatePlayer(delta, t)
    updateIdleCrew(delta, t)
    updateBerries(t)
    updateFruits(t)
    updatePellet(delta)

    const player = getPlayer()
    const showHints = !player.userData.diving && !keys.control

    if (showHints && nearShip(player)) {
      if (!boardHintShown) {
        setStatus('Press E to board Going Merry')
        boardHintShown = true
      }
    } else {
      boardHintShown = false
    }

    if (showHints) {
      for (const chest of chests) {
        if (chest.userData.opened) continue
        if (player.position.distanceTo(chest.position) < 2.4) {
          if (!statusLine.textContent) setStatus('Press E to open treasure chest')
          break
        }
      }

      if (
        meat &&
        !meat.userData.taken &&
        player.position.distanceTo(meat.position) < 2
      ) {
        if (!statusLine.textContent) setStatus('Press E to eat meat (+HP)')
      }

      if (
        cookStation &&
        player.position.distanceTo(cookStation.position) < 2.8
      ) {
        if (!statusLine.textContent) {
          setStatus(
            active === 'sanji'
              ? 'E: cook All Blue feast (5 Berries)'
              : 'E: cook at Sanji’s station (3 Berries)',
          )
        }
      }

      const cp = nearestClimb(player)
      if (cp && player.position.y < cp.topY - 0.5 && !player.userData.climbing) {
        if (!statusLine.textContent) setStatus('Hold W near structure to climb')
      }
    }
  }

  updateSlashVfx(delta)

  if (characters.luffy.userData.gear5) {
    characters.luffy.getWorldPosition(tmp)
    gearLight.position.copy(tmp).add(new THREE.Vector3(0, 2, 0))
    gearLight.intensity = 2.2 + Math.sin(t * 8) * 0.6
  } else gearLight.intensity = 0

  // Animated ocean waves + lighting response
  const dive = !spectating && getPlayer().userData.diving
  sunDir.copy(sun.position).normalize()
  ocean.update(t, { night, dive, sunDir })

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

  if (seaKing?.visible && seaKing.userData.alive) {
    seaKing.rotation.y = t * 0.4
    seaKing.position.y =
      groundY(seaKing.position.x, seaKing.position.z) +
      Math.sin(t * 2) * 0.15
  }

  if (bloomEnabled) composer.render()
  else renderer.render(scene, camera)
}

refreshStats()
refreshCrewStrip()
quest.onChestOpened(chestsOpened) // sync UI

intro = createIntro({
  camera,
  ship,
  getPlayer,
  onSkip: () => sfx.unlock(),
  onComplete() {
    const p = getPlayer()
    const orbit = syncOrbitFromCamera(camera, p.position)
    camYaw = orbit.camYaw
    camPitch = orbit.camPitch
    camDist = orbit.camDist
    smoothLookAt.copy(orbit.smoothLookAt)
    moveFacing = p.rotation.y
    moveFacingInit = true
    playerVel.set(0, 0, 0)
    sfx.unlock()
    setStatus('Welcome aboard — explore the archipelago!')
    setTimeout(() => setStatus(''), 2400)
    intro = null
  },
})

animate()
