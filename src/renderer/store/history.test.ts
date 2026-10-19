import { describe, expect, it } from 'vitest'
import { createHistory } from './history'

describe('createHistory', () => {
  it('starts empty', () => {
    const history = createHistory<string>()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
    expect(history.depth).toBe(0)
  })

  it('returns the pushed state on undo', () => {
    const history = createHistory<string>()
    history.push('a')
    expect(history.canUndo()).toBe(true)
    expect(history.undo('b')).toBe('a')
  })

  it('returns null when there is nothing to undo', () => {
    const history = createHistory<string>()
    expect(history.undo('b')).toBeNull()
  })

  it('replays the undone state on redo', () => {
    const history = createHistory<string>()
    history.push('a')
    const undone = history.undo('b')
    expect(undone).toBe('a')
    expect(history.canRedo()).toBe(true)
    expect(history.redo('a')).toBe('b')
    expect(history.canRedo()).toBe(false)
  })

  it('returns null when there is nothing to redo', () => {
    const history = createHistory<string>()
    expect(history.redo('b')).toBeNull()
  })

  it('drops the redo branch when a new edit lands after an undo', () => {
    const history = createHistory<string>()
    history.push('a')
    history.undo('b')
    history.push('a-again')
    expect(history.canRedo()).toBe(false)
    expect(history.undo('c')).toBe('a-again')
    expect(history.undo('a-again')).toBeNull()
  })

  it('walks back through a multi-step history in order', () => {
    const history = createHistory<number>()
    history.push(0)
    history.push(1)
    history.push(2)

    expect(history.undo(3)).toBe(2)
    expect(history.undo(2)).toBe(1)
    expect(history.undo(1)).toBe(0)
    expect(history.undo(0)).toBeNull()
  })

  it('forgets the oldest entries once the limit is reached', () => {
    const history = createHistory<number>(2)
    history.push(0)
    history.push(1)
    history.push(2)

    expect(history.depth).toBe(2)
    expect(history.undo(3)).toBe(2)
    expect(history.undo(2)).toBe(1)
    expect(history.undo(1)).toBeNull()
  })

  it('clears both directions', () => {
    const history = createHistory<string>()
    history.push('a')
    history.undo('b')
    history.clear()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
    expect(history.depth).toBe(0)
  })
})
