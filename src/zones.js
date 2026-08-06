import * as THREE from 'three'
import { groundY, WATER_SURFACE } from './world.js'

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts })
}

function makeRune(color = 0xffc107) {
  const g = new THREE.Group()
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 0.9, 8),
    mat(0x5d4037),
  )
  pedestal.position.y = 0.45
  pedestal.castShadow = true
  g.add(pedestal)
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.15,
      metalness: 0.4,
      roughness: 0.35,
    }),
  )
  gem.position.y = 1.05
  g.add(gem)
  g.userData = { gem, lit: false, index: 0 }
  return g
}

function makeBrazier() {
  const g = new THREE.Group()
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.3, 0.55, 8),
    mat(0x455a64, { metalness: 0.5, roughness: 0.4 }),
  )
  bowl.position.y = 0.4
  g.add(bowl)
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.55, 6),
    new THREE.MeshStandardMaterial({
      color: 0xff9800,
      emissive: 0xff6d00,
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.9,
    }),
  )
  flame.position.y = 0.85
  flame.visible = false
  g.add(flame)
  const light = new THREE.PointLight(0xff8a00, 0, 8, 2)
  light.position.y = 1.1
  g.add(light)
  g.userData = { flame, light, lit: false, index: 0 }
  return g
}

function makeWindPad() {
  const g = new THREE.Group()
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.5, 0.18, 16),
    new THREE.MeshStandardMaterial({
      color: 0xb3e5fc,
      emissive: 0x4fc3f7,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.85,
      roughness: 0.4,
    }),
  )
  disc.position.y = 0.1
  g.add(disc)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.08, 8, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x81d4fa,
      emissiveIntensity: 0.5,
    }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.22
  g.add(ring)
  g.userData = { ring, boost: 14, cooldown: 0 }
  return g
}

function makeRareChest() {
  const g = new THREE.Group()
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.75, 0.85),
    new THREE.MeshStandardMaterial({
      color: 0x1565c0,
      metalness: 0.45,
      roughness: 0.35,
      emissive: 0x0d47a1,
      emissiveIntensity: 0.25,
    }),
  )
  box.position.y = 0.38
  box.castShadow = true
  g.add(box)
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.2, 0.9),
    new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0xffa000,
      emissiveIntensity: 0.2,
    }),
  )
  lid.position.set(0, 0.82, 0)
  g.add(lid)
  const glow = new THREE.PointLight(0x4fc3f7, 1.2, 10, 2)
  glow.position.y = 1.2
  g.add(glow)
  g.userData = { kind: 'rareChest', opened: false, lid, glow }
  return g
}

/**
 * Desert ruins, winter ice + braziers, sky wind pads, underwater cave.
 */
export function createAdventureZones(scene) {
  // ——— Desert ruins dungeon (west desert -90,-40) ———
  const ruins = new THREE.Group()
  ruins.name = 'DesertRuins'

  const entrance = new THREE.Group()
  const archL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.2, 1.2), mat(0xc4a574))
  archL.position.set(-1.4, 1.6, 0)
  const archR = archL.clone()
  archR.position.x = 1.4
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.6, 1.3), mat(0xb8956a))
  lintel.position.set(0, 3.3, 0)
  entrance.add(archL, archR, lintel)
  const doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.6),
    new THREE.MeshBasicMaterial({
      color: 0xffe082,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    }),
  )
  doorGlow.position.set(0, 1.4, 0.15)
  entrance.add(doorGlow)
  const ex = -84
  const ez = -38
  entrance.position.set(ex, groundY(ex, ez), ez)
  entrance.rotation.y = 0.4
  ruins.add(entrance)

  // Underground chamber (offset below world)
  const chamber = new THREE.Group()
  chamber.position.set(-90, -8, -40)
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.4, 14),
    mat(0x8d6e4c, { roughness: 0.95 }),
  )
  floor.position.y = 0
  floor.receiveShadow = true
  chamber.add(floor)
  const walls = [
    [0, 2, -6.8, 18, 4, 0.5],
    [0, 2, 6.8, 18, 4, 0.5],
    [-8.8, 2, 0, 0.5, 4, 14],
    [8.8, 2, 0, 0.5, 4, 14],
  ]
  for (const [x, y, z, w, h, d] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0x6d4c2f))
    wall.position.set(x, y, z)
    chamber.add(wall)
  }
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 14), mat(0x5d4037))
  ceil.position.y = 4.1
  chamber.add(ceil)
  const torchLight = new THREE.PointLight(0xffb74d, 1.4, 22, 2)
  torchLight.position.set(0, 3.2, 0)
  chamber.add(torchLight)

  const runes = []
  const runeSpots = [
    [-4, -3],
    [0, -3.5],
    [4, -3],
  ]
  // Correct order: left → right → center (0, 2, 1)
  const runeOrder = [0, 2, 1]
  runeSpots.forEach(([rx, rz], i) => {
    const rune = makeRune(0xffc107)
    rune.position.set(rx, 0, rz)
    rune.userData.index = i
    chamber.add(rune)
    runes.push(rune)
  })

  const sealGate = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 3.2, 0.35),
    new THREE.MeshStandardMaterial({
      color: 0x4a148c,
      emissive: 0x7b1fa2,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85,
    }),
  )
  sealGate.position.set(0, 1.7, 4.2)
  chamber.add(sealGate)

  const ruinChest = makeRareChest()
  ruinChest.position.set(0, 0, 5.5)
  ruinChest.visible = false
  chamber.add(ruinChest)

  const exitPad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.3, 0.15, 12),
    new THREE.MeshStandardMaterial({
      color: 0x81c784,
      emissive: 0x2e7d32,
      emissiveIntensity: 0.4,
    }),
  )
  exitPad.position.set(0, 0.1, -5.5)
  chamber.add(exitPad)

  ruins.add(chamber)
  scene.add(ruins)

  const desert = {
    entrance,
    chamber,
    runes,
    runeOrder,
    progress: [],
    sealGate,
    chest: ruinChest,
    exitPad,
    solved: false,
    inside: false,
    spawn: new THREE.Vector3(-90, -7.2, -40),
    exitWorld: new THREE.Vector3(ex, groundY(ex, ez) + 0.2, ez + 3),
  }

  // ——— Winter ice + braziers ———
  const icePatches = [
    { x: -55, z: 85, r: 14 },
    { x: -130, z: 30, r: 13 },
  ]
  const iceMeshes = []
  for (const p of icePatches) {
    const ice = new THREE.Mesh(
      new THREE.CircleGeometry(p.r * 0.85, 28),
      new THREE.MeshStandardMaterial({
        color: 0xe3f2fd,
        transparent: true,
        opacity: 0.55,
        roughness: 0.15,
        metalness: 0.2,
      }),
    )
    ice.rotation.x = -Math.PI / 2
    ice.position.set(p.x, groundY(p.x, p.z) + 0.08, p.z)
    scene.add(ice)
    iceMeshes.push(ice)
  }

  const braziers = []
  const brazierSpots = [
    [-50, 88],
    [-58, 82],
    [-48, 92],
  ]
  // Light order: 0 → 1 → 2
  brazierSpots.forEach(([bx, bz], i) => {
    const b = makeBrazier()
    b.position.set(bx, groundY(bx, bz), bz)
    b.userData.index = i
    scene.add(b)
    braziers.push(b)
  })

  const winterChest = makeRareChest()
  winterChest.position.set(-54, groundY(-54, 86), 86)
  winterChest.visible = false
  scene.add(winterChest)

  const winter = {
    icePatches,
    iceMeshes,
    braziers,
    progress: [],
    order: [0, 1, 2],
    solved: false,
    chest: winterChest,
  }

  // ——— Sky wind pads ———
  const windPads = []
  const padSpots = [
    [110, 110],
    [118, 108],
    [104, 118],
    [102, 104],
    [116, 116],
  ]
  for (const [px, pz] of padSpots) {
    const pad = makeWindPad()
    const gy = groundY(px, pz)
    pad.position.set(px, Math.max(gy, 14), pz)
    scene.add(pad)
    windPads.push(pad)
  }

  // ——— Underwater cave (NE of main island / Jinbe) ———
  const cave = new THREE.Group()
  cave.name = 'UnderwaterCave'
  const caveCx = 30
  const caveCz = 18
  cave.position.set(caveCx, WATER_SURFACE - 2.4, caveCz)

  const caveFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 6, 0.4, 12),
    mat(0x37474f),
  )
  cave.add(caveFloor)
  const caveWall = new THREE.Mesh(
    new THREE.CylinderGeometry(5.8, 6.2, 3.2, 12, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x263238,
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
  )
  caveWall.position.y = 1.5
  cave.add(caveWall)
  const caveRoof = new THREE.Mesh(
    new THREE.SphereGeometry(6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0x1a237e, { roughness: 0.8 }),
  )
  caveRoof.position.y = 2.8
  cave.add(caveRoof)

  // Mouth marker buoy / rocks at surface edge
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.35, 8, 16),
    new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      emissive: 0x0288d1,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.7,
    }),
  )
  mouth.rotation.x = Math.PI / 2
  mouth.position.set(caveCx, WATER_SURFACE - 0.3, caveCz)
  scene.add(mouth)

  const caveChest = makeRareChest()
  caveChest.position.set(0, 0.2, 0)
  cave.add(caveChest)
  scene.add(cave)

  const underwater = {
    cave,
    mouth,
    chest: caveChest,
    center: new THREE.Vector3(caveCx, WATER_SURFACE - 2.4, caveCz),
    radius: 5.5,
  }

  return {
    desert,
    winter,
    windPads,
    underwater,
    chests: [ruinChest, winterChest, caveChest],
  }
}

/**
 * @returns {{ handled: boolean, message?: string, reward?: object }}
 */
export function tryZoneInteract(zones, player, activeId) {
  const p = player.position

  // Desert entrance / exit / runes / chest
  const d = zones.desert
  if (!d.inside) {
    const entr = d.entrance.position
    if (Math.hypot(p.x - entr.x, p.z - entr.z) < 2.6 && p.y > -2) {
      d.inside = true
      player.position.copy(d.spawn)
      player.userData.swimming = false
      player.userData.diving = false
      player.userData.onGround = true
      player.userData.velY = 0
      return { handled: true, message: 'Entered desert ruins — light runes in order' }
    }
  } else {
    // Exit pad
    const exitLocal = new THREE.Vector3()
    d.exitPad.getWorldPosition(exitLocal)
    if (p.distanceTo(exitLocal) < 2.2) {
      d.inside = false
      player.position.copy(d.exitWorld)
      player.userData.onGround = true
      return { handled: true, message: 'Back to the desert surface' }
    }
    // Runes
    for (const rune of d.runes) {
      if (rune.userData.lit) continue
      const rw = new THREE.Vector3()
      rune.getWorldPosition(rw)
      if (p.distanceTo(rw) < 2.1) {
        const next = d.runeOrder[d.progress.length]
        if (rune.userData.index === next) {
          rune.userData.lit = true
          rune.userData.gem.material.emissiveIntensity = 1.2
          d.progress.push(rune.userData.index)
          if (d.progress.length >= d.runeOrder.length) {
            d.solved = true
            d.sealGate.visible = false
            d.chest.visible = true
            return {
              handled: true,
              message: 'Ruins unlocked! Ancient chest revealed',
              reward: { berries: 8, bounty: 800_000 },
            }
          }
          return {
            handled: true,
            message: `Rune ${d.progress.length}/${d.runeOrder.length} lit`,
          }
        }
        // Wrong — reset
        d.progress = []
        for (const r of d.runes) {
          r.userData.lit = false
          r.userData.gem.material.emissiveIntensity = 0.15
        }
        return { handled: true, message: 'Wrong order — runes reset' }
      }
    }
    if (d.solved && d.chest.visible && !d.chest.userData.opened) {
      const cw = new THREE.Vector3()
      d.chest.getWorldPosition(cw)
      if (p.distanceTo(cw) < 2.3) {
        d.chest.userData.opened = true
        d.chest.userData.lid.rotation.x = -1.1
        return {
          handled: true,
          message: 'Desert ruin treasure! +12 Berry',
          reward: { berries: 12, bounty: 1_200_000, rare: true },
        }
      }
    }
  }

  // Winter braziers
  const w = zones.winter
  for (const b of w.braziers) {
    if (b.userData.lit) continue
    if (p.distanceTo(b.position) < 2.2) {
      const next = w.order[w.progress.length]
      if (b.userData.index === next) {
        b.userData.lit = true
        b.userData.flame.visible = true
        b.userData.flame.material.emissiveIntensity = 1.4
        b.userData.light.intensity = 2.5
        w.progress.push(b.userData.index)
        if (w.progress.length >= w.order.length) {
          w.solved = true
          w.chest.visible = true
          // Melt ice visuals a bit
          for (const ice of w.iceMeshes) {
            ice.material.opacity = 0.25
            ice.material.color.setHex(0x90caf9)
          }
          return {
            handled: true,
            message: 'All braziers lit — ice softens, treasure appears!',
            reward: { berries: 6, bounty: 700_000 },
          }
        }
        return {
          handled: true,
          message: `Brazier ${w.progress.length}/${w.order.length} lit`,
        }
      }
      // Reset
      w.progress = []
      for (const bb of w.braziers) {
        bb.userData.lit = false
        bb.userData.flame.visible = false
        bb.userData.flame.material.emissiveIntensity = 0
        bb.userData.light.intensity = 0
      }
      return { handled: true, message: 'Wrong brazier — flames snuffed out' }
    }
  }
  if (w.solved && w.chest.visible && !w.chest.userData.opened) {
    if (p.distanceTo(w.chest.position) < 2.3) {
      w.chest.userData.opened = true
      w.chest.userData.lid.rotation.x = -1.1
      return {
        handled: true,
        message: 'Winter cache claimed! +10 Berry',
        reward: { berries: 10, bounty: 900_000, rare: true },
      }
    }
  }

  // Underwater cave chest
  const u = zones.underwater
  if (
    !u.chest.userData.opened &&
    (player.userData.diving || activeId === 'jinbe')
  ) {
    const cw = new THREE.Vector3()
    u.chest.getWorldPosition(cw)
    const reach = activeId === 'jinbe' ? 3.2 : 2.4
    if (p.distanceTo(cw) < reach) {
      // Non-Jinbe must be diving
      if (activeId !== 'jinbe' && !player.userData.diving) {
        return { handled: false }
      }
      u.chest.userData.opened = true
      u.chest.userData.lid.rotation.x = -1.1
      return {
        handled: true,
        message:
          activeId === 'jinbe'
            ? 'Fish-Man treasure! Jinbe claims the deep chest'
            : 'Deep-sea chest! +15 Berry',
        reward: {
          berries: activeId === 'jinbe' ? 18 : 15,
          bounty: 1_500_000,
          rare: true,
        },
      }
    }
  }

  return { handled: false }
}

/**
 * Per-frame zone gameplay: ice slip, wind pads, desert containment, cave glow.
 */
export function updateAdventureZones(zones, {
  player,
  playerVel,
  delta,
  t,
  activeId,
  onGround,
}) {
  const p = player.position
  let onIce = false
  let hint = null

  // Ice slip
  if (onGround && !player.userData.swimming && !zones.desert.inside) {
    for (const patch of zones.winter.icePatches) {
      const dist = Math.hypot(p.x - patch.x, p.z - patch.z)
      if (dist < patch.r) {
        onIce = true
        // After puzzle, ice is less slippery
        const slip = zones.winter.solved ? 0.55 : 1
        // Weaker accel damping handled by caller via returned iceFactor
        if (!hint && !zones.winter.solved) {
          hint = 'Ice! Light braziers in order (E) — watch your footing'
        }
        break
      }
    }
  }

  // Wind pads
  for (const pad of zones.windPads) {
    pad.userData.cooldown = Math.max(0, pad.userData.cooldown - delta)
    pad.userData.ring.rotation.z = t * 2.5
    pad.position.y = groundY(pad.position.x, pad.position.z) + 0.05 + Math.sin(t * 3 + pad.position.x) * 0.04
    const dist = Math.hypot(p.x - pad.position.x, p.z - pad.position.z)
    if (dist < 1.6 && pad.userData.cooldown <= 0 && p.y > pad.position.y - 0.5) {
      player.userData.velY = Math.max(player.userData.velY || 0, pad.userData.boost)
      player.userData.onGround = false
      // Slight outward boost from pad center
      const dx = p.x - pad.position.x
      const dz = p.z - pad.position.z
      const len = Math.hypot(dx, dz) || 1
      playerVel.x += (dx / len) * 6
      playerVel.z += (dz / len) * 6
      pad.userData.cooldown = 0.85
      hint = 'Wind pad! Updraft!'
    } else if (dist < 3.5 && !hint) {
      hint = 'Sky wind pad — step on for an updraft'
    }
  }

  // Desert entrance hint / contain player in chamber
  const d = zones.desert
  if (!d.inside) {
    const entr = d.entrance.position
    if (Math.hypot(p.x - entr.x, p.z - entr.z) < 3.5 && !hint) {
      hint = 'Desert ruins — press E to enter'
    }
  } else {
    // Soft bounds inside chamber (world space around chamber center)
    const cx = d.chamber.position.x
    const cz = d.chamber.position.z
    const dx = p.x - cx
    const dz = p.z - cz
    if (Math.abs(dx) > 8) p.x = cx + Math.sign(dx) * 8
    if (Math.abs(dz) > 6) p.z = cz + Math.sign(dz) * 6
    // Keep underground
    if (p.y > -5) p.y = d.spawn.y
    player.userData.swimming = false
    player.userData.diving = false
    if (!hint) {
      hint = d.solved
        ? 'Ruins cleared — claim chest or stand on green pad (E) to exit'
        : 'Light the three runes in the correct order (E)'
    }
  }

  // Underwater cave
  const u = zones.underwater
  u.mouth.rotation.z = t * 0.4
  u.mouth.material.opacity = 0.55 + Math.sin(t * 2) * 0.15
  const toCave = Math.hypot(p.x - u.center.x, p.z - u.center.z)
  if (toCave < 10 && !u.chest.userData.opened) {
    if (activeId === 'jinbe') {
      hint = hint || 'Jinbe senses a cave below — dive or swim in (E near chest)'
    } else if (player.userData.diving) {
      hint = hint || 'Underwater cave — reach the glowing chest'
    } else if (player.userData.swimming) {
      hint = hint || 'Dive (Ctrl) into the glowing ring — Jinbe is strongest here'
    }
  }

  // Brazier proximity hint
  if (!zones.winter.solved && onIce) {
    for (const b of zones.winter.braziers) {
      if (!b.userData.lit && p.distanceTo(b.position) < 3) {
        hint = 'Press E to light the brazier'
        break
      }
    }
  }

  return {
    onIce,
    iceDamp: onIce ? (zones.winter.solved ? 3.2 : 1.15) : null,
    iceAccel: onIce ? (zones.winter.solved ? 0.7 : 0.45) : 1,
    hint,
  }
}
