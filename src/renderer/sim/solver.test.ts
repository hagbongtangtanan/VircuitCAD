import { describe, expect, it } from 'vitest'
import { circuitDocumentSchema, type CircuitDocument, type LedColor } from '../../shared/circuit'
import { buildNetlist } from '../wiring/netlist'
import { solveCircuit, type PinDriver } from './solver'

function circuit(ledColor: LedColor = 'red'): CircuitDocument {
  return circuitDocumentSchema.parse({
    version: 1,
    parts: [
      { id: 'uno', type: 'arduino-uno', position: { x: 0, y: 0 }, rotation: 0, props: {} },
      {
        id: 'r1',
        type: 'resistor',
        position: { x: 400, y: 0 },
        rotation: 0,
        props: { resistanceOhms: 220 },
      },
      {
        id: 'led1',
        type: 'led',
        position: { x: 500, y: 0 },
        rotation: 0,
        props: { color: ledColor },
      },
    ],
    wires: [
      {
        id: 'w1',
        from: { partId: 'uno', pinId: '5V' },
        to: { partId: 'r1', pinId: 'lead1' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w2',
        from: { partId: 'r1', pinId: 'lead2' },
        to: { partId: 'led1', pinId: 'anode' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w3',
        from: { partId: 'led1', pinId: 'cathode' },
        to: { partId: 'uno', pinId: 'GND' },
        color: '#4f9cf9',
        waypoints: [],
      },
    ],
  })
}

function driversFor(volts: Record<string, number>): Map<string, PinDriver> {
  const drivers = new Map<string, PinDriver>()
  for (const [pin, value] of Object.entries(volts)) {
    drivers.set(`uno:${pin}`, { volts: value, resistanceOhms: pin === '5V' ? 0.5 : 0.1 })
  }
  return drivers
}

describe('solveCircuit', () => {
  it('lights a red LED through a 220 ohm resistor', () => {
    const document = circuit()
    const netlist = buildNetlist(document)
    const result = solveCircuit(document, netlist, driversFor({ '5V': 5, GND: 0, GND2: 0 }))

    const current = result.ledCurrents.get('led1') ?? 0
    // (5 - 1.8) / (220 + 0.5 source + 0.5 LED + 0.1 ground)
    expect(current).toBeGreaterThan(0.014)
    expect(current).toBeLessThan(0.015)
  })

  it('does not light a reversed LED', () => {
    const document = circuit()
    const reversed = circuitDocumentSchema.parse({
      ...document,
      wires: [
        {
          id: 'w1',
          from: { partId: 'uno', pinId: '5V' },
          to: { partId: 'r1', pinId: 'lead1' },
          color: '#4f9cf9',
          waypoints: [],
        },
        {
          id: 'w2',
          from: { partId: 'r1', pinId: 'lead2' },
          to: { partId: 'led1', pinId: 'cathode' },
          color: '#4f9cf9',
          waypoints: [],
        },
        {
          id: 'w3',
          from: { partId: 'led1', pinId: 'anode' },
          to: { partId: 'uno', pinId: 'GND' },
          color: '#4f9cf9',
          waypoints: [],
        },
      ],
    })
    const result = solveCircuit(
      reversed,
      buildNetlist(reversed),
      new Map([
        ['uno:5V', { volts: 5, resistanceOhms: 0.5 }],
        ['uno:GND', { volts: 0, resistanceOhms: 0.1 }],
        ['uno:GND2', { volts: 0, resistanceOhms: 0.1 }],
      ])
    )
    expect(result.ledCurrents.get('led1') ?? 0).toBeLessThan(1e-6)
  })

  it('leaves an unconnected LED dark', () => {
    const document = circuitDocumentSchema.parse({
      version: 1,
      parts: [
        { id: 'led1', type: 'led', position: { x: 0, y: 0 }, rotation: 0, props: { color: 'red' } },
      ],
      wires: [],
    })
    const result = solveCircuit(document, buildNetlist(document), new Map())
    expect(result.ledCurrents.get('led1')).toBe(0)
  })

  it('drives an LED from a digital pin instead of the 5V rail', () => {
    const document = circuit()
    const wired = circuitDocumentSchema.parse({
      ...document,
      wires: document.wires.map((wire) =>
        wire.from.pinId === '5V' ? { ...wire, from: { ...wire.from, pinId: 'D13' } } : wire
      ),
    })
    const netlist = buildNetlist(wired)

    const high = solveCircuit(
      wired,
      netlist,
      new Map([
        ['uno:D13', { volts: 5, resistanceOhms: 25 }],
        ['uno:GND', { volts: 0, resistanceOhms: 0.1 }],
        ['uno:GND2', { volts: 0, resistanceOhms: 0.1 }],
      ])
    )
    const turned = solveCircuit(
      wired,
      netlist,
      new Map([
        ['uno:D13', { volts: 0, resistanceOhms: 25 }],
        ['uno:GND', { volts: 0, resistanceOhms: 0.1 }],
        ['uno:GND2', { volts: 0, resistanceOhms: 0.1 }],
      ])
    )

    expect(high.ledCurrents.get('led1') ?? 0).toBeGreaterThan(0.01)
    expect(turned.ledCurrents.get('led1') ?? 0).toBeLessThan(1e-6)
  })

  it('scales an LED by the PWM duty cycle at the pin', () => {
    const document = circuit()
    const wired = circuitDocumentSchema.parse({
      ...document,
      wires: document.wires.map((wire) =>
        wire.from.pinId === '5V' ? { ...wire, from: { ...wire.from, pinId: 'D6' } } : wire
      ),
    })
    const netlist = buildNetlist(wired)
    const driven = (duty: number): Map<string, PinDriver> =>
      new Map([
        ['uno:D6', { volts: 5, resistanceOhms: 25, duty }],
        ['uno:GND', { volts: 0, resistanceOhms: 0.1 }],
        ['uno:GND2', { volts: 0, resistanceOhms: 0.1 }],
      ])

    const full = solveCircuit(wired, netlist, driven(1)).ledCurrents.get('led1') ?? 0
    const half = solveCircuit(wired, netlist, driven(0.5)).ledCurrents.get('led1') ?? 0
    const off =
      solveCircuit(
        wired,
        netlist,
        new Map([
          ['uno:D6', { volts: 0, resistanceOhms: 25, duty: 0 }],
          ['uno:GND', { volts: 0, resistanceOhms: 0.1 }],
          ['uno:GND2', { volts: 0, resistanceOhms: 0.1 }],
        ])
      ).ledCurrents.get('led1') ?? 0

    expect(full).toBeGreaterThan(0.01)
    expect(half).toBeCloseTo(full * 0.5, 6)
    expect(off).toBeLessThan(1e-6)
  })

  it('handles two LEDs in series', () => {
    const document = circuit()
    const two = circuitDocumentSchema.parse({
      ...document,
      parts: [
        ...document.parts,
        {
          id: 'led2',
          type: 'led',
          position: { x: 600, y: 0 },
          rotation: 0,
          props: { color: 'red' },
        },
      ],
      wires: [
        ...document.wires.filter((wire) => wire.id !== 'w3'),
        {
          id: 'w3',
          from: { partId: 'led1', pinId: 'cathode' },
          to: { partId: 'led2', pinId: 'anode' },
          color: '#4f9cf9',
          waypoints: [],
        },
        {
          id: 'w4',
          from: { partId: 'led2', pinId: 'cathode' },
          to: { partId: 'uno', pinId: 'GND' },
          color: '#4f9cf9',
          waypoints: [],
        },
      ],
    })
    const result = solveCircuit(
      two,
      buildNetlist(two),
      new Map([
        ['uno:5V', { volts: 5, resistanceOhms: 0.5 }],
        ['uno:GND', { volts: 0, resistanceOhms: 0.1 }],
        ['uno:GND2', { volts: 0, resistanceOhms: 0.1 }],
      ])
    )

    // (5 - 3.6) / (220 + 1.0 ohms of LED drops + 0.6 of sources)
    expect(result.ledCurrents.get('led1') ?? 0).toBeGreaterThan(0.006)
    expect(result.ledCurrents.get('led1') ?? 0).toBeLessThan(0.007)
    expect(result.ledCurrents.get('led2')).toBeCloseTo(result.ledCurrents.get('led1') ?? 0, 6)
  })
})
