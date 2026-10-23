import type { CircuitDocument, PartInstance, PartType, Point } from '../../shared/circuit'
import { pinKey } from '../../shared/circuit'
import { wireColorFor, wireKindFor, type WireKind } from '../../shared/wireColors'
import { definitionOf, partDefinitions, type PinKind } from '../parts/definitions'
import { buildNetlist } from '../wiring/netlist'
import { partValue, referenceDesignators } from './annotations'

/**
 * Turns the breadboard document into a read-only schematic. Breadboards are
 * prototyping hardware, not schematic symbols, so every board size is skipped:
 * a net that only exists on a breadboard strip disappears, and a net that also
 * reaches a real component is drawn between those components directly.
 */

const SKIPPED_TYPES: ReadonlySet<PartType> = new Set<PartType>([
  'breadboard',
  'breadboard-small',
  'breadboard-mini',
])
const BOARD_TYPES: ReadonlySet<PartType> = new Set<PartType>(['arduino-uno'])

const BOARD_X = 48
const BOARD_WIDTH = 200
const LEAF_WIDTH = 176
const MAX_LEAF_WIDTH = 240
const COLUMN_GAP = 92
const TOP = 96
const NODE_GAP = 30
const PIN_SPACING = 22
const PIN_STUB = 12
const PIN_TOP = 34
const PIN_BOTTOM = 22
const TARGET_COLUMN_HEIGHT = 470
const MAX_COLUMNS = 6
const BUS_LANES = 26
const BUS_STEP = 2.8
const CHANNEL_LANES = 5
const CHANNEL_STEP = 7
const MAX_UNCONNECTED_PINS = 6
const GROUP_GAP = 36
const PAGE_PADDING = 28
const DEFAULT_MIN_PAGE_SCALE = 0.55

export type SchematicPaper = 'a4' | 'letter' | 'legal'

export interface PaperPreset {
  readonly label: string
  readonly width: number
  readonly height: number
}

/** Landscape sheet dimensions in PostScript points (72 per inch). */
export const PAPER_PRESETS: Readonly<Record<SchematicPaper, PaperPreset>> = {
  a4: { label: 'A4', width: 842, height: 595 },
  letter: { label: 'Letter / Short', width: 792, height: 612 },
  legal: { label: 'Legal / Long', width: 1008, height: 612 },
}

export const SHEET_MARGIN = 26
export const TITLE_BLOCK_HEIGHT = 78

export interface SchematicSheet {
  readonly width: number
  readonly height: number
  readonly scale: number
  readonly x: number
  readonly y: number
}

/** Scales the complete drawing into a fixed sheet, above the title block. */
export function fitSchematicToPaper(
  layout: Pick<SchematicLayout, 'width' | 'height'>,
  paper: SchematicPaper
): SchematicSheet {
  const preset = PAPER_PRESETS[paper]
  const availableWidth = preset.width - SHEET_MARGIN * 2
  const availableHeight = preset.height - SHEET_MARGIN * 2 - TITLE_BLOCK_HEIGHT
  const scale = Math.min(
    1.2,
    availableWidth / Math.max(1, layout.width),
    availableHeight / Math.max(1, layout.height)
  )
  return {
    width: preset.width,
    height: preset.height,
    scale,
    x: (preset.width - layout.width * scale) / 2,
    y: SHEET_MARGIN + Math.max(0, (availableHeight - layout.height * scale) / 2),
  }
}

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
  /** Routing channel to the left of this part's column. */
  readonly channel: number
  /** Full-document net id, or null when the pin is not connected. */
  readonly netId: number | null
}

export interface SchematicPartNode {
  readonly id: string
  readonly type: PartType
  readonly label: string
  readonly designator: string
  readonly value: string | null
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly column: number
  readonly board: boolean
  readonly pins: readonly SchematicPin[]
}

export interface SchematicWire {
  readonly netId: number
  readonly kind: WireKind
  readonly color: string
  readonly paths: readonly (readonly Point[])[]
  readonly junctions: readonly Point[]
}

export interface SchematicNetLabel {
  readonly netId: number
  readonly label: string
  readonly x: number
  readonly y: number
  readonly anchor: 'start' | 'end'
}

export interface SchematicLayout {
  readonly nodes: readonly SchematicPartNode[]
  readonly wires: readonly SchematicWire[]
  readonly netLabels: readonly SchematicNetLabel[]
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
  /** Used by pagination to keep a cluster inside one sheet width. */
  readonly maxColumns?: number
  /** Used by pagination to keep a cluster inside one sheet height. */
  readonly targetColumnHeight?: number
  /** Shared across independently laid-out clusters so references stay unique. */
  readonly designators?: ReadonlyMap<string, string>
}

export interface SchematicPaginationOptions extends SchematicLayoutOptions {
  readonly paperSize: SchematicPaper
  readonly minScale?: number
}

export interface SchematicPagination {
  readonly pages: readonly SchematicLayout[]
  readonly pageCount: number
}

interface PinPlan {
  readonly part: PartInstance
  readonly board: boolean
  readonly pins: readonly {
    readonly pinId: string
    readonly label: string
    readonly kind: PinKind
    readonly netId: number | null
  }[]
}

interface LeafPlan {
  readonly part: PartInstance
  readonly pins: PinPlan['pins']
  readonly width: number
  readonly height: number
}

interface ColumnPlan {
  readonly x: number
  readonly width: number
  readonly leaves: readonly LeafPlan[]
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

/**
 * Breadth-first depth from the board. It keeps a series chain flowing left to
 * right instead of arranging every part by type alone.
 */
function leafDepths(
  leaves: readonly PartInstance[],
  boards: readonly PartInstance[],
  anchors: ReadonlyMap<number, string[]>
): Map<string, number> {
  const leafIds = new Set(leaves.map((leaf) => leaf.id))
  const adjacency = new Map<string, Set<string>>()
  for (const id of leafIds) adjacency.set(id, new Set())

  for (const keys of anchors.values()) {
    const ids = [...new Set(keys.map((key) => key.slice(0, key.indexOf(':'))))].filter((id) =>
      leafIds.has(id)
    )
    const hub = ids[0]
    const hubNeighbours = hub === undefined ? undefined : adjacency.get(hub)
    if (hub === undefined || hubNeighbours === undefined) continue
    for (const id of ids) {
      if (id === hub) continue
      hubNeighbours.add(id)
      adjacency.get(id)?.add(hub)
    }
  }

  const depths = new Map<string, number>()
  const queue: string[] = []
  const boardIds = new Set(boards.map((board) => board.id))

  for (const keys of anchors.values()) {
    const ids = [...new Set(keys.map((key) => key.slice(0, key.indexOf(':'))))]
    if (!ids.some((id) => boardIds.has(id))) continue
    for (const id of ids) {
      if (leafIds.has(id) && !depths.has(id)) {
        depths.set(id, 1)
        queue.push(id)
      }
    }
  }

  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index]
    if (id === undefined) continue
    const depth = depths.get(id) ?? 1
    for (const next of adjacency.get(id) ?? []) {
      if (!depths.has(next)) {
        depths.set(next, depth + 1)
        queue.push(next)
      }
    }
  }

  return depths
}

function sortLeaves(
  leaves: readonly PartInstance[],
  ranks: ReadonlyMap<string, number>,
  depths: ReadonlyMap<string, number>
): readonly PartInstance[] {
  return [...leaves].sort((a, b) => {
    const depthA = depths.get(a.id) ?? Number.POSITIVE_INFINITY
    const depthB = depths.get(b.id) ?? Number.POSITIVE_INFINITY
    if (depthA !== depthB) return depthA - depthB
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
): PinPlan['pins'] {
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

  return chosen.map((pin) => ({
    pinId: pin.id,
    label: pin.label,
    kind: pin.kind,
    netId: netIdOfPin(netlist, part.id, pin.id) ?? null,
  }))
}

function nodeHeight(pinCount: number, options: SchematicLayoutOptions): number {
  if (pinCount <= 1) return 64
  if (pinCount === 2 && options.roomyTwoPin === true) return 136
  return Math.max(78, PIN_TOP + PIN_BOTTOM + (pinCount - 1) * PIN_SPACING)
}

function leafWidth(plan: PinPlan): number {
  const labelWidth = definitionOf(plan.part.type).label.length * 6.4 + 26
  const pinWidth = plan.pins.reduce((max, pin) => Math.max(max, pin.label.length * 6.2 + 34), 0)
  return Math.max(LEAF_WIDTH, Math.min(MAX_LEAF_WIDTH, Math.ceil(Math.max(labelWidth, pinWidth))))
}

function buildNode(
  plan: PinPlan,
  x: number,
  y: number,
  width: number,
  column: number,
  options: SchematicLayoutOptions,
  designator: string,
  value: string | null
): SchematicPartNode {
  const definition = definitionOf(plan.part.type)
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
      channel: plan.board ? 0 : column,
      netId: pin.netId,
    } satisfies SchematicPin
  })

  return {
    id: plan.part.id,
    type: plan.part.type,
    label: definition.label,
    designator,
    value,
    x,
    y,
    width,
    height,
    column,
    board: plan.board,
    pins,
  }
}

function planColumns(
  leaves: readonly LeafPlan[],
  hasBoards: boolean,
  options: SchematicLayoutOptions
): readonly ColumnPlan[] {
  if (leaves.length === 0) return []

  const maxColumns = Math.max(1, options.maxColumns ?? MAX_COLUMNS)
  const targetColumnHeight = Math.max(120, options.targetColumnHeight ?? TARGET_COLUMN_HEIGHT)
  const totalHeight =
    leaves.reduce((sum, leaf) => sum + leaf.height, 0) + NODE_GAP * Math.max(0, leaves.length - 1)
  const columnCount = Math.max(1, Math.min(maxColumns, Math.ceil(totalHeight / targetColumnHeight)))
  const targetHeight = totalHeight / columnCount
  const groups: LeafPlan[][] = []
  let current: LeafPlan[] = []
  let currentHeight = 0

  for (const leaf of leaves) {
    const addition = current.length === 0 ? leaf.height : NODE_GAP + leaf.height
    if (
      current.length > 0 &&
      currentHeight + addition > targetHeight &&
      groups.length < columnCount - 1
    ) {
      groups.push(current)
      current = []
      currentHeight = 0
    }
    current.push(leaf)
    currentHeight += current.length === 1 ? leaf.height : NODE_GAP + leaf.height
  }
  if (current.length > 0) groups.push(current)

  const columns: ColumnPlan[] = []
  let x = hasBoards ? BOARD_X + BOARD_WIDTH + COLUMN_GAP : 56
  for (const group of groups) {
    const width = group.reduce((max, leaf) => Math.max(max, leaf.width), LEAF_WIDTH)
    columns.push({ x, width, leaves: group })
    x += width + COLUMN_GAP
  }
  return columns
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

function wireForNet(
  netId: number,
  anchors: readonly SchematicPin[],
  channels: readonly number[],
  netIndex: number,
  color: string,
  kind: WireKind
): SchematicWire | null {
  if (anchors.length < 2) return null

  const ordered = [...anchors].sort((a, b) => a.x - b.x || a.y - b.y)
  const hub = ordered[0]
  if (hub === undefined) return null

  const laneOffset = ((netIndex % CHANNEL_LANES) - Math.floor(CHANNEL_LANES / 2)) * CHANNEL_STEP
  const channelX = (channel: number): number =>
    (channels[channel] ?? channels[0] ?? hub.x) + laneOffset
  const hubChannel = channelX(hub.channel)
  const busY = 12 + (netIndex % BUS_LANES) * BUS_STEP
  const paths: Point[][] = []
  const junctions: Point[] = []
  const junctionKeys = new Set<string>()

  const addJunction = (point: Point): void => {
    const key = `${point.x}:${point.y}`
    if (junctionKeys.has(key)) return
    junctionKeys.add(key)
    junctions.push(point)
  }

  for (const pin of ordered.slice(1)) {
    const targetChannel = channelX(pin.channel)
    let path: Point[]

    const hubPoint = { x: hub.x, y: hub.y }
    const pinPoint = { x: pin.x, y: pin.y }
    if (pin.channel === hub.channel) {
      path =
        hub.y === pin.y
          ? [hubPoint, pinPoint]
          : [hubPoint, { x: targetChannel, y: hub.y }, { x: targetChannel, y: pin.y }, pinPoint]
      if (anchors.length > 2) addJunction({ x: targetChannel, y: pin.y })
    } else {
      path = [
        hubPoint,
        { x: hubChannel, y: hub.y },
        { x: hubChannel, y: busY },
        { x: targetChannel, y: busY },
        { x: targetChannel, y: pin.y },
        pinPoint,
      ]
      if (anchors.length > 2) addJunction({ x: targetChannel, y: busY })
    }
    paths.push(dedupe(path))
  }

  return { netId, kind, color, paths, junctions }
}

/** First wire on a net carries the user's chosen colour into the schematic. */
function colorByNet(
  document: CircuitDocument,
  netlist: ReturnType<typeof buildNetlist>
): ReadonlyMap<number, string> {
  const colors = new Map<number, string>()
  for (const wire of document.wires) {
    const netId = netIdOfPin(netlist, wire.from.partId, wire.from.pinId)
    if (netId !== undefined && !colors.has(netId)) colors.set(netId, wire.color)
  }
  return colors
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
  const ranks = rankLeaves(leafParts, boards, netlist)
  const depths = leafDepths(leafParts, boards, anchors)
  const leaves = sortLeaves(leafParts, ranks, depths)
  const designators = options.designators ?? referenceDesignators(drawable)
  const colors = colorByNet(document, netlist)

  const leafPlans: LeafPlan[] = leaves.map((leaf) => {
    const plan: PinPlan = {
      part: leaf,
      board: false,
      pins: planPins(leaf, anchors, netlist),
    }
    return {
      part: leaf,
      pins: plan.pins,
      width: leafWidth(plan),
      height: nodeHeight(plan.pins.length, options),
    }
  })
  const columns = planColumns(leafPlans, boards.length > 0, options)

  const nodes: SchematicPartNode[] = []
  let boardY = TOP
  for (const board of boards) {
    const plan: PinPlan = {
      part: board,
      board: true,
      pins: planPins(board, anchors, netlist),
    }
    const node = buildNode(
      plan,
      BOARD_X,
      boardY,
      BOARD_WIDTH,
      -1,
      options,
      designators.get(board.id) ?? 'U?',
      partValue(board)
    )
    nodes.push(node)
    boardY += node.height + NODE_GAP
  }

  for (const [columnIndex, column] of columns.entries()) {
    let y = TOP
    for (const leaf of column.leaves) {
      const node = buildNode(
        { part: leaf.part, board: false, pins: leaf.pins },
        column.x,
        y,
        column.width,
        columnIndex,
        options,
        designators.get(leaf.part.id) ?? '?',
        partValue(leaf.part)
      )
      nodes.push(node)
      y += node.height + NODE_GAP
    }
  }

  const channelBases =
    columns.length === 0 ? [] : columns.map((column) => column.x - COLUMN_GAP / 2)

  const pinLookup = new Map<string, SchematicPin>()
  for (const node of nodes) {
    for (const pin of node.pins) pinLookup.set(pin.key, pin)
  }

  const wires: SchematicWire[] = []
  let netIndex = 0
  for (const [netId, keys] of anchors) {
    const netPins = keys
      .map((key) => pinLookup.get(key))
      .filter((pin): pin is SchematicPin => pin !== undefined)
    if (netPins.length < 2) continue

    const kind = wireKindFor(netPins.map((pin) => pin.kind))
    const color = colors.get(netId) ?? wireColorFor(kind)
    const wire = wireForNet(netId, netPins, channelBases, netIndex, color, kind)
    if (wire !== null) wires.push(wire)
    netIndex += 1
  }
  wires.sort((a, b) => a.netId - b.netId)

  const right = nodes.reduce(
    (max, node) => Math.max(max, node.x + node.width + (node.board ? COLUMN_GAP : 0)),
    0
  )
  const bottom = nodes.reduce((max, node) => Math.max(max, node.y + node.height), 0)
  const left = nodes.reduce((min, node) => Math.min(min, node.x), Number.POSITIVE_INFINITY)

  return {
    nodes,
    wires,
    netLabels: [],
    width: Math.max(560, right + 56, Number.isFinite(left) ? left + 560 : 560),
    height: Math.max(320, bottom + 62, TOP + 224),
  }
}

interface LayoutBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

function layoutBounds(layout: SchematicLayout): LayoutBounds | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const include = (x: number, y: number): void => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  for (const node of layout.nodes) {
    include(node.x, node.y)
    include(node.x + node.width, node.y + node.height)
    for (const pin of node.pins) include(pin.x, pin.y)
  }
  for (const wire of layout.wires) {
    for (const path of wire.paths) {
      for (const point of path) include(point.x, point.y)
    }
    for (const point of wire.junctions) include(point.x, point.y)
  }
  for (const label of layout.netLabels) include(label.x, label.y)

  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

function translateLayout(
  layout: SchematicLayout,
  dx: number,
  dy: number,
  width: number,
  height: number
): SchematicLayout {
  return {
    nodes: layout.nodes.map((node) => ({
      ...node,
      x: node.x + dx,
      y: node.y + dy,
      pins: node.pins.map((pin) => ({ ...pin, x: pin.x + dx, y: pin.y + dy })),
    })),
    wires: layout.wires.map((wire) => ({
      ...wire,
      paths: wire.paths.map((path) => path.map((point) => ({ x: point.x + dx, y: point.y + dy }))),
      junctions: wire.junctions.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    })),
    netLabels: layout.netLabels.map((label) => ({ ...label, x: label.x + dx, y: label.y + dy })),
    width,
    height,
  }
}

function compactLayout(layout: SchematicLayout, padding = PAGE_PADDING): SchematicLayout {
  const bounds = layoutBounds(layout)
  if (bounds === null) return layout
  return translateLayout(
    layout,
    padding - bounds.minX,
    padding - bounds.minY,
    Math.max(1, bounds.maxX - bounds.minX + padding * 2),
    Math.max(1, bounds.maxY - bounds.minY + padding * 2)
  )
}

function pageCapacity(
  paperSize: SchematicPaper,
  minScale: number
): { readonly width: number; readonly height: number } {
  const paper = PAPER_PRESETS[paperSize]
  const availableWidth = paper.width - SHEET_MARGIN * 2
  const availableHeight = paper.height - SHEET_MARGIN * 2 - TITLE_BLOCK_HEIGHT
  return {
    width: availableWidth / minScale,
    height: availableHeight / minScale,
  }
}

function partIdOfKey(key: string): string {
  return key.slice(0, key.indexOf(':'))
}

function connectedGroups(
  anchors: ReadonlyMap<number, string[]>,
  drawable: readonly PartInstance[]
): readonly PartInstance[][] {
  const partsById = new Map(drawable.map((part) => [part.id, part]))
  const parent = new Map<string, string>(drawable.map((part) => [part.id, part.id]))

  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root) ?? root
    let current = id
    while (current !== root) {
      const next = parent.get(current) ?? root
      parent.set(current, root)
      current = next
    }
    return root
  }

  const union = (a: string, b: string): void => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent.set(rootB, rootA)
  }

  for (const keys of anchors.values()) {
    const ids = [...new Set(keys.map(partIdOfKey))].filter((id) => partsById.has(id))
    const first = ids[0]
    if (first === undefined) continue
    for (const id of ids) union(first, id)
  }

  const groups = new Map<string, PartInstance[]>()
  for (const part of drawable) {
    const root = find(part.id)
    const group = groups.get(root)
    if (group === undefined) groups.set(root, [part])
    else group.push(part)
  }
  return [...groups.values()]
}

function groupDocument(
  document: CircuitDocument,
  parts: readonly PartInstance[],
  skipped: readonly PartInstance[]
): CircuitDocument {
  const included = new Set([...parts, ...skipped].map((part) => part.id))
  return {
    version: document.version,
    parts: [...parts, ...skipped],
    wires: document.wires.filter(
      (wire) => included.has(wire.from.partId) && included.has(wire.to.partId)
    ),
  }
}

function packLayouts(
  layouts: readonly SchematicLayout[],
  capacity: { readonly width: number; readonly height: number }
): SchematicLayout[] {
  const packWidth = capacity.width - PAGE_PADDING * 2
  const packHeight = capacity.height - PAGE_PADDING * 2
  const pages: SchematicLayout[] = []
  let placements: { layout: SchematicLayout; x: number; y: number }[] = []
  let x = PAGE_PADDING
  let y = PAGE_PADDING
  let rowHeight = 0

  const flush = (): void => {
    if (placements.length === 0) return
    const nodes: SchematicPartNode[] = []
    const wires: SchematicWire[] = []
    const netLabels: SchematicNetLabel[] = []
    for (const placement of placements) {
      const moved = translateLayout(
        placement.layout,
        placement.x,
        placement.y,
        capacity.width,
        capacity.height
      )
      nodes.push(...moved.nodes)
      wires.push(...moved.wires)
      netLabels.push(...moved.netLabels)
    }
    pages.push({ nodes, wires, netLabels, width: capacity.width, height: capacity.height })
    placements = []
  }

  for (const layout of layouts) {
    if (layout.width > packWidth || layout.height > packHeight) continue
    if (x > PAGE_PADDING && x + layout.width > PAGE_PADDING + packWidth) {
      x = PAGE_PADDING
      y += rowHeight + GROUP_GAP
      rowHeight = 0
    }
    if (y + layout.height > PAGE_PADDING + packHeight) {
      flush()
      x = PAGE_PADDING
      y = PAGE_PADDING
      rowHeight = 0
    }
    placements.push({ layout, x, y })
    x += layout.width + GROUP_GAP
    rowHeight = Math.max(rowHeight, layout.height)
  }
  flush()
  return pages
}

function netLabelNames(layout: SchematicLayout): ReadonlyMap<number, string> {
  const labelsByNet = new Map<number, Set<string>>()
  for (const node of layout.nodes) {
    for (const pin of node.pins) {
      if (pin.netId === null) continue
      const labels = labelsByNet.get(pin.netId)
      if (labels === undefined) labelsByNet.set(pin.netId, new Set([pin.label]))
      else labels.add(pin.label)
    }
  }

  const preferred = ['GND', '5V', '3V3', 'VIN', 'VCC', '+5V', '+3V3']
  const names = new Map<number, string>()
  for (const [netId, labels] of labelsByNet) {
    const match = preferred.find((candidate) => labels.has(candidate))
    if (match !== undefined) {
      names.set(netId, match)
    } else if (labels.size === 1) {
      names.set(netId, [...labels][0] ?? `N${netId}`)
    } else {
      names.set(netId, `N${netId}`)
    }
  }
  return names
}

function tileLayout(
  layout: SchematicLayout,
  capacity: { readonly width: number; readonly height: number }
): SchematicLayout[] {
  const tileWidth = capacity.width - PAGE_PADDING * 2
  const tileHeight = capacity.height - PAGE_PADDING * 2
  const xBands = Math.max(1, Math.ceil(layout.width / tileWidth))
  const yBands = Math.max(1, Math.ceil(layout.height / tileHeight))
  const buckets: SchematicPartNode[][] = Array.from({ length: xBands * yBands }, () => [])

  for (const node of layout.nodes) {
    const column = Math.min(
      xBands - 1,
      Math.max(0, Math.floor((node.x + node.width / 2) / tileWidth))
    )
    const row = Math.min(
      yBands - 1,
      Math.max(0, Math.floor((node.y + node.height / 2) / tileHeight))
    )
    buckets[row * xBands + column]?.push(node)
  }

  const tiles: { bx: number; by: number; nodes: SchematicPartNode[] }[] = []
  for (let by = 0; by < yBands; by += 1) {
    for (let bx = 0; bx < xBands; bx += 1) {
      const nodes = buckets[by * xBands + bx]
      if (nodes !== undefined && nodes.length > 0) tiles.push({ bx, by, nodes })
    }
  }

  const netPages = new Map<number, Set<number>>()
  tiles.forEach((tile, pageIndex) => {
    for (const node of tile.nodes) {
      for (const pin of node.pins) {
        if (pin.netId === null) continue
        const pages = netPages.get(pin.netId)
        if (pages === undefined) netPages.set(pin.netId, new Set([pageIndex]))
        else pages.add(pageIndex)
      }
    }
  })
  const names = netLabelNames(layout)

  return tiles.map((tile) => {
    const includedNets = new Set<number>()
    for (const node of tile.nodes) {
      for (const pin of node.pins) {
        if (pin.netId !== null) includedNets.add(pin.netId)
      }
    }
    const spanning = new Set(
      [...includedNets].filter((netId) => (netPages.get(netId)?.size ?? 0) > 1)
    )
    const wires = layout.wires.filter(
      (wire) => includedNets.has(wire.netId) && !spanning.has(wire.netId)
    )
    const netLabels: SchematicNetLabel[] = []
    for (const node of tile.nodes) {
      for (const pin of node.pins) {
        if (pin.netId === null || !spanning.has(pin.netId)) continue
        const left = pin.side === 'left'
        netLabels.push({
          netId: pin.netId,
          label: names.get(pin.netId) ?? `N${pin.netId}`,
          x: pin.x + (left ? -4 : 4),
          y: pin.y + 3,
          anchor: left ? 'end' : 'start',
        })
      }
    }

    return translateLayout(
      { nodes: tile.nodes, wires, netLabels, width: capacity.width, height: capacity.height },
      PAGE_PADDING - tile.bx * tileWidth,
      PAGE_PADDING - tile.by * tileHeight,
      capacity.width,
      capacity.height
    )
  })
}

/**
 * Groups electrically connected components, lays each group out as a compact
 * block, and adds sheets whenever the blocks no longer fit the selected paper.
 * A group that is itself larger than a sheet is split into readable tiles; nets
 * crossing those tiles become labelled off-page connections.
 */
export function layoutSchematicPages(
  document: CircuitDocument,
  options: SchematicPaginationOptions
): SchematicPagination {
  const minScale = options.minScale ?? DEFAULT_MIN_PAGE_SCALE
  const capacity = pageCapacity(options.paperSize, minScale)
  const packWidth = capacity.width - PAGE_PADDING * 2
  const packHeight = capacity.height - PAGE_PADDING * 2
  const netlist = buildNetlist(document)
  const anchors = anchorKeysByNet(document, netlist)
  const drawable = document.parts.filter((part) => !SKIPPED_TYPES.has(part.type))
  if (drawable.length === 0) {
    return { pages: [layoutSchematic(document, options)], pageCount: 1 }
  }

  const skipped = document.parts.filter((part) => SKIPPED_TYPES.has(part.type))
  const designators = referenceDesignators(drawable)
  const normal: SchematicLayout[] = []
  const oversized: SchematicLayout[] = []

  for (const group of connectedGroups(anchors, drawable)) {
    const hasBoard = group.some((part) => BOARD_TYPES.has(part.type))
    const boardRoom = hasBoard ? BOARD_WIDTH + COLUMN_GAP : 0
    const maxColumns = Math.max(
      1,
      Math.min(
        MAX_COLUMNS,
        Math.floor((packWidth - boardRoom + COLUMN_GAP) / (LEAF_WIDTH + COLUMN_GAP))
      )
    )
    const compact = compactLayout(
      layoutSchematic(groupDocument(document, group, skipped), {
        ...options,
        designators,
        maxColumns,
        targetColumnHeight: packHeight,
      })
    )
    if (compact.width > packWidth || compact.height > packHeight) oversized.push(compact)
    else normal.push(compact)
  }

  normal.sort((a, b) => b.height - a.height || b.width - a.width)
  const pages = packLayouts(normal, capacity)
  for (const layout of oversized) pages.push(...tileLayout(layout, capacity))
  if (pages.length === 0) pages.push(layoutSchematic(document, options))
  if (pages.length === 1)
    return { pages: [compactLayout(pages[0] ?? layoutSchematic(document, options))], pageCount: 1 }
  return { pages, pageCount: pages.length }
}
