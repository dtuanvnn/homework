/*
 * The queue behind "Nghe cả bài" (components/question/use-passage-reader.ts).
 * Browsers fire an utterance's end/error when cancel() interrupts it, so every
 * start and stop bumps a run counter that silences the interrupted callbacks.
 * One reader speaks at a time: starting one halts any other (a result screen
 * has a reader per bài).
 */

export interface ReaderState {
  reading?: number
  playing: boolean
}

/** Speaks one block and calls `end` when it finishes or is cut off. */
export type Say = (text: string, end: () => void) => void

let active: { halt(): void } | null = null

export function createPassageReader(cancel: () => void, onChange: (state: ReaderState) => void) {
  let run = 0
  const self = {
    halt() {
      run += 1
      onChange({ reading: undefined, playing: false })
    },
  }
  return {
    /** Reads `queue` in order; `all` marks "Nghe cả bài" (the button turns into "Dừng"). */
    play(queue: { index: number; text: string }[], all: boolean, say: Say) {
      if (active && active !== self) active.halt()
      active = self
      const id = ++run
      const next = (k: number) => {
        if (run !== id) return
        const item = queue[k]
        if (!item) {
          if (active === self) active = null
          onChange({ reading: undefined, playing: false })
          return
        }
        onChange({ reading: item.index, playing: all })
        say(item.text, () => next(k + 1))
      }
      next(0)
    },
    stop() {
      self.halt()
      if (active === self) active = null
      cancel()
    },
  }
}
