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
import {
  WORLD,
  buildWorld,
  applyTerrainOrSwim,
  groundY,
} from './world.js'

const canvas = document.querySelector('#canvas')

const keys = { w: false, a: false, s: false, d: false, shift: false }

let active = 'luffy'
let bloomEnabled = true
let onShip = false
let boardHintShown = false
let berryCount = 0
let chestsOpened = 0
let barrelsSmashed = 0

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
scene.fog = new THREE.Fog(0xa8d8f0, 55, 160)

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  400,
)
camera.position.set(8, 9, 16)

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
controls.maxDistance = 36
controls.maxPolarAngle = Math.PI * 0.47
controls.target.set(0, 1.4, 0)

scene.add(new THREE.HemisphereLight(0xfff1c9, 0x3d8f7a, 0.75))
const sun = new THREE.DirectionalLight(0xfff3d0, 1.55)
sun.position.set(30, 45, 20)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 140
sun.shadow.camera.left = -70
sun.shadow.camera.right = 70
sun.shadow.camera.top = 70
sun.shadow.camera.bottom = -70
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
scene.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(180, 32, 16),
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
  ),
)

// World content
const world = buildWorld(scene)
const { ship, water, flagPole, campFlame, clouds, berries, chests, barrels } =
  world

// HUD
const hint = document.createElement('div')
hint.id = 'hud-hint'
hint.innerHTML = `
  <strong>Grand Line Archipelago</strong>
  <span>WASD · swim in water · F attack · G Gear 5 · E board/interact · H recall Merry · 1/2</span>
  <em id="active-char">Playing: Luffy</em>
  <em id="status-line"></em>
  <div id="hud-stats">
    <span id="berry-count">Berry: 0</span>
    <span id="chest-count">Chests: 0/3</span>
    <span id="barrel-count">Barrels: 0</span>
  </div>
`
document.body.appendChild(hint)
const activeLabel = hint.querySelector('#active-char')
const statusLine = hint.querySelector('#status-line')
const berryLabel = hint.querySelector('#berry-count')
const chestLabel = hint.querySelector('#chest-count')
const barrelLabel = hint.querySelector('#barrel-count')

function setStatus(text) {
  statusLine.textContent = text || ''
}

function refreshStats() {
  berryLabel.textContent = `Berry: ${berryCount}`
  chestLabel.textContent = `Chests: ${chestsOpened}/${chests.length}`
  barrelLabel.textContent = `Barrels: ${barrelsSmashed}`
}

// Characters
const luffy = createLuffy()
const zoro = createZoro()
luffy.position.set(0, groundY(0, 2), 2)
zoro.position.set(2.2, groundY(2.2, 1.2), 1.2)
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
  // Wide boarding zone — pier, swim-up, or gangplank
  return player.position.distanceTo(deck) < 11 || player.position.distanceTo(ship.position) < 10
}

function recallShipHome() {
  if (onShip) {
    setStatus('Leave the ship first (E), then recall')
    return
  }
  const home = ship.userData.home
  ship.position.set(home.x, 0.2, home.z)
  ship.rotation.set(0, home.rot, 0)
  ship.userData.speed = 0
  setStatus('Going Merry returned to the pier!')
  setTimeout(() => setStatus(''), 1600)
}

function boardShip() {
  if (onShip) return
  onShip = true
  // Clear swim pose
  luffy.userData.swimming = false
  zoro.userData.swimming = false
  luffy.userData.hips.rotation.x = 0
  zoro.userData.hips.rotation.x = 0

  ship.attach(luffy)
  ship.attach(zoro)
  luffy.position.copy(ship.userData.seatLuffy.position)
  zoro.position.copy(ship.userData.seatZoro.position)
  luffy.rotation.set(0, Math.PI, 0)
  zoro.rotation.set(0, Math.PI, 0)
  ship.userData.speed = 0
  refreshActiveLabel()
  setStatus('Aboard! WASD to sail · E leave · H recalls ship to pier when empty')
}

function leaveShip() {
  if (!onShip) return
  onShip = false
  scene.attach(luffy)
  scene.attach(zoro)

  ship.updateMatrixWorld(true)
  const exit = new THREE.Vector3()
  ship.getWorldPosition(exit)

  // Drop beside the stern / gangplank (can be swimming)
  const side = new THREE.Vector3(
    Math.sin(ship.rotation.y + Math.PI),
    0,
    Math.cos(ship.rotation.y + Math.PI),
  )
  luffy.position.copy(exit).addScaledVector(side, 5)
  zoro.position.copy(luffy.position).add(new THREE.Vector3(1.2, 0, 0.8))
  applyTerrainOrSwim(luffy)
  applyTerrainOrSwim(zoro)

  ship.userData.speed = 0
  refreshActiveLabel()
  setStatus(luffy.userData.swimming ? 'Swimming! Head to shore or press H to recall Merry' : 'Landed!')
  setTimeout(() => setStatus(''), 2000)
}

function tryBoardToggle() {
  if (onShip) {
    leaveShip()
    return
  }
  if (nearShip(getPlayer())) boardShip()
}

function tryInteract() {
  if (onShip) {
    tryBoardToggle()
    return
  }
  const player = getPlayer()

  // Chests
  for (const chest of chests) {
    if (chest.userData.opened) continue
    if (player.position.distanceTo(chest.position) < 2.4) {
      chest.userData.opened = true
      chest.userData.lid.rotation.x = -1.1
      chest.userData.lid.position.z = -0.25
      berryCount += 5
      chestsOpened++
      refreshStats()
      setStatus('Treasure! +5 Berry')
      setTimeout(() => setStatus(''), 1500)
      return
    }
  }

  if (nearShip(player)) {
    boardShip()
    return
  }

  setStatus('Nothing nearby — find chests, Merry, or berries')
  setTimeout(() => setStatus(''), 1400)
}

function hitBarrels(origin, range, damage) {
  let hit = false
  for (const barrel of barrels) {
    if (!barrel.visible || barrel.userData.hp <= 0) continue
    if (origin.distanceTo(barrel.position) > range) continue
    barrel.userData.hp -= damage
    barrel.scale.y = 0.5 + 0.5 * (barrel.userData.hp / barrel.userData.maxHp)
    barrel.rotation.z += (Math.random() - 0.5) * 0.4
    hit = true
    if (barrel.userData.hp <= 0) {
      barrel.visible = false
      barrelsSmashed++
      berryCount += 1
      refreshStats()
      setStatus('Barrel smashed! +1 Berry')
      setTimeout(() => setStatus(''), 900)
    }
  }
  return hit
}

function doAttack() {
  if (onShip) return
  const player = getPlayer()
  player.getWorldPosition(attackOrigin)
  attackOrigin.y += 1

  if (active === 'luffy') {
    if (triggerRubberPunch(luffy)) {
      const range = luffy.userData.gear5 ? 7 : 4.5
      setTimeout(() => hitBarrels(player.position, range, 2), 180)
      setStatus(luffy.userData.gear5 ? 'Gomu Gomu no… BAJRANE!' : 'Gomu Gomu no Pistol!')
      setTimeout(() => setStatus(''), 900)
    }
  } else if (triggerSlash(zoro)) {
    slashVfx.visible = true
    slashVfx.userData.t = 0
    zoro.updateMatrixWorld(true)
    slashVfx.position.copy(zoro.position)
    slashVfx.rotation.y = zoro.rotation.y
    hitBarrels(player.position, 3.5, 3)
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

function updateBerries(t) {
  const player = getPlayer()
  for (const berry of berries) {
    if (berry.userData.taken) continue
    berry.rotation.y = t * 2 + berry.userData.spin
    berry.position.y =
      groundY(berry.position.x, berry.position.z) +
      0.9 +
      Math.sin(t * 3 + berry.userData.spin) * 0.15

    if (!onShip && player.position.distanceTo(berry.position) < 1.4) {
      berry.userData.taken = true
      berry.visible = false
      berryCount++
      refreshStats()
      setStatus(`Berry +1  (total ${berryCount})`)
      setTimeout(() => setStatus(''), 700)
    }
  }
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
  if (k === 'e') tryInteract()
  if (k === 'h') recallShipHome()
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

function updateShip(delta) {
  const data = ship.userData
  if (keys.w) data.speed = Math.min(16, data.speed + 10 * delta)
  else if (keys.s) data.speed = Math.max(-7, data.speed - 10 * delta)
  else data.speed *= 1 - 1.5 * delta

  if (keys.a) ship.rotation.y += 1.05 * delta
  if (keys.d) ship.rotation.y -= 1.05 * delta

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

  // Don't beach the hull on tall land
  const landUnder = groundY(ship.position.x, ship.position.z)
  if (landUnder > 0.6) {
    ship.position.addScaledVector(shipForward, -data.speed * delta * 1.5)
    data.speed *= -0.4
    setStatus('Too shallow — steer back to open water')
  }

  const t = clock.elapsedTime
  updateCharacterAnim(luffy, false, false, t, { delta, swimming: false })
  updateCharacterAnim(zoro, false, false, t, { delta, swimming: false })

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
  const swimming = !!player.userData.swimming
  const running = moving && keys.shift && !swimming
  let base = active === 'luffy' ? 4.4 : 3.8
  if (active === 'luffy' && luffy.userData.gear5) base *= 1.35
  if (swimming) base *= 0.55
  const speed = running ? base * 2.1 : base

  const busy =
    (player.userData.punchT ?? -1) >= 0 || (player.userData.slashT ?? -1) >= 0

  if (moving && !busy) {
    moveDir.normalize()
    player.position.x += moveDir.x * speed * delta
    player.position.z += moveDir.z * speed * delta
    player.rotation.y = Math.atan2(moveDir.x, moveDir.z)
  }

  applyTerrainOrSwim(player)
  updateCharacterAnim(player, moving, running, t, {
    delta,
    swimming: player.userData.swimming,
  })

  lookAt.copy(player.position).add(new THREE.Vector3(0, swimming ? 0.9 : 1.4, 0))
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
    const speed = buddy.userData.swimming ? 3.2 : running ? 7.5 : 3.8
    buddy.position.x += tmp.x * speed * delta
    buddy.position.z += tmp.z * speed * delta
    applyTerrainOrSwim(buddy)
    buddy.rotation.y = Math.atan2(tmp.x, tmp.z)
  } else {
    applyTerrainOrSwim(buddy)
  }

  // Don't "run" anim while swimming
  const buddyRunning = running && !buddy.userData.swimming
  updateCharacterAnim(buddy, moving, buddyRunning, t, {
    delta,
    swimming: buddy.userData.swimming,
  })
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

  if (onShip) updateShip(delta)
  else {
    updatePlayer(delta, t)
    updateBuddy(delta, t)
    updateBerries(t)

    if (nearShip(getPlayer())) {
      if (!boardHintShown) {
        setStatus('Press E to board Going Merry')
        boardHintShown = true
      }
    } else {
      boardHintShown = false
    }

    // Chest proximity hint
    for (const chest of chests) {
      if (chest.userData.opened) continue
      if (getPlayer().position.distanceTo(chest.position) < 2.4) {
        if (!statusLine.textContent) setStatus('Press E to open treasure chest')
        break
      }
    }
  }

  updateSlashVfx(delta)

  if (luffy.userData.gear5) {
    luffy.getWorldPosition(tmp)
    gearLight.position.copy(tmp).add(new THREE.Vector3(0, 2, 0))
    gearLight.intensity = 2.2 + Math.sin(t * 8) * 0.6
  } else gearLight.intensity = 0

  water.material.opacity = 0.84 + Math.sin(t * 0.7) * 0.04
  if (campFlame) {
    campFlame.scale.y = 0.9 + Math.sin(t * 9) * 0.15
    campFlame.rotation.y = t * 2
  }
  for (const c of clouds) {
    c.position.x += Math.sin(t * 0.04 + c.position.z * 0.01) * 0.003
  }
  flagPole.children[1].rotation.y = Math.sin(t * 2) * 0.15
  if (ship.userData.sail) {
    ship.userData.sail.rotation.y = Math.sin(t * 1.3) * 0.05
  }

  controls.update()
  if (bloomEnabled) composer.render()
  else renderer.render(scene, camera)
}

refreshStats()
animate()
