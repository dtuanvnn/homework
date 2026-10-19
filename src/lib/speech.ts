"use client"

import { useSyncExternalStore } from "react"

/*
 * Reading English words aloud with the device's own voices (speechSynthesis).
 * iPad voices work offline. Client only; Safari needs the first speak() inside
 * a tap, which it always is here.
 */

export const SPEEDS = [
  { id: "normal", label: "Bình thường", rate: 1 },
  { id: "slow", label: "Chậm", rate: 0.7 },
  { id: "very-slow", label: "Rất chậm", rate: 0.45 },
] as const

export type SpeedId = (typeof SPEEDS)[number]["id"]

export const NO_VOICE = "Thiết bị chưa có giọng đọc tiếng Anh"

const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null)

function englishVoice(): SpeechSynthesisVoice | null {
  const voices = synth()?.getVoices() ?? []
  const lang = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase()
  return voices.find((v) => lang(v) === "en-us") ?? voices.find((v) => lang(v).startsWith("en")) ?? null
}

function subscribeVoices(onChange: () => void) {
  const s = synth()
  if (!s) return () => {}
  s.addEventListener("voiceschanged", onChange)
  return () => s.removeEventListener("voiceschanged", onChange)
}

/** The device has an English voice (voices load asynchronously, so this updates). */
export function useEnglishVoice(): boolean {
  return useSyncExternalStore(subscribeVoices, () => englishVoice() !== null, () => false)
}

/** Speaks `text` in English, cancelling anything still speaking. */
export function speak(text: string, rate: number, on: { start?: () => void; end?: () => void } = {}): void {
  const s = synth()
  const voice = englishVoice()
  if (!s || !voice) return
  s.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.voice = voice
  u.lang = voice.lang
  u.rate = rate
  u.onstart = () => on.start?.()
  u.onend = () => on.end?.()
  u.onerror = () => on.end?.()
  s.speak(u)
}

export function stopSpeaking(): void {
  synth()?.cancel()
}
