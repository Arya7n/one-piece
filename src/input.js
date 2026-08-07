/** Keyboard / mouse game input bindings. */

const MOVE_CODES = {
  KeyW: 'w',
  KeyA: 'a',
  KeyS: 's',
  KeyD: 'd',
  KeyV: 'v',
}

const CREW_DIGITS = {
  '1': 'luffy',
  '2': 'zoro',
  '3': 'nami',
  '4': 'usopp',
  '5': 'sanji',
  '6': 'chopper',
  '7': 'robin',
  '8': 'franky',
  '9': 'brook',
  '0': 'jinbe',
}

export function createKeys() {
  return {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    v: false,
    control: false,
    space: false,
  }
}

function blurHudFocus() {
  const ae = document.activeElement
  if (ae && ae !== document.body && typeof ae.blur === 'function') {
    if (ae.tagName === 'BUTTON' || ae.tagName === 'A' || ae.getAttribute?.('role') === 'button') {
      ae.blur()
    }
  }
}

/**
 * @param {object} deps
 * @param {ReturnType<typeof createKeys>} deps.keys
 * @param {{ unlock: () => void }} deps.sfx
 * @param {() => boolean} deps.isIntroActive
 * @param {() => boolean} deps.isUserGuideOpen
 * @param {() => boolean} deps.getSpectating
 * @param {(id: string) => void} deps.setActive
 * @param {(dir?: number) => void} deps.cycleCrew
 * @param {() => void} deps.callCrew
 * @param {() => void} deps.toggleSpectator
 * @param {() => void} deps.toggleGear5
 * @param {() => void} deps.tryInteract
 * @param {() => void} deps.recallShipHome
 * @param {() => void} deps.doAttack
 * @param {() => void} deps.tryJump
 * @param {() => string} deps.getActive
 * @param {() => boolean} deps.getBloomEnabled
 * @param {(v: boolean) => void} deps.setBloomEnabled
 * @param {{ enabled: boolean }} deps.bloomPass
 * @param {() => void} [deps.toggleMute]
 */
export function bindGameInput(deps) {
  const {
    keys,
    sfx,
    isIntroActive,
    isUserGuideOpen,
    getSpectating,
    setActive,
    cycleCrew,
    callCrew,
    toggleSpectator,
    toggleGear5,
    tryInteract,
    recallShipHome,
    doAttack,
    tryJump,
    getActive,
    getBloomEnabled,
    setBloomEnabled,
    bloomPass,
    toggleMute,
  } = deps

  window.addEventListener('keydown', (e) => {
    if (isIntroActive()) return
    if (isUserGuideOpen()) {
      if (e.key === 'Escape') return
      if (e.key !== 'Escape') {
        const block =
          e.code === 'Space' ||
          e.code.startsWith('Key') ||
          e.code.startsWith('Digit') ||
          e.code === 'BracketLeft' ||
          e.code === 'BracketRight'
        if (block) e.preventDefault()
      }
      return
    }

    // Dive uses X (not Ctrl) so browser shortcuts stay out of the way
    if (e.code === 'KeyX') {
      e.preventDefault()
      blurHudFocus()
      keys.control = true
      sfx.unlock()
      return
    }

    // Soft-block common browser chords while playing (still safer in installed PWA)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault()
      return
    }

    sfx.unlock()

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true
    if (e.code === 'Space') {
      e.preventDefault()
      keys.space = true
    }

    // Track move / aim by physical key (fixes D not moving when a button had focus)
    if (MOVE_CODES[e.code]) {
      e.preventDefault()
      blurHudFocus()
      keys[MOVE_CODES[e.code]] = true
    }

    if (e.repeat) return

    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()

    if (e.code === 'KeyP' || k === 'p') {
      e.preventDefault()
      toggleSpectator()
      return
    }
    if (getSpectating()) {
      if (CREW_DIGITS[k]) setActive(CREW_DIGITS[k])
      if (k === ']' || k === '.') cycleCrew(1)
      if (k === '[' || k === ',' || k === 'q') cycleCrew(-1)
      return
    }
    if (CREW_DIGITS[k]) setActive(CREW_DIGITS[k])
    if (k === ']' || k === '.') cycleCrew(1)
    if (k === '[' || k === ',') cycleCrew(-1)
    if (k === 'q') cycleCrew(-1)
    if (k === 'c' || e.code === 'KeyC') callCrew()
    if (k === 'm' || e.code === 'KeyM') {
      e.preventDefault()
      toggleMute?.()
    }
    if (k === 'b' || e.code === 'KeyB') {
      const next = !getBloomEnabled()
      setBloomEnabled(next)
      bloomPass.enabled = next
    }
    if (k === 'g' || e.code === 'KeyG') toggleGear5()
    if (k === 'e' || e.code === 'KeyE') {
      e.preventDefault()
      tryInteract()
    }
    if (k === 'h' || e.code === 'KeyH') recallShipHome()
    if (e.code === 'KeyF' || k === 'f') {
      e.preventDefault()
      blurHudFocus()
      doAttack()
    }
    if (e.code === 'Space' || k === ' ') {
      e.preventDefault()
      tryJump()
    }
  })
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyX') {
      keys.control = false
      return
    }
    if (e.ctrlKey || e.metaKey) e.preventDefault()
    if (MOVE_CODES[e.code]) keys[MOVE_CODES[e.code]] = false
    if (e.code === 'Space') keys.space = false
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false
  })
  // Stop Ctrl+wheel browser zoom from resizing the page and breaking the HUD
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault()
    },
    { passive: false },
  )
  window.addEventListener('mousedown', (e) => {
    if (e.button === 2 && getActive() === 'usopp') keys.v = true
  })
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) keys.v = false
  })
  window.addEventListener('contextmenu', (e) => {
    if (getActive() === 'usopp') e.preventDefault()
  })
}
