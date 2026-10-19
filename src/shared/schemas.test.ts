import { describe, expect, it } from 'vitest'
import { pingRequestSchema, pingResponseSchema } from './schemas'

describe('pingRequestSchema', () => {
  it('accepts a well-formed request', () => {
    const parsed = pingRequestSchema.parse({ sentAt: 1_700_000_000_000 })
    expect(parsed.sentAt).toBe(1_700_000_000_000)
  })

  it('rejects a non-integer timestamp', () => {
    expect(pingRequestSchema.safeParse({ sentAt: 1.5 }).success).toBe(false)
  })

  it('rejects a negative timestamp', () => {
    expect(pingRequestSchema.safeParse({ sentAt: -1 }).success).toBe(false)
  })

  it('rejects unknown keys so the IPC surface stays closed', () => {
    const result = pingRequestSchema.safeParse({ sentAt: 1, injected: 'nope' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing timestamp', () => {
    expect(pingRequestSchema.safeParse({}).success).toBe(false)
  })
})

describe('pingResponseSchema', () => {
  it('accepts a well-formed response and preserves the echo', () => {
    const parsed = pingResponseSchema.parse({
      receivedAt: 1_700_000_000_010,
      echo: 1_700_000_000_000,
      versions: { electron: '44.9.0', chrome: '140.0.0.0', node: '22.20.0' },
    })
    expect(parsed.echo).toBe(1_700_000_000_000)
    expect(parsed.versions.electron).toBe('44.9.0')
  })

  it('rejects a response with a missing version field', () => {
    const result = pingResponseSchema.safeParse({
      receivedAt: 1,
      echo: 0,
      versions: { electron: '44.9.0', chrome: '140.0.0.0' },
    })
    expect(result.success).toBe(false)
  })
})
