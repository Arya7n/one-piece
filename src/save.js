const SAVE_KEY = 'grandline-archipelago-v1'

/**
 * Persist crew progress in localStorage.
 */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

export function saveProgress(snapshot) {
  try {
    const payload = {
      ...snapshot,
      savedAt: Date.now(),
      version: 1,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(SAVE_KEY)
    return true
  } catch {
    return false
  }
}

export function hasProgress() {
  return !!localStorage.getItem(SAVE_KEY)
}
