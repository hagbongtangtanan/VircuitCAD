import { describe, expect, it } from 'vitest'
import { circuitDocumentSchema, type CircuitDocument } from '../../shared/circuit'
import { buildNetlist } from '../wiring/netlist'
import { solveCircuit, type PinDriver } from './solver'

const UNO = { id: 'uno', type: 'arduino-uno', position: { x: 0, y: 0 }, rotation: 0, props: {} }

function parse(document: {
  parts: readonly Record<string, unknown>[]
  wires: readonly { id: string; from: [string, string]; to: [string, string] }[]
}): CircuitDocument {
  return circuitDocumentSchema.parse({
    version: 1,
    parts: document.parts,
    wires: document.wires.map((wire) => ({
      id: wire.id,
      from: { partId: wire.from[0], pinId: wire.from[1] },
      to: { partId: wire.to[0], pinId: wire.to[1] },
      color: '#4f9cf9',
      waypoints: [],
    })),
  })
}

function drivers(volts: Record<string, number>): Map<string, PinDriver> {
  return new Map(
    Object.entries(volts).map(([pin, value]) => [
      `uno:${pin}`,
      { volts: value, resistanceOhms: 0.5 },
    ])
  )
}

function solve(document: CircuitDocument, pins: Record<string, number> = {}) {
  return solveCircuit(document, buildNetlist(document), drivers(pins))
}

describe('mechanical and passive parts', () => {
  it('only conducts through a slide switch when it is closed', () => {
    const document = parse({
      parts: [
        UNO,
        { id: 'sw', type: 'slide-switch', position: { x: 400, y: 0 }, rotation: 0, props: {} },
        {
          id: 'r1',
          type: 'resistor',
          position: { x: 500, y: 0 },
          rotation: 0,
          props: { resistanceOhms: 220 },
        },
        {
          id: 'led',
          type: 'led',
          position: { x: 600, y: 0 },
          rotation: 0,
          props: { color: 'red' },
        },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['sw', '1'] },
        { id: 'w2', from: ['sw', '2'], to: ['r1', 'lead1'] },
        { id: 'w3', from: ['r1', 'lead2'], to: ['led', 'anode'] },
        { id: 'w4', from: ['led', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const netlist = buildNetlist(document)
    const open = solveCircuit(document, netlist, drivers({ '5V': 5, GND: 0, GND2: 0 }))
    const closed = solveCircuit(document, netlist, drivers({ '5V': 5, GND: 0, GND2: 0 }), {
      switchStates: new Map([['sw', true]]),
    })

    expect(open.ledCurrents.get('led') ?? 0).toBeLessThan(0.0001)
    expect(closed.ledCurrents.get('led') ?? 0).toBeGreaterThan(0.012)
  })

  it('scales photoresistor current with the ambient light level', () => {
    const document = parse({
      parts: [
        UNO,
        { id: 'ldr', type: 'ldr', position: { x: 400, y: 0 }, rotation: 0, props: {} },
        {
          id: 'led',
          type: 'led',
          position: { x: 600, y: 0 },
          rotation: 0,
          props: { color: 'red' },
        },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['ldr', '1'] },
        { id: 'w2', from: ['ldr', '2'], to: ['led', 'anode'] },
        { id: 'w3', from: ['led', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const netlist = buildNetlist(document)
    const pins = drivers({ '5V': 5, GND: 0, GND2: 0 })
    const dark = solveCircuit(document, netlist, pins, {
      sensorLevels: new Map([['ldr', 0]]),
    })
    const bright = solveCircuit(document, netlist, pins, {
      sensorLevels: new Map([['ldr', 1]]),
    })

    const darkAmps = dark.ledCurrents.get('led') ?? 0
    const brightAmps = bright.ledCurrents.get('led') ?? 0
    expect(darkAmps).toBeGreaterThan(0)
    expect(brightAmps).toBeGreaterThan(darkAmps * 50)
  })

  it('blocks a reverse-biased diode but conducts forwards', () => {
    const build = (from: [string, string], to: [string, string]): CircuitDocument =>
      parse({
        parts: [
          UNO,
          {
            id: 'r1',
            type: 'resistor',
            position: { x: 400, y: 0 },
            rotation: 0,
            props: { resistanceOhms: 1_000 },
          },
          { id: 'd1', type: 'diode', position: { x: 500, y: 0 }, rotation: 0, props: {} },
        ],
        wires: [
          { id: 'w1', from: ['uno', '5V'], to: ['r1', 'lead1'] },
          { id: 'w2', from: ['r1', 'lead2'], to: from },
          { id: 'w3', from: to, to: ['uno', 'GND'] },
        ],
      })

    const forward = build(['d1', 'anode'], ['d1', 'cathode'])
    const reverse = build(['d1', 'cathode'], ['d1', 'anode'])
    const pins = drivers({ '5V': 5, GND: 0, GND2: 0 })

    const forwardResult = solveCircuit(forward, buildNetlist(forward), pins)
    const reverseResult = solveCircuit(reverse, buildNetlist(reverse), pins)
    const forwardMid = forwardResult.netVoltages.get(
      buildNetlist(forward).netIdOf({ partId: 'r1', pinId: 'lead2' }) ?? -1
    )
    const reverseMid = reverseResult.netVoltages.get(
      buildNetlist(reverse).netIdOf({ partId: 'r1', pinId: 'lead2' }) ?? -1
    )

    expect(forwardMid).toBeCloseTo(0.65, 1)
    expect(reverseMid).toBeGreaterThan(4.9)
  })
})

describe('multi-element and power parts', () => {
  it('reports RGB channels independently', () => {
    const document = parse({
      parts: [
        UNO,
        {
          id: 'r1',
          type: 'resistor',
          position: { x: 400, y: 0 },
          rotation: 0,
          props: { resistanceOhms: 220 },
        },
        { id: 'rgb', type: 'rgb-led', position: { x: 500, y: 0 }, rotation: 0, props: {} },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['r1', 'lead1'] },
        { id: 'w2', from: ['r1', 'lead2'], to: ['rgb', 'red'] },
        { id: 'w3', from: ['rgb', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const result = solve(document, { '5V': 5, GND: 0, GND2: 0 })

    expect(result.ledCurrents.get('rgb:red') ?? 0).toBeGreaterThan(0.012)
    expect(result.ledCurrents.get('rgb:green') ?? 0).toBe(0)
    expect(result.ledCurrents.get('rgb:blue') ?? 0).toBe(0)
  })

  it('lights individual seven-segment cathodes', () => {
    const document = parse({
      parts: [
        UNO,
        {
          id: 'r1',
          type: 'resistor',
          position: { x: 400, y: 0 },
          rotation: 0,
          props: { resistanceOhms: 330 },
        },
        {
          id: 'seg',
          type: 'seven-segment',
          position: { x: 500, y: 0 },
          rotation: 0,
          props: { color: 'red' },
        },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['r1', 'lead1'] },
        { id: 'w2', from: ['r1', 'lead2'], to: ['seg', 'a'] },
        { id: 'w3', from: ['seg', 'common'], to: ['uno', 'GND'] },
      ],
    })
    const result = solve(document, { '5V': 5, GND: 0, GND2: 0 })

    expect(result.ledCurrents.get('seg:a') ?? 0).toBeGreaterThan(0.005)
    expect(result.ledCurrents.get('seg:b') ?? 0).toBe(0)
  })

  it('runs a motor from a battery without the Uno', () => {
    const document = parse({
      parts: [
        {
          id: 'bat',
          type: 'battery-9v',
          position: { x: 0, y: 0 },
          rotation: 0,
          props: {},
        },
        { id: 'motor', type: 'dc-motor', position: { x: 300, y: 0 }, rotation: 0, props: {} },
      ],
      wires: [
        { id: 'w1', from: ['bat', 'plus'], to: ['motor', 'plus'] },
        { id: 'w2', from: ['motor', 'minus'], to: ['bat', 'minus'] },
      ],
    })
    const result = solveCircuit(document, buildNetlist(document), new Map())

    expect(result.motorCurrents.get('motor') ?? 0).toBeGreaterThan(0.4)
  })
})
