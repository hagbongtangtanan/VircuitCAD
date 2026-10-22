import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_NAME, normalizeProjectName } from './app'

describe('normalizeProjectName', () => {
  it('keeps a trimmed user title', () => {
    expect(normalizeProjectName('  My circuit  ')).toBe('My circuit')
  })

  it('falls back when the title is blank', () => {
    expect(normalizeProjectName('')).toBe(DEFAULT_PROJECT_NAME)
    expect(normalizeProjectName('   ')).toBe(DEFAULT_PROJECT_NAME)
  })
})
