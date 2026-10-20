"use client"

import { useSyncExternalStore } from "react"
import type { SubjectId } from "./types"

/*
 * Reading aloud with the device's own voices (speechSynthesis): English for
 * flashcards and passages, Vietnamese for Tiếng Việt passages.
 * iPad voices work offline. Client only; Safari needs the first speak() inside
 * a tap, which it always is here.
 */

export const SPEEDS = [
  { id: "normal", label: "Bình thường", rate: 1 },
  { id: "slow", label: "Chậm", rate: 0.7 },
  { id: "very-slow", label: "Rất chậm", rate: 0.45 },
] as const

export type SpeedId = (typeof SPEEDS)[number]["id"]

export type SpeechLang = "en" | "vi"

/** Passages are read in the language of their subject; Toán has no speaker. */
export function speechLangFor(subject: SubjectId): SpeechLang | null {
  return subject === "tieng-anh" ? "en" : subject === "tieng-viet" ? "vi" : null
}

export function noVoiceMessage(lang: SpeechLang): string {
  return `Thiết bị chưa có giọng đọc ${lang === "vi" ? "tiếng Việt" : "tiếng Anh"}`
}

export const NO_VOICE = noVoiceMessage("en")

const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null)

/** The best of `voices` for `lang`: American English first, then any English; any Vietnamese. */
export function voiceFor(lang: SpeechLang, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const code = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase()
  const exact = lang === "en" ? "en-us" : "vi-vn"
  return voices.find((v) => code(v) === exact) ?? voices.find((v) => code(v).startsWith(lang)) ?? null
}

const deviceVoice = (lang: SpeechLang) => voiceFor(lang, synth()?.getVoices() ?? [])

function subscribeVoices(onChange: () => void) {
  const s = synth()
  if (!s) return () => {}
  s.addEventListener("voiceschanged", onChange)
  return () => s.removeEventListener("voiceschanged", onChange)
}

/** The device has a voice for `lang` (voices load asynchronously, so this updates). */
export function useVoice(lang: SpeechLang): boolean {
  return useSyncExternalStore(subscribeVoices, () => deviceVoice(lang) !== null, () => false)
}

export const useEnglishVoice = () => useVoice("en")

/** Speaks `text` (English unless `on.lang` says otherwise), cancelling anything still speaking. */
export function speak(text: string, rate: number, on: { lang?: SpeechLang; start?: () => void; end?: () => void } = {}): void {
  const s = synth()
  const voice = deviceVoice(on.lang ?? "en")
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
