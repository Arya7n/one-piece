import * as THREE from 'three'

export const WORLD = {
  size: 320,
  segments: 200,
  sailRadius: 220,
  islands: [
    { x: 0, z: 0, r: 52, h: 1 },
    { x: 95, z: -12, r: 32, h: 0.95 },
    { x: -55, z: 85, r: 26, h: 0.92 },
    { x: 70, z: 75, r: 22, h: 0.88 },
    { x: -90, z: -40, r: 28, h: 0.9 },
    { x: 20, z: -95, r: 24, h: 0.85 },
    { x: -40, z: -70, r: 18, h: 0.8 },
  ],
}

function blobHeight(x, z, cx, cz, radius, hScale) {
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
  return (hills + plateau) * falloff * hScale - (1 - falloff) * 5
}

export function islandHeight(x, z) {
  let best = -5
  for (const isl of WORLD.islands) {
    best = Math.max(best, blobHeight(x, z, isl.x, isl.z, isl.r, isl.h))
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
  } else {
    // Chest/head above water, legs submerged
    obj.position.y = WATER_SURFACE - 0.72
    obj.userData.swimming = true
  }
  return { land, swimming: !!obj.userData.swimming }
}

/** @deprecated use applyTerrainOrSwim — kept for any leftover imports */
export function clampToLand(obj) {
  applyTerrainOrSwim(obj)
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts })
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
  g.userData = { kind: 'berry', taken: false, spin: Math.random() * Math.PI }
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
  b.userData = { kind: 'barrel', hp: 3, maxHp: 3 }
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
    const c = new THREE.Color()

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const y = islandHeight(x, z)
      pos.setY(i, y)

      if (y < 0.2) c.copy(cSand)
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

  const board = makeWantedBoard(mats)
  place(board, -6, -5)
  board.rotation.y = 0.5
  scene.add(board)

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

  // Flag
  const flagPole = new THREE.Group()
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 3.5, 6),
    mats.woodDark,
  )
  pole.position.y = 1.75
  flagPole.add(pole)
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), mats.red)
  flag.position.set(0.7, 3.1, 0)
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
  ]
  for (const [x, z] of berrySpots) {
    if (!isWalkable(x, z)) continue
    const berry = makeBerry()
    place(berry, x, z, 0.9)
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
  ]) {
    const barrel = makeBreakableBarrel(mats)
    place(barrel, x, z, 0.5)
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

  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.8, 12), mats.wood)
  hull.position.y = 0.4
  hull.castShadow = true
  ship.add(hull)

  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4, 4), mats.wood)
  bow.rotation.x = -Math.PI / 2
  bow.position.set(0, 0.5, -7)
  ship.add(bow)

  const deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.15, 11), mats.woodDark)
  deck.position.y = 1.35
  deck.receiveShadow = true
  ship.add(deck)

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 9, 8),
    mats.woodDark,
  )
  mast.position.set(0, 5.5, 0)
  ship.add(mast)

  const sail = new THREE.Mesh(new THREE.PlaneGeometry(5, 4.5), mats.sail)
  sail.position.set(0, 5.2, 0.8)
  ship.add(sail)

  const jolly = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), mats.red)
  jolly.position.set(0, 5.5, 0.85)
  ship.add(jolly)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 8),
    mat(0xf5f0e6),
  )
  head.position.set(0, 1.8, -8.2)
  ship.add(head)
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat(0xffc0cb))
  snout.position.set(0, 1.55, -8.7)
  ship.add(snout)

  for (const x of [-2.4, 2.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 10), mats.woodDark)
    rail.position.set(x, 1.7, 0)
    ship.add(rail)
  }

  const seatLuffy = new THREE.Object3D()
  seatLuffy.position.set(-1.1, 1.45, 1.5)
  ship.add(seatLuffy)
  const seatZoro = new THREE.Object3D()
  seatZoro.position.set(1.1, 1.45, 1.5)
  ship.add(seatZoro)

  // Gangplank toward pier / beach (local +Z is stern)
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 5.5), mats.wood)
  plank.position.set(0, 1.05, 7.6)
  plank.rotation.x = -0.22
  ship.add(plank)

  // Docked tight against the pier — easy to walk on
  ship.position.set(15.2, 0.2, 16.8)
  ship.rotation.y = Math.PI + 0.35
  ship.scale.setScalar(0.85)

  ship.userData = {
    seatLuffy,
    seatZoro,
    sail,
    speed: 0,
    home: { x: 15.2, z: 16.8, rot: Math.PI + 0.35 },
  }
  return ship
}
