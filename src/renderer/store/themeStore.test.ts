import { describe, expect, it } from 'vitest'
import { readTheme, THEME_STORAGE_KEY } from './themeStore'

function storage(value: string | null): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  if (value !== null) values.set(THEME_STORAGE_KEY, value)
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, next) => {
      values.set(key, next)
    },
  }
}

describe('theme storage', () => {
  it('defaults to dark when nothing is stored', () => {
    expect(readTheme(storage(null))).toBe('dark')
  })

  it('reads a stored light preference', () => {
    expect(readTheme(storage('light'))).toBe('light')
  })

  it('ignores unknown values', () => {
    expect(readTheme(storage('sepia'))).toBe('dark')
  })
})
