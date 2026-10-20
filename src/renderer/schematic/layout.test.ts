import { describe, expect, it } from 'vitest'
import type { CircuitDocument, PartInstance } from '../../shared/circuit'
import { layoutSchematic } from './layout'

const uno: PartInstance = {
  id: 'uno',
  type: 'arduino-uno',
  position: { x: 0, y: 0 },
  rotation: 0,
  props: {},
}

const led: PartInstance = {
  id: 'led',
  type: 'led',
  position: { x: 400, y: 200 },
  rotation: 0,
  props: { color: 'red' },
}

const resistor: PartInstance = {
  id: 'resistor',
  type: 'resistor',
  position: { x: 400, y: 400 },
  rotation: 0,
  props: { resistanceOhms: 220 },
}

const breadboard: PartInstance = {
  id: 'breadboard',
  type: 'breadboard',
  position: { x: 400, y: 600 },
  rotation: 0,
  props: {},
}

function documentOf(
  parts: readonly PartInstance[],
  wires: CircuitDocument['wires'] = []
): CircuitDocument {
  return { version: 1, parts: [...parts], wires }
}

describe('layoutSchematic', () => {
  it('leaves the breadboard out and keeps real components', () => {
    const layout = layoutSchematic(
      documentOf(
        [uno, breadboard, led],
        [
          {
            id: 'w1',
            from: { partId: 'uno', pinId: 'GND' },
            to: { partId: 'led', pinId: 'cathode' },
            color: '#4f9cf9',
            waypoints: [],
          },
        ]
      )
    )

    expect(layout.nodes.map((node) => node.id).sort()).toEqual(['led', 'uno'])
    expect(layout.nodes.find((node) => node.id === 'uno')?.board).toBe(true)
    expect(layout.nodes.find((node) => node.id === 'led')?.board).toBe(false)
  })

  it('routes a two-pin net from the board to the component', () => {
    const layout = layoutSchematic(
      documentOf(
        [uno, led],
        [
          {
            id: 'w1',
            from: { partId: 'uno', pinId: 'GND' },
            to: { partId: 'led', pinId: 'cathode' },
            color: '#4f9cf9',
            waypoints: [],
          },
        ]
      )
    )

    expect(layout.wires).toHaveLength(1)
    const wire = layout.wires[0]
    expect(wire).toBeDefined()
    expect(wire?.paths).toHaveLength(1)
    const points = wire?.paths[0] ?? []
    expect(points.length).toBeGreaterThanOrEqual(2)
    expect(points[0]).toEqual({ x: 260, y: 88 })
    expect(points[points.length - 1]?.x).toBe(368)
  })

  it('shares one trunk and marks junctions when a net has three pins', () => {
    const layout = layoutSchematic(
      documentOf(
        [uno, led, resistor],
        [
          {
            id: 'w1',
            from: { partId: 'uno', pinId: 'GND' },
            to: { partId: 'led', pinId: 'cathode' },
            color: '#4f9cf9',
            waypoints: [],
          },
          {
            id: 'w2',
            from: { partId: 'uno', pinId: 'GND' },
            to: { partId: 'resistor', pinId: 'lead1' },
            color: '#4f9cf9',
            waypoints: [],
          },
          {
            id: 'w3',
            from: { partId: 'led', pinId: 'anode' },
            to: { partId: 'resistor', pinId: 'lead2' },
            color: '#4f9cf9',
            waypoints: [],
          },
        ]
      )
    )

    const gnd = layout.wires.find((wire) => wire.paths.length === 2)
    expect(gnd).toBeDefined()
    expect(gnd?.junctions.length).toBe(2)
    for (const path of gnd?.paths ?? []) {
      expect(path[0]).toEqual({ x: 260, y: 88 })
      expect(path[path.length - 1]?.x).toBe(368)
    }
  })

  it('keeps unconnected parts on the drawing with their pins', () => {
    const layout = layoutSchematic(documentOf([resistor]))

    expect(layout.nodes).toHaveLength(1)
    expect(layout.wires).toHaveLength(0)
    expect(layout.nodes[0]?.pins.map((pin) => pin.pinId)).toEqual(['lead1', 'lead2'])
  })

  it('ignores nets that only reach the breadboard', () => {
    const layout = layoutSchematic(
      documentOf(
        [breadboard, led],
        [
          {
            id: 'w1',
            from: { partId: 'breadboard', pinId: 'a1' },
            to: { partId: 'led', pinId: 'cathode' },
            color: '#4f9cf9',
            waypoints: [],
          },
        ]
      )
    )

    expect(layout.wires).toHaveLength(0)
    expect(layout.nodes.map((node) => node.id)).toEqual(['led'])
  })

  it('sizes the drawing around the placed nodes', () => {
    const layout = layoutSchematic(documentOf([uno, led, resistor]))
    expect(layout.width).toBeGreaterThan(400)
    expect(layout.height).toBeGreaterThan(300)
  })
})
