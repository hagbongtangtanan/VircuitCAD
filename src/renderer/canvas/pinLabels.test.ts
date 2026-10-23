import { describe, expect, it } from 'vitest'
import { partSchema, type PartInstance } from '../../shared/circuit'
import { definitionOf, partDefinitions, pinWorldPosition } from '../parts/definitions'
import { pinLabelBoxes, pinLabelsOverlap, type PinLabelBox } from './pinLabels'

function part(
  type: PartInstance['type'],
  rotation: PartInstance['rotation'] = 0,
  position = { x: 0, y: 0 }
): PartInstance {
  return partSchema.parse({
    id: `part-${type}`,
    type,
    position,
    rotation,
    props: definitionOf(type).defaultProps,
  })
}

function overlaps(a: PinLabelBox, b: PinLabelBox): boolean {
  const epsilon = 0.01
  return (
    a.x < b.x + b.width - epsilon &&
    a.x + a.width > b.x + epsilon &&
    a.y < b.y + b.height - epsilon &&
    a.y + a.height > b.y + epsilon
  )
}

describe('pinLabelBoxes', () => {
  it('centers every label on the tangent of its pin', () => {
    for (const definition of partDefinitions) {
      if (definition.pins.length > 30) continue
      const instance = part(definition.type)
      const boxes = pinLabelBoxes(instance, 1)

      for (const pin of definition.pins) {
        const distanceToEdge = Math.min(
          pin.position.x,
          pin.position.y,
          definition.size.width - pin.position.x,
          definition.size.height - pin.position.y
        )
        if (distanceToEdge > 0.01) continue
        const box = boxes.get(pin.id)
        expect(box, `${definition.type}:${pin.id}`).toBeDefined()
        if (box === undefined) continue
        const world = pinWorldPosition(instance, pin.id)
        if (box.edge === 'top' || box.edge === 'bottom') {
          expect(box.x + box.width / 2, `${definition.type}:${pin.id}`).toBeCloseTo(world.x, 5)
        } else {
          expect(box.y + box.height / 2, `${definition.type}:${pin.id}`).toBeCloseTo(world.y, 5)
        }
      }
    }
  })

  it('keeps the Uno header labels inside the board', () => {
    const uno = part('arduino-uno')
    const boxes = pinLabelBoxes(uno, 1)
    for (const pin of definitionOf('arduino-uno').pins) {
      const box = boxes.get(pin.id)
      expect(box?.inside, pin.id).toBe(true)
      expect(box?.y ?? -1).toBeGreaterThanOrEqual(0)
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(200)
    }
  })

  it('places two-pin passive labels outside their body', () => {
    const led = part('led')
    const boxes = pinLabelBoxes(led, 1)
    expect(boxes.get('anode')?.inside).toBe(false)
    expect(boxes.get('cathode')?.inside).toBe(false)
    expect((boxes.get('anode')?.y ?? 0) > 40).toBe(true)

    const resistor = part('resistor')
    const resistorBoxes = pinLabelBoxes(resistor, 1)
    expect(resistorBoxes.get('lead1')?.inside).toBe(false)
    expect(resistorBoxes.get('lead2')?.inside).toBe(false)
    expect((resistorBoxes.get('lead1')?.x ?? 0) < 0).toBe(true)
    expect((resistorBoxes.get('lead2')?.x ?? 0) > 60).toBe(true)
  })

  it('keeps labels aligned and inside the Uno after rotation', () => {
    const uno = part('arduino-uno', 90, { x: 100, y: 100 })
    const boxes = pinLabelBoxes(uno, 1)
    for (const pin of definitionOf('arduino-uno').pins) {
      const box = boxes.get(pin.id)
      const world = pinWorldPosition(uno, pin.id)
      expect(box?.inside, pin.id).toBe(true)
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(150)
      expect((box?.y ?? 0) + (box?.height ?? 0) / 2).toBeCloseTo(world.y, 5)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(350)
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(400)
    }
  })

  it('does not overlap labels on any component', () => {
    for (const definition of partDefinitions) {
      if (definition.pins.length > 30) continue
      const boxes = [...pinLabelBoxes(part(definition.type), 1).values()]
      for (let a = 0; a < boxes.length; a += 1) {
        for (let b = a + 1; b < boxes.length; b += 1) {
          const left = boxes[a]
          const right = boxes[b]
          if (left === undefined || right === undefined) continue
          expect(overlaps(left, right), `${definition.type} labels ${a}/${b}`).toBe(false)
        }
      }
    }
  })

  it('lays out every Raspberry Pi header label without overlap', () => {
    const boxes = [...pinLabelBoxes(part('raspberry-pi'), 1).values()]
    expect(boxes).toHaveLength(40)
    expect(pinLabelsOverlap(boxes)).toBe(false)
  })

  it('flags crowded labels so the canvas can hide them', () => {
    expect(pinLabelsOverlap(pinLabelBoxes(part('attiny85'), 0.6).values())).toBe(true)
    expect(pinLabelsOverlap(pinLabelBoxes(part('attiny85'), 1).values())).toBe(false)
    expect(pinLabelsOverlap(pinLabelBoxes(part('arduino-uno'), 1).values())).toBe(false)
  })

  it('does not overlap labels after quarter turns', () => {
    for (const rotation of [90, 180, 270] as const) {
      for (const definition of partDefinitions) {
        if (definition.pins.length > 30) continue
        const boxes = [...pinLabelBoxes(part(definition.type, rotation), 1).values()]
        for (let a = 0; a < boxes.length; a += 1) {
          for (let b = a + 1; b < boxes.length; b += 1) {
            const left = boxes[a]
            const right = boxes[b]
            if (left === undefined || right === undefined) continue
            expect(overlaps(left, right), `${definition.type}@${rotation} labels ${a}/${b}`).toBe(
              false
            )
          }
        }
      }
    }
  })
})
