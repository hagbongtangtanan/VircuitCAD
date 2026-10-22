import { describe, expect, it } from 'vitest'
import type { CircuitDocument, PartInstance, Wire } from '../../shared/circuit'
import {
  fitSchematicToPaper,
  layoutSchematic,
  PAPER_PRESETS,
  SHEET_MARGIN,
  TITLE_BLOCK_HEIGHT,
} from './layout'

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

const miniBreadboard: PartInstance = {
  id: 'mini',
  type: 'breadboard-mini',
  position: { x: 600, y: 600 },
  rotation: 0,
  props: {},
}

function wire(id: string, from: Wire['from'], to: Wire['to'], color = '#4f9cf9'): Wire {
  return { id, from, to, color, waypoints: [] }
}

function documentOf(parts: readonly PartInstance[], wires: readonly Wire[] = []): CircuitDocument {
  return { version: 1, parts: [...parts], wires: [...wires] }
}

describe('layoutSchematic', () => {
  it('leaves every breadboard size out and keeps real components', () => {
    const layout = layoutSchematic(
      documentOf(
        [uno, breadboard, miniBreadboard, led],
        [wire('w1', { partId: 'uno', pinId: 'GND' }, { partId: 'led', pinId: 'cathode' })]
      )
    )

    expect(layout.nodes.map((node) => node.id).sort()).toEqual(['led', 'uno'])
    expect(layout.nodes.find((node) => node.id === 'uno')?.board).toBe(true)
    expect(layout.nodes.find((node) => node.id === 'led')?.board).toBe(false)
  })

  it('routes a two-pin net from the board pin to the component pin', () => {
    const layout = layoutSchematic(
      documentOf(
        [uno, led],
        [wire('w1', { partId: 'uno', pinId: 'GND' }, { partId: 'led', pinId: 'cathode' })]
      )
    )

    const boardPin = layout.nodes
      .find((node) => node.id === 'uno')
      ?.pins.find((pin) => pin.pinId === 'GND')
    const ledPin = layout.nodes
      .find((node) => node.id === 'led')
      ?.pins.find((pin) => pin.pinId === 'cathode')
    expect(boardPin).toBeDefined()
    expect(ledPin).toBeDefined()

    expect(layout.wires).toHaveLength(1)
    const points = layout.wires[0]?.paths[0] ?? []
    expect(points.length).toBeGreaterThanOrEqual(2)
    expect(points[0]).toEqual({ x: boardPin?.x, y: boardPin?.y })
    expect(points[points.length - 1]).toEqual({ x: ledPin?.x, y: ledPin?.y })
  })

  it('branches a multi-pin net and marks the junctions', () => {
    const layout = layoutSchematic(
      documentOf(
        [uno, led, resistor],
        [
          wire('w1', { partId: 'uno', pinId: 'GND' }, { partId: 'led', pinId: 'cathode' }),
          wire('w2', { partId: 'uno', pinId: 'GND' }, { partId: 'resistor', pinId: 'lead1' }),
          wire('w3', { partId: 'led', pinId: 'anode' }, { partId: 'resistor', pinId: 'lead2' }),
        ]
      )
    )

    const gnd = layout.wires.find((candidate) => candidate.paths.length === 2)
    expect(gnd).toBeDefined()
    expect(gnd?.junctions.length).toBeGreaterThan(0)
    expect(gnd?.kind).toBe('ground')
  })

  it('keeps unconnected parts on the drawing with their pins', () => {
    const layout = layoutSchematic(documentOf([resistor]))

    expect(layout.nodes).toHaveLength(1)
    expect(layout.wires).toHaveLength(0)
    expect(layout.nodes[0]?.pins.map((pin) => pin.pinId)).toEqual(['lead1', 'lead2'])
    expect(layout.nodes[0]?.designator).toBe('R1')
    expect(layout.nodes[0]?.value).toBe('220 Ω')
  })

  it('ignores nets that only reach a breadboard', () => {
    const layout = layoutSchematic(
      documentOf(
        [breadboard, led],
        [wire('w1', { partId: 'breadboard', pinId: 'a1' }, { partId: 'led', pinId: 'cathode' })]
      )
    )

    expect(layout.wires).toHaveLength(0)
    expect(layout.nodes.map((node) => node.id)).toEqual(['led'])
  })

  it('sizes the drawing around the placed nodes', () => {
    const layout = layoutSchematic(documentOf([uno, led, resistor]))
    expect(layout.width).toBeGreaterThan(400)
    expect(layout.height).toBeGreaterThan(300)
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width)
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height)
    }
  })

  it('never overlaps two component bodies, even with many parts', () => {
    const parts: PartInstance[] = Array.from({ length: 18 }, (_unused, index) => ({
      id: `r-${index}`,
      type: 'resistor',
      position: { x: index * 20, y: index * 20 },
      rotation: 0,
      props: { resistanceOhms: 220 + index },
    }))
    const layout = layoutSchematic(documentOf(parts))

    for (let a = 0; a < layout.nodes.length; a += 1) {
      for (let b = a + 1; b < layout.nodes.length; b += 1) {
        const left = layout.nodes[a]
        const right = layout.nodes[b]
        if (left === undefined || right === undefined) continue
        const overlap =
          left.x < right.x + right.width &&
          left.x + left.width > right.x &&
          left.y < right.y + right.height &&
          left.y + left.height > right.y
        expect(overlap).toBe(false)
      }
    }
  })

  it('keeps the compact two-pin layout by default', () => {
    const layout = layoutSchematic(documentOf([resistor]))
    const node = layout.nodes[0]
    expect(node?.height).toBe(78)
    const pins = node?.pins ?? []
    expect((pins[1]?.y ?? 0) - (pins[0]?.y ?? 0)).toBe(22)
  })

  it('gives two-pin parts room for rotated original symbols', () => {
    const layout = layoutSchematic(documentOf([resistor]), { roomyTwoPin: true })
    const node = layout.nodes[0]
    expect(node?.height).toBe(136)
    const pins = node?.pins ?? []
    expect((pins[1]?.y ?? 0) - (pins[0]?.y ?? 0)).toBe(68)
    expect((pins[0]?.y ?? 0) - (node?.y ?? 0)).toBe(34)
  })

  it('uses the first wire colour on a net in both schematic styles', () => {
    const layout = layoutSchematic(
      documentOf(
        [uno, led],
        [wire('w1', { partId: 'uno', pinId: '5V' }, { partId: 'led', pinId: 'anode' }, '#c58cff')]
      )
    )

    expect(layout.wires[0]?.color).toBe('#c58cff')
    expect(layout.wires[0]?.kind).toBe('power')
  })

  it('fits the drawing inside every paper size above the title block', () => {
    const parts: PartInstance[] = Array.from({ length: 14 }, (_unused, index) => ({
      id: `r-${index}`,
      type: 'resistor',
      position: { x: index * 20, y: index * 20 },
      rotation: 0,
      props: { resistanceOhms: 220 + index },
    }))
    const layout = layoutSchematic(documentOf(parts))

    for (const paperSize of ['a4', 'letter', 'legal'] as const) {
      const paper = PAPER_PRESETS[paperSize]
      const sheet = fitSchematicToPaper(layout, paperSize)
      expect(sheet.scale).toBeGreaterThan(0)
      expect(sheet.x).toBeGreaterThanOrEqual(0)
      expect(sheet.y).toBeGreaterThanOrEqual(SHEET_MARGIN)
      expect(sheet.x + layout.width * sheet.scale).toBeLessThanOrEqual(paper.width)
      expect(sheet.y + layout.height * sheet.scale).toBeLessThanOrEqual(
        paper.height - TITLE_BLOCK_HEIGHT
      )
    }
  })

  it('offers fixed landscape A4, Letter and Legal sheets', () => {
    expect(PAPER_PRESETS.a4.width / PAPER_PRESETS.a4.height).toBeCloseTo(297 / 210, 2)
    expect(PAPER_PRESETS.letter.width / PAPER_PRESETS.letter.height).toBeCloseTo(11 / 8.5, 2)
    expect(PAPER_PRESETS.legal.width / PAPER_PRESETS.legal.height).toBeCloseTo(14 / 8.5, 2)
    expect(PAPER_PRESETS.legal.width).toBeGreaterThan(PAPER_PRESETS.a4.width)
  })
})
