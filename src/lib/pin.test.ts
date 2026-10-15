import { describe, expect, it } from "vitest"
import { roleForPath, isValidPin, parentPin, studentPinHash } from "./pin"

describe("pin gate", () => {
  it("maps paths to modes", () => {
    expect(roleForPath("/parent")).toBe("parent")
    expect(roleForPath("/parent/library/abc")).toBe("parent")
    expect(roleForPath("/student/results/x")).toBe("student")
    expect(roleForPath("/parents")).toBeNull()
    expect(roleForPath("/")).toBeNull()
  })
})

describe("student pins", () => {
  it("hashes per child", async () => {
    const a = await studentPinHash("s1", "1234")
    expect(a).toBe(await studentPinHash("s1", "1234"))
    expect(a).not.toBe(await studentPinHash("s2", "1234"))
  })
  it("accepts 4–6 digits", () => {
    expect(isValidPin("1234")).toBe(true)
    expect(isValidPin("123456")).toBe(true)
    expect(isValidPin("123")).toBe(false)
    expect(isValidPin("12a4")).toBe(false)
  })
  it("reads the parent PIN with the APP_PIN fallback", () => {
    expect(parentPin({ PARENT_PIN: "1", APP_PIN: "2" })).toBe("1")
    expect(parentPin({ APP_PIN: "2" })).toBe("2")
    expect(parentPin({})).toBeUndefined()
  })
})
