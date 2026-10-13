/*
 * Figure boxes: [x0, y0, x1, y1] in 0–1000 of a page's width and height, as
 * the scanner returns them. Pure maths for repairing AI boxes, snapping them to
 * the drawing on the page, cropping, and converting to/from react-image-crop's
 * percent crops.
 */

export type Box = [number, number, number, number]

export const FULL_PAGE: Box = [0, 0, 1000, 1000]

const clamp = (n: number) => Math.min(1000, Math.max(0, Math.round(n)))

/** A usable box, or null when it is missing, too small (<2% of a side) or covers >95% of the page. */
export function repairBox(raw: number[] | null | undefined): Box | null {
  if (!raw || raw.length !== 4 || raw.some((n) => !Number.isFinite(n))) return null
  const [a, b, c, d] = raw.map(clamp)
  const box: Box = [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]
  const w = box[2] - box[0]
  const h = box[3] - box[1]
  if (w < 20 || h < 20 || w * h > 950_000) return null
  return box
}

/** Pixel rectangle of a box on a `width`×`height` page, padded by `padding` of the page on each side. */
export function cropRect(box: Box, width: number, height: number, padding = 0) {
  const pad = padding * 1000
  const x0 = Math.max(0, box[0] - pad)
  const y0 = Math.max(0, box[1] - pad)
  const x1 = Math.min(1000, box[2] + pad)
  const y1 = Math.min(1000, box[3] + pad)
  const x = Math.floor((x0 / 1000) * width)
  const y = Math.floor((y0 / 1000) * height)
  return { x, y, width: Math.ceil((x1 / 1000) * width) - x, height: Math.ceil((y1 / 1000) * height) - y }
}

export function boxFromPercent(c: { x: number; y: number; width: number; height: number }): Box {
  return [clamp(c.x * 10), clamp(c.y * 10), clamp((c.x + c.width) * 10), clamp((c.y + c.height) * 10)]
}

export function percentFromBox(b: Box) {
  return { unit: "%" as const, x: b[0] / 10, y: b[1] / 10, width: (b[2] - b[0]) / 10, height: (b[3] - b[1]) / 10 }
}

export const sameBox = (a: Box, b: Box) => a.every((v, i) => Math.abs(v - b[i]) < 1)

/** Dark pixels of a page (1 = ink), from canvas RGBA data. */
export interface InkMap {
  width: number
  height: number
  ink: Uint8Array
}

/** Ink is anything clearly darker than the paper (the 90th-percentile brightness, so photos of gray paper work too). */
export function inkMap(rgba: Uint8ClampedArray, width: number, height: number): InkMap {
  const n = width * height
  const light = new Uint8Array(n)
  const histogram = new Uint32Array(256)
  for (let i = 0; i < n; i++) {
    const l = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000
    light[i] = l
    histogram[light[i]]++
  }
  let paper = 0
  for (let seen = histogram[0]; seen < 0.9 * n && paper < 255; ) seen += histogram[++paper]
  const threshold = paper * 0.7
  const ink = new Uint8Array(n)
  for (let i = 0; i < n; i++) ink[i] = light[i] < threshold ? 1 : 0
  return { width, height, ink }
}

/**
 * Fits an AI box to the drawing it points at, in four steps:
 * 1. drop short bands at the top or bottom whose ink runs on past the box's
 *    sides: lines of question text or answer choices the box cut through;
 * 2. move edges that cut through ink outwards (at most `maxGrow` of the page),
 *    jumping word gaps sideways so a label like "30 cm" comes along whole;
 * 3. trim blank margins;
 * 4. add up to `margin` of the page of blank space back, never into other ink.
 * A box with no ink in it is returned as is.
 */
export function snapBox(map: InkMap, box: Box, { maxGrow = 0.08, margin = 0.01 } = {}): Box {
  const { width: w, height: h, ink } = map
  const minInk = (length: number) => Math.max(1, Math.round(length * 0.002))
  const rowInk = (y: number, x0: number, x1: number) => {
    let count = 0
    for (let x = x0; x < x1; x++) count += ink[y * w + x]
    return count >= minInk(x1 - x0)
  }
  const colInk = (x: number, y0: number, y1: number) => {
    let count = 0
    for (let y = y0; y < y1; y++) count += ink[y * w + x]
    return count >= minInk(y1 - y0)
  }
  // Edges in pixels: left/top inclusive, right/bottom exclusive.
  let l = Math.floor((box[0] / 1000) * w)
  let t = Math.floor((box[1] / 1000) * h)
  let r = Math.ceil((box[2] / 1000) * w)
  let b = Math.ceil((box[3] / 1000) * h)

  const lineHeight = 0.03 * h
  const reach = Math.round(0.08 * w)
  const runsOn = (y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) if (rowInk(y, Math.max(0, l - reach), l) || rowInk(y, r, Math.min(w, r + reach))) return true
    return false
  }
  for (;;) {
    let s = t
    while (s < b && !rowInk(s, l, r)) s++
    let e = s
    while (e < b && rowInk(e, l, r)) e++
    if (s >= b || e - s >= lineHeight || !runsOn(s, e)) break
    t = e
  }
  for (;;) {
    let e = b
    while (e > t && !rowInk(e - 1, l, r)) e--
    let s = e
    while (s > t && rowInk(s - 1, l, r)) s--
    if (e <= t || e - s >= lineHeight || !runsOn(s, e)) break
    b = s
  }

  const limit = { l: Math.max(0, l - maxGrow * w), t: Math.max(0, t - maxGrow * h), r: Math.min(w, r + maxGrow * w), b: Math.min(h, b + maxGrow * h) }
  const gap = Math.round(0.015 * w)
  const edges = () => `${l},${t},${r},${b}`
  // Only edges with ink on them grow (after step 1 the dropped side is blank).
  // Growing one edge widens the lines the others check, so repeat until nothing moves.
  for (let before = ""; before !== edges(); ) {
    before = edges()
    if (colInk(l, t, b)) for (let x = l - 1; x >= limit.l && x >= l - gap; x--) if (colInk(x, t, b)) l = x
    if (colInk(r - 1, t, b)) for (let x = r; x < limit.r && x < r + gap; x++) if (colInk(x, t, b)) r = x + 1
    if (rowInk(t, l, r)) while (t > limit.t && rowInk(t - 1, l, r)) t--
    if (rowInk(b - 1, l, r)) while (b < limit.b && rowInk(b, l, r)) b++
  }

  while (l < r && !colInk(l, t, b)) l++
  while (r > l && !colInk(r - 1, t, b)) r--
  while (t < b && !rowInk(t, l, r)) t++
  while (b > t && !rowInk(b - 1, l, r)) b--
  if (l >= r || t >= b) return box

  const padX = Math.round(margin * w)
  const padY = Math.round(margin * h)
  for (let i = 0; i < padX && l > 0 && !colInk(l - 1, t, b); i++) l--
  for (let i = 0; i < padX && r < w && !colInk(r, t, b); i++) r++
  for (let i = 0; i < padY && t > 0 && !rowInk(t - 1, l, r); i++) t--
  for (let i = 0; i < padY && b < h && !rowInk(b, l, r); i++) b++
  return [clamp((l / w) * 1000), clamp((t / h) * 1000), clamp((r / w) * 1000), clamp((b / h) * 1000)]
}
