/** Lightweight Web Audio SFX — no external files required. */

let ctx = null

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
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
    g.connect(ac.destination)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  } catch {
    /* ignore autoplay blocks until first gesture */
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
    g.connect(ac.destination)
    src.start(t0)
  } catch {
    /* ignore */
  }
}

export const sfx = {
  unlock() {
    getCtx()
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
  berry() {
    beep({ freq: 660, dur: 0.08, type: 'sine', gain: 0.05, slide: 220 })
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
