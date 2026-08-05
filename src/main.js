import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

const canvas = document.querySelector('#canvas')

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050816)
scene.fog = new THREE.FogExp2(0x050816, 0.028)

const mouse = new THREE.Vector2(0, 0)
let bloomEnabled = true

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
)

camera.position.set(0, 2.2, 6)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 2
controls.maxDistance = 20

const ambientLight = new THREE.AmbientLight(0xffffff, 0.25)
scene.add(ambientLight)

const keyLight = new THREE.PointLight(0x60a5fa, 2.2, 80, 2)
keyLight.position.set(5, 6, 6)
scene.add(keyLight)

// Postprocessing (bloom)

const composer = new EffectComposer(renderer)
const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.0, // strength
  0.45, // radius
  0.2, // threshold
)
composer.addPass(bloomPass)

function setBloomEnabled(next) {
  bloomEnabled = next
  bloomPass.enabled = next
}

setBloomEnabled(true)

// HUD hint
const hint = document.createElement('div')
hint.id = 'hud-hint'
hint.textContent = 'Drag: orbit · Mouse: warp · B: bloom · R: reset camera'
document.body.appendChild(hint)

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
}

window.addEventListener('resize', onWindowResize)

window.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
})

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase()
  if (key === 'b') setBloomEnabled(!bloomEnabled)
  if (key === 'r') {
    camera.position.set(0, 2.2, 6)
    controls.target.set(0, 0, 0)
    controls.update()
  }
})

// Stars background
const starsCount = 2500
const starsGeometry = new THREE.BufferGeometry()
const starsPositions = new Float32Array(starsCount * 3)
for (let i = 0; i < starsCount; i++) {
  // Bias stars outward so it feels deep.
  const r = Math.pow(Math.random(), 0.35) * 110
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)

  const x = r * Math.sin(phi) * Math.cos(theta)
  const y = r * Math.cos(phi)
  const z = r * Math.sin(phi) * Math.sin(theta)

  starsPositions[i * 3 + 0] = x
  starsPositions[i * 3 + 1] = y
  starsPositions[i * 3 + 2] = z
}
starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3))

const starsMaterial = new THREE.PointsMaterial({
  color: 0xe5e7eb,
  size: 0.06,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
})
const stars = new THREE.Points(starsGeometry, starsMaterial)
scene.add(stars)

// Terrain "wave" (CPU animated vertices)
const terrainSize = 30
const terrainSegments = 60 // (segments+1)^2 ~ 3721 vertices
const terrainGeometry = new THREE.PlaneGeometry(
  terrainSize,
  terrainSize,
  terrainSegments,
  terrainSegments,
)
terrainGeometry.rotateX(-Math.PI / 2)

const terrainBasePositions = terrainGeometry.attributes.position.array.slice()
const terrainMaterial = new THREE.MeshStandardMaterial({
  color: 0x0f766e,
  roughness: 0.35,
  metalness: 0.12,
  emissive: 0x062525,
  emissiveIntensity: 0.25,
})
const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial)
terrain.position.y = -2.2
scene.add(terrain)

// Hero object: torus knot
const knotGeometry = new THREE.TorusKnotGeometry(1.2, 0.42, 220, 28)
const knotMaterial = new THREE.MeshStandardMaterial({
  color: 0x7c3aed,
  roughness: 0.18,
  metalness: 0.7,
  emissive: 0x2563eb,
  emissiveIntensity: 0.45,
})
const knot = new THREE.Mesh(knotGeometry, knotMaterial)
knot.position.y = 0.2
knot.castShadow = false
scene.add(knot)

// Swirling particles (points with per-vertex colors)
const particleCount = 4000
const particleGeometry = new THREE.BufferGeometry()
const particlePositions = new Float32Array(particleCount * 3)
const particleColors = new Float32Array(particleCount * 3)

const particleR = new Float32Array(particleCount)
const particleA = new Float32Array(particleCount)
const particleZ = new Float32Array(particleCount)

for (let i = 0; i < particleCount; i++) {
  const idx3 = i * 3
  const r = Math.random() * 2.8 + 0.2
  const a = Math.random() * Math.PI * 2
  const z = (Math.random() - 0.5) * 6

  particleR[i] = r
  particleA[i] = a
  particleZ[i] = z

  particlePositions[idx3 + 0] = Math.cos(a) * r
  particlePositions[idx3 + 1] = (Math.random() - 0.5) * 2.2
  particlePositions[idx3 + 2] = z

  const c = new THREE.Color()
  c.setHSL(0.62 + Math.random() * 0.18, 0.85, 0.6 + Math.random() * 0.15)
  particleColors[idx3 + 0] = c.r
  particleColors[idx3 + 1] = c.g
  particleColors[idx3 + 2] = c.b
}

particleGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(particlePositions, 3),
)
particleGeometry.setAttribute(
  'color',
  new THREE.BufferAttribute(particleColors, 3),
)

const particlesMaterial = new THREE.PointsMaterial({
  size: 0.05,
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
})

const particles = new THREE.Points(particleGeometry, particlesMaterial)
scene.add(particles)

const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)

  const t = clock.getElapsedTime()

  // Mouse affects camera orbit target and lighting direction.
  const targetX = mouse.x * 1.2
  const targetY = 0.4 + mouse.y * 0.25
  controls.target.set(targetX, targetY, 0)

  // Warp light a bit so the bloom feels alive.
  keyLight.position.x = 4 + mouse.x * 4
  keyLight.position.y = 6 + Math.sin(t * 0.7) * 1.2 + mouse.y * 2
  keyLight.position.z = 6 + Math.cos(t * 0.5) * 3

  // Terrain waves: multiple sine bands + mouse-centric "pulse".
  const pos = terrainGeometry.attributes.position
  const positions = pos.array
  const base = terrainBasePositions
  const verts = pos.count

  // Convert mouse to world-ish coordinates on the terrain.
  const pulseX = mouse.x * (terrainSize * 0.18)
  const pulseZ = mouse.y * (terrainSize * 0.18)

  for (let i = 0; i < verts; i++) {
    const ix = i * 3
    const x = base[ix + 0]
    const z = base[ix + 2]

    const dx = x - pulseX
    const dz = z - pulseZ
    const dist = Math.sqrt(dx * dx + dz * dz)

    const wave1 =
      Math.sin(x * 0.55 + t * 1.3) * Math.cos(z * 0.45 - t * 1.1) * 0.22
    const wave2 =
      Math.sin((x + z) * 0.33 + t * 0.9) * Math.sin(z * 0.28 - t * 1.6) * 0.18
    const pulse = Math.sin(dist * 0.25 - t * 2.2) * 0.45 * Math.exp(-dist * 0.12)

    positions[ix + 1] = base[ix + 1] + wave1 + wave2 + pulse
  }

  pos.needsUpdate = true
  terrainGeometry.computeVertexNormals()

  // Hero knot motion and color shift
  knot.rotation.x = t * 0.35 + mouse.y * 0.35
  knot.rotation.y = t * 0.6 + mouse.x * 0.3
  knot.rotation.z = Math.sin(t * 0.4) * 0.18

  const hue = 0.72 + Math.sin(t * 0.25) * 0.08
  knot.material.color.setHSL(hue, 0.85, 0.58)
  knot.material.emissive.setHSL(hue * 0.9 + 0.03, 0.85, 0.45)

  // Particles swirl around the knot
  const pPos = particleGeometry.attributes.position
  const pArr = pPos.array
  for (let i = 0; i < particleCount; i++) {
    const idx3 = i * 3
    const r = particleR[i]
    const a = particleA[i] + t * (0.6 + r * 0.12) + mouse.x * 0.6
    const z = particleZ[i] + Math.sin(t * 1.2 + r * 2.0) * 0.55

    pArr[idx3 + 0] = Math.cos(a) * r
    pArr[idx3 + 1] = Math.sin(t * 1.15 + r * 1.8) * 1.05 + mouse.y * 0.35
    pArr[idx3 + 2] = z
  }
  pPos.needsUpdate = true

  controls.update()

  if (bloomEnabled) composer.render()
  else renderer.render(scene, camera)
}

animate()
