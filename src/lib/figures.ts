/*
 * Question figures are JPEGs cut out of scanned pages (or picked in the
 * editor), uploaded under the set's Storage folder as `figure.jpg`, so their
 * paths are `sets/{setId}/{uuid}-figure.jpg`. Duplicated sets and answer
 * snapshots can point at another set's figure, so cleanup only removes
 * figures nothing references.
 */

export const FIGURE_FILE_NAME = "figure.jpg"

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const FIGURE_PATH = new RegExp(`^sets/(${UUID})/${UUID}-figure\\.jpg$`, "i")

export const isFigurePath = (path: string) => FIGURE_PATH.test(path)
export const figureOwner = (path: string) => FIGURE_PATH.exec(path)?.[1] ?? null

/** Figure objects among `listed` that nothing in `referenced` points to. */
export function unusedFigures(listed: string[], referenced: Iterable<string>): string[] {
  const used = new Set(referenced)
  return listed.filter((p) => isFigurePath(p) && !used.has(p))
}
