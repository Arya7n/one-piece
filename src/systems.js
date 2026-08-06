import * as THREE from 'three'

/** Rain + lightning FX for Nami's Clima-Tact */
export function createWeatherSystem(scene) {
  const count = 1400
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40
    positions[i * 3 + 1] = Math.random() * 22
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40
    speeds[i] = 14 + Math.random() * 18
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const rain = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xa0d8ff,
      size: 0.08,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  )
  rain.visible = false
  scene.add(rain)

  const flashLight = new THREE.PointLight(0xaaccff, 0, 80, 2)
  scene.add(flashLight)

  let stormT = -1
  let flashT = 0
  const origin = new THREE.Vector3()

  return {
    trigger(at, duration = 2.8) {
      origin.copy(at)
      stormT = duration
      rain.visible = true
      rain.position.copy(at)
      flashT = 0.08
      flashLight.position.copy(at).y += 12
      flashLight.intensity = 8
    },
    update(delta) {
      if (stormT < 0) {
        rain.visible = false
        flashLight.intensity = 0
        return
      }
      stormT -= delta
      flashT -= delta
      if (flashT > 0) flashLight.intensity = 6 + Math.random() * 10
      else if (Math.random() < 0.02) {
        flashT = 0.06 + Math.random() * 0.08
        flashLight.intensity = 10
      } else flashLight.intensity *= 0.85

      const pos = geo.attributes.position.array
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] -= speeds[i] * delta
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3] = (Math.random() - 0.5) * 40
          pos[i * 3 + 1] = 18 + Math.random() * 8
          pos[i * 3 + 2] = (Math.random() - 0.5) * 40
        }
      }
      geo.attributes.position.needsUpdate = true
      if (stormT < 0) rain.visible = false
    },
  }
}

/** Soft day→night cycle driving lights / fog / sky uniforms */
export function createDayNight({ sun, hemi, fog, skyMat, exposureRef }) {
  const dayTop = new THREE.Color(0x3d8fd1)
  const dayMid = new THREE.Color(0x8ec8ef)
  const dayBot = new THREE.Color(0xf7f3e8)
  const nightTop = new THREE.Color(0x0a1028)
  const nightMid = new THREE.Color(0x1a2744)
  const nightBot = new THREE.Color(0x2a2038)
  const dayFog = new THREE.Color(0xa8d8f0)
  const nightFog = new THREE.Color(0x1a2038)

  /** @type {'auto' | 'day' | 'night'} */
  let mode = 'day'

  return {
    getMode() {
      return mode
    },
    setMode(next) {
      if (next === 'auto' || next === 'day' || next === 'night') mode = next
    },
    /** Toggle day ↔ night (leaves auto). Returns new mode. */
    toggle() {
      mode = mode === 'night' ? 'day' : 'night'
      return mode
    },
    /** @returns {{ night: number, dayFactor: number, mode: string }} */
    update(t) {
      let night
      let phase = (t / 180) % 1

      if (mode === 'day') {
        night = 0
        phase = 0.25 // high sun
      } else if (mode === 'night') {
        night = 1
        phase = 0.75 // low moon arc
      } else {
        // Full cycle ~180s — 0 noon-ish via sin curve
        night = Math.pow(Math.sin(phase * Math.PI * 2) * 0.5 + 0.5, 1.4)
      }

      const dayFactor = 1 - night

      sun.intensity = 0.25 + dayFactor * 1.3
      hemi.intensity = 0.2 + dayFactor * 0.55
      sun.color.setRGB(1, 0.92 - night * 0.25, 0.78 - night * 0.35)
      hemi.color.setRGB(1, 0.94 - night * 0.4, 0.85 - night * 0.5)

      if (skyMat?.uniforms) {
        skyMat.uniforms.topColor.value.copy(dayTop).lerp(nightTop, night)
        skyMat.uniforms.midColor.value.copy(dayMid).lerp(nightMid, night)
        skyMat.uniforms.bottomColor.value.copy(dayBot).lerp(nightBot, night)
      }
      if (fog) fog.color.copy(dayFog).lerp(nightFog, night)
      if (exposureRef) {
        exposureRef.current = 0.75 + dayFactor * 0.4
      }

      const ang = phase * Math.PI * 2
      sun.position.set(Math.cos(ang) * 55, Math.sin(ang) * 40 + 10, 25)

      return { night, dayFactor, phase, mode }
    },
  }
}

export function createBubbleSystem(scene) {
  const count = 80
  const positions = new Float32Array(count * 3)
  const ages = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 1] = -10
    ages[i] = 999
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xc8f0ff,
      size: 0.12,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  )
  scene.add(pts)
  let emit = false
  const origin = new THREE.Vector3()

  return {
    setDiving(on, at) {
      emit = on
      if (at) origin.copy(at)
    },
    update(delta, at) {
      if (at) origin.copy(at)
      const pos = geo.attributes.position.array
      for (let i = 0; i < count; i++) {
        ages[i] += delta
        if (emit && (ages[i] > 1.2 || pos[i * 3 + 1] < -5) && Math.random() < 0.15) {
          ages[i] = 0
          pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.8
          pos[i * 3 + 1] = origin.y + Math.random() * 0.4
          pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.8
        }
        if (ages[i] < 1.5) {
          pos[i * 3 + 1] += 1.2 * delta
          pos[i * 3] += Math.sin(ages[i] * 8 + i) * 0.15 * delta
        }
      }
      geo.attributes.position.needsUpdate = true
    },
  }
}

export function createCannonBall() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.4,
    }),
  )
  mesh.visible = false
  mesh.userData = { t: -1, dir: new THREE.Vector3(), active: false }
  return mesh
}

/** Canvas-based bounty poster texture */
export function createBountyPoster(mats) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace

  const g = new THREE.Group()
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), mats.woodDark)
  post.position.y = 1.6
  g.add(post)
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.12), mats.wood)
  board.position.set(0, 2.2, 0)
  g.add(board)
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 2.4),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
  )
  poster.position.set(0, 2.2, 0.08)
  g.add(poster)

  function draw(bounty) {
    ctx.fillStyle = '#f5e6c8'
    ctx.fillRect(0, 0, 512, 640)
    ctx.strokeStyle = '#3e2723'
    ctx.lineWidth = 14
    ctx.strokeRect(18, 18, 476, 604)
    ctx.fillStyle = '#b71c1c'
    ctx.font = 'bold 48px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('WANTED', 256, 80)
    ctx.fillStyle = '#5d4037'
    ctx.beginPath()
    ctx.arc(256, 220, 90, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff8e1'
    ctx.beginPath()
    ctx.arc(256, 200, 55, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c62828'
    ctx.beginPath()
    ctx.ellipse(256, 175, 70, 22, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#3e2723'
    ctx.font = 'bold 36px Georgia, serif'
    ctx.fillText('STRAW HAT CREW', 256, 360)
    ctx.font = '28px Georgia, serif'
    ctx.fillText('Dead or Alive', 256, 410)
    ctx.fillStyle = '#b71c1c'
    ctx.font = 'bold 42px Georgia, serif'
    const text =
      bounty >= 1e9
        ? `${(bounty / 1e9).toFixed(2)}B`
        : bounty >= 1e6
          ? `${(bounty / 1e6).toFixed(1)}M`
          : `${Math.round(bounty)}`
    ctx.fillText(`${text} ฿`, 256, 500)
    ctx.fillStyle = '#5d4037'
    ctx.font = '22px Georgia, serif'
    ctx.fillText('World Government', 256, 560)
    tex.needsUpdate = true
  }

  draw(30_000_000)
  g.userData = { kind: 'bounty', draw, bounty: 30_000_000 }
  return g
}

export function makeCookStation(mats) {
  const g = new THREE.Group()
  const stove = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.2), mats.woodDark)
  stove.position.y = 0.45
  stove.castShadow = true
  g.add(stove)
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.12, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.5, roughness: 0.4 }),
  )
  top.position.y = 0.96
  g.add(top)
  const pan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.4, 0.15, 16),
    new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.6, roughness: 0.35 }),
  )
  pan.position.set(0, 1.12, 0)
  g.add(pan)
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.35, 6),
    new THREE.MeshStandardMaterial({
      color: 0xff6d00,
      emissive: 0xff3d00,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.85,
    }),
  )
  flame.position.set(0, 1.05, 0)
  g.add(flame)
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xffecb3, side: THREE.DoubleSide }),
  )
  sign.position.set(0, 1.7, 0.7)
  g.add(sign)
  g.userData = { kind: 'cook', flame }
  return g
}
