import { describe, expect, it } from 'vitest'
import { resistorBands } from './resistorBands'

describe('resistorBands', () => {
  it('renders 220 Ω as red, red, brown, gold', () => {
    expect(resistorBands(220)).toEqual(['#c0392b', '#c0392b', '#6b4a2f', '#d4a017'])
  })

  it('renders 1000 Ω as brown, black, red, gold', () => {
    expect(resistorBands(1000)).toEqual(['#6b4a2f', '#11131a', '#c0392b', '#d4a017'])
  })

  it('renders 4700 Ω as yellow, violet, red, gold', () => {
    expect(resistorBands(4700)).toEqual(['#eab308', '#7c3aed', '#c0392b', '#d4a017'])
  })

  it('always returns four bands', () => {
    for (const value of [1, 10, 47, 330, 10_000, 1_000_000]) {
      expect(resistorBands(value)).toHaveLength(4)
    }
  })

  it('falls back to a valid set of bands for nonsense values', () => {
    expect(resistorBands(0)).toHaveLength(4)
    expect(resistorBands(Number.NaN)).toHaveLength(4)
    expect(resistorBands(-100)).toHaveLength(4)
  })
})
