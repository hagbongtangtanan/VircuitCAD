/**
 * A snapshot-based command stack. Each mutation hands the previous document to
 * `push`, which is enough to reconstruct any earlier state without every command
 * knowing how to invert itself.
 */
export interface History<State> {
  readonly depth: number
  push(previous: State): void
  undo(current: State): State | null
  redo(current: State): State | null
  canUndo(): boolean
  canRedo(): boolean
  clear(): void
}

export function createHistory<State>(limit = 100): History<State> {
  const past: State[] = []
  const future: State[] = []

  return {
    get depth(): number {
      return past.length
    },

    push(previous: State): void {
      past.push(previous)
      if (past.length > limit) {
        past.shift()
      }
      // Any new edit invalidates the redo branch.
      future.length = 0
    },

    undo(current: State): State | null {
      const previous = past.pop()
      if (previous === undefined) return null
      future.push(current)
      return previous
    },

    redo(current: State): State | null {
      const next = future.pop()
      if (next === undefined) return null
      past.push(current)
      return next
    },

    canUndo(): boolean {
      return past.length > 0
    },

    canRedo(): boolean {
      return future.length > 0
    },

    clear(): void {
      past.length = 0
      future.length = 0
    },
  }
}
