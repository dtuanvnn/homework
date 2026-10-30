import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { passagePieces } from "@/lib/blanks"
import RichText from "./RichText"
import Passage from "./Passage"
import BlankText from "./BlankText"
import FormulaPreview from "@/components/exercise-detail/FormulaPreview"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe("formatted question rendering", () => {
  it("renders a formatted dialogue speaker without exposing markup", () => {
    const html = renderToStaticMarkup(createElement(Passage, { group: { id: "g", prompt: "<u>Mai: Hello.</u>", layout: "hoi-thoai" } }))
    expect(html).toMatch(/<u[^>]*>Mai<\/u>/)
    expect(html).toMatch(/<u[^>]*>Hello.<\/u>/)
    expect(html).not.toContain("&lt;u&gt;")
    expect(html).not.toContain("&lt;/u&gt;")
  })

  it("renders emphasis as safe semantic elements and arbitrary HTML as text", () => {
    const html = renderToStaticMarkup(createElement(RichText, { text: '**word** ch<u>oo</u>se ==here== <img src=x onerror=alert(1)>' }))
    expect(html).toContain("<strong>word</strong>")
    expect(html).toMatch(/<u[^>]*>oo<\/u>/)
    expect(html).toMatch(/<mark[^>]*>here<\/mark>/)
    expect(html).toContain("&lt;img")
    expect(html).not.toContain("<img")
  })

  it("shows a live preview when a field contains formatting but no math", () => {
    const html = renderToStaticMarkup(createElement(FormulaPreview, { text: "ch<u>oo</u>se" }))
    expect(html).toMatch(/<u[^>]*>oo<\/u>/)
    expect(html).toContain("Xem trước")
  })

  it.each([undefined, "doan-van", "hoi-thoai"] as const)("keeps emphasis in a passage with layout %s", (layout) => {
    const html = renderToStaticMarkup(createElement(Passage, { group: { id: "g", prompt: "ch<u>oo</u>se **word** ==now==", layout } }))
    expect(html).toMatch(/<u[^>]*>oo<\/u>/)
    expect(html).toContain("<strong>word</strong>")
    expect(html).toMatch(/<mark[^>]*>now<\/mark>/)
  })

  it("preserves styles surrounding filled blanks and renders math only once", () => {
    const html = renderToStaticMarkup(createElement(BlankText, {
      pieces: passagePieces("<u>word ___</u> **$x$**"),
      slot: () => ({ given: "answer", correct: true }),
    }))
    expect(html).toMatch(/<u[^>]*>word <\/u>/)
    expect(html).toMatch(/<u[^>]*>.*answer.*<\/u>/)
    expect(html).toContain("katex")
    expect(html).not.toContain("&lt;u&gt;")
    expect(html).not.toContain("**")
  })
})
