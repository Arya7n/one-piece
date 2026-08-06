/**
 * Installable PWA helpers — capture browser install prompt + detect standalone.
 */

let deferredPrompt = null
const listeners = new Set()

function notify() {
  for (const fn of listeners) fn(getInstallState())
}

export function getInstallState() {
  return {
    canInstall: !!deferredPrompt,
    isStandalone: isStandalone(),
  }
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari
    /** @type {any} */ (navigator).standalone === true
  )
}

export function onInstallStateChange(fn) {
  listeners.add(fn)
  fn(getInstallState())
  return () => listeners.delete(fn)
}

export function initPwaInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })

  // display-mode can change after install without reload on some browsers
  const mq = window.matchMedia('(display-mode: standalone)')
  mq.addEventListener?.('change', notify)
}

/** Returns true if the install UI was shown / completed. */
export async function promptInstall() {
  if (!deferredPrompt) return { ok: false, reason: 'unavailable' }
  const promptEvent = deferredPrompt
  deferredPrompt = null
  notify()
  const result = await promptEvent.prompt()
  const outcome = result?.outcome || 'dismissed'
  return { ok: outcome === 'accepted', reason: outcome }
}
