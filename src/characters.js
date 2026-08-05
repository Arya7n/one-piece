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
    attackLock: 0,
    displayName: 'Luffy',
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
    attackLock: 0,
    displayName: 'Zoro',
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

export function updateCharacterAnim(char, moving, running, t, opts = {}) {
  const d = char.userData
  if (!d?.leftArm) return

  const punching = d.punchT >= 0
  const slashing = d.slashT >= 0

  if (d.attackLock > 0) d.attackLock -= opts.delta ?? 0.016

  // Rubber punch stretch
  if (punching) {
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
  }

  // Slash pose
  if (slashing) {
    d.slashT += opts.delta ?? 0.016
    const s = d.slashT
    d.rightArm.rotation.x = -1.2 + Math.sin(s * 20) * 0.3
    d.leftArm.rotation.x = -0.8
    d.rightArm.rotation.z = -0.8
    d.leftArm.rotation.z = 0.8
    if (d.swordR) d.swordR.rotation.set(-1.2, 0.2, -0.3)
    if (d.swordL) d.swordL.rotation.set(-1.0, -0.2, 0.3)
    if (s > 0.45) {
      d.slashT = -1
      if (d.swordL) d.swordL.rotation.set(0.2, 0, 0.9)
      if (d.swordR) d.swordR.rotation.set(0.2, 0, -0.9)
    }
  }

  if (!punching && !slashing) {
    const swimming = opts.swimming || d.swimming

    if (swimming) {
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
    char.scale.set(1 / Math.sqrt(bounce), bounce, 1 / Math.sqrt(bounce))
    d.gearClouds.rotation.y = t * 1.5
    d.gearClouds.children.forEach((puff, i) => {
      puff.position.y = 0.15 + Math.sin(t * 3 + i) * 0.08
    })
  } else if (d.kind === 'luffy') {
    char.scale.set(1, 1, 1)
  }
}
