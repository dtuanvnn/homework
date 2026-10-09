/**
 * Sound engine + React hook.
 *
 * Callers only ever use `play(name)`. Each sound is synthesized with the Web
 * Audio API; to swap in a real file, drop e.g. `/public/sounds/tap.mp3` and
 * list its name in SOUND_FILES. The file is decoded once and then used
 * instead of the synth, with no change for callers.
 */
import { useCallback, useSyncExternalStore } from "react"
import type { AppMode } from "@/lib/types"

export type SoundName = "tap" | "select" | "next" | "correct" | "wrong" | "star" | "submit" | "celebrate" | "shutter"

/** Sounds that have a real file in /public/sounds/<name>.mp3. */
export const SOUND_FILES: Partial<Record<SoundName, string>> = {
  // tap: "/sounds/tap.mp3",
}

interface Settings {
  enabled: boolean
  volume: number // 0–1
}

const DEFAULTS: Record<AppMode, Settings> = {
  student: { enabled: true, volume: 0.4 },
  parent: { enabled: false, volume: 0.4 },
}
const KEY = (m: AppMode) => `hh-sound-${m}`

function load(m: AppMode): Settings {
  try {
    const raw = localStorage.getItem(KEY(m))
    return raw ? { ...DEFAULTS[m], ...JSON.parse(raw) } : DEFAULTS[m]
  } catch {
    return DEFAULTS[m]
  }
}

/* ---------- Store ---------- */

let mode: AppMode = "parent"
let settings: Settings = DEFAULTS.parent
let loaded = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setSoundMode(next: AppMode) {
  if (next === mode && loaded) return
  loaded = true
  mode = next
  settings = load(next)
  emit()
}

function update(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  try { localStorage.setItem(KEY(mode), JSON.stringify(settings)) } catch { /* private mode */ }
  emit()
}

/* ---------- Audio ---------- */

let ctx: AudioContext | null = null
let master: GainNode | null = null
const buffers = new Map<SoundName, AudioBuffer>()

function audio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.connect(ctx.destination)
    for (const [name, url] of Object.entries(SOUND_FILES) as [SoundName, string][]) {
      fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)).then((buf) => buffers.set(name, buf)).catch(() => {})
    }
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

// Safari/iOS: audio can only start after a user gesture, so unlock on the first tap.
if (typeof window !== "undefined") {
  const unlock = () => {
    if (!settings.enabled) return
    const c = audio()
    if (c?.state === "running") {
      window.removeEventListener("pointerdown", unlock, true)
      window.removeEventListener("keydown", unlock, true)
    }
  }
  window.addEventListener("pointerdown", unlock, true)
  window.addEventListener("keydown", unlock, true)
}

function tone(c: AudioContext, freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number } = {}) {
  const t = c.currentTime + start
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = opts.type ?? "sine"
  osc.frequency.setValueAtTime(freq, t)
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.5, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(master!)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise(c: AudioContext, start: number, dur: number, opts: { freq: number; to?: number; gain?: number; q?: number }) {
  const t = c.currentTime + start
  const len = Math.ceil(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = "bandpass"
  filter.Q.value = opts.q ?? 1
  filter.frequency.setValueAtTime(opts.freq, t)
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(opts.gain ?? 0.4, t + dur * 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(g).connect(master!)
  src.start(t)
}

const SYNTH: Record<SoundName, (c: AudioContext, step: number) => void> = {
  tap: (c) => tone(c, 1200, 0, 0.04, { type: "triangle", gain: 0.18 }),
  select: (c) => tone(c, 520, 0, 0.12, { to: 880, gain: 0.35 }),
  next: (c) => noise(c, 0, 0.22, { freq: 600, to: 2400, gain: 0.18, q: 0.8 }),
  correct: (c) => { tone(c, 784, 0, 0.18, { gain: 0.35 }); tone(c, 1175, 0.1, 0.28, { gain: 0.35 }) },
  wrong: (c) => tone(c, 220, 0, 0.22, { to: 180, gain: 0.3, type: "sine" }),
  star: (c, step) => {
    const f = 1046 * Math.pow(1.19, step)
    tone(c, f, 0, 0.25, { gain: 0.25, type: "triangle" })
    tone(c, f * 2, 0.04, 0.2, { gain: 0.1 })
  },
  submit: (c) => noise(c, 0, 0.5, { freq: 400, to: 3000, gain: 0.25, q: 0.7 }),
  celebrate: (c) => {
    ;[523, 659, 784].forEach((f, i) => tone(c, f, i * 0.09, 0.16, { type: "triangle", gain: 0.3 }))
    tone(c, 1046, 0.27, 0.45, { type: "triangle", gain: 0.35 })
    tone(c, 1318, 0.27, 0.45, { gain: 0.15 })
  },
  shutter: (c) => { noise(c, 0, 0.05, { freq: 3000, gain: 0.4, q: 0.5 }); noise(c, 0.07, 0.06, { freq: 2000, gain: 0.3, q: 0.5 }) },
}

/** Minimum gap per sound so rapid taps don't stack into noise. */
const THROTTLE: Partial<Record<SoundName, number>> = { tap: 70, select: 90, next: 150, star: 60 }
const last = new Map<SoundName, number>()

export function play(name: SoundName, step = 0) {
  if (!settings.enabled || settings.volume <= 0 || typeof window === "undefined") return
  const now = performance.now()
  if (now - (last.get(name) ?? 0) < (THROTTLE[name] ?? 120)) return
  last.set(name, now)
  const c = audio()
  if (!c || !master) return
  master.gain.value = settings.volume
  const buf = buffers.get(name)
  if (buf) {
    const src = c.createBufferSource()
    src.buffer = buf
    src.connect(master)
    src.start()
    return
  }
  SYNTH[name](c, step)
}

/* ---------- Hook ---------- */

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l) }
const snapshot = () => settings

export function useSound() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot)
  return {
    play,
    enabled: s.enabled,
    volume: s.volume,
    setEnabled: useCallback((enabled: boolean) => { update({ enabled }); if (enabled) { audio(); play("tap") } }, []),
    setVolume: useCallback((volume: number) => update({ volume }), []),
  }
}
