import * as THREE from 'three'
import { BOSS_ISLAND, W } from './world.js'

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Opening fly-through tour — skippable via button, Esc, Space, Enter, or tap.
 */
export function createIntro({ camera, getPlayer, ship, onComplete, onSkip }) {
  const lookTmp = new THREE.Vector3()
  const posTmp = new THREE.Vector3()
  const playerCam = new THREE.Vector3()

  const beats = [
    {
      pos: [0, W(72), W(118)],
      look: [0, 4, 0],
      title: 'One Piece World',
      subtitle: 'A fan-made voyage across the seas',
      duration: 3.8,
    },
    {
      pos: [W(42), 14, W(38)],
      look: () => ship.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
      title: 'The Going Merry',
      subtitle: 'Board with E · Sail with WASD · Fire cannons with F',
      duration: 3.2,
    },
    {
      pos: [W(-38), 28, W(52)],
      look: [0, 6, 0],
      title: 'The Straw Hat crew',
      subtitle: 'Ten pirates · Ten islands · One dream',
      duration: 3.2,
    },
    {
      pos: [W(128), 22, W(-8)],
      look: [W(150), 4, W(-55)],
      title: 'Desert & winter isles',
      subtitle: 'Berry, chests, and Devil Fruits hide in every biome',
      duration: 3,
    },
    {
      pos: [W(-108), 26, W(68)],
      look: [W(-130), 5, W(30)],
      title: 'Frozen shores',
      subtitle: 'Climb towers · Dive beneath the waves',
      duration: 2.6,
    },
    {
      pos: [W(138), 52, W(128)],
      look: [W(110), 18, W(110)],
      title: 'Sky island',
      subtitle: 'Hold W near cliffs to climb into the clouds',
      duration: 3,
    },
    {
      pos: [W(-72), 38, W(-48)],
      look: [BOSS_ISLAND.x, 6, BOSS_ISLAND.z],
      title: 'Boss Island',
      subtitle: 'Open three chests to unlock the southwest · Kaido awaits',
      duration: 3.4,
    },
    {
      dynamic: 'player',
      title: 'Set sail!',
      subtitle: 'Press any key or tap Skip to begin your adventure',
      duration: 2.8,
    },
  ]

  const overlay = document.createElement('div')
  overlay.id = 'intro-overlay'
  overlay.innerHTML = `
    <div id="intro-vignette"></div>
    <div id="intro-copy">
      <h1 id="intro-title"></h1>
      <p id="intro-subtitle"></p>
    </div>
    <button type="button" id="intro-skip">Skip tour</button>
    <div id="intro-progress"><span id="intro-progress-fill"></span></div>
  `
  document.body.appendChild(overlay)

  const titleEl = overlay.querySelector('#intro-title')
  const subEl = overlay.querySelector('#intro-subtitle')
  const skipBtn = overlay.querySelector('#intro-skip')
  const progressFill = overlay.querySelector('#intro-progress-fill')

  let active = true
  let segment = 0
  let segT = 0
  let fadeOut = 0
  let finishing = false

  function resolveLook(beat) {
    if (beat.dynamic === 'player') {
      const p = getPlayer()
      return p.position.clone().add(new THREE.Vector3(0, 1.4, 0))
    }
    if (typeof beat.look === 'function') return beat.look()
    return new THREE.Vector3(...beat.look)
  }

  function resolvePos(beat) {
    if (beat.dynamic === 'player') {
      const p = getPlayer()
      const yaw = p.rotation.y + Math.PI
      const dist = 11
      const pitch = 0.38
      const cosP = Math.cos(pitch)
      return new THREE.Vector3(
        p.position.x + Math.sin(yaw) * dist * cosP,
        p.position.y + Math.sin(pitch) * dist + 1.2,
        p.position.z + Math.cos(yaw) * dist * cosP,
      )
    }
    return new THREE.Vector3(...beat.pos)
  }

  function setCopy(beat) {
    titleEl.textContent = beat.title
    subEl.textContent = beat.subtitle
    titleEl.classList.remove('intro-fade')
    subEl.classList.remove('intro-fade')
    void titleEl.offsetWidth
    titleEl.classList.add('intro-fade')
    subEl.classList.add('intro-fade')
  }

  function finish() {
    if (finishing) return
    finishing = true
    active = false
    onSkip?.()
    document.body.classList.remove('intro-active')
    overlay.classList.add('intro-out')
    const p = getPlayer()
    playerCam.copy(resolvePos(beats[beats.length - 1]))
    onComplete?.({ cameraPos: playerCam.clone(), playerPos: p.position.clone() })
    setTimeout(() => overlay.remove(), 650)
  }

  function skip() {
    finish()
  }

  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    skip()
  })
  overlay.addEventListener('click', (e) => {
    if (e.target === skipBtn) return
    skip()
  })

  const onKey = (e) => {
    if (!active) return
    if (
      e.code === 'Escape' ||
      e.code === 'Space' ||
      e.code === 'Enter' ||
      e.key === ' '
    ) {
      e.preventDefault()
      skip()
    }
  }
  window.addEventListener('keydown', onKey)

  document.body.classList.add('intro-active')
  setCopy(beats[0])
  camera.position.copy(resolvePos(beats[0]))
  camera.lookAt(resolveLook(beats[0]))

  return {
    get isActive() {
      return active
    },
    skip,
    update(delta) {
      if (!active) return

      const beat = beats[segment]
      const nextBeat = beats[segment + 1]
      segT += delta

      const progress = Math.min(1, segT / beat.duration)
      const eased = easeInOutCubic(progress)

      if (nextBeat) {
        posTmp.copy(resolvePos(beat)).lerp(resolvePos(nextBeat), eased)
        lookTmp.copy(resolveLook(beat)).lerp(resolveLook(nextBeat), eased)
      } else {
        posTmp.copy(resolvePos(beat))
        lookTmp.copy(resolveLook(beat))
      }

      camera.position.copy(posTmp)
      camera.lookAt(lookTmp)

      const totalDur = beats.reduce((s, b) => s + b.duration, 0)
      const doneDur =
        beats.slice(0, segment).reduce((s, b) => s + b.duration, 0) +
        segT
      progressFill.style.width = `${Math.min(100, (doneDur / totalDur) * 100)}%`

      if (segT >= beat.duration) {
        segment++
        segT = 0
        if (segment >= beats.length) {
          finish()
          return
        }
        setCopy(beats[segment])
      }
    },
    dispose() {
      window.removeEventListener('keydown', onKey)
      overlay.remove()
      document.body.classList.remove('intro-active')
    },
  }
}

/** Sync third-person orbit vars after intro hands off to gameplay. */
export function syncOrbitFromCamera(camera, target) {
  const dx = camera.position.x - target.x
  const dy = camera.position.y - target.y
  const dz = camera.position.z - target.z
  const horiz = Math.hypot(dx, dz) || 0.01
  const camYaw = Math.atan2(dx, dz)
  const camPitch = THREE.MathUtils.clamp(
    Math.asin(dy / Math.hypot(horiz, dy)),
    0.08,
    1.25,
  )
  const camDist = horiz / Math.cos(camPitch)
  const smoothLookAt = target.clone().add(new THREE.Vector3(0, 1.4, 0))
  return { camYaw, camPitch, camDist, smoothLookAt }
}
