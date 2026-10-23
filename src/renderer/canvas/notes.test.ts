import { describe, expect, it } from 'vitest'
import { NOTE_MIN_HEIGHT, noteHeight } from './notes'

describe('noteHeight', () => {
  it('keeps short notes at the minimum card height', () => {
    expect(noteHeight('')).toBe(NOTE_MIN_HEIGHT)
    expect(noteHeight('Blink the LED')).toBe(NOTE_MIN_HEIGHT)
  })

  it('grows for explicit and wrapped lines', () => {
    const oneLine = noteHeight('a'.repeat(20))
    const manyLines = noteHeight('a'.repeat(200))
    const explicit = noteHeight('one\ntwo\nthree\nfour\nfive')
    expect(manyLines).toBeGreaterThan(oneLine)
    expect(explicit).toBeGreaterThan(oneLine)
  })
})
