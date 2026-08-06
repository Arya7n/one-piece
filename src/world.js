import * as THREE from 'three'
import { createBountyPoster, makeCookStation } from './systems.js'

export const WORLD = {
  size: 360,
  segments: 200,
  sailRadius: 250,
  islands: [
    { x: 0, z: 0, r: 52, h: 1, theme: 'grass' },
    { x: 95, z: -12, r: 32, h: 0.95, theme: 'grass' },
    { x: -55, z: 85, r: 26, h: 0.92, theme: 'winter' },
    { x: 70, z: 75, r: 22, h: 0.88, theme: 'grass' },
    { x: -90, z: -40, r: 28, h: 0.9, theme: 'desert' },
    { x: 20, z: -95, r: 24, h: 0.85, theme: 'grass' },
    { x: -40, z: -70, r: 18, h: 0.8, theme: 'grass' },
    // Unique theme islands
    { x: 150, z: -55, r: 28, h: 0.9, theme: 'desert' },
    { x: -130, z: 30, r: 26, h: 0.95, theme: 'winter' },
    { x: 110, z: 110, r: 22, h: 1.05, theme: 'sky', elevate: 14 },
  ],
}

function blobHeight(x, z, cx, cz, radius, hScale, elevate = 0) {
  const dist = Math.hypot(x - cx, z - cz)
  const edge = THREE.MathUtils.clamp(1 - dist / radius, 0, 1)
  const falloff = edge * edge * (3 - 2 * edge)
  const lx = x - cx
  const lz = z - cz
  const hills =
    Math.sin(lx * 0.11) * Math.cos(lz * 0.09) * 1.5 +
    Math.sin(lx * 0.26 + 1.2) * Math.sin(lz * 0.22) * 0.75 +
    Math.sin((lx + lz) * 0.07) * 0.5
  const plateau = Math.exp(-(lx * lx + lz * lz) * 0.0028) * 0.55
  return (hills + plateau) * falloff * hScale + elevate * falloff - (1 - falloff) * 5
}

export function nearestIsland(x, z) {
  let best = WORLD.islands[0]
  let bestD = Infinity
  for (const isl of WORLD.islands) {
    const d = Math.hypot(x - isl.x, z - isl.z) / isl.r
    if (d < bestD) {
      bestD = d
      best = isl
    }
  }
  return best
}

export function islandHeight(x, z) {
  let best = -5
  for (const isl of WORLD.islands) {
    best = Math.max(
      best,
      blobHeight(x, z, isl.x, isl.z, isl.r, isl.h, isl.elevate || 0),
    )
  }
  // Sandbar bridges between nearby islands
  const bridges = [
    { x0: 40, x1: 88, z: -6, halfW: 4 },
    { x0: 25, x1: 55, z: 55, halfW: 3.5, alongAxis: 'diag' },
  ]
  // Main → east pier path
  if (x > 40 && x < 92 && Math.abs(z - -6) < 4) {
    const along = THREE.MathUtils.clamp((x - 40) / 52, 0, 1)
    const ridge = 0.55 - Math.abs(z + 6) * 0.1
    best = Math.max(best, ridge * (0.55 + along * 0.4))
  }
  // Main → south sandbar
  if (z < -40 && z > -90 && Math.abs(x - 8) < 5) {
    const along = THREE.MathUtils.clamp((-z - 40) / 50, 0, 1)
    best = Math.max(best, 0.4 * (0.5 + along * 0.3))
  }
  return best
}

export function groundY(x, z) {
  return islandHeight(x, z)
}

export function isWalkable(x, z) {
  return islandHeight(x, z) > 0.15
}

export const WATER_SURFACE = 0.42
export const SWIM_LAND_THRESHOLD = 0.12

/**
 * Stand on land, or swim in the ocean. Soft world boundary only —
 * no longer pushes you out of the water.
 * @param {object} [opts]
 * @param {boolean} [opts.airborne] — keep vertical velocity (jump); only clamp XZ
 * @returns {{ land: number, swimming: boolean }}
 */
export function applyTerrainOrSwim(obj, opts = {}) {
  let x = obj.position.x
  let z = obj.position.z

  const r = Math.hypot(x, z)
  if (r > WORLD.sailRadius) {
    const s = WORLD.sailRadius / r
    x *= s
    z *= s
  }

  const land = groundY(x, z)
  obj.position.x = x
  obj.position.z = z

  if (opts.airborne) {
    return { land, swimming: land <= SWIM_LAND_THRESHOLD }
  }

  if (land > SWIM_LAND_THRESHOLD) {
    obj.position.y = land
    obj.userData.swimming = false
    obj.userData.diving = false
  } else if (opts.diving) {
    // Brief underwater dive
    const diveY = WATER_SURFACE - 2.1
    obj.position.y = diveY
    obj.userData.swimming = true
    obj.userData.diving = true
  } else {
    obj.position.y = WATER_SURFACE - 0.72
    obj.userData.swimming = true
    obj.userData.diving = false
  }
  return { land, swimming: !!obj.userData.swimming, diving: !!obj.userData.diving }
}

/** @deprecated use applyTerrainOrSwim — kept for any leftover imports */
export function clampToLand(obj) {
  applyTerrainOrSwim(obj)
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts })
}

/** Procedural Straw Hat / Mugiwara Jolly Roger (canvas texture). */
function createJollyRogerTexture(size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const s = size

  // Black flag field
  ctx.fillStyle = '#111111'
  ctx.fillRect(0, 0, s, s)

  const cx = s * 0.5
  const cy = s * 0.52

  // Crossed bones
  ctx.save()
  ctx.translate(cx, cy + s * 0.06)
  ctx.strokeStyle = '#f5f5f5'
  ctx.fillStyle = '#f5f5f5'
  ctx.lineWidth = s * 0.055
  ctx.lineCap = 'round'
  for (const ang of [-0.55, 0.55]) {
    ctx.save()
    ctx.rotate(ang)
    ctx.beginPath()
    ctx.moveTo(-s * 0.28, 0)
    ctx.lineTo(s * 0.28, 0)
    ctx.stroke()
    // bone knobs
    for (const x of [-s * 0.28, s * 0.28]) {
      ctx.beginPath()
      ctx.arc(x, -s * 0.035, s * 0.045, 0, Math.PI * 2)
      ctx.arc(x, s * 0.035, s * 0.045, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
  ctx.restore()

  // Skull
  ctx.fillStyle = '#f7f3e8'
  ctx.beginPath()
  ctx.ellipse(cx, cy - s * 0.02, s * 0.2, s * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  // jaw
  ctx.beginPath()
  ctx.ellipse(cx, cy + s * 0.12, s * 0.14, s * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()

  // Eye sockets
  ctx.fillStyle = '#111111'
  ctx.beginPath()
  ctx.ellipse(cx - s * 0.07, cy - s * 0.02, s * 0.045, s * 0.055, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + s * 0.07, cy - s * 0.02, s * 0.045, s * 0.055, 0, 0, Math.PI * 2)
  ctx.fill()

  // Smile / teeth line
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = s * 0.012
  ctx.beginPath()
  ctx.arc(cx, cy + s * 0.08, s * 0.08, 0.15, Math.PI - 0.15)
  ctx.stroke()
  ctx.beginPath()
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(cx + i * s * 0.03, cy + s * 0.08)
    ctx.lineTo(cx + i * s * 0.03, cy + s * 0.14)
  }
  ctx.stroke()

  // Straw hat brim
  ctx.fillStyle = '#e0b040'
  ctx.beginPath()
  ctx.ellipse(cx, cy - s * 0.2, s * 0.28, s * 0.055, 0, 0, Math.PI * 2)
  ctx.fill()
  // Crown
  ctx.beginPath()
  ctx.ellipse(cx, cy - s * 0.28, s * 0.15, s * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(cx - s * 0.15, cy - s * 0.32, s * 0.3, s * 0.1)

  // Red ribbon
  ctx.fillStyle = '#c62828'
  ctx.beginPath()
  ctx.ellipse(cx, cy - s * 0.2, s * 0.16, s * 0.028, 0, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

function makeJollyRogerMaterial(opts = {}) {
  const map = createJollyRogerTexture(opts.size ?? 512)
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.85,
    metalness: 0.05,
    side: opts.side ?? THREE.DoubleSide,
    transparent: !!opts.transparent,
    alphaTest: opts.alphaTest ?? 0,
  })
}

function makeJollyRogerFlag(w = 1.6, h = 1.05) {
  const matFlag = makeJollyRogerMaterial()
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matFlag)
  return flag
}

function place(obj, x, z, yOff = 0) {
  obj.position.set(x, groundY(x, z) + yOff, z)
  return obj
}

function makePalm(mats, scale = 1) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 3.2 * scale, 7),
    mats.trunk,
  )
  trunk.position.y = 1.6 * scale
  trunk.rotation.z = 0.12
  trunk.castShadow = true
  g.add(trunk)
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.35 * scale, 2.2 * scale, 4),
      mats.palm,
    )
    leaf.position.set(0, 3.1 * scale, 0)
    leaf.rotation.set(0.9, (i / 6) * Math.PI * 2, 0)
    leaf.castShadow = true
    g.add(leaf)
  }
  return g
}

function makeHouse(mats, w = 3.2, d = 3.6, h = 2.2) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.wall)
  body.position.y = h / 2
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 1.4, 4), mats.roof)
  roof.position.y = h + 0.5
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  g.add(roof)
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), mats.woodDark)
  door.position.set(0, 0.6, d / 2 + 0.05)
  g.add(door)
  return g
}

function makeBerry() {
  const g = new THREE.Group()
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      metalness: 0.7,
      roughness: 0.25,
      emissive: 0xffa000,
      emissiveIntensity: 0.25,
    }),
  )
  coin.rotation.x = Math.PI / 2
  g.add(coin)
  g.userData = {
    kind: 'berry',
    taken: false,
    spin: Math.random() * Math.PI,
    homeX: 0,
    homeZ: 0,
    respawnAt: 0,
  }
  return g
}

function makeChest() {
  const g = new THREE.Group()
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.7, 0.75),
    mat(0x8d6e4c),
  )
  box.position.y = 0.35
  box.castShadow = true
  g.add(box)
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.18, 0.8),
    mat(0x6d4c2f),
  )
  lid.position.set(0, 0.78, 0)
  g.add(lid)
  const lock = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.8, roughness: 0.3 }),
  )
  lock.position.set(0, 0.55, 0.4)
  g.add(lock)
  g.userData = { kind: 'chest', opened: false, lid }
  return g
}

function makeBreakableBarrel(mats) {
  const b = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.55, 1.0, 10),
    mats.woodDark,
  )
  b.castShadow = true
  b.userData = {
    kind: 'barrel',
    hp: 3,
    maxHp: 3,
    homeX: 0,
    homeZ: 0,
    respawnAt: 0,
  }
  return b
}

function makeWantedBoard(mats) {
  const g = new THREE.Group()
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.8, 0.15), mats.woodDark)
  post.position.y = 1.4
  g.add(post)
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.12), mats.wood)
  board.position.set(0, 2.0, 0)
  g.add(board)
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.9 }),
  )
  poster.position.set(0, 2.0, 0.08)
  g.add(poster)
  const skull = new THREE.Mesh(
    new THREE.CircleGeometry(0.25, 12),
    new THREE.MeshStandardMaterial({ color: 0xc62828 }),
  )
  skull.position.set(0, 2.25, 0.1)
  g.add(skull)
  return g
}

function makeBridge(mats) {
  const g = new THREE.Group()
  for (let i = 0; i < 36; i++) {
    const x = 42 + i * 1.4
    const z = -6 + Math.sin(i * 0.35) * 0.2
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 2.6), mats.wood)
    plank.position.x = x
    plank.position.z = z
    plank.position.y = Math.max(groundY(x, z), 0.35) + 0.15
    plank.castShadow = true
    plank.receiveShadow = true
    g.add(plank)
    if (i % 3 === 0) {
      for (const side of [-1.4, 1.4]) {
        const rail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.07, 1.1, 5),
          mats.woodDark,
        )
        rail.position.set(x, plank.position.y + 0.55, z + side)
        g.add(rail)
      }
    }
  }
  return g
}

function makeWatchtower(mats) {
  const g = new THREE.Group()
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 5, 6),
      mats.woodDark,
    )
    leg.position.set(x, 2.5, z)
    leg.castShadow = true
    g.add(leg)
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 3), mats.wood)
  platform.position.y = 5
  platform.castShadow = true
  g.add(platform)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 4), mats.roof)
  roof.position.y = 6.2
  roof.rotation.y = Math.PI / 4
  g.add(roof)
  return g
}

/**
 * Builds expanded world props into `scene`.
 * Returns interactive registries for the game loop.
 */
export function buildWorld(scene) {
  const mats = {
    wood: mat(0x8d6e4c),
    woodDark: mat(0x5d4037),
    palm: mat(0x2e7d32),
    trunk: mat(0x6d4c2f),
    wall: mat(0xe8d5b5),
    roof: mat(0xc62828),
    sail: new THREE.MeshStandardMaterial({
      color: 0xfff8e7,
      roughness: 0.95,
      side: THREE.DoubleSide,
    }),
    red: mat(0xc62828, { roughness: 0.7 }),
  }

  // Terrain
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
    const cRock = new THREE.Color(0x7a7f85)
    const cDesert = new THREE.Color(0xe0c080)
    const cSnow = new THREE.Color(0xeef5ff)
    const cIce = new THREE.Color(0xb3e5fc)
    const cSky = new THREE.Color(0xc5e1a5)
    const c = new THREE.Color()

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const y = islandHeight(x, z)
      pos.setY(i, y)
      const theme = nearestIsland(x, z).theme || 'grass'

      if (theme === 'desert') {
        if (y < 0.25) c.copy(cSand)
        else c.copy(cDesert).lerp(cSand, Math.min(1, y / 3))
      } else if (theme === 'winter') {
        if (y < 0.25) c.copy(cIce)
        else c.copy(cSnow).lerp(cIce, 0.2)
      } else if (theme === 'sky') {
        if (y < 8) c.copy(cSand)
        else c.copy(cSky).lerp(cBright, 0.35)
      } else if (y < 0.2) c.copy(cSand)
      else if (y > 2.8) c.copy(cRock)
      else if (y < 0.55) c.copy(cSand).lerp(cDirt, 0.3)
      else c.copy(cGrass).lerp(cBright, (Math.sin(x * 0.35 + z * 0.2) + 1) * 0.25)

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
    new THREE.CircleGeometry(250, 96),
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

  // Palms
  const palmSpots = [
    [-14, 8],
    [-22, -4],
    [-16, -14],
    [12, 12],
    [18, -10],
    [-8, 18],
    [8, -18],
    [85, -18],
    [100, -8],
    [92, 4],
    [78, 2],
    [-50, 78],
    [-62, 90],
    [-45, 95],
    [68, 70],
    [78, 80],
    [62, 82],
    [-85, -35],
    [-95, -48],
    [-80, -50],
    [15, -90],
    [28, -100],
    [8, -85],
    [-38, -68],
    [-48, -75],
    [35, 20],
    [-25, 30],
    [50, -40],
  ]
  for (const [x, z] of palmSpots) {
    if (!isWalkable(x, z)) continue
    const palm = makePalm(mats, 0.85 + Math.random() * 0.5)
    place(palm, x, z)
    palm.rotation.y = Math.random() * Math.PI
    scene.add(palm)
  }

  // Village on main island (west)
  const village = new THREE.Group()
  const houses = [
    [-10, -6, 0.4],
    [-14, -8, -0.3],
    [-8, -10, 1.1],
    [-12, -3, 0.7],
  ]
  for (const [x, z, rot] of houses) {
    const house = makeHouse(mats)
    place(house, x, z)
    house.rotation.y = rot
    village.add(house)
  }
  scene.add(village)

  const bountyBoard = createBountyPoster(mats)
  place(bountyBoard, -6, -5)
  bountyBoard.rotation.y = 0.5
  scene.add(bountyBoard)

  const cookStation = makeCookStation(mats)
  place(cookStation, -16, -4)
  cookStation.rotation.y = 0.8
  scene.add(cookStation)

  // Theme landmarks
  // Desert dunes markers
  for (const [x, z] of [
    [145, -50],
    [155, -60],
    [-95, -35],
  ]) {
    if (groundY(x, z) < 0.2) continue
    const dune = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 1.4, 7),
      mat(0xe0c080, { roughness: 1 }),
    )
    place(dune, x, z, 0.4)
    scene.add(dune)
  }
  // Winter ice spires
  for (const [x, z] of [
    [-125, 28],
    [-135, 35],
    [-50, 90],
  ]) {
    if (groundY(x, z) < 0.2) continue
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 3.5, 5),
      new THREE.MeshStandardMaterial({
        color: 0xb3e5fc,
        transparent: true,
        opacity: 0.85,
        roughness: 0.2,
      }),
    )
    place(spike, x, z, 1.5)
    scene.add(spike)
  }
  // Sky island cloud ring
  {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(16, 2.2, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        transparent: true,
        opacity: 0.9,
      }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.set(110, 12, 110)
    scene.add(ring)
  }

  // Bridge to east island
  scene.add(makeBridge(mats))

  // Watchtower on east island
  const tower = makeWatchtower(mats)
  place(tower, 95, -10)
  scene.add(tower)

  // North rocky camp
  const campFire = new THREE.Group()
  const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.25, 8), mats.woodDark)
  logs.position.y = 0.1
  campFire.add(logs)
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.9, 6),
    new THREE.MeshStandardMaterial({
      color: 0xff6d00,
      emissive: 0xff3d00,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.9,
    }),
  )
  flame.position.y = 0.7
  campFire.add(flame)
  place(campFire, -55, 85, 0)
  scene.add(campFire)

  // Pier from beach straight to the Merry dock
  const pier = new THREE.Group()
  for (let i = 0; i < 16; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 1.15), mats.wood)
    plank.position.set(8 + i * 0.45, 0.52, 4 + i * 0.7)
    plank.castShadow = true
    plank.receiveShadow = true
    pier.add(plank)
  }
  // Dock posts at the end
  for (const [dx, dz] of [
    [0.9, -0.8],
    [-0.9, -0.8],
    [0.9, 0.8],
    [-0.9, 0.8],
  ]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6),
      mats.woodDark,
    )
    post.position.set(14.8 + dx, 0.4, 14.5 + dz)
    pier.add(post)
  }
  scene.add(pier)

  const eastPier = new THREE.Group()
  for (let i = 0; i < 8; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 1.0), mats.wood)
    plank.position.set(108 + i * 0.05, 0.4, -8 + i * 0.9)
    eastPier.add(plank)
  }
  scene.add(eastPier)

  // Meat bait
  const meat = new THREE.Group()
  const bone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6),
    mat(0xfff8e1),
  )
  bone.rotation.z = Math.PI / 2
  meat.add(bone)
  const steak = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    mat(0x8b1a1a, { roughness: 0.7 }),
  )
  steak.scale.set(1.4, 0.7, 1)
  meat.add(steak)
  place(meat, 2.5, -1.5, 0.35)
  scene.add(meat)

  // Flag — Straw Hat Jolly Roger
  const flagPole = new THREE.Group()
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 3.5, 6),
    mats.woodDark,
  )
  pole.position.y = 1.75
  flagPole.add(pole)
  const flag = makeJollyRogerFlag(1.6, 1.05)
  flag.position.set(0.85, 3.1, 0)
  flagPole.add(flag)
  place(flagPole, -2, 2)
  scene.add(flagPole)

  // Ship
  const ship = makeShip(mats)
  scene.add(ship)

  // Collectibles
  const berries = []
  const berrySpots = [
    [5, 5],
    [-5, 8],
    [10, -8],
    [-15, 2],
    [85, -14],
    [98, 2],
    [90, -22],
    [-52, 80],
    [-60, 92],
    [68, 72],
    [8, 16],
    [-18, -10],
    [22, 6],
    [-88, -38],
    [-95, -50],
    [18, -92],
    [25, -100],
    [-42, -72],
    [40, 30],
    [-30, 40],
    [70, 60],
    [50, -50],
    [148, -52],
    [155, -58],
    [-128, 32],
    [-135, 25],
    [108, 108],
    [115, 112],
  ]
  for (const [x, z] of berrySpots) {
    if (!isWalkable(x, z)) continue
    const berry = makeBerry()
    place(berry, x, z, 0.9)
    berry.userData.homeX = x
    berry.userData.homeZ = z
    scene.add(berry)
    berries.push(berry)
  }

  const chests = []
  for (const [x, z] of [
    [98, 6],
    [-58, 82],
    [-11, -12],
    [-88, -42],
    [22, -92],
    [72, 78],
  ]) {
    const chest = makeChest()
    place(chest, x, z, 0)
    chest.rotation.y = Math.random() * Math.PI
    scene.add(chest)
    chests.push(chest)
  }

  const barrels = []
  for (const [x, z] of [
    [3, 4],
    [4.5, 3.2],
    [6, 5],
    [88, -10],
    [92, -8],
    [-52, 82],
    [-8, -7],
    [-90, -45],
    [20, -88],
    [70, 70],
    [150, -55],
    [-130, 28],
    [112, 110],
  ]) {
    const barrel = makeBreakableBarrel(mats)
    place(barrel, x, z, 0.5)
    barrel.userData.homeX = x
    barrel.userData.homeZ = z
    scene.add(barrel)
    barrels.push(barrel)
  }

  // Rocks scatter
  for (let i = 0; i < 40; i++) {
    const isl = WORLD.islands[i % WORLD.islands.length]
    const a = Math.random() * Math.PI * 2
    const r = 3 + Math.random() * (isl.r * 0.7)
    const x = isl.x + Math.cos(a) * r
    const z = isl.z + Math.sin(a) * r
    if (groundY(x, z) < 0.3) continue
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.7, 0),
      mat(0x6e7378),
    )
    rock.scale.set(1, 0.5 + Math.random() * 0.4, 1)
    place(rock, x, z, 0.2)
    rock.castShadow = true
    scene.add(rock)
  }

  // Extra clouds
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    opacity: 0.92,
  })
  const clouds = []
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group()
    for (let j = 0; j < 5; j++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(1.2 + Math.random(), 8, 6),
        cloudMat,
      )
      puff.position.set((j - 2) * 1.4, Math.random() * 0.5, (Math.random() - 0.5) * 1.5)
      g.add(puff)
    }
    g.position.set(
      (Math.random() - 0.5) * 220,
      28 + Math.random() * 16,
      (Math.random() - 0.5) * 220,
    )
    scene.add(g)
    clouds.push(g)
  }

  // Devil Fruit pickups
  const fruits = []
  const fruitDefs = [
    { x: 12, z: -12, type: 'gomu', label: 'Gomu Gomu', color: 0xff5252, buff: 'stretch' },
    { x: 92, z: 10, type: 'mero', label: 'Mero Mero', color: 0xff80ab, buff: 'charm' },
    { x: -50, z: 78, type: 'hana', label: 'Hana Hana', color: 0xce93d8, buff: 'bloom' },
    { x: 68, z: 78, type: 'suna', label: 'Suna Suna', color: 0xffe082, buff: 'speed' },
    { x: -85, z: -45, type: 'gomu', label: 'Gomu Gomu', color: 0xff5252, buff: 'stretch' },
    { x: 18, z: -88, type: 'suna', label: 'Suna Suna', color: 0xffe082, buff: 'speed' },
  ]
  for (const def of fruitDefs) {
    if (!isWalkable(def.x, def.z)) continue
    const fruit = makeDevilFruit(def)
    place(fruit, def.x, def.z, 0.85)
    scene.add(fruit)
    fruits.push(fruit)
  }

  // Climb points (watchtower + village roof-ish poles)
  const climbPoints = [
    { x: 95, z: -10, topY: 5.2, radius: 2.2 },
    { x: -10, z: -6, topY: 2.8, radius: 1.8 },
    { x: -2, z: 2, topY: 3.2, radius: 1.2 },
    { x: -88, z: -40, topY: 3.0, radius: 2.0 },
  ]

  // Meat is heal pickup
  meat.userData = { kind: 'meat', taken: false }

  // Climb sky island edge
  climbPoints.push({ x: 110, z: 110, topY: 16, radius: 3.5 })

  return {
    water,
    ship,
    flagPole,
    campFlame: flame,
    clouds,
    berries,
    chests,
    barrels,
    fruits,
    climbPoints,
    meat,
    mats,
    bountyBoard,
    cookStation,
  }
}

function makeDevilFruit(def) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 10),
    new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.55,
      metalness: 0.15,
      emissive: def.color,
      emissiveIntensity: 0.25,
    }),
  )
  body.scale.set(1, 1.15, 1)
  g.add(body)
  // Spiral pattern dots
  for (let i = 0; i < 6; i++) {
    const swirl = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.03, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    )
    swirl.position.y = -0.15 + i * 0.08
    swirl.rotation.x = Math.PI / 2
    swirl.scale.setScalar(0.7 + i * 0.08)
    g.add(swirl)
  }
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.2, 5),
    mat(0x5d4037),
  )
  stem.position.y = 0.45
  g.add(stem)
  g.userData = {
    kind: 'fruit',
    taken: false,
    type: def.type,
    label: def.label,
    buff: def.buff,
    spin: Math.random() * Math.PI,
  }
  return g
}

function makeShip(mats) {
  const ship = new THREE.Group()
  ship.name = 'GoingMerry'

  const wood = mats.wood
  const woodDark = mats.woodDark
  const cream = mat(0xf5f0e6, { roughness: 0.8 })
  const pink = mat(0xffb6c1, { roughness: 0.75 })
  const black = mat(0x222222)
  const redRoof = mats.roof
  const brass = new THREE.MeshStandardMaterial({
    color: 0xd4a017,
    metalness: 0.65,
    roughness: 0.35,
  })

  // --- Hull: layered caravel shape ---
  const hullGroup = new THREE.Group()

  // Keel
  const keel = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.7, 11.5),
    woodDark,
  )
  keel.position.set(0, -0.15, 0.2)
  keel.castShadow = true
  hullGroup.add(keel)

  // Lower hull (wider belly)
  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 1.1, 11.2),
    wood,
  )
  lower.position.set(0, 0.35, 0.15)
  lower.castShadow = true
  lower.receiveShadow = true
  hullGroup.add(lower)

  // Bilge curve suggestion — side planks angled
  for (const side of [-1, 1]) {
    const bilge = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 1.0, 10.8),
      wood,
    )
    bilge.position.set(side * 2.55, 0.45, 0.15)
    bilge.rotation.z = side * -0.35
    bilge.castShadow = true
    hullGroup.add(bilge)
  }

  // Upper gunwale / sheer
  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(5.0, 0.7, 11.0),
    wood,
  )
  upper.position.set(0, 1.15, 0.1)
  upper.castShadow = true
  hullGroup.add(upper)

  // Waterline stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(5.35, 0.18, 11.3),
    mat(0xc62828),
  )
  stripe.position.set(0, 0.85, 0.15)
  hullGroup.add(stripe)

  // Bow taper (stacked wedges)
  for (let i = 0; i < 5; i++) {
    const t = i / 4
    const w = 5.0 * (1 - t * 0.75)
    const h = 1.6 * (1 - t * 0.15)
    const section = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.15), wood)
    section.position.set(0, 0.55 + t * 0.15, -5.2 - i * 0.95)
    section.castShadow = true
    hullGroup.add(section)
  }
  // Sharp stem
  const stem = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.8, 4), wood)
  stem.rotation.x = -Math.PI / 2
  stem.position.set(0, 0.7, -10.2)
  stem.castShadow = true
  hullGroup.add(stem)

  // Stern overhang
  const stern = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, 2.2), wood)
  stern.position.set(0, 0.7, 6.4)
  stern.castShadow = true
  hullGroup.add(stern)

  // Rudder
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 1.4), woodDark)
  rudder.position.set(0, 0.2, 7.6)
  rudder.castShadow = true
  hullGroup.add(rudder)

  ship.add(hullGroup)

  // --- Deck ---
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.12, 10.5),
    woodDark,
  )
  deck.position.set(0, 1.52, 0.2)
  deck.receiveShadow = true
  deck.castShadow = true
  ship.add(deck)

  // Deck planks (visual lines)
  for (let i = -4; i <= 4; i++) {
    const plankLine = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.02, 0.06),
      mat(0x4e342e),
    )
    plankLine.position.set(0, 1.59, i * 1.1)
    ship.add(plankLine)
  }

  // Raised forecastle
  const forecastle = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.35, 2.4),
    wood,
  )
  forecastle.position.set(0, 1.75, -4.2)
  forecastle.castShadow = true
  ship.add(forecastle)

  // --- Stern cabin (Merry classic) ---
  const cabin = new THREE.Group()
  const cabinBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 1.8, 3.2),
    cream,
  )
  cabinBody.position.y = 0.9
  cabinBody.castShadow = true
  cabin.add(cabinBody)
  // Windows
  for (const [x, z] of [
    [-1.1, 1.62],
    [0, 1.62],
    [1.1, 1.62],
    [-1.1, -1.62],
    [1.1, -1.62],
  ]) {
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x81d4fa,
        emissive: 0x4fc3f7,
        emissiveIntensity: 0.2,
        roughness: 0.3,
        metalness: 0.1,
        side: THREE.DoubleSide,
      }),
    )
    win.position.set(x, 1.0, z)
    cabin.add(win)
  }
  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.08), woodDark)
  door.position.set(0, 0.55, 1.65)
  cabin.add(door)
  // Red roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.3, 4), redRoof)
  roof.position.y = 2.35
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  cabin.add(roof)
  // Chimney
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.7, 6),
    woodDark,
  )
  chimney.position.set(1.1, 2.5, -0.4)
  cabin.add(chimney)
  cabin.position.set(0, 1.52, 4.2)
  ship.add(cabin)

  // --- Railings ---
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const z = -5.2 + i * 0.95
      if (z > 2.6 && z < 5.8) continue // cabin gap
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 0.85, 5),
        woodDark,
      )
      post.position.set(side * 2.15, 1.95, z)
      post.castShadow = true
      ship.add(post)
    }
    const railTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 9.5),
      woodDark,
    )
    railTop.position.set(side * 2.15, 2.35, -0.3)
    ship.add(railTop)
  }
  // Bow rail curve
  const bowRail = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.07, 6, 12, Math.PI),
    woodDark,
  )
  bowRail.rotation.x = Math.PI / 2
  bowRail.rotation.z = Math.PI
  bowRail.position.set(0, 2.2, -5.8)
  ship.add(bowRail)

  // --- Mast, yards, rigging ---
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 11, 10),
    woodDark,
  )
  mast.position.set(0, 6.2, -0.5)
  mast.castShadow = true
  ship.add(mast)

  // Crow's nest
  const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.35, 10), wood)
  nest.position.set(0, 9.5, -0.5)
  nest.castShadow = true
  ship.add(nest)
  const nestRail = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.05, 6, 12),
    woodDark,
  )
  nestRail.rotation.x = Math.PI / 2
  nestRail.position.set(0, 9.75, -0.5)
  ship.add(nestRail)

  // Yard (crossbeam)
  const yard = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 6.2, 8),
    woodDark,
  )
  yard.rotation.z = Math.PI / 2
  yard.position.set(0, 7.4, -0.5)
  ship.add(yard)

  // Main sail + Mugiwara Jolly Roger
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e7,
    roughness: 0.95,
    side: THREE.DoubleSide,
  })
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.8), sailMat)
  sail.position.set(0, 5.4, -0.15)
  sail.castShadow = true
  ship.add(sail)

  const jolly = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    makeJollyRogerMaterial(),
  )
  jolly.position.set(0, 5.5, -0.1)
  ship.add(jolly)

  // Topsail smaller
  const topSail = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.8),
    sailMat.clone(),
  )
  topSail.position.set(0, 8.3, -0.2)
  ship.add(topSail)

  // Bowsprit
  const bowsprit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 4.5, 6),
    woodDark,
  )
  bowsprit.rotation.x = Math.PI / 2.4
  bowsprit.position.set(0, 2.4, -8.5)
  ship.add(bowsprit)

  // Foresail triangle
  const foreSail = new THREE.Mesh(
    new THREE.BufferGeometry(),
    sailMat.clone(),
  )
  {
    const verts = new Float32Array([
      0, 4.5, -6.5,
      0, 2.2, -10.2,
      0, 2.0, -6.8,
    ])
    foreSail.geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    foreSail.geometry.computeVertexNormals()
  }
  ship.add(foreSail)

  // Simple rope lines (cylinders)
  for (const side of [-1, 1]) {
    const stay = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 8.5, 4),
      black,
    )
    stay.position.set(side * 1.8, 5.2, 1.5)
    stay.rotation.z = side * 0.28
    stay.rotation.x = 0.15
    ship.add(stay)
  }

  // --- Sheep figurehead (Merry) ---
  const figure = new THREE.Group()
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 1.2, 8),
    cream,
  )
  neck.rotation.x = Math.PI / 2.5
  neck.position.set(0, 0.2, 0.3)
  figure.add(neck)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 12), cream)
  head.scale.set(1, 1.05, 1.15)
  head.position.set(0, 0.55, -0.5)
  head.castShadow = true
  figure.add(head)

  // Snout
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), pink)
  snout.scale.set(1, 0.85, 1.1)
  snout.position.set(0, 0.25, -1.15)
  figure.add(snout)
  // Nostrils
  for (const sx of [-0.12, 0.12]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mat(0xe57373))
    n.position.set(sx, 0.28, -1.45)
    figure.add(n)
  }

  // Eyes
  for (const sx of [-0.28, 0.28]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat(0xffffff))
    eye.position.set(sx, 0.7, -1.0)
    figure.add(eye)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), black)
    pupil.position.set(sx, 0.7, -1.1)
    figure.add(pupil)
  }

  // Floppy ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      cream,
    )
    ear.scale.set(0.5, 1.1, 0.7)
    ear.position.set(side * 0.75, 0.9, -0.35)
    ear.rotation.z = side * 0.5
    figure.add(ear)
  }

  // Horns / wool tuft on top
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), cream)
  tuft.position.set(0, 1.25, -0.35)
  figure.add(tuft)

  // Smile
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.035, 6, 12, Math.PI),
    mat(0x5d4037),
  )
  smile.position.set(0, 0.35, -1.35)
  smile.rotation.set(Math.PI, 0, 0)
  figure.add(smile)

  figure.position.set(0, 1.9, -10.0)
  figure.scale.setScalar(1.05)
  ship.add(figure)

  // Helm wheel at stern cabin front
  const wheel = new THREE.Group()
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.05, 6, 16),
    woodDark,
  )
  wheel.add(rim)
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.9, 0.06),
      woodDark,
    )
    spoke.rotation.z = (i / 6) * Math.PI
    wheel.add(spoke)
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), brass)
  wheel.add(hub)
  wheel.position.set(0, 2.5, 2.35)
  ship.add(wheel)

  // Lanterns (meshes + real lights for night)
  const lanternLights = []
  for (const side of [-1, 1]) {
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffecb3,
        emissive: 0xffa000,
        emissiveIntensity: 0.6,
      }),
    )
    lantern.position.set(side * 2.0, 2.6, 5.5)
    ship.add(lantern)
    const light = new THREE.PointLight(0xffb74d, 0, 14, 2)
    light.position.copy(lantern.position)
    ship.add(light)
    lanternLights.push({ mesh: lantern, light })
  }
  // Bow lantern
  const bowLantern = new THREE.PointLight(0xffcc80, 0, 12, 2)
  bowLantern.position.set(0, 3.2, -6)
  ship.add(bowLantern)
  lanternLights.push({ mesh: null, light: bowLantern })

  // Working cannons (ports + muzzle anchors)
  const cannons = []
  for (const side of [-1, 1]) {
    for (const z of [-2.5, 0.5, 2.5]) {
      const port = new THREE.Mesh(
        new THREE.CircleGeometry(0.22, 10),
        black,
      )
      port.position.set(side * 2.62, 0.95, z)
      port.rotation.y = side * -Math.PI / 2
      ship.add(port)
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8),
        black,
      )
      barrel.rotation.z = side * Math.PI / 2
      barrel.position.set(side * 2.3, 0.95, z)
      ship.add(barrel)
      const muzzle = new THREE.Object3D()
      muzzle.position.set(side * 2.9, 0.95, z)
      ship.add(muzzle)
      cannons.push({ muzzle, side })
    }
  }

  // Seats on deck midships
  const seatLuffy = new THREE.Object3D()
  seatLuffy.position.set(-1.2, 1.6, 0.5)
  ship.add(seatLuffy)
  const seatZoro = new THREE.Object3D()
  seatZoro.position.set(1.2, 1.6, 0.5)
  ship.add(seatZoro)

  // Gangplank (stern / +Z)
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 5.2), wood)
  plank.position.set(0, 1.15, 8.2)
  plank.rotation.x = -0.28
  plank.castShadow = true
  ship.add(plank)

  // Docked at pier
  ship.position.set(15.2, 0.35, 16.8)
  ship.rotation.y = Math.PI + 0.35
  ship.scale.setScalar(0.78)

  ship.userData = {
    seatLuffy,
    seatZoro,
    sail,
    topSail,
    wheel,
    figure,
    speed: 0,
    lanternLights,
    cannons,
    cannonCooldown: 0,
    home: { x: 15.2, z: 16.8, rot: Math.PI + 0.35 },
  }
  return ship
}
