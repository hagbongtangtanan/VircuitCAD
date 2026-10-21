import { describe, expect, it } from 'vitest'
import { definitionOf } from './definitions'

describe('part pin layouts', () => {
  it('puts the seven-segment pins on both edges like a real package', () => {
    const definition = definitionOf('seven-segment')
    const top = definition.pins.filter((pin) => pin.position.y === 0)
    const bottom = definition.pins.filter((pin) => pin.position.y === definition.size.height)

    expect(top).toHaveLength(5)
    expect(bottom).toHaveLength(5)
    expect(new Set(definition.pins.map((pin) => pin.id)).size).toBe(definition.pins.length)
    expect(definition.internalNets).toContainEqual(['common', 'common2'])
  })

  it('marks the six Uno PWM pins with a leading tilde', () => {
    const pwmPins = definitionOf('arduino-uno')
      .pins.filter((pin) => pin.label.startsWith('~'))
      .map((pin) => pin.id)
      .sort()

    expect(pwmPins).toEqual(['D10', 'D11', 'D3', 'D5', 'D6', 'D9'])
  })
})
