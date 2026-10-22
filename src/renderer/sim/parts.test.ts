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

  it('drives every RGB channel when all three anodes are powered', () => {
    const document = parse({
      parts: [
        UNO,
        ...['red', 'green', 'blue'].map((channel, index) => ({
          id: `r${channel}`,
          type: 'resistor',
          position: { x: 400, y: index * 60 },
          rotation: 0,
          props: { resistanceOhms: 220 },
        })),
        { id: 'rgb', type: 'rgb-led', position: { x: 500, y: 0 }, rotation: 0, props: {} },
      ],
      wires: [
        ...['red', 'green', 'blue'].flatMap((channel, index) => [
          {
            id: `w${index}a`,
            from: ['uno', '5V'] as [string, string],
            to: [`r${channel}`, 'lead1'] as [string, string],
          },
          {
            id: `w${index}b`,
            from: [`r${channel}`, 'lead2'] as [string, string],
            to: ['rgb', channel] as [string, string],
          },
        ]),
        { id: 'wc', from: ['rgb', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const result = solve(document, { '5V': 5, GND: 0, GND2: 0 })

    expect(result.ledCurrents.get('rgb:red') ?? 0).toBeGreaterThan(0.012)
    expect(result.ledCurrents.get('rgb:green') ?? 0).toBeGreaterThan(0.012)
    expect(result.ledCurrents.get('rgb:blue') ?? 0).toBeGreaterThan(0.006)
  })

  it('lights all RGB channels when their anodes share the 5V rail', () => {
    const document = parse({
      parts: [
        UNO,
        { id: 'rgb', type: 'rgb-led', position: { x: 500, y: 0 }, rotation: 0, props: {} },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['rgb', 'red'] },
        { id: 'w2', from: ['uno', '5V'], to: ['rgb', 'green'] },
        { id: 'w3', from: ['uno', '5V'], to: ['rgb', 'blue'] },
        { id: 'w4', from: ['rgb', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const result = solve(document, { '5V': 5, GND: 0, GND2: 0 })

    expect(result.ledCurrents.get('rgb:red') ?? 0).toBeGreaterThan(0.001)
    expect(result.ledCurrents.get('rgb:green') ?? 0).toBeGreaterThan(0.001)
    expect(result.ledCurrents.get('rgb:blue') ?? 0).toBeGreaterThan(0.001)
  })

  it('drives red and blue RGB channels together for mixed colours', () => {
    const document = parse({
      parts: [
        UNO,
        {
          id: 'rRed',
          type: 'resistor',
          position: { x: 400, y: 0 },
          rotation: 0,
          props: { resistanceOhms: 220 },
        },
        {
          id: 'rBlue',
          type: 'resistor',
          position: { x: 400, y: 60 },
          rotation: 0,
          props: { resistanceOhms: 220 },
        },
        { id: 'rgb', type: 'rgb-led', position: { x: 500, y: 0 }, rotation: 0, props: {} },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['rRed', 'lead1'] },
        { id: 'w2', from: ['rRed', 'lead2'], to: ['rgb', 'red'] },
        { id: 'w3', from: ['uno', '5V'], to: ['rBlue', 'lead1'] },
        { id: 'w4', from: ['rBlue', 'lead2'], to: ['rgb', 'blue'] },
        { id: 'w5', from: ['rgb', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const result = solve(document, { '5V': 5, GND: 0, GND2: 0 })

    expect(result.ledCurrents.get('rgb:red') ?? 0).toBeGreaterThan(0.012)
    expect(result.ledCurrents.get('rgb:blue') ?? 0).toBeGreaterThan(0.006)
    expect(result.ledCurrents.get('rgb:green') ?? 0).toBe(0)
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

describe('input and power parts', () => {
  it('splits the potentiometer at the wiper', () => {
    const document = parse({
      parts: [
        UNO,
        {
          id: 'pot',
          type: 'potentiometer',
          position: { x: 400, y: 0 },
          rotation: 0,
          props: { resistanceOhms: 10_000 },
        },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['pot', '3'] },
        { id: 'w2', from: ['pot', '1'], to: ['uno', 'GND'] },
      ],
    })
    const netlist = buildNetlist(document)
    const pins = drivers({ '5V': 5, GND: 0, GND2: 0 })
    const wiperNet = netlist.netIdOf({ partId: 'pot', pinId: '2' }) ?? -1

    const at = (position: number): number =>
      solveCircuit(document, netlist, pins, {
        potPositions: new Map([['pot', position]]),
      }).netVoltages.get(wiperNet) ?? 0

    expect(at(0)).toBeLessThan(0.05)
    expect(at(0.25)).toBeCloseTo(1.25, 1)
    expect(at(0.5)).toBeCloseTo(2.5, 1)
    expect(at(0.75)).toBeCloseTo(3.75, 1)
    expect(at(1)).toBeGreaterThan(4.95)
  })

  it('conducts through a push button only while it is held', () => {
    const document = parse({
      parts: [
        UNO,
        { id: 'btn', type: 'push-button', position: { x: 400, y: 0 }, rotation: 0, props: {} },
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
        { id: 'w1', from: ['uno', '5V'], to: ['btn', '1'] },
        { id: 'w2', from: ['btn', '2'], to: ['r1', 'lead1'] },
        { id: 'w3', from: ['r1', 'lead2'], to: ['led', 'anode'] },
        { id: 'w4', from: ['led', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const netlist = buildNetlist(document)
    const pins = drivers({ '5V': 5, GND: 0, GND2: 0 })
    const open = solveCircuit(document, netlist, pins)
    const held = solveCircuit(document, netlist, pins, {
      pressedParts: new Set(['btn']),
    })

    expect(open.ledCurrents.get('led') ?? 0).toBeLessThan(0.0001)
    expect(held.ledCurrents.get('led') ?? 0).toBeGreaterThan(0.012)
  })

  it('treats a capacitor as an open circuit and an inductor as a wire', () => {
    const build = (type: 'capacitor' | 'inductor'): CircuitDocument =>
      parse({
        parts: [
          UNO,
          {
            id: 'x1',
            type,
            position: { x: 400, y: 0 },
            rotation: 0,
            props:
              type === 'capacitor'
                ? { capacitanceMicroFarads: 100 }
                : { inductanceMilliHenries: 10 },
          },
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
          { id: 'w1', from: ['uno', '5V'], to: ['x1', '1'] },
          { id: 'w2', from: ['x1', '2'], to: ['r1', 'lead1'] },
          { id: 'w3', from: ['r1', 'lead2'], to: ['led', 'anode'] },
          { id: 'w4', from: ['led', 'cathode'], to: ['uno', 'GND'] },
        ],
      })
    const pins = drivers({ '5V': 5, GND: 0, GND2: 0 })
    const cap = build('capacitor')
    const coil = build('inductor')

    expect(solveCircuit(cap, buildNetlist(cap), pins).ledCurrents.get('led') ?? 0).toBeLessThan(
      1e-6
    )
    expect(
      solveCircuit(coil, buildNetlist(coil), pins).ledCurrents.get('led') ?? 0
    ).toBeGreaterThan(0.012)
  })

  it('draws current through a buzzer and an AA battery motor', () => {
    const buzzerDoc = parse({
      parts: [
        UNO,
        { id: 'bz', type: 'buzzer', position: { x: 400, y: 0 }, rotation: 0, props: {} },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['bz', 'plus'] },
        { id: 'w2', from: ['bz', 'minus'], to: ['uno', 'GND'] },
      ],
    })
    const buzzer = solveCircuit(
      buzzerDoc,
      buildNetlist(buzzerDoc),
      drivers({ '5V': 5, GND: 0, GND2: 0 })
    )
    expect(buzzer.buzzerCurrents.get('bz') ?? 0).toBeCloseTo(0.05, 2)

    const motorDoc = parse({
      parts: [
        { id: 'bat', type: 'battery-aa', position: { x: 0, y: 0 }, rotation: 0, props: {} },
        { id: 'motor', type: 'dc-motor', position: { x: 300, y: 0 }, rotation: 0, props: {} },
      ],
      wires: [
        { id: 'w1', from: ['bat', 'plus'], to: ['motor', 'plus'] },
        { id: 'w2', from: ['motor', 'minus'], to: ['bat', 'minus'] },
      ],
    })
    const motor = solveCircuit(motorDoc, buildNetlist(motorDoc), new Map())
    expect(motor.motorCurrents.get('motor') ?? 0).toBeGreaterThan(0.06)
    expect(motor.motorCurrents.get('motor') ?? 0).toBeLessThan(0.08)
  })
})

describe('expanded component library', () => {
  const pins = (): Map<string, PinDriver> => drivers({ '5V': 5, GND: 0, GND2: 0 })

  it('clamps a reverse-biased zener near its breakdown voltage', () => {
    const document = parse({
      parts: [
        { id: 'bat', type: 'battery-9v', position: { x: 0, y: 0 }, rotation: 0, props: {} },
        {
          id: 'r1',
          type: 'resistor',
          position: { x: 200, y: 0 },
          rotation: 0,
          props: { resistanceOhms: 1_000 },
        },
        {
          id: 'z1',
          type: 'zener-diode',
          position: { x: 400, y: 0 },
          rotation: 0,
          props: { zenerVoltage: 5.1 },
        },
      ],
      wires: [
        { id: 'w1', from: ['bat', 'plus'], to: ['r1', 'lead1'] },
        { id: 'w2', from: ['r1', 'lead2'], to: ['z1', 'cathode'] },
        { id: 'w3', from: ['z1', 'anode'], to: ['bat', 'minus'] },
      ],
    })
    const netlist = buildNetlist(document)
    const result = solveCircuit(document, netlist, new Map())
    const cathode = netlist.netIdOf({ partId: 'z1', pinId: 'cathode' }) ?? -1
    const anode = netlist.netIdOf({ partId: 'z1', pinId: 'anode' }) ?? -1

    expect(
      (result.netVoltages.get(cathode) ?? 0) - (result.netVoltages.get(anode) ?? 0)
    ).toBeCloseTo(5.1, 0)
  })

  it('drives a light bulb and reports its current', () => {
    const document = parse({
      parts: [
        UNO,
        {
          id: 'bulb',
          type: 'light-bulb',
          position: { x: 400, y: 0 },
          rotation: 0,
          props: { ratedVolts: 5, resistanceOhms: 100 },
        },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['bulb', '1'] },
        { id: 'w2', from: ['bulb', '2'], to: ['uno', 'GND'] },
      ],
    })

    expect(solve(document, { '5V': 5, GND: 0 }).ledCurrents.get('bulb') ?? 0).toBeCloseTo(0.05, 2)
  })

  it('models a TMP36 output as 10 mV per degree Celsius', () => {
    const document = parse({
      parts: [
        { id: 'bat', type: 'battery-9v', position: { x: 0, y: 0 }, rotation: 0, props: {} },
        {
          id: 'temp',
          type: 'tmp36',
          position: { x: 300, y: 0 },
          rotation: 0,
          props: {},
        },
      ],
      wires: [
        { id: 'w1', from: ['bat', 'plus'], to: ['temp', 'vcc'] },
        { id: 'w2', from: ['temp', 'gnd'], to: ['bat', 'minus'] },
      ],
    })
    const netlist = buildNetlist(document)
    const level = 65 / 165
    const result = solveCircuit(document, netlist, new Map(), {
      sensorLevels: new Map([['temp', level]]),
    })
    const out = netlist.netIdOf({ partId: 'temp', pinId: 'vout' }) ?? -1
    const ground = netlist.netIdOf({ partId: 'temp', pinId: 'gnd' }) ?? -1

    expect((result.netVoltages.get(out) ?? 0) - (result.netVoltages.get(ground) ?? 0)).toBeCloseTo(
      0.75,
      2
    )
  })

  it('closes only the selected DIP switch contacts', () => {
    const document = parse({
      parts: [
        UNO,
        {
          id: 'dip',
          type: 'dip-switch-4',
          position: { x: 300, y: 0 },
          rotation: 0,
          props: {},
        },
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
        { id: 'w1', from: ['uno', '5V'], to: ['dip', 'top1'] },
        { id: 'w2', from: ['dip', 'bottom1'], to: ['r1', 'lead1'] },
        { id: 'w3', from: ['r1', 'lead2'], to: ['led', 'anode'] },
        { id: 'w4', from: ['led', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const netlist = buildNetlist(document)
    const open = solveCircuit(document, netlist, pins())
    const closed = solveCircuit(document, netlist, pins(), {
      dipBits: new Map([['dip', [true, false, false, false]]]),
    })

    expect(open.ledCurrents.get('led') ?? 0).toBeLessThan(1e-6)
    expect(closed.ledCurrents.get('led') ?? 0).toBeGreaterThan(0.01)
  })

  it('regulates 9 V down to 5 V and 3.3 V', () => {
    const build = (type: 'lm7805' | 'ld1117v33'): CircuitDocument =>
      parse({
        parts: [
          { id: 'bat', type: 'battery-9v', position: { x: 0, y: 0 }, rotation: 0, props: {} },
          { id: 'reg', type, position: { x: 300, y: 0 }, rotation: 0, props: {} },
        ],
        wires: [
          { id: 'w1', from: ['bat', 'plus'], to: ['reg', 'in'] },
          { id: 'w2', from: ['reg', 'gnd'], to: ['bat', 'minus'] },
        ],
      })
    for (const [type, expected] of [
      ['lm7805', 5],
      ['ld1117v33', 3.3],
    ] as const) {
      const document = build(type)
      const netlist = buildNetlist(document)
      const result = solveCircuit(document, netlist, new Map())
      const out = netlist.netIdOf({ partId: 'reg', pinId: 'out' }) ?? -1
      const ground = netlist.netIdOf({ partId: 'reg', pinId: 'gnd' }) ?? -1
      expect(
        (result.netVoltages.get(out) ?? 0) - (result.netVoltages.get(ground) ?? 0)
      ).toBeCloseTo(expected, 1)
    }
  })

  it('powers a motor from a coin cell and a gear motor from 5 V', () => {
    const coin = parse({
      parts: [
        { id: 'bat', type: 'coin-cell', position: { x: 0, y: 0 }, rotation: 0, props: {} },
        {
          id: 'motor',
          type: 'vibration-motor',
          position: { x: 300, y: 0 },
          rotation: 0,
          props: {},
        },
      ],
      wires: [
        { id: 'w1', from: ['bat', 'plus'], to: ['motor', 'plus'] },
        { id: 'w2', from: ['motor', 'minus'], to: ['bat', 'minus'] },
      ],
    })
    const coinResult = solveCircuit(coin, buildNetlist(coin), new Map())
    expect(coinResult.motorCurrents.get('motor') ?? 0).toBeGreaterThan(0.05)

    const gear = parse({
      parts: [
        UNO,
        { id: 'motor', type: 'gear-motor', position: { x: 300, y: 0 }, rotation: 0, props: {} },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['motor', 'plus'] },
        { id: 'w2', from: ['motor', 'minus'], to: ['uno', 'GND'] },
      ],
    })
    expect(solve(gear, { '5V': 5, GND: 0 }).motorCurrents.get('motor') ?? 0).toBeGreaterThan(0.07)
  })

  it('maps soil moisture and solar light levels to analog voltages', () => {
    const soil = parse({
      parts: [
        { id: 'bat', type: 'battery-9v', position: { x: 0, y: 0 }, rotation: 0, props: {} },
        {
          id: 'soil',
          type: 'soil-moisture',
          position: { x: 300, y: 0 },
          rotation: 0,
          props: {},
        },
      ],
      wires: [
        { id: 'w1', from: ['bat', 'plus'], to: ['soil', 'vcc'] },
        { id: 'w2', from: ['soil', 'gnd'], to: ['bat', 'minus'] },
      ],
    })
    const soilNetlist = buildNetlist(soil)
    const soilAt = (level: number): number => {
      const result = solveCircuit(soil, soilNetlist, new Map(), {
        sensorLevels: new Map([['soil', level]]),
      })
      const sig = soilNetlist.netIdOf({ partId: 'soil', pinId: 'sig' }) ?? -1
      const gnd = soilNetlist.netIdOf({ partId: 'soil', pinId: 'gnd' }) ?? -1
      return (result.netVoltages.get(sig) ?? 0) - (result.netVoltages.get(gnd) ?? 0)
    }
    expect(soilAt(0)).toBeCloseTo(0, 1)
    expect(soilAt(1)).toBeCloseTo(5, 1)

    const solar = parse({
      parts: [
        {
          id: 'cell',
          type: 'solar-cell',
          position: { x: 0, y: 0 },
          rotation: 0,
          props: {},
        },
      ],
      wires: [],
    })
    const solarNetlist = buildNetlist(solar)
    const solarAt = (level: number): number => {
      const result = solveCircuit(solar, solarNetlist, new Map(), {
        sensorLevels: new Map([['cell', level]]),
      })
      const plus = solarNetlist.netIdOf({ partId: 'cell', pinId: 'plus' }) ?? -1
      const minus = solarNetlist.netIdOf({ partId: 'cell', pinId: 'minus' }) ?? -1
      return (result.netVoltages.get(plus) ?? 0) - (result.netVoltages.get(minus) ?? 0)
    }
    expect(solarAt(1)).toBeCloseTo(0.6, 2)
  })

  it('makes a tilt sensor conduct past its threshold', () => {
    const document = parse({
      parts: [
        UNO,
        {
          id: 'tilt',
          type: 'tilt-sensor',
          position: { x: 300, y: 0 },
          rotation: 0,
          props: {},
        },
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
        { id: 'w1', from: ['uno', '5V'], to: ['tilt', '1'] },
        { id: 'w2', from: ['tilt', '2'], to: ['r1', 'lead1'] },
        { id: 'w3', from: ['r1', 'lead2'], to: ['led', 'anode'] },
        { id: 'w4', from: ['led', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const netlist = buildNetlist(document)
    const upright = solveCircuit(document, netlist, pins(), {
      sensorLevels: new Map([['tilt', 0.2]]),
    })
    const tilted = solveCircuit(document, netlist, pins(), {
      sensorLevels: new Map([['tilt', 0.8]]),
    })

    expect(upright.ledCurrents.get('led') ?? 0).toBeLessThan(1e-6)
    expect(tilted.ledCurrents.get('led') ?? 0).toBeGreaterThan(0.01)
  })
})

describe('module and instrument models', () => {
  const pinDrivers = (): Map<string, PinDriver> => drivers({ '5V': 5, GND: 0, GND2: 0 })

  it('drives PIR and ultrasonic outputs from their UI levels', () => {
    const pir = parse({
      parts: [{ id: 'pir', type: 'pir-sensor', position: { x: 0, y: 0 }, rotation: 0, props: {} }],
      wires: [],
    })
    const pirNetlist = buildNetlist(pir)
    const pirResult = solveCircuit(pir, pirNetlist, new Map(), {
      sensorLevels: new Map([['pir', 1]]),
    })
    const out = pirNetlist.netIdOf({ partId: 'pir', pinId: 'out' }) ?? -1
    const ground = pirNetlist.netIdOf({ partId: 'pir', pinId: 'gnd' }) ?? -1
    expect(
      (pirResult.netVoltages.get(out) ?? 0) - (pirResult.netVoltages.get(ground) ?? 0)
    ).toBeCloseTo(5, 1)

    const ultrasonic = parse({
      parts: [
        { id: 'us', type: 'ultrasonic-3pin', position: { x: 0, y: 0 }, rotation: 0, props: {} },
      ],
      wires: [],
    })
    const usNetlist = buildNetlist(ultrasonic)
    const usResult = solveCircuit(ultrasonic, usNetlist, new Map(), {
      sensorLevels: new Map([['us', 0.4]]),
    })
    const sig = usNetlist.netIdOf({ partId: 'us', pinId: 'sig' }) ?? -1
    const usGround = usNetlist.netIdOf({ partId: 'us', pinId: 'gnd' }) ?? -1
    expect(
      (usResult.netVoltages.get(sig) ?? 0) - (usResult.netVoltages.get(usGround) ?? 0)
    ).toBeCloseTo(2, 1)
  })

  it('applies the function generator DC offset', () => {
    const document = parse({
      parts: [
        {
          id: 'fg',
          type: 'function-generator',
          position: { x: 0, y: 0 },
          rotation: 0,
          props: { waveform: 'sine', frequencyHz: 1000, amplitudeVolts: 5, offsetVolts: 2.5 },
        },
      ],
      wires: [],
    })
    const netlist = buildNetlist(document)
    const result = solveCircuit(document, netlist, new Map())
    const plus = netlist.netIdOf({ partId: 'fg', pinId: 'plus' }) ?? -1
    const minus = netlist.netIdOf({ partId: 'fg', pinId: 'minus' }) ?? -1
    expect((result.netVoltages.get(plus) ?? 0) - (result.netVoltages.get(minus) ?? 0)).toBeCloseTo(
      2.5,
      1
    )
  })

  it('switches a transistor and an SPDT relay', () => {
    const transistor = parse({
      parts: [
        UNO,
        { id: 'q1', type: 'transistor-npn', position: { x: 300, y: 0 }, rotation: 0, props: {} },
        {
          id: 'led',
          type: 'led',
          position: { x: 500, y: 0 },
          rotation: 0,
          props: { color: 'red' },
        },
      ],
      wires: [
        { id: 'w1', from: ['uno', 'D2'], to: ['q1', 'base'] },
        { id: 'w2', from: ['uno', '5V'], to: ['led', 'anode'] },
        { id: 'w3', from: ['led', 'cathode'], to: ['q1', 'collector'] },
        { id: 'w4', from: ['q1', 'emitter'], to: ['uno', 'GND'] },
      ],
    })
    const transistorNetlist = buildNetlist(transistor)
    const baseOn = solveCircuit(
      transistor,
      transistorNetlist,
      drivers({ D2: 5, '5V': 5, GND: 0, GND2: 0 })
    )
    const baseOff = solveCircuit(
      transistor,
      transistorNetlist,
      drivers({ D2: 0, '5V': 5, GND: 0, GND2: 0 })
    )
    expect(baseOn.ledCurrents.get('led') ?? 0).toBeGreaterThan(0.01)
    expect(baseOff.ledCurrents.get('led') ?? 0).toBeLessThan(1e-5)

    const relay = parse({
      parts: [
        UNO,
        { id: 'k1', type: 'relay-spdt', position: { x: 300, y: 0 }, rotation: 0, props: {} },
        {
          id: 'led',
          type: 'led',
          position: { x: 500, y: 0 },
          rotation: 0,
          props: { color: 'red' },
        },
      ],
      wires: [
        { id: 'w1', from: ['uno', 'D2'], to: ['k1', 'coil1'] },
        { id: 'w2', from: ['k1', 'coil2'], to: ['uno', 'GND'] },
        { id: 'w3', from: ['uno', '5V'], to: ['k1', 'com'] },
        { id: 'w4', from: ['k1', 'no'], to: ['led', 'anode'] },
        { id: 'w5', from: ['led', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const relayNetlist = buildNetlist(relay)
    const coilOn = solveCircuit(relay, relayNetlist, drivers({ D2: 5, '5V': 5, GND: 0, GND2: 0 }))
    const coilOff = solveCircuit(relay, relayNetlist, drivers({ D2: 0, '5V': 5, GND: 0, GND2: 0 }))
    expect(coilOn.ledCurrents.get('led') ?? 0).toBeGreaterThan(0.01)
    expect(coilOff.ledCurrents.get('led') ?? 0).toBeLessThan(1e-5)
  })

  it('evaluates a 74HC00 NAND gate', () => {
    const build = (): CircuitDocument =>
      parse({
        parts: [
          UNO,
          { id: 'u1', type: '74hc00', position: { x: 300, y: 0 }, rotation: 0, props: {} },
          {
            id: 'led',
            type: 'led',
            position: { x: 500, y: 0 },
            rotation: 0,
            props: { color: 'red' },
          },
        ],
        wires: [
          { id: 'w0a', from: ['uno', 'D2'], to: ['u1', '1'] },
          { id: 'w0b', from: ['uno', 'D3'], to: ['u1', '2'] },
          { id: 'w1', from: ['uno', 'GND'], to: ['u1', '7'] },
          { id: 'w2', from: ['u1', '3'], to: ['led', 'anode'] },
          { id: 'w3', from: ['led', 'cathode'], to: ['uno', 'GND'] },
        ],
      })
    const document = build()
    const lit = solveCircuit(
      document,
      buildNetlist(document),
      drivers({ D2: 5, D3: 0, GND: 0, GND2: 0 })
    )
    const offDocument = build()
    const off = solveCircuit(
      offDocument,
      buildNetlist(offDocument),
      drivers({ D2: 5, D3: 5, GND: 0, GND2: 0 })
    )

    expect(lit.ledCurrents.get('led') ?? 0).toBeGreaterThan(0.005)
    expect(off.ledCurrents.get('led') ?? 0).toBeLessThan(1e-6)
  })

  it('shorts the selected keypad row and column', () => {
    const document = parse({
      parts: [
        UNO,
        { id: 'kp', type: 'keypad-4x4', position: { x: 300, y: 0 }, rotation: 0, props: {} },
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
        { id: 'w1', from: ['uno', '5V'], to: ['kp', 'r1'] },
        { id: 'w2', from: ['kp', 'c1'], to: ['r1', 'lead1'] },
        { id: 'w3', from: ['r1', 'lead2'], to: ['led', 'anode'] },
        { id: 'w4', from: ['led', 'cathode'], to: ['uno', 'GND'] },
      ],
    })
    const netlist = buildNetlist(document)
    const open = solveCircuit(document, netlist, pinDrivers())
    const pressed = solveCircuit(document, netlist, pinDrivers(), {
      keypadKeys: new Map([['kp', 0]]),
    })

    expect(open.ledCurrents.get('led') ?? 0).toBeLessThan(1e-6)
    expect(pressed.ledCurrents.get('led') ?? 0).toBeGreaterThan(0.005)
  })

  it('drives an encoder motor as a normal DC load', () => {
    const document = parse({
      parts: [
        UNO,
        {
          id: 'motor',
          type: 'encoder-motor',
          position: { x: 300, y: 0 },
          rotation: 0,
          props: {},
        },
      ],
      wires: [
        { id: 'w1', from: ['uno', '5V'], to: ['motor', 'plus'] },
        { id: 'w2', from: ['motor', 'minus'], to: ['uno', 'GND'] },
      ],
    })
    const result = solveCircuit(document, buildNetlist(document), pinDrivers())
    expect(result.motorCurrents.get('motor') ?? 0).toBeGreaterThan(0.2)
  })
})
