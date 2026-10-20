import type { CircuitDocument, PartInstance, PartType, Point } from '../../shared/circuit'
import { pinKey } from '../../shared/circuit'
import { definitionOf, partDefinitions, type PinKind } from '../parts/definitions'
import { buildNetlist } from '../wiring/netlist'

/**
 * Turns the breadboard document into a read-only schematic. Breadboards are
 * prototyping hardware, not schematic symbols, so they are skipped: a net that
 * only exists on a breadboard strip disappears, and a net that also reaches a
 * real component is drawn between those components directly.
 */

const SKIPPED_TYPES: ReadonlySet<PartType> = new Set<PartType>(['breadboard'])
const BOARD_TYPES: ReadonlySet<PartType> = new Set<PartType>(['arduino-uno'])

const BOARD_X = 48
const BOARD_WIDTH = 200
const LEAF_X = 380
const LEAF_WIDTH = 176
const TOP = 56
const NODE_GAP = 30
const PIN_SPACING = 22
const PIN_STUB = 12
const PIN_TOP = 34
const PIN_BOTTOM = 22
const CHANNEL_BASE = 286
const LANE_STEP = 9
const LANE_COUNT = 7
const MAX_UNCONNECTED_PINS = 6

const TYPE_ORDER = new Map<PartType, number>(
  partDefinitions.map((definition, index) => [definition.type, index])
)

export interface SchematicPin {
  readonly key: string
  readonly partId: string
  readonly pinId: string
  readonly label: string
  readonly kind: PinKind
  readonly side: 'left' | 'right'
  /** Endpoint of the wire stub, outside the part body. */
  readonly x: number
  readonly y: number
}

export interface SchematicPartNode {
  readonly id: string
  readonly type: PartType
  readonly label: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly board: boolean
  readonly pins: readonly SchematicPin[]
}

export interface SchematicWire {
  readonly netId: number
  readonly paths: readonly (readonly Point[])[]
  readonly junctions: readonly Point[]
}

export interface SchematicLayout {
  readonly nodes: readonly SchematicPartNode[]
  readonly wires: readonly SchematicWire[]
  readonly width: number
  readonly height: number
}

export interface SchematicLayoutOptions {
  /**
   * Rotated two-terminal symbols need both terminals 68 units apart, so the
   * original style gives those nodes extra height. The simplified cards keep
   * their compact layout.
   */
  readonly roomyTwoPin?: boolean
}

interface PinPlan {
  readonly part: PartInstance
  readonly board: boolean
  readonly pins: readonly {
    readonly pinId: string
    readonly label: string
    readonly kind: PinKind
  }[]
}

function netIdOfPin(
  netlist: ReturnType<typeof buildNetlist>,
  partId: string,
  pinId: string
): number | undefined {
  return netlist.netIdOf({ partId, pinId })
}

/** Pins that reach another real component, i.e. ignore breadboard-only nets. */
function anchorKeysByNet(
  document: CircuitDocument,
  netlist: ReturnType<typeof buildNetlist>
): Map<number, string[]> {
  const anchors = new Map<number, string[]>()
  const partTypes = new Map(document.parts.map((part) => [part.id, part.type]))

  for (const [netId, keys] of netlist.pinsByNet) {
    const realKeys = keys.filter((key) => {
      const partId = key.slice(0, key.indexOf(':'))
      const type = partTypes.get(partId)
      return type !== undefined && !SKIPPED_TYPES.has(type)
    })
    if (realKeys.length >= 2) anchors.set(netId, realKeys)
  }

  return anchors
}

function rankLeaves(
  leaves: readonly PartInstance[],
  boards: readonly PartInstance[],
  netlist: ReturnType<typeof buildNetlist>
): Map<string, number> {
  const boardNetRank = new Map<number, number>()

  for (const board of boards) {
    definitionOf(board.type).pins.forEach((pin, index) => {
      const netId = netIdOfPin(netlist, board.id, pin.id)
      if (netId === undefined) return
      const current = boardNetRank.get(netId)
      if (current === undefined || index < current) boardNetRank.set(netId, index)
    })
  }

  const ranks = new Map<string, number>()
  for (const leaf of leaves) {
    let best = Number.POSITIVE_INFINITY
    for (const pin of definitionOf(leaf.type).pins) {
      const netId = netIdOfPin(netlist, leaf.id, pin.id)
      if (netId === undefined) continue
      const rank = boardNetRank.get(netId)
      if (rank !== undefined && rank < best) best = rank
    }
    ranks.set(leaf.id, best)
  }

  return ranks
}

function sortLeaves(
  leaves: readonly PartInstance[],
  ranks: ReadonlyMap<string, number>
): readonly PartInstance[] {
  return [...leaves].sort((a, b) => {
    const rankA = ranks.get(a.id) ?? Number.POSITIVE_INFINITY
    const rankB = ranks.get(b.id) ?? Number.POSITIVE_INFINITY
    if (rankA !== rankB) return rankA - rankB
    const orderA = TYPE_ORDER.get(a.type) ?? Number.MAX_SAFE_INTEGER
    const orderB = TYPE_ORDER.get(b.type) ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    const labelA = definitionOf(a.type).label
    const labelB = definitionOf(b.type).label
    if (labelA !== labelB) return labelA.localeCompare(labelB)
    return a.id.localeCompare(b.id)
  })
}

function planPins(
  part: PartInstance,
  anchors: ReadonlyMap<number, string[]>,
  netlist: ReturnType<typeof buildNetlist>
): readonly { pinId: string; label: string; kind: PinKind }[] {
  const definition = definitionOf(part.type)
  const connected = new Set<string>()

  for (const pin of definition.pins) {
    const netId = netIdOfPin(netlist, part.id, pin.id)
    if (netId === undefined) continue
    if (anchors.has(netId)) connected.add(pin.id)
  }

  const chosen =
    connected.size > 0
      ? definition.pins.filter((pin) => connected.has(pin.id))
      : definition.pins.slice(0, MAX_UNCONNECTED_PINS)

  return chosen.map((pin) => ({ pinId: pin.id, label: pin.label, kind: pin.kind }))
}

function nodeHeight(pinCount: number, options: SchematicLayoutOptions): number {
  if (pinCount <= 1) return 64
  if (pinCount === 2 && options.roomyTwoPin === true) return 136
  return Math.max(72, PIN_TOP + PIN_BOTTOM + (pinCount - 1) * PIN_SPACING)
}

function buildNode(
  plan: PinPlan,
  x: number,
  y: number,
  options: SchematicLayoutOptions
): SchematicPartNode {
  const definition = definitionOf(plan.part.type)
  const width = plan.board ? BOARD_WIDTH : LEAF_WIDTH
  const height = nodeHeight(plan.pins.length, options)
  const side = plan.board ? 'right' : 'left'
  const stubX = plan.board ? x + width + PIN_STUB : x - PIN_STUB

  const pins = plan.pins.map((pin, index) => {
    const span = height - PIN_TOP - PIN_BOTTOM
    const centeredTwoPin = plan.pins.length === 2 && options.roomyTwoPin === true
    const offset = centeredTwoPin
      ? height / 2 - 34 + index * 68
      : plan.pins.length <= 1
        ? height / 2
        : PIN_TOP + (span * index) / (plan.pins.length - 1)
    return {
      key: pinKey({ partId: plan.part.id, pinId: pin.pinId }),
      partId: plan.part.id,
      pinId: pin.pinId,
      label: pin.label,
      kind: pin.kind,
      side,
      x: stubX,
      y: y + offset,
    } satisfies SchematicPin
  })

  return {
    id: plan.part.id,
    type: plan.part.type,
    label: definition.label,
    x,
    y,
    width,
    height,
    board: plan.board,
    pins,
  }
}

function dedupe(points: readonly Point[]): Point[] {
  const result: Point[] = []
  for (const point of points) {
    const previous = result[result.length - 1]
    if (previous !== undefined && previous.x === point.x && previous.y === point.y) continue
    result.push(point)
  }
  return result
}

function wireForNet(netId: number, anchors: readonly SchematicPin[]): SchematicWire | null {
  if (anchors.length < 2) return null

  const ordered = [...anchors].sort((a, b) => a.x - b.x || a.y - b.y)
  const hub = ordered[0]
  if (hub === undefined) return null

  const laneX = CHANNEL_BASE + (netId % LANE_COUNT) * LANE_STEP
  const paths: Point[][] = []
  const junctions: Point[] = []

  for (const pin of ordered.slice(1)) {
    if (pin.y === hub.y) {
      paths.push([
        { x: hub.x, y: hub.y },
        { x: pin.x, y: pin.y },
      ])
      if (anchors.length > 2) junctions.push({ x: pin.x, y: pin.y })
      continue
    }

    const path = dedupe([
      { x: hub.x, y: hub.y },
      { x: laneX, y: hub.y },
      { x: laneX, y: pin.y },
      { x: pin.x, y: pin.y },
    ])
    paths.push(path)
    if (anchors.length > 2) junctions.push({ x: laneX, y: pin.y })
  }

  return { netId, paths, junctions }
}

export function layoutSchematic(
  document: CircuitDocument,
  options: SchematicLayoutOptions = {}
): SchematicLayout {
  const netlist = buildNetlist(document)
  const anchors = anchorKeysByNet(document, netlist)
  const drawable = document.parts.filter((part) => !SKIPPED_TYPES.has(part.type))
  const boards = drawable.filter((part) => BOARD_TYPES.has(part.type))
  const leafParts = drawable.filter((part) => !BOARD_TYPES.has(part.type))
  const leaves = sortLeaves(leafParts, rankLeaves(leafParts, boards, netlist))

  const nodes: SchematicPartNode[] = []
  let boardY = TOP
  for (const board of boards) {
    const pins = planPins(board, anchors, netlist)
    const node = buildNode({ part: board, board: true, pins }, BOARD_X, boardY, options)
    nodes.push(node)
    boardY += node.height + NODE_GAP
  }

  let leafY = TOP
  for (const leaf of leaves) {
    const pins = planPins(leaf, anchors, netlist)
    const node = buildNode({ part: leaf, board: false, pins }, LEAF_X, leafY, options)
    nodes.push(node)
    leafY += node.height + NODE_GAP
  }

  const pinLookup = new Map<string, SchematicPin>()
  for (const node of nodes) {
    for (const pin of node.pins) pinLookup.set(pin.key, pin)
  }

  const wires: SchematicWire[] = []
  for (const [netId, keys] of anchors) {
    const netPins = keys
      .map((key) => pinLookup.get(key))
      .filter((pin): pin is SchematicPin => pin !== undefined)
    const wire = wireForNet(netId, netPins)
    if (wire !== null) wires.push(wire)
  }
  wires.sort((a, b) => a.netId - b.netId)

  const right = nodes.reduce((max, node) => Math.max(max, node.x + node.width), 0) + 80
  const bottom = nodes.reduce((max, node) => Math.max(max, node.y + node.height), 0) + 56

  return {
    nodes,
    wires,
    width: Math.max(560, right),
    height: Math.max(320, bottom),
  }
}
