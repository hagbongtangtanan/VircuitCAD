import { describe, expect, it } from 'vitest'
import type { CircuitDocument, PartInstance, PinRef, Wire } from '../../shared/circuit'
import { buildNetlist } from './netlist'

function part(instance: PartInstance): PartInstance {
  return instance
}

function wire(id: string, from: PinRef, to: PinRef): Wire {
  return { id, from, to, color: '#4f9cf9', waypoints: [] }
}

const breadboard = part({
  id: 'bb',
  type: 'breadboard',
  position: { x: 0, y: 0 },
  rotation: 0,
  props: {},
})

const led = part({
  id: 'led1',
  type: 'led',
  position: { x: 100, y: 300 },
  rotation: 0,
  props: { color: 'red' },
})

const resistor = part({
  id: 'r1',
  type: 'resistor',
  position: { x: 200, y: 300 },
  rotation: 0,
  props: { resistanceOhms: 220 },
})

function documentWith(parts: readonly PartInstance[], wires: readonly Wire[]): CircuitDocument {
  return { version: 1, parts: [...parts], wires: [...wires] }
}

describe('buildNetlist', () => {
  it('puts two parts joined through a breadboard column strip in the same net', () => {
    const document = documentWith(
      [breadboard, led, resistor],
      [
        wire('w1', { partId: 'led1', pinId: 'anode' }, { partId: 'bb', pinId: 'a1' }),
        wire('w2', { partId: 'r1', pinId: 'lead1' }, { partId: 'bb', pinId: 'c1' }),
      ]
    )

    const netlist = buildNetlist(document)

    expect(
      netlist.areConnected({ partId: 'led1', pinId: 'anode' }, { partId: 'r1', pinId: 'lead1' })
    ).toBe(true)
  })

  it('treats the five holes of a top column as one net and keeps the bottom half separate', () => {
    const document = documentWith(
      [breadboard, led, resistor],
      [
        wire('w1', { partId: 'led1', pinId: 'anode' }, { partId: 'bb', pinId: 'a1' }),
        wire('w2', { partId: 'r1', pinId: 'lead1' }, { partId: 'bb', pinId: 'e1' }),
        wire('w3', { partId: 'r1', pinId: 'lead2' }, { partId: 'bb', pinId: 'f1' }),
      ]
    )

    const netlist = buildNetlist(document)

    expect(
      netlist.areConnected({ partId: 'led1', pinId: 'anode' }, { partId: 'r1', pinId: 'lead1' })
    ).toBe(true)
    expect(
      netlist.areConnected({ partId: 'led1', pinId: 'anode' }, { partId: 'r1', pinId: 'lead2' })
    ).toBe(false)
  })

  it('shares one net across every hole of a power rail', () => {
    const document = documentWith(
      [breadboard, led, resistor],
      [
        wire('w1', { partId: 'led1', pinId: 'anode' }, { partId: 'bb', pinId: 'top-plus-1' }),
        wire('w2', { partId: 'r1', pinId: 'lead1' }, { partId: 'bb', pinId: 'top-plus-25' }),
      ]
    )

    expect(
      buildNetlist(document).areConnected(
        { partId: 'led1', pinId: 'anode' },
        { partId: 'r1', pinId: 'lead1' }
      )
    ).toBe(true)
  })

  it('keeps adjacent columns apart', () => {
    const document = documentWith(
      [breadboard, led, resistor],
      [
        wire('w1', { partId: 'led1', pinId: 'anode' }, { partId: 'bb', pinId: 'a1' }),
        wire('w2', { partId: 'r1', pinId: 'lead1' }, { partId: 'bb', pinId: 'a2' }),
      ]
    )

    expect(
      buildNetlist(document).areConnected(
        { partId: 'led1', pinId: 'anode' },
        { partId: 'r1', pinId: 'lead1' }
      )
    ).toBe(false)
  })

  it('joins two pins that are wired together directly', () => {
    const secondLed = part({
      id: 'led2',
      type: 'led',
      position: { x: 400, y: 300 },
      rotation: 0,
      props: { color: 'blue' },
    })

    const document = documentWith(
      [led, secondLed],
      [wire('w1', { partId: 'led1', pinId: 'cathode' }, { partId: 'led2', pinId: 'cathode' })]
    )

    expect(
      buildNetlist(document).areConnected(
        { partId: 'led1', pinId: 'cathode' },
        { partId: 'led2', pinId: 'cathode' }
      )
    ).toBe(true)
  })

  it('unions nets transitively across several wires', () => {
    const secondLed = part({
      id: 'led2',
      type: 'led',
      position: { x: 400, y: 300 },
      rotation: 0,
      props: { color: 'green' },
    })

    const document = documentWith(
      [led, secondLed, resistor],
      [
        wire('w1', { partId: 'led1', pinId: 'anode' }, { partId: 'led2', pinId: 'anode' }),
        wire('w2', { partId: 'led2', pinId: 'anode' }, { partId: 'r1', pinId: 'lead1' }),
      ]
    )

    expect(
      buildNetlist(document).areConnected(
        { partId: 'led1', pinId: 'anode' },
        { partId: 'r1', pinId: 'lead1' }
      )
    ).toBe(true)
  })

  it('does not connect two pins through a part that does not link them internally', () => {
    const secondLed = part({
      id: 'led2',
      type: 'led',
      position: { x: 400, y: 300 },
      rotation: 0,
      props: { color: 'green' },
    })

    const document = documentWith(
      [led, secondLed, resistor],
      [
        wire('w1', { partId: 'led1', pinId: 'anode' }, { partId: 'led2', pinId: 'anode' }),
        wire('w2', { partId: 'led2', pinId: 'cathode' }, { partId: 'r1', pinId: 'lead1' }),
      ]
    )

    expect(
      buildNetlist(document).areConnected(
        { partId: 'led1', pinId: 'anode' },
        { partId: 'r1', pinId: 'lead1' }
      )
    ).toBe(false)
  })

  it('leaves untouched pins in their own singleton nets', () => {
    const document = documentWith([breadboard, led], [])
    const netlist = buildNetlist(document)

    expect(
      netlist.areConnected({ partId: 'led1', pinId: 'anode' }, { partId: 'led1', pinId: 'cathode' })
    ).toBe(false)
    expect(netlist.netIdOf({ partId: 'led1', pinId: 'anode' })).not.toBe(
      netlist.netIdOf({ partId: 'led1', pinId: 'cathode' })
    )
  })

  it('reports undefined for pins that do not exist', () => {
    const netlist = buildNetlist(documentWith([led], []))
    expect(netlist.netIdOf({ partId: 'led1', pinId: 'nope' })).toBeUndefined()
    expect(
      netlist.areConnected({ partId: 'ghost', pinId: 'x' }, { partId: 'led1', pinId: 'anode' })
    ).toBe(false)
  })

  it('ignores wires pointing at missing parts', () => {
    const document = documentWith(
      [led, resistor],
      [wire('w1', { partId: 'led1', pinId: 'anode' }, { partId: 'ghost', pinId: 'x' })]
    )

    const netlist = buildNetlist(document)
    expect(
      netlist.areConnected({ partId: 'led1', pinId: 'anode' }, { partId: 'ghost', pinId: 'x' })
    ).toBe(false)
  })

  it('counts one net per pin when nothing is connected', () => {
    const document = documentWith([led], [])
    const netlist = buildNetlist(document)
    expect(netlist.netCount).toBe(2)
    expect(netlist.pinsByNet.size).toBe(2)
  })
})
