/*
 * Figure boxes: [x0, y0, x1, y1] in 0–1000 of a page's width and height, as
 * the scanner returns them. Pure maths for repairing AI boxes, cropping with
 * padding, and converting to/from react-image-crop's percent crops.
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
export function cropRect(box: Box, width: number, height: number, padding = 0.03) {
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
