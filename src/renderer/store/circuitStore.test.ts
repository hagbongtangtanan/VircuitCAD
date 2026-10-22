import { beforeEach, describe, expect, it } from 'vitest'
import { circuitDocumentSchema, type CircuitDocument } from '../../shared/circuit'
import { DEFAULT_WIRE_COLOR, useCircuitStore } from './circuitStore'

function document(): CircuitDocument {
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
      { id: 'led', type: 'led', position: { x: 500, y: 0 }, rotation: 0, props: { color: 'red' } },
    ],
    wires: [],
  })
}

beforeEach(() => {
  useCircuitStore.getState().replaceDocument(document())
})

describe('addWire', () => {
  it('keeps manual bends and refuses duplicate connections', () => {
    const store = useCircuitStore.getState()
    const id = store.addWire({ partId: 'uno', pinId: 'D13' }, { partId: 'r1', pinId: 'lead1' }, [
      { x: 300, y: 40 },
    ])
    expect(id).not.toBeNull()
    expect(useCircuitStore.getState().document.wires[0]?.waypoints).toEqual([{ x: 300, y: 40 }])

    expect(
      useCircuitStore
        .getState()
        .addWire({ partId: 'r1', pinId: 'lead1' }, { partId: 'uno', pinId: 'D13' })
    ).toBeNull()
    expect(useCircuitStore.getState().document.wires).toHaveLength(1)
  })

  it('gives every terminal at most one wire', () => {
    const store = useCircuitStore.getState()
    expect(
      store.addWire({ partId: 'uno', pinId: 'D13' }, { partId: 'r1', pinId: 'lead1' })
    ).not.toBeNull()
    expect(
      useCircuitStore
        .getState()
        .addWire({ partId: 'uno', pinId: 'D13' }, { partId: 'led', pinId: 'anode' })
    ).toBeNull()
    expect(
      useCircuitStore
        .getState()
        .addWire({ partId: 'uno', pinId: '5V' }, { partId: 'r1', pinId: 'lead1' })
    ).toBeNull()
    expect(useCircuitStore.getState().document.wires).toHaveLength(1)

    expect(
      useCircuitStore
        .getState()
        .addWire({ partId: 'uno', pinId: '5V' }, { partId: 'r1', pinId: 'lead2' })
    ).not.toBeNull()
  })

  it('colours power and ground leads conventionally', () => {
    const store = useCircuitStore.getState()
    store.addWire({ partId: 'uno', pinId: '5V' }, { partId: 'r1', pinId: 'lead1' })
    store.addWire({ partId: 'r1', pinId: 'lead2' }, { partId: 'led', pinId: 'anode' })
    store.addWire({ partId: 'led', pinId: 'cathode' }, { partId: 'uno', pinId: 'GND' })

    const wires = useCircuitStore.getState().document.wires
    expect(wires.find((wire) => wire.from.pinId === '5V')?.color).toBe('#ffc928')
    expect(wires.find((wire) => wire.to.pinId === 'GND')?.color).toBe('#2f7df6')
    expect(wires.find((wire) => wire.from.pinId === 'lead2')?.color).toBe(DEFAULT_WIRE_COLOR)
  })

  it('uses the selected palette colour for signal wires', () => {
    useCircuitStore.setState({ wireColor: '#7c5cff' })
    useCircuitStore
      .getState()
      .addWire({ partId: 'uno', pinId: 'D13' }, { partId: 'r1', pinId: 'lead1' })
    expect(useCircuitStore.getState().document.wires[0]?.color).toBe('#7c5cff')
  })
})

describe('setWireEndpoint', () => {
  it('reconnects an end to another pin', () => {
    const store = useCircuitStore.getState()
    const id = store.addWire({ partId: 'uno', pinId: 'D13' }, { partId: 'r1', pinId: 'lead1' }, [
      { x: 300, y: 40 },
    ])
    if (id === null) throw new Error('wire was not created')

    expect(
      useCircuitStore.getState().setWireEndpoint(id, 'to', { partId: 'r1', pinId: 'lead2' })
    ).toBe(true)
    const wire = useCircuitStore.getState().document.wires[0]
    expect(wire?.to).toEqual({ partId: 'r1', pinId: 'lead2' })
    expect(wire?.waypoints).toEqual([{ x: 300, y: 40 }])
  })

  it('rejects a pin already used by the other end or by another wire', () => {
    const store = useCircuitStore.getState()
    store.addWire({ partId: 'uno', pinId: 'D13' }, { partId: 'r1', pinId: 'lead1' })
    const second = store.addWire(
      { partId: 'r1', pinId: 'lead2' },
      { partId: 'led', pinId: 'anode' }
    )
    if (second === null) throw new Error('wire was not created')
    store.addWire({ partId: 'uno', pinId: 'D13' }, { partId: 'led', pinId: 'anode' })

    expect(
      useCircuitStore.getState().setWireEndpoint(second, 'from', { partId: 'led', pinId: 'anode' })
    ).toBe(false)
    expect(
      useCircuitStore.getState().setWireEndpoint(second, 'from', { partId: 'uno', pinId: 'D13' })
    ).toBe(false)

    expect(
      useCircuitStore.getState().setWireEndpoint(second, 'from', { partId: 'r1', pinId: 'lead2' })
    ).toBe(true)
  })

  it('will not move a wire onto a terminal that already has one', () => {
    const store = useCircuitStore.getState()
    const first = store.addWire({ partId: 'uno', pinId: 'D13' }, { partId: 'r1', pinId: 'lead1' })
    const second = store.addWire({ partId: 'uno', pinId: '5V' }, { partId: 'led', pinId: 'anode' })
    if (first === null || second === null) throw new Error('wires were not created')

    expect(
      useCircuitStore.getState().setWireEndpoint(second, 'from', { partId: 'r1', pinId: 'lead1' })
    ).toBe(false)
    expect(
      useCircuitStore.getState().setWireEndpoint(second, 'from', { partId: 'r1', pinId: 'lead2' })
    ).toBe(true)
  })
})
