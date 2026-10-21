import { describe, expect, it } from 'vitest'
import { circuitDocumentSchema } from '../../shared/circuit'
import { definitionOf, partDefinitions } from './definitions'

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

describe('expanded library definitions', () => {
  it('gives every part a unique pin layout inside its footprint', () => {
    for (const definition of partDefinitions) {
      const ids = definition.pins.map((pin) => pin.id)
      expect(new Set(ids).size, definition.type).toBe(ids.length)
      for (const pin of definition.pins) {
        expect(pin.position.x, `${definition.type}:${pin.id}`).toBeGreaterThanOrEqual(0)
        expect(pin.position.x, `${definition.type}:${pin.id}`).toBeLessThanOrEqual(
          definition.size.width
        )
        expect(pin.position.y, `${definition.type}:${pin.id}`).toBeGreaterThanOrEqual(0)
        expect(pin.position.y, `${definition.type}:${pin.id}`).toBeLessThanOrEqual(
          definition.size.height
        )
      }
      expect(definition.size.width, definition.type).toBeGreaterThan(0)
      expect(definition.size.height, definition.type).toBeGreaterThan(0)
    }
  })

  it('publishes physical ranges for every analog sensor', () => {
    const sensors = partDefinitions.filter((definition) => definition.sensor !== undefined)
    expect(sensors.length).toBeGreaterThanOrEqual(10)
    for (const definition of sensors) {
      const spec = definition.sensor
      if (spec === undefined) continue
      expect(spec.max, definition.type).toBeGreaterThan(spec.min)
      expect(spec.label.length, definition.type).toBeGreaterThan(0)
    }
  })

  it('routes the six-pin gas sensor through paired A and B contacts', () => {
    const gas = definitionOf('gas-sensor')
    expect(gas.pins).toHaveLength(6)
    expect(gas.internalNets).toContainEqual(['a1', 'a2'])
    expect(gas.internalNets).toContainEqual(['b1', 'b2'])
  })

  it('exposes the documented DIP switch banks', () => {
    expect(definitionOf('dip-switch-4').pins).toHaveLength(8)
    expect(definitionOf('dip-switch-6').pins).toHaveLength(12)
  })
})

describe('full reference library', () => {
  it('adds every reference part exactly once', () => {
    const types = partDefinitions.map((definition) => definition.type)
    expect(new Set(types).size).toBe(types.length)
    expect(types.length).toBeGreaterThanOrEqual(95)
  })

  it('round-trips every definition through the document schema with its defaults', () => {
    for (const definition of partDefinitions) {
      const parsed = circuitDocumentSchema.parse({
        version: 1,
        parts: [
          {
            id: `part-${definition.type}`,
            type: definition.type,
            position: { x: 0, y: 0 },
            rotation: 0,
            props: definition.defaultProps,
          },
        ],
        wires: [],
      })
      expect(parsed.parts[0]?.type, definition.type).toBe(definition.type)
    }
  })
})
