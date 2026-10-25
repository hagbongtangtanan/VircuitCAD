import { describe, expect, it } from 'vitest'
import { hasSeenOnboarding, markOnboardingSeen, ONBOARDING_STORAGE_KEY } from './onboarding'

function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('onboarding storage', () => {
  it('treats a fresh install as unseen', () => {
    expect(hasSeenOnboarding(memoryStorage())).toBe(false)
  })

  it('remembers a skipped orientation', () => {
    const storage = memoryStorage()
    markOnboardingSeen('skipped', storage)
    expect(storage.getItem(ONBOARDING_STORAGE_KEY)).toBe('skipped')
    expect(hasSeenOnboarding(storage)).toBe(true)
  })

  it('remembers a completed orientation', () => {
    const storage = memoryStorage()
    markOnboardingSeen('completed', storage)
    expect(storage.getItem(ONBOARDING_STORAGE_KEY)).toBe('completed')
    expect(hasSeenOnboarding(storage)).toBe(true)
  })

  it('does not block startup when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(hasSeenOnboarding(storage)).toBe(false)
    expect(() => markOnboardingSeen('skipped', storage)).not.toThrow()
  })
})
