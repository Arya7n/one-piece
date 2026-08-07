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
  W,
  buildWorld,
  applyTerrainOrSwim,
  groundY,
  WATER_SURFACE,
  SWIM_LAND_THRESHOLD,
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
import {
  createAdventureZones,
  tryZoneInteract,
  updateAdventureZones,
  getZoneProgress,
  applyZoneProgress,
} from './zones.js'
import { sfx, music } from './audio.js'
import { createMobileGamepad } from './gamepad.js'
import { createIntro, syncOrbitFromCamera } from './intro.js'
import { createEpilogue } from './epilogue.js'
import { createUserGuide } from './guide.js'
import { loadProgress, saveProgress, clearProgress } from './save.js'
import { initPwaInstall, onInstallStateChange, promptInstall, isStandalone } from './pwa.js'
import { createKeys, bindGameInput } from './input.js'
import { createCollectibles } from './collectibles.js'
import { createShipController } from './ship.js'
import { createBossController } from './boss.js'

const canvas = document.querySelector('#canvas')

const keys = createKeys()

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
/** After air runs out, block re-dive until dive key is released and air recovers */
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
let epilogue = null
let epilogueSeen = false

function isCinematic() {
  return !!(intro?.isActive || epilogue?.isActive)
}

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

const adventureZones = createAdventureZones(scene)

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
    <div id="hud-bar-main">
      <em id="active-char" title="Playing: Luffy">Luffy</em>
      <span id="berry-count-mini">Berry: 0</span>
      <span id="hp-count-mini">HP: 100</span>
      <span id="dive-air-mini" hidden>Dive: 100%</span>
    </div>
    <div id="hud-bar-actions">
      <button type="button" id="hud-spectate" title="Spectator mode (P)" tabindex="-1">Spec</button>
      <button type="button" id="hud-guide-slot" hidden aria-hidden="true"></button>
      <button type="button" id="hud-open" aria-expanded="false" aria-controls="hud-hint" tabindex="-1">Info</button>
    </div>
  </div>
  <div id="hud-hint" class="hud-closed" hidden>
    <div class="hud-panel-head">
      <strong>One Piece World</strong>
      <button type="button" id="hud-close" aria-label="Close info">×</button>
    </div>
    <span>Open <b>Guide</b> for full controls, crew, quests &amp; adventure zones.</span>
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
    <div class="hud-info-actions">
      <button type="button" id="mute-toggle" class="hud-info-btn" aria-label="Mute or unmute audio">Audio</button>
      <button type="button" id="open-guide-from-info" class="guide-link-btn">Open full Guide</button>
    </div>
  </div>
`
document.body.appendChild(hudRoot)

const toastEl = document.createElement('div')
toastEl.id = 'game-toast'
toastEl.setAttribute('role', 'status')
toastEl.setAttribute('aria-live', 'polite')
document.body.appendChild(toastEl)

const userGuide = createUserGuide({
  onResetProgress() {
    clearProgress()
    window.location.reload()
  },
  onInstallApp: () => promptInstall(),
})
const guideSlot = hudRoot.querySelector('#hud-guide-slot')
guideSlot.replaceWith(userGuide.btn)
document.body.appendChild(userGuide.panel)

initPwaInstall()
if (isStandalone()) document.documentElement.classList.add('pwa-standalone')
onInstallStateChange(({ canInstall, isStandalone: standalone }) => {
  document.documentElement.classList.toggle('pwa-standalone', standalone)
  userGuide.setInstallAvailable?.(canInstall && !standalone)
})

const dayNightBtn = document.createElement('button')
dayNightBtn.type = 'button'
dayNightBtn.id = 'day-night-toggle'
dayNightBtn.title = 'Switch day / night'
dayNightBtn.tabIndex = -1
dayNightBtn.setAttribute('aria-label', 'Switch day or night mode')
document.body.appendChild(dayNightBtn)

const muteBtn = hudRoot.querySelector('#mute-toggle')

function refreshMuteBtn() {
  const on = music.muted
  muteBtn.textContent = on ? 'Muted' : 'Audio on'
  muteBtn.dataset.muted = on ? 'true' : 'false'
  muteBtn.setAttribute('aria-pressed', on ? 'true' : 'false')
  muteBtn.title = on ? 'Unmute (M)' : 'Mute (M)'
}
refreshMuteBtn()

muteBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  sfx.unlock()
  music.toggleMute()
  refreshMuteBtn()
  muteBtn.blur()
})

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

let refreshBossHud = () => {}

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
    persistProgress()
  },
  onBossDefeated() {
    addBounty(10_000_000, 'Kaido defeated!')
    setStatus('You cleared Boss Island!')
    refreshBossHud()
    persistProgress()
    setTimeout(() => setStatus(''), 1800)
    // Let Kaido's fall read, then start the victory ceremony
    setTimeout(() => startEpilogue(), 1600)
  },
})

const hint = hudRoot.querySelector('#hud-hint')
const hudOpenBtn = hudRoot.querySelector('#hud-open')
const hudSpectateBtn = hudRoot.querySelector('#hud-spectate')
const hudCloseBtn = hudRoot.querySelector('#hud-close')
const activeLabel = hudRoot.querySelector('#active-char')
const activeLabelPanel = hudRoot.querySelector('#active-char-panel')
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

/** Ephemeral dialogue toast (attacks, rewards) — not in the top HUD bar */
let toastMsg = ''
let toastUntil = 0
let toastGen = 0
/** Soft proximity / zone hint — lower priority than toast */
let softHint = ''
/** Collected each frame, then committed once (avoids flicker) */
let softHintFrame = ''
let lastToastPaint = ''

function isStatusBusy() {
  return !!toastMsg && performance.now() < toastUntil
}

function syncToast() {
  const ephemeral = isStatusBusy() ? toastMsg : ''
  if (!ephemeral && toastMsg && performance.now() >= toastUntil) toastMsg = ''
  const text = ephemeral || softHint
  const mode = ephemeral ? 'alert' : softHint ? 'hint' : ''
  const paint = `${mode}|${text}`
  if (paint === lastToastPaint) return
  lastToastPaint = paint
  toastEl.textContent = text
  toastEl.classList.toggle('toast-visible', !!text)
  toastEl.classList.toggle('toast-alert', mode === 'alert')
  toastEl.classList.toggle('toast-hint', mode === 'hint')
}

function setStatus(text, durationMs = 0) {
  if (getPlayer()?.userData?.diving && !text) return
  toastGen++
  const gen = toastGen
  if (!text) {
    toastMsg = ''
    toastUntil = 0
    syncToast()
    return
  }
  const ms = durationMs > 0 ? durationMs : Math.min(4200, 1400 + text.length * 28)
  toastMsg = text
  toastUntil = performance.now() + ms
  syncToast()
  setTimeout(() => {
    if (gen !== toastGen) return
    toastMsg = ''
    toastUntil = 0
    syncToast()
  }, ms)
}

function proposeSoftHint(text) {
  if (text) softHintFrame = text
}

function commitSoftHints() {
  softHint = softHintFrame
  softHintFrame = ''
  syncToast()
}

function setHudOpen(open) {
  hint.classList.toggle('hud-closed', !open)
  hint.hidden = !open
  hudOpenBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
  hudOpenBtn.classList.toggle('hud-open-active', open)
}

hudOpenBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  setHudOpen(hint.hidden)
  hudOpenBtn.blur()
})
hudSpectateBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  toggleSpectator()
  hudSpectateBtn.blur()
})
hudCloseBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  setHudOpen(false)
})
hudRoot.querySelector('#open-guide-from-info')?.addEventListener('click', (e) => {
  e.stopPropagation()
  setHudOpen(false)
  userGuide.open()
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
    if (userGuide.panel.contains(e.target)) return
    setHudOpen(false)
  },
  true,
)

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

function updateMusicMood() {
  if (music.muted || epilogue?.isActive) return
  if (intro?.isActive) {
    if (music.track !== 'explore') music.setTrack('explore')
    return
  }
  const boss = seaKing
  const nearBoss =
    quest.bossUnlocked &&
    boss?.visible &&
    boss.userData.alive &&
    getPlayer().position.distanceTo(boss.position) < 42
  const want = nearBoss ? 'boss' : 'explore'
  if (music.track !== want && music.track !== 'victory') music.setTrack(want)
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

function persistProgress() {
  saveProgress({
    berryCount,
    chestsOpened,
    barrelsSmashed,
    playerHp,
    crewBounty,
    questStage: quest.stage,
    bossUnlocked: quest.bossUnlocked,
    bossDefeated: quest.bossDefeated,
    epilogueSeen,
    openChestIds: chests
      .filter((c) => c.userData.opened)
      .map((c) => c.userData.id)
      .filter(Boolean),
    zones: getZoneProgress(adventureZones),
  })
}

function applySavedProgress(data) {
  if (!data) return false
  berryCount = data.berryCount ?? berryCount
  chestsOpened = data.chestsOpened ?? chestsOpened
  barrelsSmashed = data.barrelsSmashed ?? barrelsSmashed
  playerHp = data.playerHp ?? playerHp
  crewBounty = data.crewBounty ?? crewBounty
  epilogueSeen = !!data.epilogueSeen

  const opened = new Set(data.openChestIds || [])
  for (const chest of chests) {
    if (!chest.userData.id || !opened.has(chest.userData.id)) continue
    chest.userData.opened = true
    if (chest.userData.lid) {
      chest.userData.lid.rotation.x = -1.1
      chest.userData.lid.position.z = -0.25
    }
  }

  applyZoneProgress(adventureZones, data.zones)

  quest.restore({
    stage: data.questStage,
    chestsOpened,
    bossUnlocked: data.bossUnlocked,
    bossDefeated: data.bossDefeated,
  })

  if (quest.bossUnlocked) {
    setBossIslandUnlocked(true)
    if (bossBarrier) bossBarrier.visible = false
    if (seaKing && !quest.bossDefeated) {
      seaKing.visible = true
      seaKing.userData.alive = true
      seaKing.userData.hp = seaKing.userData.maxHp
      seaKing.userData.phase = 'idle'
    }
    if (quest.bossDefeated && seaKing) {
      seaKing.visible = false
      seaKing.userData.alive = false
    }
  }

  bountyBoard?.userData.draw(crewBounty)
  if (bountyBoard) bountyBoard.userData.bounty = crewBounty
  refreshStats()
  refreshBossHud()
  return true
}

function damagePlayer(amount, reason = 'Kaido strikes!', from = null) {
  if (spectating || isCinematic()) return false
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
  luffy: [W(0), W(2)],
  zoro: [W(8), W(-6)],
  nami: [W(-12), W(-8)],
  usopp: [W(92), W(-6)],
  sanji: [W(-52), W(82)],
  chopper: [W(68), W(72)],
  robin: [W(-88), W(-42)],
  franky: [W(18), W(-90)],
  brook: [W(-40), W(-68)],
  jinbe: [W(14), W(14)],
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
    // Keep top bar short — full line only in Info panel
    activeLabel.textContent = who
    activeLabel.title = `Spectator · ${who}`
    if (activeLabelPanel) activeLabelPanel.textContent = `Spectator · ${who}`
    return
  }
  const name = characters[active].userData.displayName
  const gear = characters.luffy.userData.gear5 ? ' · GEAR 5!' : ''
  const shipTag = onShip ? ' · On Merry' : ''
  const lost =
    active !== 'zoro' && characters.zoro.userData.lost ? ' · Zoro is lost…' : ''
  activeLabel.textContent = name
  activeLabel.title = `Playing: ${name}${gear}${shipTag}${lost}`
  if (activeLabelPanel) {
    activeLabelPanel.textContent = `Playing: ${name}${gear}${shipTag}${lost}`
  }
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

const bossCtrl = createBossController({
  quest,
  getPlayer,
  getSeaKing: () => seaKing,
  isStatusBusy,
  setStatus,
  bossHud,
  bossBarFill,
  damagePlayer,
  getSpectating: () => spectating,
  isIntroActive: () => isCinematic(),
  getOnShip: () => onShip,
  bossShockwave,
  bossBreath,
  tmp,
})
refreshBossHud = bossCtrl.refreshBossHud
const { enforceBossLock, updateBossFight } = bossCtrl

const {
  updateBerries,
  updateBarrelRespawn,
  updateFruits,
  hitBarrels,
} = createCollectibles({
  getPlayer,
  getOnShip: () => onShip,
  getActive: () => active,
  getCharacters: () => characters,
  getBerries: () => berries,
  getBarrels: () => barrels,
  getFruits: () => fruits,
  getMeat: () => meat,
  getSeaKing: () => seaKing,
  getClock: () => clock,
  getFruitBuff: () => fruitBuff,
  setFruitBuff: (v) => {
    fruitBuff = v
  },
  getCookBuff: () => cookBuff,
  getBerryCount: () => berryCount,
  setBerryCount: (v) => {
    berryCount = v
  },
  getBarrelsSmashed: () => barrelsSmashed,
  setBarrelsSmashed: (v) => {
    barrelsSmashed = v
  },
  getAiming: () => aiming,
  groundY,
  sfx,
  setStatus,
  addBounty,
  refreshStats,
  refreshBossHud: () => refreshBossHud(),
  persistProgress,
  quest,
})

let pad = null
const {
  nearShip,
  recallShipHome,
  boardShip,
  leaveShip,
  tryBoardToggle,
  fireShipCannon,
  updateShip,
  updateLanterns,
} = createShipController({
  ship,
  scene,
  characters,
  CREW_ORDER,
  getActive: () => active,
  getPlayer,
  getSpectating: () => spectating,
  aboard,
  getOnShip: () => onShip,
  setOnShip: (v) => {
    onShip = v
  },
  getGathering: () => gathering,
  setGathering: (v) => {
    gathering = v
  },
  keys,
  getPad: () => pad,
  clock,
  shipForward,
  tmp,
  cannonBall,
  sfx,
  setStatus,
  refreshActiveLabel,
  enforceBossLock,
  updateFollowCamera: (target, delta, lookHeight) => updateFollowCamera(target, delta, lookHeight),
})

function startEpilogue() {
  if (epilogueSeen || epilogue?.isActive || intro?.isActive) return
  if (spectating) exitSpectator()
  if (onShip) leaveShip()

  epilogue = createEpilogue({
    camera,
    getPlayer,
    ship,
    getSeaKing: () => seaKing,
    getCrewBounty: () => crewBounty,
    formatBounty,
    onGatherCrew() {
      gathering = true
      for (const id of CREW_ORDER) {
        if (id === active) continue
        if (aboard.has(id)) continue
        const c = characters[id]
        c.userData.gathering = true
        c.userData.lost = false
        c.userData.idleTarget = null
      }
      sfx.board()
    },
    onSkip: () => sfx.unlock(),
    onComplete({ orbit }) {
      if (orbit) {
        camYaw = orbit.camYaw
        camPitch = orbit.camPitch
        camDist = orbit.camDist
        smoothLookAt.copy(orbit.smoothLookAt)
      }
      const p = getPlayer()
      moveFacing = p.rotation.y
      moveFacingInit = true
      playerVel.set(0, 0, 0)
      epilogueSeen = true
      epilogue = null
      persistProgress()
      sfx.gear()
      music.setTrack('explore')
      setStatus('The seas are yours — sail wherever you like!')
      setTimeout(() => setStatus(''), 2800)
    },
  })
  sfx.gear()
  music.setTrack('victory')
}

function nearestClimb(player) {
  for (const cp of climbPoints) {
    const d = Math.hypot(player.position.x - cp.x, player.position.z - cp.z)
    if (d < cp.radius) return cp
  }
  return null
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

  const zoneHit = tryZoneInteract(adventureZones, player, active)
  if (zoneHit.handled) {
    if (zoneHit.reward) {
      berryCount += zoneHit.reward.berries || 0
      if (zoneHit.reward.bounty) addBounty(zoneHit.reward.bounty, zoneHit.message)
      else {
        setStatus(zoneHit.message || '')
        setTimeout(() => setStatus(''), 1600)
      }
      if (zoneHit.reward.rare) {
        chestsOpened++
        quest.onChestOpened(chestsOpened)
      }
      refreshStats()
      sfx.chest()
      persistProgress()
    } else {
      sfx.switch()
      setStatus(zoneHit.message || '')
      setTimeout(() => setStatus(''), 1600)
      persistProgress()
    }
    return
  }

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
      persistProgress()
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
  if (aiming) proposeSoftHint('Sniper aim — F to fire')
}

// Mobile pad
pad = createMobileGamepad({
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
  onDive: (v) => {
    keys.control = !!v
  },
})

bindGameInput({
  keys,
  sfx,
  isIntroActive: () => isCinematic(),
  isUserGuideOpen: () => userGuide.isOpen(),
  getSpectating: () => spectating,
  setActive,
  cycleCrew,
  callCrew,
  toggleSpectator,
  toggleGear5,
  tryInteract,
  recallShipHome,
  doAttack,
  tryJump,
  getActive: () => active,
  getBloomEnabled: () => bloomEnabled,
  setBloomEnabled: (v) => {
    bloomEnabled = v
  },
  bloomPass,
  toggleMute() {
    sfx.unlock()
    music.toggleMute()
    refreshMuteBtn()
  },
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
  if (isCinematic()) return
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
  if (keys.control || pad.state.dive) spectateFocus.y -= maxSpeed * 0.7 * delta

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
    // Devil fruit weakness — except Jinbe; cave bonus for Jinbe
    let swimMul = active === 'jinbe' ? 0.7 : fruitBuff ? 0.25 : 0.55
    const uc = adventureZones.underwater.center
    if (
      active === 'jinbe' &&
      Math.hypot(player.position.x - uc.x, player.position.z - uc.z) < 12
    ) {
      swimMul *= 1.35
    }
    base *= swimMul
  }

  const zoneFx = updateAdventureZones(adventureZones, {
    player,
    playerVel,
    delta,
    t,
    activeId: active,
    onGround: !!player.userData.onGround,
  })
  if (zoneFx.hint) proposeSoftHint(zoneFx.hint)

  const maxSpeed = running ? base * 2.1 : base
  const iceAccel = zoneFx.iceAccel ?? 1

  const busy =
    (player.userData.punchT ?? -1) >= 0 ||
    (player.userData.slashT ?? -1) >= 0 ||
    (player.userData.kickT ?? -1) >= 0 ||
    (player.userData.staffT ?? -1) >= 0 ||
    (player.userData.shotT ?? -1) >= 0

  if (moving && !busy && !player.userData.climbing) {
    moveDir.normalize()
    const accel = (running ? 28 : 18) * iceAccel
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
    const damp = swimming
      ? 4.5
      : zoneFx.iceDamp != null
        ? zoneFx.iceDamp
        : 10
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
  if (adventureZones.desert.inside) {
    // Underground chamber — skip ocean/terrain snap
    player.userData.swimming = false
    player.userData.diving = false
    player.userData.onGround = true
    player.userData.velY = 0
    if (player.position.y > -5) player.position.y = adventureZones.desert.spawn.y
    refreshDiveHud()
  } else if (!player.userData.climbing) {
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
      // Start dive needs air; once underwater, stay down until X / pad release or 0%
      // (old diveAir > 0.12 check caused surface↔dive flicker near empty)
      const startDive =
        (keys.control || pad.state.dive) &&
        !!player.userData.swimming &&
        !player.userData.diving &&
        !diveExhausted &&
        diveAir >= 0.25
      const keepDive =
        !!player.userData.diving &&
        (keys.control || pad.state.dive) &&
        diveAir > 0 &&
        !diveExhausted
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
          setStatus('Out of breath! Release dive and recover')
          setTimeout(() => {
            if (toastMsg.startsWith('Out of breath')) setStatus('')
          }, 1600)
        }
      } else if (player.userData.swimming) {
        diveAir = Math.min(1, diveAir + delta * 0.22)
        if (!(keys.control || pad.state.dive) && diveAir >= 0.35) diveExhausted = false
      } else {
        diveAir = 1
        if (!(keys.control || pad.state.dive)) diveExhausted = false
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
    if (!isCinematic() && id === active) continue
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
  softHintFrame = ''

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
  updateMusicMood()

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

  if (epilogue?.isActive) {
    epilogue.update(delta)
    updateIntroAmbient(delta, t)
    updateIdleCrew(delta, t)
    updateSlashVfx(delta)
    for (const c of clouds) {
      c.position.x += Math.sin(t * 0.04 + c.position.z * 0.01) * 0.003
    }
    flagPole.children[1].rotation.y = Math.sin(t * 2) * 0.15
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
    const showHints = !player.userData.diving && !(keys.control || pad.state.dive)
    let nearHint = ''

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
          nearHint = 'Press E to open treasure chest'
          break
        }
      }

      if (
        !nearHint &&
        meat &&
        !meat.userData.taken &&
        player.position.distanceTo(meat.position) < 2
      ) {
        nearHint = 'Press E to eat meat (+HP)'
      }

      if (!nearHint && cookStation && player.position.distanceTo(cookStation.position) < 2.8) {
        nearHint =
          active === 'sanji'
            ? 'E: cook All Blue feast (5 Berries)'
            : 'E: cook at Sanji’s station (3 Berries)'
      }

      const cp = nearestClimb(player)
      if (
        !nearHint &&
        cp &&
        player.position.y < cp.topY - 0.5 &&
        !player.userData.climbing
      ) {
        nearHint = 'Hold W near structure to climb'
      }
    }

    if (nearHint) proposeSoftHint(nearHint)
    else if (!showHints) {
      /* diving — no soft prompts */
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

  commitSoftHints()

  if (bloomEnabled) composer.render()
  else renderer.render(scene, camera)
}

refreshStats()
refreshCrewStrip()

const saved = loadProgress()
if (saved) {
  applySavedProgress(saved)
  setStatus('Progress restored')
  setTimeout(() => setStatus(''), 1600)
} else {
  quest.onChestOpened(chestsOpened) // sync UI
}

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
    music.start('explore')
    setStatus('Welcome aboard — explore One Piece World!')
    setTimeout(() => setStatus(''), 2400)
    intro = null
  },
})

animate()
