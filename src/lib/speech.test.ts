import { describe, expect, it } from "vitest"
import { noVoiceMessage, speechLangFor, voiceFor } from "./speech"

const v = (lang: string) => ({ lang, name: lang }) as SpeechSynthesisVoice

describe("voiceFor", () => {
  it("prefers American English", () => {
    expect(voiceFor("en", [v("en-GB"), v("en-US")])?.lang).toBe("en-US")
    expect(voiceFor("en", [v("vi-VN"), v("en-AU")])?.lang).toBe("en-AU")
  })

  it("picks a Vietnamese voice", () => {
    expect(voiceFor("vi", [v("en-US"), v("vi-VN")])?.lang).toBe("vi-VN")
    expect(voiceFor("vi", [v("vi_VN")])?.lang).toBe("vi_VN")
  })

  it("returns null when no voice matches", () => {
    expect(voiceFor("vi", [v("en-US")])).toBeNull()
    expect(voiceFor("en", [])).toBeNull()
  })
})

describe("speechLangFor", () => {
  it("maps subjects to voices", () => {
    expect(speechLangFor("tieng-anh")).toBe("en")
    expect(speechLangFor("tieng-viet")).toBe("vi")
    expect(speechLangFor("toan")).toBeNull()
  })

  it("names the missing voice", () => {
    expect(noVoiceMessage("vi")).toBe("Thiết bị chưa có giọng đọc tiếng Việt")
    expect(noVoiceMessage("en")).toBe("Thiết bị chưa có giọng đọc tiếng Anh")
  })
})
