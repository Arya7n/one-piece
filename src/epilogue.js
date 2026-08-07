import * as THREE from 'three'
import { BOSS_ISLAND, W } from './world.js'
import { syncOrbitFromCamera } from './intro.js'

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Short victory ceremony after defeating Kaido — skippable.
 */
export function createEpilogue({
  camera,
  getPlayer,
  ship,
  getSeaKing,
  getCrewBounty,
  formatBounty,
  onGatherCrew,
  onComplete,
  onSkip,
}) {
  const lookTmp = new THREE.Vector3()
  const posTmp = new THREE.Vector3()

  const beats = [
    {
      id: 'fallen',
      pos: () => {
        const boss = getSeaKing()
        const c = boss?.position || new THREE.Vector3(BOSS_ISLAND.x, 4, BOSS_ISLAND.z)
        return new THREE.Vector3(c.x + 14, 9, c.z + 16)
      },
      look: () => {
        const boss = getSeaKing()
        return (boss?.position || new THREE.Vector3(BOSS_ISLAND.x, 2, BOSS_ISLAND.z)).clone().add(
          new THREE.Vector3(0, 1.5, 0),
        )
      },
      title: 'Kaido falls!',
      subtitle: 'The strongest creature… laid low by the Straw Hats',
      duration: 3.4,
      onEnter: null,
    },
    {
      id: 'gather',
      pos: () => {
        const p = getPlayer().position
        return new THREE.Vector3(p.x + 10, p.y + 7, p.z + 12)
      },
      look: () => getPlayer().position.clone().add(new THREE.Vector3(0, 1.2, 0)),
      title: 'All hands!',
      subtitle: 'The crew rushes in — a pirate celebration begins',
      duration: 3.2,
      onEnter: () => onGatherCrew?.(),
    },
    {
      id: 'bounty',
      pos: () => {
        const p = getPlayer().position
        return new THREE.Vector3(p.x - 8, p.y + 5.5, p.z + 14)
      },
      look: () => getPlayer().position.clone().add(new THREE.Vector3(0, 1.4, 0)),
      title: 'World Government alert',
      subtitle: () =>
        `Crew bounty soars to ${formatBounty?.(getCrewBounty?.() ?? 0) ?? '???'}฿`,
      duration: 3.4,
    },
    {
      id: 'merry',
      pos: () =>
        ship.position
          .clone()
          .add(new THREE.Vector3(16, 11, 18)),
      look: () => ship.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
      title: 'Going Merry awaits',
      subtitle: 'Your ship. Your seas. Your next island.',
      duration: 3.0,
    },
    {
      id: 'horizon',
      pos: [
        BOSS_ISLAND.x + W(40),
        28,
        BOSS_ISLAND.z + W(55),
      ],
      look: [BOSS_ISLAND.x * 0.35, 4, BOSS_ISLAND.z * 0.35],
      title: 'One Piece World is yours',
      subtitle: 'Sail on — the adventure never ends',
      duration: 3.6,
    },
    {
      id: 'player',
      dynamic: 'player',
      title: 'Set sail again!',
      subtitle: 'Explore freely · Skip or wait to continue',
      duration: 2.6,
    },
  ]

  const overlay = document.createElement('div')
  overlay.id = 'epilogue-overlay'
  overlay.innerHTML = `
    <div id="epilogue-vignette"></div>
    <div id="epilogue-banner">VICTORY</div>
    <div id="epilogue-copy">
      <h1 id="epilogue-title"></h1>
      <p id="epilogue-subtitle"></p>
    </div>
    <button type="button" id="epilogue-skip">Skip ceremony</button>
    <div id="epilogue-progress"><span id="epilogue-progress-fill"></span></div>
  `
  document.body.appendChild(overlay)

  const titleEl = overlay.querySelector('#epilogue-title')
  const subEl = overlay.querySelector('#epilogue-subtitle')
  const skipBtn = overlay.querySelector('#epilogue-skip')
  const progressFill = overlay.querySelector('#epilogue-progress-fill')

  let active = true
  let segment = 0
  let segT = 0
  let finishing = false

  function resolveLook(beat) {
    if (beat.dynamic === 'player') {
      return getPlayer().position.clone().add(new THREE.Vector3(0, 1.4, 0))
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
    if (typeof beat.pos === 'function') return beat.pos()
    return new THREE.Vector3(...beat.pos)
  }

  function resolveSub(beat) {
    return typeof beat.subtitle === 'function' ? beat.subtitle() : beat.subtitle
  }

  function setCopy(beat) {
    titleEl.textContent = beat.title
    subEl.textContent = resolveSub(beat)
    titleEl.classList.remove('epilogue-fade')
    subEl.classList.remove('epilogue-fade')
    void titleEl.offsetWidth
    titleEl.classList.add('epilogue-fade')
    subEl.classList.add('epilogue-fade')
    beat.onEnter?.()
  }

  function finish() {
    if (finishing) return
    finishing = true
    active = false
    onSkip?.()
    document.body.classList.remove('intro-active', 'epilogue-active')
    overlay.classList.add('epilogue-out')
    const p = getPlayer()
    const orbit = syncOrbitFromCamera(camera, p.position)
    onComplete?.({ orbit, playerPos: p.position.clone() })
    setTimeout(() => {
      overlay.remove()
      window.removeEventListener('keydown', onKey)
    }, 650)
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

  document.body.classList.add('intro-active', 'epilogue-active')
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
        beats.slice(0, segment).reduce((s, b) => s + b.duration, 0) + segT
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
  }
}
