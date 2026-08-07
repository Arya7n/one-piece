/**
 * Audio hub — Web Audio SFX + BGM.
 *
 * Default: procedural sea ambient + soft explore / boss / victory beds (no files needed).
 * Optional: drop loops in /public/audio/ to override:
 *   explore.mp3 | explore.ogg
 *   boss.mp3    | boss.ogg
 *   victory.mp3 | victory.ogg
 */

const PREF_KEY = 'one-piece-world-audio-v1'

let ctx = null
let masterGain = null
let sfxGain = null
let musicGain = null

let muted = false
let musicVol = 0.45
let sfxVol = 0.85
let currentTrack = null // 'explore' | 'boss' | 'victory' | null
let fileBuffers = {}
let proceduralNodes = null
let fileSource = null
let wantTrack = 'explore'
let started = false

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return
    const p = JSON.parse(raw)
    if (typeof p.muted === 'boolean') muted = p.muted
    if (typeof p.musicVol === 'number') musicVol = THREE_CLAMP(p.musicVol, 0, 1)
    if (typeof p.sfxVol === 'number') sfxVol = THREE_CLAMP(p.sfxVol, 0, 1)
  } catch {
    /* ignore */
  }
}

function savePrefs() {
  try {
    localStorage.setItem(
      PREF_KEY,
      JSON.stringify({ muted, musicVol, sfxVol }),
    )
  } catch {
    /* ignore */
  }
}

function THREE_CLAMP(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

loadPrefs()

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = ctx.createGain()
    sfxGain = ctx.createGain()
    musicGain = ctx.createGain()
    sfxGain.connect(masterGain)
    musicGain.connect(masterGain)
    masterGain.connect(ctx.destination)
    applyGains()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function applyGains() {
  if (!masterGain) return
  const m = muted ? 0 : 1
  masterGain.gain.value = m
  sfxGain.gain.value = sfxVol
  musicGain.gain.value = musicVol
}

function beep({ freq = 440, dur = 0.12, type = 'square', gain = 0.08, slide = 0 }) {
  try {
    const ac = getCtx()
    const t0 = ac.currentTime
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.connect(g)
    g.connect(sfxGain)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  } catch {
    /* autoplay until gesture */
  }
}

function noiseBurst({ dur = 0.1, gain = 0.06, filterFreq = 1200 }) {
  try {
    const ac = getCtx()
    const t0 = ac.currentTime
    const n = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate)
    const data = n.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = n
    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    const g = ac.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(sfxGain)
    src.start(t0)
  } catch {
    /* ignore */
  }
}

function stopProcedural() {
  if (!proceduralNodes) return
  for (const iv of proceduralNodes.intervals || []) clearInterval(iv)
  try {
    for (const n of proceduralNodes.stop) n.stop()
  } catch {
    /* already stopped */
  }
  for (const n of proceduralNodes.disconnect) {
    try {
      n.disconnect()
    } catch {
      /* ignore */
    }
  }
  proceduralNodes = null
}

function stopFileSource() {
  if (!fileSource) return
  try {
    fileSource.stop()
  } catch {
    /* ignore */
  }
  try {
    fileSource.disconnect()
  } catch {
    /* ignore */
  }
  fileSource = null
}

function stopMusicPlayback() {
  stopProcedural()
  stopFileSource()
  currentTrack = null
}

/** Soft looping sea + musical bed (explore / boss / victory). */
function startProcedural(track) {
  const ac = getCtx()
  stopProcedural()

  const stop = []
  const disconnect = []
  const intervals = []
  const bed = ac.createGain()
  bed.gain.value = 0.0001
  bed.connect(musicGain)
  disconnect.push(bed)

  // --- Sea wash (filtered noise) ---
  const secs = 4
  const buf = ac.createBuffer(1, ac.sampleRate * secs, ac.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = last * 0.98 + white * 0.02
    data[i] = last
  }
  const sea = ac.createBufferSource()
  sea.buffer = buf
  sea.loop = true
  const seaLp = ac.createBiquadFilter()
  seaLp.type = 'lowpass'
  seaLp.frequency.value = track === 'boss' ? 420 : 680
  seaLp.Q.value = 0.7
  const seaGain = ac.createGain()
  seaGain.gain.value = track === 'victory' ? 0.12 : track === 'boss' ? 0.2 : 0.28
  sea.connect(seaLp)
  seaLp.connect(seaGain)
  seaGain.connect(bed)
  sea.start()
  stop.push(sea)
  disconnect.push(sea, seaLp, seaGain)

  // --- Pad / melody oscillators ---
  const scales = {
    explore: [130.81, 164.81, 196.0, 246.94, 261.63, 329.63],
    boss: [110, 130.81, 146.83, 164.81, 185, 207.65],
    victory: [196, 246.94, 293.66, 349.23, 392, 493.88],
  }
  const notes = scales[track] || scales.explore
  const voices = track === 'boss' ? 3 : 4

  for (let v = 0; v < voices; v++) {
    const o = ac.createOscillator()
    o.type = track === 'boss' ? 'sawtooth' : v % 2 === 0 ? 'sine' : 'triangle'
    const g = ac.createGain()
    const base = notes[v % notes.length]
    o.frequency.value = base
    g.gain.value = track === 'boss' ? 0.025 : 0.035
    const lfo = ac.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.08 + v * 0.03
    const lfoG = ac.createGain()
    lfoG.gain.value = track === 'boss' ? 8 : 4
    lfo.connect(lfoG)
    lfoG.connect(o.frequency)
    o.connect(g)
    g.connect(bed)
    o.start()
    lfo.start()
    stop.push(o, lfo)
    disconnect.push(o, g, lfo, lfoG)

    const step = track === 'boss' ? 1.6 : track === 'victory' ? 0.9 : 2.4
    let i = v
    const iv = setInterval(() => {
      if (!proceduralNodes) {
        clearInterval(iv)
        return
      }
      i = (i + 1 + (Math.random() > 0.7 ? 2 : 0)) % notes.length
      try {
        o.frequency.setTargetAtTime(notes[i] * (v === 0 ? 0.5 : 1), ac.currentTime, 0.35)
      } catch {
        clearInterval(iv)
      }
    }, step * 1000 + v * 200)
    intervals.push(iv)
  }

  if (track === 'boss') {
    const pulse = ac.createOscillator()
    pulse.type = 'square'
    pulse.frequency.value = 55
    const pg = ac.createGain()
    pg.gain.value = 0.0001
    pulse.connect(pg)
    pg.connect(bed)
    pulse.start()
    stop.push(pulse)
    disconnect.push(pulse, pg)
    const iv = setInterval(() => {
      if (!proceduralNodes) {
        clearInterval(iv)
        return
      }
      const t0 = ac.currentTime
      pg.gain.cancelScheduledValues(t0)
      pg.gain.setValueAtTime(0.04, t0)
      pg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18)
    }, 520)
    intervals.push(iv)
  }

  proceduralNodes = { stop, disconnect, intervals }

  const t0 = ac.currentTime
  bed.gain.setValueAtTime(0.0001, t0)
  bed.gain.linearRampToValueAtTime(1, t0 + 1.2)
}

async function tryLoadFile(name) {
  if (fileBuffers[name]) return fileBuffers[name]
  const exts = ['ogg', 'mp3', 'wav']
  for (const ext of exts) {
    try {
      const res = await fetch(`/audio/${name}.${ext}`)
      if (!res.ok) continue
      const ac = getCtx()
      const arr = await res.arrayBuffer()
      const buf = await ac.decodeAudioData(arr.slice(0))
      fileBuffers[name] = buf
      return buf
    } catch {
      /* try next */
    }
  }
  return null
}

async function startFileTrack(name, loop = true) {
  const buf = await tryLoadFile(name)
  if (!buf) return false
  const ac = getCtx()
  stopFileSource()
  stopProcedural()
  const src = ac.createBufferSource()
  src.buffer = buf
  src.loop = loop
  const g = ac.createGain()
  g.gain.value = 0.0001
  src.connect(g)
  g.connect(musicGain)
  src.start()
  fileSource = src
  const t0 = ac.currentTime
  g.gain.linearRampToValueAtTime(1, t0 + 1.0)
  src.onended = () => {
    if (fileSource === src) fileSource = null
  }
  return true
}

async function playTrack(track) {
  wantTrack = track
  if (!started || muted) {
    currentTrack = track
    return
  }
  if (track === currentTrack && (proceduralNodes || fileSource)) return

  stopMusicPlayback()
  currentTrack = track
  if (!track) return

  const usedFile = await startFileTrack(track, track !== 'victory')
  if (wantTrack !== track) return
  if (!usedFile) startProcedural(track)

  if (track === 'victory') {
    // After victory bed, ease back to explore
    setTimeout(() => {
      if (wantTrack === 'victory') playTrack('explore')
    }, 12000)
  }
}

export const sfx = {
  unlock() {
    getCtx()
    if (!started) {
      started = true
      applyGains()
      if (!muted && wantTrack) playTrack(wantTrack)
    }
  },
  punch() {
    beep({ freq: 180, dur: 0.08, type: 'sawtooth', gain: 0.07, slide: -80 })
    noiseBurst({ dur: 0.06, gain: 0.04, filterFreq: 800 })
  },
  slash() {
    beep({ freq: 880, dur: 0.1, type: 'sawtooth', gain: 0.05, slide: -400 })
    noiseBurst({ dur: 0.08, gain: 0.05, filterFreq: 2400 })
  },
  kick() {
    beep({ freq: 140, dur: 0.1, type: 'square', gain: 0.08, slide: -60 })
  },
  shot() {
    beep({ freq: 520, dur: 0.06, type: 'triangle', gain: 0.06, slide: 200 })
  },
  staff() {
    beep({ freq: 360, dur: 0.09, type: 'triangle', gain: 0.06, slide: -120 })
  },
  chest() {
    beep({ freq: 220, dur: 0.15, type: 'square', gain: 0.06 })
    setTimeout(() => beep({ freq: 440, dur: 0.12, type: 'sine', gain: 0.05 }), 80)
  },
  splash() {
    noiseBurst({ dur: 0.18, gain: 0.07, filterFreq: 600 })
  },
  jump() {
    beep({ freq: 300, dur: 0.1, type: 'sine', gain: 0.05, slide: 280 })
  },
  fruit() {
    beep({ freq: 200, dur: 0.2, type: 'sine', gain: 0.07, slide: 400 })
    setTimeout(() => beep({ freq: 500, dur: 0.15, type: 'triangle', gain: 0.05 }), 100)
  },
  gear() {
    beep({ freq: 150, dur: 0.25, type: 'sawtooth', gain: 0.08, slide: 500 })
  },
  board() {
    beep({ freq: 180, dur: 0.12, type: 'triangle', gain: 0.06 })
  },
  smash() {
    noiseBurst({ dur: 0.15, gain: 0.09, filterFreq: 400 })
    beep({ freq: 90, dur: 0.12, type: 'square', gain: 0.07 })
  },
  switch() {
    beep({ freq: 480, dur: 0.06, type: 'sine', gain: 0.04 })
  },
  heal() {
    beep({ freq: 400, dur: 0.1, type: 'sine', gain: 0.05, slide: 200 })
    setTimeout(() => beep({ freq: 600, dur: 0.12, type: 'sine', gain: 0.05 }), 70)
  },
  berry() {
    beep({ freq: 660, dur: 0.08, type: 'triangle', gain: 0.05, slide: 80 })
  },
  thunder() {
    noiseBurst({ dur: 0.35, gain: 0.12, filterFreq: 180 })
    beep({ freq: 60, dur: 0.3, type: 'sawtooth', gain: 0.08, slide: -30 })
  },
  cannon() {
    noiseBurst({ dur: 0.22, gain: 0.14, filterFreq: 280 })
    beep({ freq: 70, dur: 0.18, type: 'square', gain: 0.09, slide: -40 })
  },
  cook() {
    beep({ freq: 320, dur: 0.1, type: 'triangle', gain: 0.05, slide: 120 })
    setTimeout(() => beep({ freq: 480, dur: 0.12, type: 'sine', gain: 0.05 }), 80)
    setTimeout(() => beep({ freq: 640, dur: 0.14, type: 'sine', gain: 0.05 }), 160)
  },
}

export const music = {
  /** Call after a user gesture (also done via sfx.unlock). */
  start(track = 'explore') {
    sfx.unlock()
    playTrack(track)
  },
  setTrack(track) {
    playTrack(track)
  },
  stop() {
    wantTrack = null
    stopMusicPlayback()
  },
  get muted() {
    return muted
  },
  get track() {
    return currentTrack
  },
  get musicVolume() {
    return musicVol
  },
  get sfxVolume() {
    return sfxVol
  },
  setMuted(v) {
    muted = !!v
    applyGains()
    savePrefs()
    if (!muted && started && wantTrack) playTrack(wantTrack)
    if (muted) stopMusicPlayback()
  },
  toggleMute() {
    music.setMuted(!muted)
    return muted
  },
  setMusicVolume(v) {
    musicVol = THREE_CLAMP(v, 0, 1)
    applyGains()
    savePrefs()
  },
  setSfxVolume(v) {
    sfxVol = THREE_CLAMP(v, 0, 1)
    applyGains()
    savePrefs()
  },
}
