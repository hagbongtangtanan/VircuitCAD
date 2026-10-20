import { describe, expect, it } from 'vitest'
import type { PartInstance } from '../../shared/circuit'
import { partValue, referenceDesignators } from './annotations'

function part(overrides: Pick<PartInstance, 'id' | 'type'> & Partial<PartInstance>): PartInstance {
  return {
    position: { x: 0, y: 0 },
    rotation: 0,
    ...overrides,
    props: overrides.props ?? {},
  } as PartInstance
}

describe('referenceDesignators', () => {
  it('numbers each reference prefix in document order', () => {
    const designators = referenceDesignators([
      part({ id: 'r1', type: 'resistor', props: { resistanceOhms: 220 } }),
      part({ id: 'd1', type: 'led', props: { color: 'red' } }),
      part({ id: 'r2', type: 'resistor', props: { resistanceOhms: 10_000 } }),
      part({ id: 'd2', type: 'diode' }),
      part({ id: 'uno', type: 'arduino-uno' }),
    ])

    expect(designators.get('r1')).toBe('R1')
    expect(designators.get('r2')).toBe('R2')
    expect(designators.get('d1')).toBe('D1')
    expect(designators.get('d2')).toBe('D2')
    expect(designators.get('uno')).toBe('U1')
  })

  it('keeps numbering stable when a component is removed', () => {
    const before = referenceDesignators([
      part({ id: 'r1', type: 'resistor', props: { resistanceOhms: 220 } }),
      part({ id: 'r2', type: 'resistor', props: { resistanceOhms: 10_000 } }),
    ])
    const after = referenceDesignators([
      part({ id: 'r1', type: 'resistor', props: { resistanceOhms: 220 } }),
    ])

    expect(before.get('r2')).toBe('R2')
    expect(after.get('r1')).toBe('R1')
  })
})

describe('partValue', () => {
  it('formats component values with engineering units', () => {
    expect(partValue(part({ id: 'r', type: 'resistor', props: { resistanceOhms: 220 } }))).toBe(
      '220 Ω'
    )
    expect(
      partValue(part({ id: 'rv', type: 'potentiometer', props: { resistanceOhms: 10_000 } }))
    ).toBe('10 kΩ')
    expect(partValue(part({ id: 'r2', type: 'resistor', props: { resistanceOhms: 4_700 } }))).toBe(
      '4.7 kΩ'
    )
    expect(
      partValue(part({ id: 'r3', type: 'resistor', props: { resistanceOhms: 1_000_000 } }))
    ).toBe('1 MΩ')
    expect(
      partValue(part({ id: 'c', type: 'capacitor', props: { capacitanceMicroFarads: 100 } }))
    ).toBe('100 µF')
    expect(
      partValue(part({ id: 'l', type: 'inductor', props: { inductanceMilliHenries: 10 } }))
    ).toBe('10 mH')
    expect(partValue(part({ id: 'led', type: 'led', props: { color: 'green' } }))).toBe('GREEN')
  })

  it('returns null for parts without a value', () => {
    expect(partValue(part({ id: 'sw', type: 'push-button' }))).toBeNull()
    expect(partValue(part({ id: 'uno', type: 'arduino-uno' }))).toBeNull()
  })
})
