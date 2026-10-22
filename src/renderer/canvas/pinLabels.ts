import type { PartInstance, Rotation } from '../../shared/circuit'
import { definitionOf, pinWorldPosition, type PartPin } from '../parts/definitions'
import type { Size } from './geometry'

/** On-screen sizes, divided by the canvas scale so labels stay readable. */
const LABEL_FONT_SIZE = 10
const LABEL_HEIGHT_FACTOR = 1.15
const LABEL_CHAR_WIDTH_FACTOR = 0.72
const LABEL_GAP = 2
const LABEL_ROW_GAP = 2
const LABEL_LANE_GAP = 0.5
const PIN_RADIUS = 4

type PinEdge = 'top' | 'bottom' | 'left' | 'right'
type PinKey = string

export interface PinLabelBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly fontSize: number
  readonly edge: PinEdge
  readonly row: number
  readonly inside: boolean
}

interface LabelEntry {
  readonly pin: PartPin
  readonly centerAlongEdge: number
  readonly extentAlongEdge: number
  readonly width: number
  readonly height: number
  readonly halfNormal: number
}

const EDGE_DIRECTIONS: Readonly<Record<PinEdge, { readonly x: number; readonly y: number }>> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const EDGE_TANGENTS: Readonly<Record<PinEdge, { readonly x: number; readonly y: number }>> = {
  top: { x: 1, y: 0 },
  bottom: { x: 1, y: 0 },
  left: { x: 0, y: 1 },
  right: { x: 0, y: 1 },
}

function edgeDistance(pin: PartPin, size: Size): number {
  return Math.min(
    pin.position.x,
    pin.position.y,
    size.width - pin.position.x,
    size.height - pin.position.y
  )
}

function nearestEdge(pin: PartPin, size: Size): PinEdge {
  const distances: readonly [PinEdge, number][] = [
    ['top', Math.abs(pin.position.y)],
    ['bottom', Math.abs(pin.position.y - size.height)],
    ['left', Math.abs(pin.position.x)],
    ['right', Math.abs(pin.position.x - size.width)],
  ]
  return distances.reduce((best, entry) => (entry[1] < best[1] ? entry : best))[0]
}

/** True when a layout is too dense for its labels to stay readable. */
export function pinLabelsOverlap(boxes: Iterable<PinLabelBox>): boolean {
  const list = [...boxes]
  for (let a = 0; a < list.length; a += 1) {
    for (let b = a + 1; b < list.length; b += 1) {
      const first = list[a]
      const second = list[b]
      if (first !== undefined && second !== undefined && overlaps(first, second)) return true
    }
  }
  return false
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

function rotateDirection(
  direction: { readonly x: number; readonly y: number },
  rotation: Rotation
): { readonly x: number; readonly y: number } {
  switch (rotation) {
    case 0:
      return direction
    case 90:
      return { x: -direction.y, y: direction.x }
    case 180:
      return { x: -direction.x, y: -direction.y }
    case 270:
      return { x: direction.y, y: -direction.x }
  }
}

/** Greedy lane packing keeps labels on adjacent pins from overlapping. */
function assignRows(entries: readonly LabelEntry[], gap: number): Map<PinKey, number> {
  const ends: number[] = []
  const rows = new Map<PinKey, number>()
  for (const entry of [...entries].sort((a, b) => a.centerAlongEdge - b.centerAlongEdge)) {
    const start = entry.centerAlongEdge - entry.extentAlongEdge / 2
    const end = entry.centerAlongEdge + entry.extentAlongEdge / 2
    let row = ends.findIndex((laneEnd) => start >= laneEnd + gap)
    if (row === -1) {
      row = ends.length
      ends.push(end)
    } else {
      ends[row] = end
    }
    rows.set(entry.pin.id, row)
  }
  return rows
}

/**
 * Places every pin label next to its pin, centered on the pin. Dense edges such
 * as the Uno headers or an LCD data bus use multiple inward lanes, which keeps
 * long labels off the wires and readable. Labels stay upright when the part is
 * rotated.
 */
export function pinLabelBoxes(part: PartInstance, scale: number): ReadonlyMap<PinKey, PinLabelBox> {
  const definition = definitionOf(part.type)
  const fontSize = LABEL_FONT_SIZE / scale
  const height = fontSize * LABEL_HEIGHT_FACTOR
  const gap = LABEL_GAP / scale
  const rowGap = LABEL_ROW_GAP / scale
  const radius = PIN_RADIUS / scale
  const edgeGroups = new Map<PinEdge, LabelEntry[]>()

  const interiorPins: PartPin[] = []
  for (const pin of definition.pins) {
    if (edgeDistance(pin, definition.size) > 0.01) {
      interiorPins.push(pin)
      continue
    }
    const edge = nearestEdge(pin, definition.size)
    const normal = rotateDirection(EDGE_DIRECTIONS[edge], part.rotation)
    const tangent = rotateDirection(EDGE_TANGENTS[edge], part.rotation)
    const world = pinWorldPosition(part, pin.id)
    const width = Math.max(
      fontSize * 0.9,
      pin.label.length * fontSize * LABEL_CHAR_WIDTH_FACTOR + gap
    )
    const halfNormal = Math.abs(normal.x) > 0.5 ? width / 2 : height / 2
    const horizontal = Math.abs(tangent.x) > 0.5
    const entries = edgeGroups.get(edge) ?? []
    entries.push({
      pin,
      centerAlongEdge: horizontal ? world.x : world.y,
      extentAlongEdge: horizontal ? width : height,
      width,
      height,
      halfNormal,
    })
    edgeGroups.set(edge, entries)
  }

  const boxes = new Map<PinKey, PinLabelBox>()
  const layout = new Map<
    PinEdge,
    {
      readonly rows: ReadonlyMap<PinKey, number>
      readonly normal: { readonly x: number; readonly y: number }
      readonly laneStep: number
      readonly inside: boolean
    }
  >()

  for (const [edge, entries] of edgeGroups) {
    const rows = assignRows(entries, LABEL_LANE_GAP / scale)
    const maxRow = Math.max(...rows.values())
    const normal = rotateDirection(EDGE_DIRECTIONS[edge], part.rotation)
    const normalHorizontal = Math.abs(normal.x) > 0.5
    const maxHalfNormal = Math.max(...entries.map((entry) => entry.halfNormal))
    const maxWidth = Math.max(...entries.map((entry) => entry.width))
    const laneStep = (normalHorizontal ? maxWidth : height) + rowGap
    const bodyDepth =
      edge === 'top' || edge === 'bottom' ? definition.size.height : definition.size.width
    const requiredDepth = radius + gap + maxHalfNormal * 2 + maxRow * laneStep
    // Two-pin passives look better with their labels just outside the body.
    const inside = entries.length >= 3 && requiredDepth <= bodyDepth
    layout.set(edge, { rows, normal, laneStep, inside })
  }

  const maxWidthOf = (edge: PinEdge): number =>
    Math.max(0, ...(edgeGroups.get(edge) ?? []).map((entry) => entry.width))
  const clearance = (radius + gap) * 2
  const oppositeEdges: readonly [PinEdge, PinEdge][] = [
    ['left', 'right'],
    ['top', 'bottom'],
  ]
  for (const [first, second] of oppositeEdges) {
    const firstLayout = layout.get(first)
    const secondLayout = layout.get(second)
    if (firstLayout?.inside !== true || secondLayout?.inside !== true) continue
    const bodyDepth = first === 'left' ? definition.size.width : definition.size.height
    if (maxWidthOf(first) + maxWidthOf(second) + clearance > bodyDepth) {
      layout.set(first, { ...firstLayout, inside: false })
      layout.set(second, { ...secondLayout, inside: false })
    }
  }

  for (const [edge, entries] of edgeGroups) {
    const edgeLayout = layout.get(edge)
    if (edgeLayout === undefined) continue
    const { rows, normal, laneStep, inside } = edgeLayout

    for (const entry of entries) {
      const row = rows.get(entry.pin.id) ?? 0
      const pinPosition = pinWorldPosition(part, entry.pin.id)
      const distance = radius + gap + entry.halfNormal + row * laneStep
      const side = inside ? -1 : 1
      const centerX = pinPosition.x + normal.x * side * distance
      const centerY = pinPosition.y + normal.y * side * distance
      boxes.set(entry.pin.id, {
        x: centerX - entry.width / 2,
        y: centerY - entry.height / 2,
        width: entry.width,
        height: entry.height,
        fontSize,
        edge,
        row,
        inside,
      })
    }
  }

  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ] as const
  for (const pin of interiorPins) {
    const width = Math.max(
      fontSize * 0.9,
      pin.label.length * fontSize * LABEL_CHAR_WIDTH_FACTOR + gap
    )
    const world = pinWorldPosition(part, pin.id)
    let placed: PinLabelBox | null = null
    for (let step = 0; step < 4 && placed === null; step += 1) {
      for (const direction of directions) {
        const distance =
          radius + gap + (direction.x === 0 ? height / 2 : width / 2) + step * (height + rowGap)
        const centerX = world.x + direction.x * distance
        const centerY = world.y + direction.y * distance
        const candidate: PinLabelBox = {
          x: centerX - width / 2,
          y: centerY - height / 2,
          width,
          height,
          fontSize,
          edge: nearestEdge(pin, definition.size),
          row: step,
          inside: false,
        }
        if (![...boxes.values()].some((box) => overlaps(candidate, box))) {
          placed = candidate
          break
        }
      }
    }
    if (placed !== null) boxes.set(pin.id, placed)
  }

  return boxes
}
