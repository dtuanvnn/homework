import { describe, expect, it } from "vitest"
import { grants, pinsFromEnv, pinToken, roleForPath } from "./pin"

describe("pin gate", () => {
  const pins = { student: "4430", parent: "0316" }

  it("gives each mode its own PIN, the parent falling back to APP_PIN", () => {
    expect(pinsFromEnv({ APP_PIN: "4430", PARENT_PIN: "0316" })).toEqual(pins)
    expect(pinsFromEnv({ APP_PIN: "4430" })).toEqual({ student: "4430", parent: "4430" })
    expect(pinsFromEnv({})).toEqual({ student: undefined, parent: undefined })
  })

  it("lets a cookie open only the mode whose PIN was entered", async () => {
    const student = await pinToken("student", "4430")
    expect(await grants(student, pins, "student")).toBe(true)
    expect(await grants(student, pins, "parent")).toBe(false)
    const parent = await pinToken("parent", "0316")
    expect(await grants(parent, pins, "parent")).toBe(true)
    expect(await grants(parent, pins, "student")).toBe(false)
    // Same PIN for both modes still means one mode per entry.
    expect(await grants(await pinToken("student", "4430"), { student: "4430", parent: "4430" }, "parent")).toBe(false)
    expect(await grants(undefined, pins, "student")).toBe(false)
  })

  it("leaves modes without a PIN open", async () => {
    expect(await grants(undefined, {}, "parent")).toBe(true)
  })

  it("maps paths to modes", () => {
    expect(roleForPath("/parent")).toBe("parent")
    expect(roleForPath("/parent/library/abc")).toBe("parent")
    expect(roleForPath("/student/results/x")).toBe("student")
    expect(roleForPath("/parents")).toBeNull()
    expect(roleForPath("/")).toBeNull()
  })
})
