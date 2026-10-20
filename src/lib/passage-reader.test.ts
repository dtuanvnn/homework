import { describe, expect, it } from "vitest"
import { createPassageReader, type ReaderState } from "./passage-reader"

/** Like a browser: cancel() ends the utterance being spoken, firing its end callback. */
function fakeVoice() {
  const said: string[] = []
  let pending: (() => void) | null = null
  return {
    said,
    speak(text: string, end: () => void) {
      const before = pending
      pending = null
      before?.()
      said.push(text)
      pending = end
    },
    cancel() {
      const before = pending
      pending = null
      before?.()
    },
    finish() {
      const before = pending
      pending = null
      before?.()
    },
  }
}

const queue = [
  { index: 1, text: "one" },
  { index: 2, text: "two" },
  { index: 3, text: "three" },
]

describe("createPassageReader", () => {
  it("reads blocks in order and reports the one being read", () => {
    const voice = fakeVoice()
    const states: ReaderState[] = []
    const reader = createPassageReader(voice.cancel, (s) => states.push(s))
    reader.play(queue, true, voice.speak)
    expect(states.at(-1)).toEqual({ reading: 1, playing: true })
    voice.finish()
    voice.finish()
    expect(voice.said).toEqual(["one", "two", "three"])
    voice.finish()
    expect(states.at(-1)).toEqual({ reading: undefined, playing: false })
  })

  it("stops for good when stopped (leaving the bài)", () => {
    const voice = fakeVoice()
    const reader = createPassageReader(voice.cancel, () => {})
    reader.play(queue, true, voice.speak)
    reader.stop()
    voice.finish()
    expect(voice.said).toEqual(["one"])
  })

  it("starting another reader stops the first one", () => {
    const voice = fakeVoice()
    const a: ReaderState[] = []
    const first = createPassageReader(voice.cancel, (s) => a.push(s))
    const second = createPassageReader(voice.cancel, () => {})
    first.play(queue, true, voice.speak)
    second.play([{ index: 1, text: "B one" }], true, voice.speak)
    voice.finish()
    expect(voice.said).toEqual(["one", "B one"])
    expect(a.at(-1)).toEqual({ reading: undefined, playing: false })
  })

  it("replaying one block interrupts the whole-passage queue", () => {
    const voice = fakeVoice()
    const reader = createPassageReader(voice.cancel, () => {})
    reader.play(queue, true, voice.speak)
    reader.play([{ index: 3, text: "three" }], false, voice.speak)
    voice.finish()
    expect(voice.said).toEqual(["one", "three"])
  })
})
