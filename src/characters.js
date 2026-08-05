import * as THREE from 'three'

function skinMat(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.05,
  })
}

function clothMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.02,
    ...opts,
  })
}

function enableShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
}

function makeLimb(mat, h, r = 0.12) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 4, 8), mat)
  mesh.position.y = -h / 2 - r
  const pivot = new THREE.Group()
  pivot.add(mesh)
  pivot.userData.limbMesh = mesh
  pivot.userData.baseHeight = h
  return pivot
}

function makeHead(skin, hairColor, opts = {}) {
  const head = new THREE.Group()
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), skin)
  skull.scale.set(1, 1.05, 1)
  head.add(skull)

  const eyeWhite = clothMat(0xffffff)
  const pupil = clothMat(0x111111)
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeWhite)
    white.scale.set(1, 1.15, 0.5)
    white.position.set(side * 0.14, 0.06, 0.32)
    head.add(white)
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), pupil)
    p.position.set(side * 0.14, 0.06, 0.37)
    head.add(p)
  }

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI),
    clothMat(0x222222),
  )
  smile.position.set(0, -0.12, 0.34)
  smile.rotation.set(Math.PI, 0, 0)
  head.add(smile)

  if (opts.scar) {
    const scar = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.18, 0.01),
      clothMat(0x8b4513),
    )
    scar.position.set(-0.14, 0.08, 0.37)
    scar.rotation.z = 0.25
    head.add(scar)
  }

  if (opts.hairStyle === 'luffy') {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 10),
      clothMat(hairColor),
    )
    hair.scale.set(1.05, 0.7, 1.05)
    hair.position.y = 0.18
    hair.name = 'hair'
    head.add(hair)
  } else if (opts.hairStyle === 'zoro') {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 10),
      clothMat(hairColor),
    )
    hair.scale.set(1.1, 0.95, 1.05)
    hair.position.set(0, 0.12, -0.05)
    head.add(hair)
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.35, 5),
        clothMat(hairColor),
      )
      const a = -0.8 + i * 0.4
      spike.position.set(Math.sin(a) * 0.25, 0.35, -0.05 + Math.cos(a) * 0.05)
      spike.rotation.z = -a * 0.5
      head.add(spike)
    }
  }

  return head
}

function makeStrawHat() {
  const hat = new THREE.Group()
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.05, 20),
    clothMat(0xd4a017),
  )
  brim.position.y = 0.02
  hat.add(brim)
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.28, 16),
    clothMat(0xe0b040),
  )
  crown.position.y = 0.16
  hat.add(crown)
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.035, 6, 20),
    clothMat(0xc41e3a),
  )
  band.rotation.x = Math.PI / 2
  band.position.y = 0.08
  hat.add(band)
  return hat
}

function makeKatana(length = 1.1) {
  const sword = new THREE.Group()
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, length, 0.02),
    new THREE.MeshStandardMaterial({
      color: 0xdfe7ef,
      metalness: 0.85,
      roughness: 0.2,
    }),
  )
  blade.position.y = length / 2
  sword.add(blade)
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.04, 0.08),
    clothMat(0x222222),
  )
  sword.add(guard)
  const hilt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.04, 0.28, 8),
    clothMat(0x1a5c3a),
  )
  hilt.position.y = -0.16
  sword.add(hilt)
  return sword
}

function makeGearClouds() {
  const group = new THREE.Group()
  group.visible = false
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    opacity: 0.92,
    emissive: 0xffffff,
    emissiveIntensity: 0.15,
  })
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat)
    const a = (i / 8) * Math.PI * 2
    puff.position.set(Math.cos(a) * 0.55, 0.15 + (i % 3) * 0.12, Math.sin(a) * 0.4)
    puff.scale.setScalar(0.7 + (i % 3) * 0.2)
    group.add(puff)
  }
  return group
}

export function createLuffy() {
  const root = new THREE.Group()
  root.name = 'Luffy'
  const skin = skinMat(0xffd2a6)

  const hips = new THREE.Group()
  hips.position.y = 0.95
  root.add(hips)

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.45, 6, 10),
    clothMat(0xc62828),
  )
  torso.position.y = 0.35
  hips.add(torso)

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin)
  chest.scale.set(1.1, 0.7, 0.7)
  chest.position.set(0, 0.45, 0.12)
  hips.add(chest)

  const shorts = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.3, 0.35, 10),
    clothMat(0x1565c0),
  )
  shorts.position.y = -0.05
  hips.add(shorts)

  const head = makeHead(skin, 0x1a1a1a, { hairStyle: 'luffy' })
  head.position.y = 0.95
  hips.add(head)

  const hat = makeStrawHat()
  hat.position.y = 0.42
  head.add(hat)

  const gearClouds = makeGearClouds()
  gearClouds.position.y = 0.35
  head.add(gearClouds)

  const leftArm = makeLimb(skin, 0.45, 0.1)
  leftArm.position.set(-0.42, 0.55, 0)
  hips.add(leftArm)
  const rightArm = makeLimb(skin, 0.45, 0.1)
  rightArm.position.set(0.42, 0.55, 0)
  hips.add(rightArm)

  // Stretch punch beam (hidden until attack)
  const stretch = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.11, 1, 4, 8),
    skinMat(0xffd2a6),
  )
  stretch.visible = false
  stretch.rotation.x = Math.PI / 2
  stretch.position.set(0.42, 0.55, 0.5)
  hips.add(stretch)

  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skin)
  fist.visible = false
  hips.add(fist)

  const leftLeg = makeLimb(skin, 0.5, 0.12)
  leftLeg.position.set(-0.16, 0, 0)
  hips.add(leftLeg)
  const rightLeg = makeLimb(skin, 0.5, 0.12)
  rightLeg.position.set(0.16, 0, 0)
  hips.add(rightLeg)

  for (const leg of [leftLeg, rightLeg]) {
    const sandal = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.06, 0.32),
      clothMat(0x5d4037),
    )
    sandal.position.y = -0.72
    sandal.position.z = 0.04
    leg.add(sandal)
  }

  root.userData = {
    kind: 'luffy',
    hips,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    hat,
    gearClouds,
    stretch,
    fist,
    gear5: false,
    punchT: -1,
    kickT: -1,
    staffT: -1,
    shotT: -1,
    slashT: -1,
    attackLock: 0,
    displayName: 'Luffy',
    moveSpeed: 4.4,
  }

  enableShadows(root)
  return root
}

export function createZoro() {
  const root = new THREE.Group()
  root.name = 'Zoro'
  const skin = skinMat(0xf0c49a)

  const hips = new THREE.Group()
  hips.position.y = 0.95
  root.add(hips)

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.5, 6, 10),
    clothMat(0xf5f5f5),
  )
  torso.position.y = 0.38
  hips.add(torso)

  const sash = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.08, 8, 16),
    clothMat(0x2e7d32),
  )
  sash.rotation.x = Math.PI / 2
  sash.position.y = 0.12
  hips.add(sash)

  const pants = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.28, 0.7, 10),
    clothMat(0x1b5e20),
  )
  pants.position.y = -0.2
  hips.add(pants)

  const head = makeHead(skin, 0x1b5e20, { hairStyle: 'zoro', scar: true })
  head.position.y = 1.0
  hips.add(head)

  const bandana = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.05, 6, 14),
    clothMat(0x111111),
  )
  bandana.rotation.x = Math.PI / 2
  bandana.position.set(0, 0.28, -0.05)
  head.add(bandana)

  const leftArm = makeLimb(skin, 0.48, 0.11)
  leftArm.position.set(-0.45, 0.58, 0)
  hips.add(leftArm)
  const rightArm = makeLimb(skin, 0.48, 0.11)
  rightArm.position.set(0.45, 0.58, 0)
  hips.add(rightArm)

  const leftLeg = makeLimb(skin, 0.52, 0.13)
  leftLeg.position.set(-0.16, 0, 0)
  hips.add(leftLeg)
  const rightLeg = makeLimb(skin, 0.52, 0.13)
  rightLeg.position.set(0.16, 0, 0)
  hips.add(rightLeg)

  const swordL = makeKatana(1.05)
  swordL.position.set(-0.35, 0.1, -0.15)
  swordL.rotation.set(0.2, 0, 0.9)
  hips.add(swordL)

  const swordR = makeKatana(1.05)
  swordR.position.set(0.35, 0.1, -0.15)
  swordR.rotation.set(0.2, 0, -0.9)
  hips.add(swordR)

  const swordMouth = makeKatana(0.95)
  swordMouth.position.set(0, 0.85, 0.35)
  swordMouth.rotation.set(1.2, 0, 0)
  swordMouth.visible = false
  hips.add(swordMouth)

  root.userData = {
    kind: 'zoro',
    hips,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    swordL,
    swordR,
    swordMouth,
    slashT: -1,
    punchT: -1,
    kickT: -1,
    staffT: -1,
    shotT: -1,
    attackLock: 0,
    displayName: 'Zoro',
    moveSpeed: 3.8,
  }

  enableShadows(root)
  return root
}

export function setGear5(luffy, enabled) {
  const d = luffy.userData
  d.gear5 = enabled
  d.gearClouds.visible = enabled
  const hair = d.head.getObjectByName('hair')
  if (hair?.material) {
    hair.material.color.set(enabled ? 0xffffff : 0x1a1a1a)
    hair.material.emissive = new THREE.Color(enabled ? 0xffffff : 0x000000)
    hair.material.emissiveIntensity = enabled ? 0.35 : 0
  }
  if (d.hat) d.hat.visible = !enabled
}

export function triggerRubberPunch(luffy) {
  const d = luffy.userData
  if (d.attackLock > 0 || d.punchT >= 0) return false
  d.punchT = 0
  d.attackLock = 0.85
  d.rightArm.visible = false
  d.stretch.visible = true
  d.fist.visible = true
  return true
}

export function triggerSlash(zoro) {
  const d = zoro.userData
  if (d.attackLock > 0 || d.slashT >= 0) return false
  d.slashT = 0
  d.attackLock = 0.55
  d.swordMouth.visible = true
  return true
}

/** Create a reusable triple-slash VFX group (add to scene once). */
export function createSlashVfx() {
  const group = new THREE.Group()
  group.visible = false
  const mat = new THREE.MeshBasicMaterial({
    color: 0xa7f3d0,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.4, 24, 1, 0, Math.PI * 0.85),
      mat.clone(),
    )
    arc.rotation.y = Math.PI / 2
    arc.rotation.z = (i - 1) * 0.35
    arc.position.set(0, 1.1 + i * 0.15, 0.8)
    group.add(arc)
  }
  return group
}

function baseHumanoid(opts) {
  const {
    name,
    kind,
    skinColor,
    hairColor,
    hairStyle,
    torsoColor,
    legsColor,
    displayName,
    scale = 1,
    scar = false,
  } = opts
  const root = new THREE.Group()
  root.name = name
  root.scale.setScalar(scale)
  const skin = skinMat(skinColor)

  const hips = new THREE.Group()
  hips.position.y = 0.95
  root.add(hips)

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.48, 6, 10),
    clothMat(torsoColor),
  )
  torso.position.y = 0.36
  hips.add(torso)

  const pants = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.28, 0.55, 10),
    clothMat(legsColor),
  )
  pants.position.y = -0.12
  hips.add(pants)

  const head = makeHead(skin, hairColor, { hairStyle, scar })
  head.position.y = 0.98
  hips.add(head)

  const leftArm = makeLimb(skin, 0.46, 0.1)
  leftArm.position.set(-0.42, 0.55, 0)
  hips.add(leftArm)
  const rightArm = makeLimb(skin, 0.46, 0.1)
  rightArm.position.set(0.42, 0.55, 0)
  hips.add(rightArm)

  const leftLeg = makeLimb(skin, 0.5, 0.12)
  leftLeg.position.set(-0.16, 0, 0)
  hips.add(leftLeg)
  const rightLeg = makeLimb(skin, 0.5, 0.12)
  rightLeg.position.set(0.16, 0, 0)
  hips.add(rightLeg)

  root.userData = {
    kind,
    hips,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    attackLock: 0,
    kickT: -1,
    staffT: -1,
    shotT: -1,
    punchT: -1,
    slashT: -1,
    displayName,
    moveSpeed: opts.moveSpeed ?? 4,
  }
  enableShadows(root)
  return root
}

export function createNami() {
  const root = baseHumanoid({
    name: 'Nami',
    kind: 'nami',
    skinColor: 0xffd4b8,
    hairColor: 0xff8a00,
    hairStyle: 'luffy',
    torsoColor: 0xff8a65,
    legsColor: 0x1565c0,
    displayName: 'Nami',
    moveSpeed: 4.2,
  })
  const staff = new THREE.Group()
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.045, 1.6, 6),
    clothMat(0xf5f5f5),
  )
  pole.position.y = 0.8
  staff.add(pole)
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      emissive: 0x29b6f6,
      emissiveIntensity: 0.4,
    }),
  )
  tip.position.y = 1.55
  staff.add(tip)
  staff.position.set(0.45, 0.2, 0)
  staff.rotation.z = -0.3
  root.userData.hips.add(staff)
  root.userData.staff = staff
  return root
}

export function createUsopp() {
  const root = baseHumanoid({
    name: 'Usopp',
    kind: 'usopp',
    skinColor: 0xc68642,
    hairColor: 0x3e2723,
    hairStyle: 'zoro',
    torsoColor: 0xffeb3b,
    legsColor: 0x5d4037,
    displayName: 'Usopp',
    moveSpeed: 3.9,
  })
  // Long nose
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.35, 6),
    skinMat(0xc68642),
  )
  nose.rotation.x = Math.PI / 2
  nose.position.set(0, 0.02, 0.45)
  root.userData.head.add(nose)

  const sling = new THREE.Group()
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.5, 0.08),
    clothMat(0x5d4037),
  )
  sling.add(handle)
  sling.position.set(0.4, 0.4, 0.1)
  root.userData.hips.add(sling)
  root.userData.sling = sling
  return root
}

export function createSanji() {
  const root = baseHumanoid({
    name: 'Sanji',
    kind: 'sanji',
    skinColor: 0xffd2a6,
    hairColor: 0xfdd835,
    hairStyle: 'luffy',
    torsoColor: 0x212121,
    legsColor: 0x111111,
    displayName: 'Sanji',
    moveSpeed: 4.6,
  })
  // Curly brow hint
  const brow = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.02, 4, 10, Math.PI),
    clothMat(0xfdd835),
  )
  brow.position.set(0.12, 0.18, 0.34)
  brow.rotation.z = -0.4
  root.userData.head.add(brow)
  // Cigarette
  const cig = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4),
    clothMat(0xfff8e1),
  )
  cig.rotation.z = Math.PI / 2
  cig.position.set(0.05, -0.1, 0.4)
  root.userData.head.add(cig)
  return root
}

export function createChopper() {
  const root = new THREE.Group()
  root.name = 'Chopper'
  root.scale.setScalar(0.75)
  const fur = skinMat(0xd7ccc8)
  const hips = new THREE.Group()
  hips.position.y = 0.7
  root.add(hips)

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), fur)
  body.scale.set(1, 1.1, 0.9)
  hips.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), fur)
  head.position.y = 0.7
  hips.add(head)

  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.38, 0.2, 12),
    clothMat(0xc62828),
  )
  hat.position.y = 0.35
  head.add(hat)
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.02), clothMat(0xffffff))
  cross.position.set(0, 0.05, 0.2)
  hat.add(cross)
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.02), clothMat(0xffffff))
  cross2.position.set(0, 0.05, 0.2)
  hat.add(cross2)

  for (const side of [-1, 1]) {
    const antler = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.35, 5),
      clothMat(0x5d4037),
    )
    antler.position.set(side * 0.22, 0.45, 0)
    antler.rotation.z = side * -0.35
    head.add(antler)
  }

  const leftArm = makeLimb(fur, 0.28, 0.12)
  leftArm.position.set(-0.4, 0.2, 0)
  hips.add(leftArm)
  const rightArm = makeLimb(fur, 0.28, 0.12)
  rightArm.position.set(0.4, 0.2, 0)
  hips.add(rightArm)
  const leftLeg = makeLimb(fur, 0.28, 0.12)
  leftLeg.position.set(-0.16, -0.2, 0)
  hips.add(leftLeg)
  const rightLeg = makeLimb(fur, 0.28, 0.12)
  rightLeg.position.set(0.16, -0.2, 0)
  hips.add(rightLeg)

  root.userData = {
    kind: 'chopper',
    hips,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    attackLock: 0,
    kickT: -1,
    punchT: -1,
    slashT: -1,
    staffT: -1,
    shotT: -1,
    displayName: 'Chopper',
    moveSpeed: 3.6,
  }
  enableShadows(root)
  return root
}

export function createRobin() {
  const root = baseHumanoid({
    name: 'Robin',
    kind: 'robin',
    skinColor: 0xffd2a6,
    hairColor: 0x212121,
    hairStyle: 'luffy',
    torsoColor: 0x4a148c,
    legsColor: 0x311b92,
    displayName: 'Robin',
    moveSpeed: 4.0,
  })
  // Extra sprouted arms (shown during attack)
  const bloom = new THREE.Group()
  bloom.visible = false
  for (let i = 0; i < 4; i++) {
    const arm = makeLimb(skinMat(0xffd2a6), 0.35, 0.08)
    const a = (i / 4) * Math.PI * 2
    arm.position.set(Math.cos(a) * 0.7, 0.4, Math.sin(a) * 0.5)
    bloom.add(arm)
  }
  root.userData.hips.add(bloom)
  root.userData.bloom = bloom
  return root
}

export function createFranky() {
  const root = baseHumanoid({
    name: 'Franky',
    kind: 'franky',
    skinColor: 0x29b6f6,
    hairColor: 0x1565c0,
    hairStyle: 'zoro',
    torsoColor: 0xfff8e1,
    legsColor: 0x37474f,
    displayName: 'Franky',
    scale: 1.15,
    moveSpeed: 3.5,
  })
  const sunglass = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.12, 0.08),
    clothMat(0x111111),
  )
  sunglass.position.set(0, 0.08, 0.36)
  root.userData.head.add(sunglass)
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8),
    new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00bcd4,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.85,
    }),
  )
  beam.visible = false
  beam.rotation.x = Math.PI / 2
  beam.position.set(0, 0.7, 1.2)
  root.userData.hips.add(beam)
  root.userData.beam = beam
  return root
}

export function createBrook() {
  const root = baseHumanoid({
    name: 'Brook',
    kind: 'brook',
    skinColor: 0xf5f5f5,
    hairColor: 0x212121,
    hairStyle: 'luffy',
    torsoColor: 0x212121,
    legsColor: 0x111111,
    displayName: 'Brook',
    moveSpeed: 4.1,
  })
  // Afro
  const afro = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8),
    clothMat(0x212121),
  )
  afro.position.y = 0.35
  root.userData.head.add(afro)
  const cane = makeKatana(1.2)
  cane.position.set(0.4, 0.15, -0.1)
  cane.rotation.z = -0.5
  root.userData.hips.add(cane)
  root.userData.cane = cane
  return root
}

export function createJinbe() {
  const root = baseHumanoid({
    name: 'Jinbe',
    kind: 'jinbe',
    skinColor: 0x4fc3f7,
    hairColor: 0x000000,
    hairStyle: 'zoro',
    torsoColor: 0xffeb3b,
    legsColor: 0xff8f00,
    displayName: 'Jinbe',
    scale: 1.2,
    moveSpeed: 3.7,
  })
  // Fin ears
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.4, 4),
      clothMat(0x0288d1),
    )
    fin.position.set(side * 0.4, 0.1, 0)
    fin.rotation.z = side * 0.9
    root.userData.head.add(fin)
  }
  return root
}

export const CREW_ORDER = [
  'luffy',
  'zoro',
  'nami',
  'usopp',
  'sanji',
  'chopper',
  'robin',
  'franky',
  'brook',
  'jinbe',
]

export function createCrew() {
  return {
    luffy: createLuffy(),
    zoro: createZoro(),
    nami: createNami(),
    usopp: createUsopp(),
    sanji: createSanji(),
    chopper: createChopper(),
    robin: createRobin(),
    franky: createFranky(),
    brook: createBrook(),
    jinbe: createJinbe(),
  }
}

export function triggerKick(char) {
  const d = char.userData
  if (d.attackLock > 0 || d.kickT >= 0) return false
  d.kickT = 0
  d.attackLock = 0.55
  return true
}

export function triggerStaff(char) {
  const d = char.userData
  if (d.attackLock > 0 || d.staffT >= 0) return false
  d.staffT = 0
  d.attackLock = 0.5
  return true
}

export function triggerShot(char) {
  const d = char.userData
  if (d.attackLock > 0 || d.shotT >= 0) return false
  d.shotT = 0
  d.attackLock = 0.45
  return true
}

export function triggerBloom(char) {
  const d = char.userData
  if (d.attackLock > 0 || d.staffT >= 0) return false
  d.staffT = 0
  d.attackLock = 0.7
  if (d.bloom) d.bloom.visible = true
  return true
}

export function triggerBeam(char) {
  const d = char.userData
  if (d.attackLock > 0 || d.punchT >= 0) return false
  d.punchT = 0
  d.attackLock = 0.7
  if (d.beam) d.beam.visible = true
  return true
}

/** Create a reusable triple-slash VFX group (add to scene once). */
export function createPelletVfx() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffeb3b,
      emissive: 0xffc107,
      emissiveIntensity: 0.5,
    }),
  )
  mesh.visible = false
  mesh.userData = { t: -1, dir: new THREE.Vector3() }
  return mesh
}

export function updateCharacterAnim(char, moving, running, t, opts = {}) {
  const d = char.userData
  if (!d?.leftArm) return

  const punching = d.punchT >= 0
  const slashing = d.slashT >= 0
  const kicking = d.kickT >= 0
  const staffing = d.staffT >= 0
  const shooting = d.shotT >= 0
  const attacking = punching || slashing || kicking || staffing || shooting

  if (d.attackLock > 0) d.attackLock -= opts.delta ?? 0.016

  // Rubber punch stretch
  if (punching && d.stretch) {
    d.punchT += opts.delta ?? 0.016
    const p = d.punchT
    const extend = p < 0.25 ? p / 0.25 : p < 0.45 ? 1 : Math.max(0, 1 - (p - 0.45) / 0.35)
    const reach = (d.gear5 ? 5.5 : 3.2) * extend
    d.stretch.scale.set(1, 1, Math.max(0.01, reach))
    d.stretch.position.set(0.42, 0.55, 0.35 + reach * 0.5)
    d.fist.position.set(0.42, 0.55, 0.5 + reach)
    d.leftArm.rotation.x = -0.4
    if (p > 0.8) {
      d.punchT = -1
      d.stretch.visible = false
      d.fist.visible = false
      d.rightArm.visible = true
    }
  } else if (punching && d.beam) {
    // Franky beam
    d.punchT += opts.delta ?? 0.016
    const p = d.punchT
    d.beam.scale.z = 1 + p * 4
    d.beam.material.opacity = Math.max(0, 0.9 - p)
    d.rightArm.rotation.x = -1.4
    if (p > 0.55) {
      d.punchT = -1
      d.beam.visible = false
      d.beam.scale.z = 1
    }
  } else if (punching) {
    // Generic punch (Jinbe / Chopper)
    d.punchT += opts.delta ?? 0.016
    const p = d.punchT
    d.rightArm.rotation.x = -1.5 * Math.min(1, p * 4)
    if (p > 0.4) d.punchT = -1
  }

  // Slash pose (Zoro / Brook)
  if (slashing) {
    d.slashT += opts.delta ?? 0.016
    const s = d.slashT
    d.rightArm.rotation.x = -1.2 + Math.sin(s * 20) * 0.3
    d.leftArm.rotation.x = -0.8
    d.rightArm.rotation.z = -0.8
    d.leftArm.rotation.z = 0.8
    if (d.swordR) d.swordR.rotation.set(-1.2, 0.2, -0.3)
    if (d.swordL) d.swordL.rotation.set(-1.0, -0.2, 0.3)
    if (d.cane) d.cane.rotation.set(-1.2, 0.2, -0.4)
    if (s > 0.45) {
      d.slashT = -1
      if (d.swordL) d.swordL.rotation.set(0.2, 0, 0.9)
      if (d.swordR) d.swordR.rotation.set(0.2, 0, -0.9)
      if (d.cane) d.cane.rotation.set(0, 0, -0.5)
    }
  }

  // Sanji / Chopper kick
  if (kicking) {
    d.kickT += opts.delta ?? 0.016
    const k = d.kickT
    d.rightLeg.rotation.x = -1.6 * Math.min(1, k * 5)
    d.leftArm.rotation.x = 0.5
    if (k > 0.4) d.kickT = -1
  }

  // Nami staff / Robin bloom
  if (staffing) {
    d.staffT += opts.delta ?? 0.016
    const s = d.staffT
    d.rightArm.rotation.x = -1.3
    d.rightArm.rotation.z = -0.6 + Math.sin(s * 18) * 0.4
    if (d.staff) d.staff.rotation.z = -0.3 - s * 2
    if (d.bloom) {
      d.bloom.rotation.y = s * 8
      d.bloom.visible = true
    }
    if (s > 0.5) {
      d.staffT = -1
      if (d.staff) d.staff.rotation.z = -0.3
      if (d.bloom) d.bloom.visible = false
    }
  }

  // Usopp shot pose
  if (shooting) {
    d.shotT += opts.delta ?? 0.016
    d.leftArm.rotation.x = -1.2
    d.rightArm.rotation.x = -0.9
    if (d.shotT > 0.35) d.shotT = -1
  }

  if (!attacking) {
    const swimming = opts.swimming || d.swimming
    const climbing = opts.climbing || d.climbing

    if (climbing) {
      const swing = Math.sin(t * 10) * 0.5
      d.leftArm.rotation.x = -1.2 + swing
      d.rightArm.rotation.x = -1.2 - swing
      d.leftLeg.rotation.x = swing * 0.5
      d.rightLeg.rotation.x = -swing * 0.5
      d.hips.rotation.x = 0.15
    } else if (swimming) {
      const rate = moving ? 10 : 3
      const swing = Math.sin(t * rate) * (moving ? 0.85 : 0.25)
      d.leftArm.rotation.x = -0.6 + swing
      d.rightArm.rotation.x = -0.6 - swing
      d.leftArm.rotation.z = 0.9
      d.rightArm.rotation.z = -0.9
      d.leftLeg.rotation.x = swing * 0.7
      d.rightLeg.rotation.x = -swing * 0.7
      d.hips.position.y = 0.95 + Math.sin(t * rate) * 0.06
      d.hips.rotation.x = 0.55
      d.head.rotation.x = -0.25
      if (d.swordMouth) d.swordMouth.visible = false
    } else {
      d.hips.rotation.x = 0
      d.head.rotation.x = 0

      const rate = running ? 14 : moving ? 9 : 0
      const amp = running ? 0.7 : moving ? 0.45 : 0
      const swing = rate ? Math.sin(t * rate) * amp : 0

      d.leftArm.rotation.x = swing
      d.rightArm.rotation.x = -swing
      d.leftArm.rotation.z = 0
      d.rightArm.rotation.z = 0
      d.leftLeg.rotation.x = -swing
      d.rightLeg.rotation.x = swing

      if (!moving) {
        d.hips.position.y = 0.95 + Math.sin(t * 2.2) * 0.02
        d.head.rotation.z = Math.sin(t * 1.5) * 0.03
        if (d.kind === 'zoro' && d.swordMouth) {
          d.swordMouth.visible = Math.sin(t) > 0.85
        }
      } else {
        d.hips.position.y = 0.95 + Math.abs(Math.sin(t * rate)) * 0.04
        d.head.rotation.z = 0
        if (d.swordMouth && d.slashT < 0) d.swordMouth.visible = false
      }
    }

    if (d.hat && d.hat.visible) {
      d.hat.rotation.z = moving ? Math.sin(t * 8) * 0.05 : Math.sin(t) * 0.02
    }
  }

  // Gear 5 body bounce + cloud swirl
  if (d.gear5) {
    const bounce = 1 + Math.sin(t * 6) * 0.06
    const base = char.userData._baseScale || 1
    char.scale.set(
      (base / Math.sqrt(bounce)),
      base * bounce,
      (base / Math.sqrt(bounce)),
    )
    d.gearClouds.rotation.y = t * 1.5
    d.gearClouds.children.forEach((puff, i) => {
      puff.position.y = 0.15 + Math.sin(t * 3 + i) * 0.08
    })
  } else if (d.kind === 'luffy') {
    char.scale.set(1, 1, 1)
  }
}
