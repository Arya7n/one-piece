/**
 * Mobile / touch virtual gamepad.
 * Exposes a state object mutated by touch + optional physical gamepad poll.
 */

export function createMobileGamepad({
  onAttack,
  onInteract,
  onJump,
  onGear,
  onCycleChar,
  onRun,
  onCall,
  onSpectate,
}) {
  const state = {
    x: 0,
    y: 0,
    run: false,
    physRun: false,
    visible: false,
  }

  const root = document.createElement('div')
  root.id = 'mobile-pad'
  root.innerHTML = `
    <div class="pad-stick" id="pad-stick">
      <div class="pad-knob" id="pad-knob"></div>
    </div>
    <div class="pad-btns">
      <button type="button" data-act="jump" class="pad-btn pad-jump">J</button>
      <button type="button" data-act="attack" class="pad-btn pad-atk">A</button>
      <button type="button" data-act="interact" class="pad-btn pad-use">E</button>
      <button type="button" data-act="gear" class="pad-btn pad-gear">G</button>
      <button type="button" data-act="run" class="pad-btn pad-run">R</button>
      <button type="button" data-act="cycle" class="pad-btn pad-cycle">⇄</button>
      <button type="button" data-act="call" class="pad-btn pad-call">📣</button>
      <button type="button" data-act="spectate" class="pad-btn pad-spec">👁</button>
    </div>
  `
  document.body.appendChild(root)

  const stick = root.querySelector('#pad-stick')
  const knob = root.querySelector('#pad-knob')
  let stickId = null
  let stickCx = 0
  let stickCy = 0
  const radius = 48

  function showIfNeeded() {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const narrow = window.innerWidth < 900
    state.visible = touch || narrow
    root.classList.toggle('pad-visible', state.visible)
  }
  showIfNeeded()
  window.addEventListener('resize', showIfNeeded)

  function setStick(dx, dy) {
    const len = Math.hypot(dx, dy)
    const s = len > radius ? radius / len : 1
    const nx = dx * s
    const ny = dy * s
    knob.style.transform = `translate(${nx}px, ${ny}px)`
    state.x = nx / radius
    state.y = -ny / radius
  }

  function resetStick() {
    stickId = null
    state.x = 0
    state.y = 0
    knob.style.transform = 'translate(0, 0)'
  }

  stick.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault()
      stick.setPointerCapture(e.pointerId)
      stickId = e.pointerId
      const r = stick.getBoundingClientRect()
      stickCx = r.left + r.width / 2
      stickCy = r.top + r.height / 2
      setStick(e.clientX - stickCx, e.clientY - stickCy)
    },
    { passive: false },
  )
  stick.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerId !== stickId) return
      e.preventDefault()
      setStick(e.clientX - stickCx, e.clientY - stickCy)
    },
    { passive: false },
  )
  const endStick = (e) => {
    if (e.pointerId === stickId) resetStick()
  }
  stick.addEventListener('pointerup', endStick)
  stick.addEventListener('pointercancel', endStick)

  root.querySelectorAll('.pad-btn').forEach((btn) => {
    const act = btn.dataset.act
    btn.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (act === 'attack') onAttack?.()
        if (act === 'interact') onInteract?.()
        if (act === 'jump') onJump?.()
        if (act === 'gear') onGear?.()
        if (act === 'cycle') onCycleChar?.()
        if (act === 'call') onCall?.()
        if (act === 'spectate') onSpectate?.()
        if (act === 'run') {
          state.run = true
          btn.classList.add('pad-held')
          onRun?.(true)
        }
      },
      { passive: false },
    )
    const release = () => {
      if (act === 'run') {
        state.run = false
        btn.classList.remove('pad-held')
        onRun?.(false)
      }
    }
    btn.addEventListener('pointerup', release)
    btn.addEventListener('pointerleave', release)
    btn.addEventListener('pointercancel', release)
  })

  /** Merge HTML5 Gamepad API sticks/buttons into state each frame. */
  const latch = { atk: false, use: false, jmp: false }
  function pollPhysical() {
    state.physRun = false
    const pads = navigator.getGamepads?.() || []
    for (const gp of pads) {
      if (!gp) continue
      const ax = gp.axes[0] || 0
      const ay = gp.axes[1] || 0
      if (Math.hypot(ax, ay) > 0.18) {
        state.x = ax
        state.y = -ay
      }
      state.physRun = !!gp.buttons[1]?.pressed
      const atk = !!gp.buttons[0]?.pressed
      const use = !!gp.buttons[2]?.pressed
      const jmp = !!gp.buttons[3]?.pressed
      if (atk && !latch.atk) onAttack?.()
      if (use && !latch.use) onInteract?.()
      if (jmp && !latch.jmp) onJump?.()
      latch.atk = atk
      latch.use = use
      latch.jmp = jmp
      break
    }
  }

  return { state, root, pollPhysical, showIfNeeded }
}
