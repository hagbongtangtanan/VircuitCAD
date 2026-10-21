import { describe, expect, it } from 'vitest'
import { mixRgbGlow } from './partColors'

function channels(
  red: number,
  green: number,
  blue: number
): {
  red: number
  green: number
  blue: number
} {
  return { red, green, blue }
}

function rgbParts(color: string): readonly [number, number, number] {
  const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(color)
  if (match === null) throw new Error(`unexpected colour ${color}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

describe('mixRgbGlow', () => {
  it('adds red and blue into violet instead of hiding one behind the lens', () => {
    const [red, green, blue] = rgbParts(mixRgbGlow(channels(1, 0, 1)).color)

    expect(red).toBeGreaterThan(200)
    expect(blue).toBeGreaterThan(200)
    expect(green).toBeLessThan(red)
  })

  it('turns all three dice into a near-white mix', () => {
    const [red, green, blue] = rgbParts(mixRgbGlow(channels(1, 1, 1)).color)

    expect(red).toBeGreaterThan(230)
    expect(green).toBeGreaterThan(230)
    expect(blue).toBeGreaterThan(230)
  })

  it('reports zero strength while every channel is dark', () => {
    expect(mixRgbGlow(channels(0, 0, 0))).toEqual({ color: '#ffffff', strength: 0 })
  })
})
