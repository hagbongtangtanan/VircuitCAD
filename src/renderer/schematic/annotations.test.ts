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

  it('assigns prefixes to expanded library parts', () => {
    const designators = referenceDesignators([
      part({ id: 'c1', type: 'electrolytic-capacitor', props: { capacitanceMicroFarads: 100 } }),
      part({ id: 'z1', type: 'zener-diode', props: { zenerVoltage: 5.1 } }),
      part({ id: 'lp1', type: 'light-bulb', props: { ratedVolts: 5, resistanceOhms: 100 } }),
      part({ id: 'th1', type: 'thermistor' }),
      part({ id: 'dip1', type: 'dip-switch-4' }),
      part({ id: 'reg1', type: 'lm7805' }),
      part({ id: 'ir1', type: 'ir-receiver' }),
      part({ id: 'neo1', type: 'neopixel-strip', props: { pixelCount: 8, color: 'green' } }),
      part({ id: 'gate1', type: '74hc00' }),
      part({ id: 'q1', type: 'transistor-npn' }),
    ])

    expect(designators.get('c1')).toBe('C1')
    expect(designators.get('z1')).toBe('D1')
    expect(designators.get('lp1')).toBe('LP1')
    expect(designators.get('th1')).toBe('TH1')
    expect(designators.get('dip1')).toBe('SW1')
    expect(designators.get('reg1')).toBe('U1')
    expect(designators.get('ir1')).toBe('IR1')
    expect(designators.get('neo1')).toBe('DS1')
    expect(designators.get('gate1')).toBe('U2')
    expect(designators.get('q1')).toBe('Q1')
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
    expect(partValue(part({ id: 'rgb', type: 'rgb-led' }))).toBe('RGB')
    expect(
      partValue(
        part({ id: 'ec', type: 'electrolytic-capacitor', props: { capacitanceMicroFarads: 470 } })
      )
    ).toBe('470 µF')
    expect(partValue(part({ id: 'z', type: 'zener-diode', props: { zenerVoltage: 5.1 } }))).toBe(
      '5.1 V'
    )
    expect(
      partValue(
        part({ id: 'lp', type: 'light-bulb', props: { ratedVolts: 5, resistanceOhms: 100 } })
      )
    ).toBe('5 V')
    expect(partValue(part({ id: 'reg', type: 'lm7805' }))).toBe('5 V')
    expect(partValue(part({ id: 'reg2', type: 'ld1117v33' }))).toBe('3.3 V')
    expect(
      partValue(
        part({ id: 'neo', type: 'neopixel-strip', props: { pixelCount: 12, color: 'blue' } })
      )
    ).toBe('12 px')
    expect(partValue(part({ id: 'dmm', type: 'multimeter', props: { mode: 'amps' } }))).toBe('AMPS')
    expect(
      partValue(
        part({
          id: 'fg',
          type: 'function-generator',
          props: {
            waveform: 'square',
            frequencyHz: 1000,
            amplitudeVolts: 5,
            offsetVolts: 0,
          },
        })
      )
    ).toBe('square 1000 Hz')
  })

  it('returns null for parts without a value', () => {
    expect(partValue(part({ id: 'sw', type: 'push-button' }))).toBeNull()
    expect(partValue(part({ id: 'uno', type: 'arduino-uno' }))).toBeNull()
  })
})
