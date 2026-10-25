import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type JSX } from 'react'
import type Konva from 'konva'
import { Circle, Group, Layer, Line, Path, Rect, Stage, Text, Wedge } from 'react-konva'
import {
  partTypeSchema,
  pinHasWire,
  pinKey,
  type Note,
  type PartType,
  type PinRef,
  type Point,
} from '../../shared/circuit'
import { definitionOf, pinWorldPosition } from '../parts/definitions'
import { PartBody } from '../parts/renderers'
import { NoteNode } from './NoteNode'
import { PIN_ACTIVE_FILL, PIN_FILL, PIN_HOVER_FILL } from '../parts/partColors'
import { useCircuitStore } from '../store/circuitStore'
import { useShallow } from 'zustand/react/shallow'
import { useInteractionStore } from '../store/interactionStore'
import { useSimStore } from '../store/simStore'
import { useThemeStore } from '../store/themeStore'
import { circuitContentBounds, fitViewport, useViewportStore } from '../store/viewportStore'
import { canvasBackground, registerPngCapture } from '../export/pngCapture'
import { PART_DRAG_MIME } from './dnd'
import { pinLabelBoxes, pinLabelsOverlap, type PinLabelBox } from './pinLabels'
import { findPinNear } from './pinHit'
import {
  GRID_SIZE,
  insertWaypoint,
  roundedPolylinePath,
  screenToWorld,
  snapPoint,
  snapWirePoint,
  wireRoute,
  type Size,
} from './geometry'

/** Konva needs concrete colours, so canvas chrome is mirrored from tokens.css. */
const GRID_COLOR = '#10233a'
const GRID_AXIS_COLOR = '#1a3b5d'

/** Every breadboard size is a mounting surface, never an ordinary component. */
const BREADBOARD_TYPES: ReadonlySet<PartType> = new Set<PartType>([
  'breadboard',
  'breadboard-small',
  'breadboard-mini',
])

function refsEqual(a: PinRef | null, b: PinRef | null): boolean {
  return a !== null && b !== null && a.partId === b.partId && a.pinId === b.pinId
}

/** A wire that is being drawn: anchored to a pin with manual bends so far. */
interface WireDraft {
  readonly start: PinRef
  readonly waypoints: readonly Point[]
}

/** Midpoint of the longest wire segment, so the add-bend handle stays clear of bends. */
function addBendAnchor(points: readonly Point[]): Point | null {
  let anchor: Point | null = null
  let longest = -1
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    if (from === undefined || to === undefined) continue
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    if (length > longest) {
      longest = length
      anchor = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    }
  }
  return anchor
}

/** Chooses a grid step that stays legible at the current zoom. */
function gridStepFor(scale: number): number {
  let step = GRID_SIZE
  while (step * scale < 8) {
    step *= 2
  }
  return step
}

interface PinMarkerProps {
  readonly partId: string
  readonly pinId: string
  readonly label: string
  readonly position: Point
  readonly scale: number
  readonly showLabel: boolean
  readonly labelBox: PinLabelBox | null
  readonly pinStyle?: 'header'
  readonly state: 'idle' | 'hovered' | 'active' | 'target'
  readonly connectedColor: string | null
  readonly onHover: (ref: PinRef | null) => void
  readonly onPointerDown: (ref: PinRef, event: KonvaEventObject<MouseEvent>) => void
}

const PIN_TARGET_FILL = '#ffc928'
const PIN_TARGET_RING = '#ffe27a'
const HEADER_PIN_FILL = '#d9b24a'

function PinMarker(props: PinMarkerProps): JSX.Element {
  const ref: PinRef = { partId: props.partId, pinId: props.pinId }
  const header = props.pinStyle === 'header'
  // A wired terminal takes on its wire's colour, including custom palette
  // choices. State colours only apply to pins that are still free.
  const fill =
    props.connectedColor ??
    (props.state === 'active'
      ? PIN_ACTIVE_FILL
      : props.state === 'target'
        ? PIN_TARGET_FILL
        : props.state === 'hovered'
          ? PIN_HOVER_FILL
          : header
            ? HEADER_PIN_FILL
            : PIN_FILL)
  // Pin dots and labels keep a constant on-screen size, like Tinkercad.
  const radius = 4 / props.scale
  const pinSize = 8 / props.scale
  const ringSize = pinSize * (props.state === 'target' ? 3.2 : 2.4)
  const ringStroke =
    props.state === 'active' ? '#ffc928' : props.state === 'target' ? PIN_TARGET_RING : '#6fb3ff'

  return (
    <Group>
      {props.state !== 'idle' &&
        (header ? (
          <Rect
            x={props.position.x - ringSize / 2}
            y={props.position.y - ringSize / 2}
            width={ringSize}
            height={ringSize}
            cornerRadius={0}
            fill={props.state === 'target' ? PIN_TARGET_RING : 'transparent'}
            opacity={props.state === 'target' ? 0.18 : 1}
            stroke={ringStroke}
            strokeWidth={(props.state === 'target' ? 2.5 : 1.5) / props.scale}
            listening={false}
          />
        ) : (
          <Circle
            x={props.position.x}
            y={props.position.y}
            radius={radius * (props.state === 'target' ? 3.4 : 2.6)}
            fill={props.state === 'target' ? PIN_TARGET_RING : 'transparent'}
            opacity={props.state === 'target' ? 0.18 : 1}
            stroke={ringStroke}
            strokeWidth={(props.state === 'target' ? 2.5 : 1.5) / props.scale}
            listening={false}
          />
        ))}
      {header ? (
        <Rect
          x={props.position.x - pinSize / 2}
          y={props.position.y - pinSize / 2}
          width={pinSize}
          height={pinSize}
          cornerRadius={0}
          fill={fill}
          stroke="#6f5418"
          strokeWidth={0.6 / props.scale}
          hitStrokeWidth={10 / props.scale}
          onMouseEnter={() => props.onHover(ref)}
          onMouseLeave={() => props.onHover(null)}
          onMouseDown={(event) => {
            event.cancelBubble = true
            props.onPointerDown(ref, event)
          }}
        />
      ) : (
        <Circle
          x={props.position.x}
          y={props.position.y}
          radius={radius}
          fill={fill}
          hitStrokeWidth={8 / props.scale}
          onMouseEnter={() => props.onHover(ref)}
          onMouseLeave={() => props.onHover(null)}
          onMouseDown={(event) => {
            event.cancelBubble = true
            props.onPointerDown(ref, event)
          }}
        />
      )}
      {(props.showLabel || props.state === 'hovered') && props.labelBox !== null && (
        <Text
          x={props.labelBox.x}
          y={props.labelBox.y}
          width={props.labelBox.width}
          height={props.labelBox.height}
          text={props.label}
          fontSize={header ? props.labelBox.fontSize * 0.82 : props.labelBox.fontSize}
          fontStyle={header ? 'normal' : 'bold'}
          align="center"
          verticalAlign="middle"
          wrap="none"
          fill="#eaf4ff"
          stroke={header ? undefined : '#040b16'}
          strokeWidth={header ? 0 : 2.5 / props.scale}
          fillAfterStrokeEnabled={!header}
          listening={false}
        />
      )}
    </Group>
  )
}

const EMPTY_DIP_BITS: readonly boolean[] = []
const EMPTY_NOTES: readonly Note[] = []

interface PartNodeProps {
  readonly partId: string
  readonly selected: boolean
  readonly routing: boolean
}

function PartNode(props: PartNodeProps): JSX.Element | null {
  const part = useCircuitStore((state) => state.document.parts.find((p) => p.id === props.partId))
  const movePart = useCircuitStore((state) => state.movePart)
  const beginTransientEdit = useCircuitStore((state) => state.beginTransientEdit)
  const commitTransientEdit = useCircuitStore((state) => state.commitTransientEdit)
  const selectParts = useCircuitStore((state) => state.selectParts)
  const brightness = useSimStore((state) => state.ledBrightness[props.partId] ?? 0)
  const pressed = useInteractionStore((state) => state.pressed[props.partId] === true)
  const potPosition = useInteractionStore((state) => state.pots[props.partId] ?? 0.5)
  const switchOn = useInteractionStore((state) => state.switches[props.partId] === true)
  const sensorLevel = useInteractionStore((state) => state.sensors[props.partId] ?? 0.5)
  const dipBits = useInteractionStore((state) => state.dipBits[props.partId] ?? EMPTY_DIP_BITS)
  const press = useInteractionStore((state) => state.press)
  const release = useInteractionStore((state) => state.release)
  const motorSpeed = useSimStore((state) => state.motorSpeed[props.partId] ?? 0)
  const elapsedMs = useSimStore((state) => state.elapsedMs)
  const channels = useSimStore(
    useShallow((state) => {
      const prefix = `${props.partId}:`
      const out: Record<string, number> = {}
      for (const [key, value] of Object.entries(state.ledBrightness)) {
        if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value
      }
      out.light = sensorLevel
      out.speed = motorSpeed
      return out
    })
  )
  const spin = motorSpeed > 0.02 ? ((elapsedMs / 1000) * motorSpeed * 360) % 360 : 0

  if (part === undefined) return null

  const definition = definitionOf(part.type)
  const { width, height } = definition.size

  return (
    <Group
      x={part.position.x + width / 2}
      y={part.position.y + height / 2}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={part.rotation}
      scaleX={part.flipX === true ? -1 : 1}
      scaleY={part.flipY === true ? -1 : 1}
      draggable={!props.routing}
      onDragStart={() => {
        beginTransientEdit()
      }}
      onDragMove={(event) => {
        movePart(part.id, { x: event.target.x() - width / 2, y: event.target.y() - height / 2 })
      }}
      onDragEnd={(event) => {
        const topLeft = { x: event.target.x() - width / 2, y: event.target.y() - height / 2 }
        movePart(part.id, snapPoint(topLeft))
        commitTransientEdit()
      }}
      onMouseDown={(event) => {
        if (event.evt.button !== 0 || props.routing) return
        if (part.type === 'push-button') press(part.id)
        if (part.type === 'slide-switch') useInteractionStore.getState().toggleSwitch(part.id)
      }}
      onMouseUp={() => release(part.id)}
      onMouseLeave={() => release(part.id)}
      onClick={(event) => {
        event.cancelBubble = true
        selectParts([part.id], event.evt.shiftKey)
      }}
    >
      <PartBody
        part={part}
        selected={props.selected}
        brightness={brightness}
        pressed={pressed}
        potPosition={potPosition}
        switchOn={switchOn}
        channels={channels}
        spin={spin}
        dipBits={dipBits}
      />
    </Group>
  )
}

interface PartPinsProps {
  readonly partId: string
  readonly scale: number
  readonly hoveredPin: PinRef | null
  readonly pendingPin: PinRef | null
  readonly targetPin: PinRef | null
  readonly connectedColors: ReadonlyMap<string, string>
  readonly onHoverPin: (ref: PinRef | null) => void
  readonly onPointerDownPin: (ref: PinRef, event: KonvaEventObject<MouseEvent>) => void
}

/**
 * Pin dots and labels live in their own layer above the wires, so a wire cannot
 * steal the click that starts the next connection. Labels stay upright even
 * when the part is rotated, which also keeps them readable.
 */
function PartPins(props: PartPinsProps): JSX.Element | null {
  const part = useCircuitStore((state) =>
    state.document.parts.find((candidate) => candidate.id === props.partId)
  )
  if (part === undefined) return null

  const definition = definitionOf(part.type)
  const labelBoxes = props.scale >= 0.45 ? pinLabelBoxes(part, props.scale) : null
  // Dense headers show a pin's label on hover instead of a wall of tiny text.
  const showLabels =
    definition.pins.length <= 30 && labelBoxes !== null && !pinLabelsOverlap(labelBoxes.values())

  return (
    <>
      {definition.pins.map((pin) => {
        const ref: PinRef = { partId: part.id, pinId: pin.id }
        const state = refsEqual(props.pendingPin, ref)
          ? 'active'
          : refsEqual(props.targetPin, ref)
            ? 'target'
            : refsEqual(props.hoveredPin, ref)
              ? 'hovered'
              : 'idle'
        return (
          <PinMarker
            key={pin.id}
            partId={part.id}
            pinId={pin.id}
            label={pin.label}
            position={pinWorldPosition(part, pin.id)}
            scale={props.scale}
            showLabel={showLabels}
            labelBox={labelBoxes?.get(pin.id) ?? null}
            pinStyle={definition.pinStyle}
            state={state}
            connectedColor={props.connectedColors.get(pinKey(ref)) ?? null}
            onHover={props.onHoverPin}
            onPointerDown={props.onPointerDownPin}
          />
        )
      })}
    </>
  )
}

interface WireNodeProps {
  readonly wireId: string
  readonly scale: number
  readonly routing: boolean
  readonly onAddWaypoint: (wireId: string) => void
}

function WireNode({ wireId, scale, routing, onAddWaypoint }: WireNodeProps): JSX.Element | null {
  const wire = useCircuitStore((state) => state.document.wires.find((w) => w.id === wireId))
  const parts = useCircuitStore((state) => state.document.parts)
  const selected = useCircuitStore((state) => state.selectedWireId === wireId)
  const selectWire = useCircuitStore((state) => state.selectWire)

  if (wire === undefined) return null

  const fromPart = parts.find((part) => part.id === wire.from.partId)
  const toPart = parts.find((part) => part.id === wire.to.partId)
  if (fromPart === undefined || toPart === undefined) return null

  const from = pinWorldPosition(fromPart, wire.from.pinId)
  const to = pinWorldPosition(toPart, wire.to.pinId)
  const route = wireRoute(from, to, wire.waypoints)

  const stroke = selected ? '#ffc928' : wire.color
  const knotRadius = 3 / scale

  return (
    <Group>
      <Path
        data={roundedPolylinePath(route, 9)}
        stroke={stroke}
        strokeWidth={(selected ? 4 : 2.5) / scale}
        hitStrokeWidth={14 / scale}
        lineCap="round"
        lineJoin="round"
        onClick={(event) => {
          if (routing) return
          event.cancelBubble = true
          selectWire(wireId)
        }}
        onDblClick={(event) => {
          if (routing) return
          event.cancelBubble = true
          onAddWaypoint(wireId)
        }}
      />
      {[from, to].map((point, index) => (
        <Circle
          key={`end-${index}`}
          x={point.x}
          y={point.y}
          radius={knotRadius}
          fill={stroke}
          listening={false}
        />
      ))}
      {wire.waypoints.map((point, index) => (
        <Circle
          key={`knot-${index}`}
          x={point.x}
          y={point.y}
          radius={knotRadius}
          fill={stroke}
          stroke="#7da4c9"
          strokeWidth={1 / scale}
          listening={false}
        />
      ))}
    </Group>
  )
}

interface WaypointHandlesProps {
  readonly scale: number
}

function WaypointHandles({ scale }: WaypointHandlesProps): JSX.Element | null {
  const dark = useThemeStore((state) => state.theme === 'dark')
  const handleOutline = dark ? '#040b16' : '#ffffff'
  const wire = useCircuitStore((state) =>
    state.document.wires.find((w) => w.id === state.selectedWireId)
  )
  const wires = useCircuitStore((state) => state.document.wires)
  const parts = useCircuitStore((state) => state.document.parts)
  const setWireEndpoint = useCircuitStore((state) => state.setWireEndpoint)
  const setWireWaypoints = useCircuitStore((state) => state.setWireWaypoints)
  const dragWireWaypoints = useCircuitStore((state) => state.dragWireWaypoints)
  const beginTransientEdit = useCircuitStore((state) => state.beginTransientEdit)
  const commitTransientEdit = useCircuitStore((state) => state.commitTransientEdit)
  const [draggedEnd, setDraggedEnd] = useState<{ end: 'from' | 'to'; point: Point } | null>(null)

  if (wire === undefined) return null

  const fromPart = parts.find((part) => part.id === wire.from.partId)
  const toPart = parts.find((part) => part.id === wire.to.partId)
  if (fromPart === undefined || toPart === undefined) return null

  const from = pinWorldPosition(fromPart, wire.from.pinId)
  const to = pinWorldPosition(toPart, wire.to.pinId)
  const previewFrom = draggedEnd?.end === 'from' ? draggedEnd.point : from
  const previewTo = draggedEnd?.end === 'to' ? draggedEnd.point : to
  const route = wireRoute(previewFrom, previewTo, wire.waypoints)
  const midpoint = addBendAnchor(route)
  const handleSize = 10 / scale
  const snapTarget =
    draggedEnd === null ? null : findPinNear(parts, draggedEnd.point, Math.min(22, 18 / scale))
  const otherEnd = draggedEnd?.end === 'from' ? wire.to : wire.from
  const validTarget =
    snapTarget !== null &&
    !refsEqual(snapTarget.ref, otherEnd) &&
    !pinHasWire(wires, snapTarget.ref, wire.id)
      ? snapTarget
      : null

  return (
    <Group>
      {draggedEnd !== null && (
        <Path
          data={roundedPolylinePath(route, 9)}
          stroke="#6fb3ff"
          strokeWidth={2.5 / scale}
          dash={[6 / scale, 4 / scale]}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      {validTarget !== null && (
        <Circle
          x={validTarget.point.x}
          y={validTarget.point.y}
          radius={7 / scale}
          fill="#ffc928"
          opacity={0.22}
          stroke="#ffe27a"
          strokeWidth={2 / scale}
          listening={false}
        />
      )}
      {wire.waypoints.map((waypoint, index) => (
        <Rect
          key={`waypoint-${index}`}
          x={waypoint.x}
          y={waypoint.y}
          width={handleSize}
          height={handleSize}
          offsetX={handleSize / 2}
          offsetY={handleSize / 2}
          cornerRadius={2 / scale}
          fill="#6fb3ff"
          stroke={handleOutline}
          strokeWidth={1.5 / scale}
          draggable
          onDragStart={() => {
            beginTransientEdit()
          }}
          onDragMove={(event) => {
            const anchor = index === 0 ? from : wire.waypoints[index - 1]
            const raw = { x: event.target.x(), y: event.target.y() }
            const target =
              anchor === undefined ? snapPoint(raw) : snapWirePoint(anchor, raw, !event.evt.ctrlKey)
            event.target.position(target)
            const next = wire.waypoints.map((existing, existingIndex) =>
              existingIndex === index ? target : existing
            )
            dragWireWaypoints(wire.id, next)
          }}
          onDragEnd={(event) => {
            const anchor = index === 0 ? from : wire.waypoints[index - 1]
            const raw = { x: event.target.x(), y: event.target.y() }
            const target =
              anchor === undefined ? snapPoint(raw) : snapWirePoint(anchor, raw, !event.evt.ctrlKey)
            event.target.position(target)
            const next = wire.waypoints.map((existing, existingIndex) =>
              existingIndex === index ? target : existing
            )
            dragWireWaypoints(wire.id, next)
            commitTransientEdit()
          }}
          onDblClick={(event) => {
            event.cancelBubble = true
            setWireWaypoints(
              wire.id,
              wire.waypoints.filter((_, existingIndex) => existingIndex !== index)
            )
          }}
        />
      ))}
      {(
        [
          ['from', previewFrom],
          ['to', previewTo],
        ] as const
      ).map(([end, point]) => (
        <Circle
          key={`endpoint-${end}`}
          x={point.x}
          y={point.y}
          radius={5 / scale}
          fill="#ffc928"
          stroke="#f4f9ff"
          strokeWidth={1.5 / scale}
          draggable
          onDragMove={(event) => {
            setDraggedEnd({ end, point: { x: event.target.x(), y: event.target.y() } })
          }}
          onDragEnd={(event) => {
            const hit = findPinNear(
              parts,
              { x: event.target.x(), y: event.target.y() },
              Math.min(22, 18 / scale)
            )
            const other = end === 'from' ? wire.to : wire.from
            setDraggedEnd(null)
            if (hit !== null && !refsEqual(hit.ref, other)) {
              setWireEndpoint(wire.id, end, hit.ref)
            }
          }}
        />
      ))}
      {midpoint !== null && (
        <Rect
          x={midpoint.x}
          y={midpoint.y}
          width={handleSize}
          height={handleSize}
          offsetX={handleSize / 2}
          offsetY={handleSize / 2}
          cornerRadius={handleSize / 2}
          fill="#2f7df6"
          stroke={handleOutline}
          strokeWidth={1.5 / scale}
          draggable
          onDragEnd={(event) => {
            setWireWaypoints(
              wire.id,
              insertWaypoint(
                from,
                to,
                wire.waypoints,
                snapPoint({ x: event.target.x(), y: event.target.y() })
              )
            )
          }}
        />
      )}
    </Group>
  )
}

export function CircuitCanvas(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const dark = useThemeStore((state) => state.theme === 'dark')
  const gridColor = dark ? GRID_COLOR : '#dbe5ef'
  const gridAxisColor = dark ? GRID_AXIS_COLOR : '#b7c9db'
  const handleOutline = dark ? '#040b16' : '#ffffff'

  const [size, setSize] = useState<Size>({ width: 800, height: 600 })
  const [hoveredPin, setHoveredPin] = useState<PinRef | null>(null)
  const [draft, setDraft] = useState<WireDraft | null>(null)
  const [pointerWorld, setPointerWorld] = useState<Point | null>(null)
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [isCtrlDown, setIsCtrlDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ pointer: Point; offsetX: number; offsetY: number } | null>(null)

  const viewport = useViewportStore((state) => state.viewport)
  const setCanvasSize = useViewportStore((state) => state.setSize)
  const zoomBy = useViewportStore((state) => state.zoomBy)
  const panBy = useViewportStore((state) => state.panBy)

  const parts = useCircuitStore((state) => state.document.parts)
  const wires = useCircuitStore((state) => state.document.wires)
  const notes = useCircuitStore((state) => state.document.notes ?? EMPTY_NOTES)
  const selectedNoteId = useCircuitStore((state) => state.selectedNoteId)
  const connectedColors = useMemo(() => {
    const colors = new Map<string, string>()
    for (const wire of wires) {
      colors.set(pinKey(wire.from), wire.color)
      colors.set(pinKey(wire.to), wire.color)
    }
    return colors
  }, [wires])
  // Breadboards are the mounting surface: their body and holes sit below every
  // component, so a part dropped on top is never hidden by the hole markers.
  const breadboards = parts.filter((part) => BREADBOARD_TYPES.has(part.type))
  const components = parts.filter((part) => !BREADBOARD_TYPES.has(part.type))
  const selectedPartIds = useCircuitStore((state) => state.selectedPartIds)
  const addPart = useCircuitStore((state) => state.addPart)
  const addWire = useCircuitStore((state) => state.addWire)
  const selectParts = useCircuitStore((state) => state.selectParts)
  const selectWire = useCircuitStore((state) => state.selectWire)
  const selectNote = useCircuitStore((state) => state.selectNote)
  const setWireWaypoints = useCircuitStore((state) => state.setWireWaypoints)

  useEffect(() => {
    const element = containerRef.current
    if (element === null) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) return
      const next = {
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      }
      setSize(next)
      setCanvasSize(next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [setCanvasSize])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setIsSpaceDown(true)
      if (event.key === 'Control') setIsCtrlDown(true)
      if (event.key === 'Escape') setDraft(null)
      if (
        draft !== null &&
        (event.key === 'Backspace' || event.key === 'Delete') &&
        draft.waypoints.length > 0
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        setDraft({ ...draft, waypoints: draft.waypoints.slice(0, -1) })
      }
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setIsSpaceDown(false)
      if (event.key === 'Control') setIsCtrlDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [draft])

  const pointerInWorld = useCallback((): Point | null => {
    const stage = stageRef.current
    if (stage === null) return null
    const pointer = stage.getPointerPosition()
    if (pointer === null) return null
    return screenToWorld(pointer, viewport)
  }, [viewport])

  const handleWheel = useCallback(
    (event: KonvaEventObject<WheelEvent>): void => {
      event.evt.preventDefault()
      const pointer = stageRef.current?.getPointerPosition() ?? { x: 0, y: 0 }
      zoomBy(event.evt.deltaY > 0 ? 0.9 : 1.1, pointer)
    },
    [zoomBy]
  )

  const endPan = useCallback((): void => {
    panStart.current = null
    setIsPanning(false)
  }, [])

  // Release the pan even when the pointer leaves the stage mid-drag.
  useEffect(() => {
    const releaseInputs = (): void => {
      endPan()
      setIsCtrlDown(false)
      useInteractionStore.getState().releaseAll()
    }
    window.addEventListener('mouseup', releaseInputs)
    window.addEventListener('blur', releaseInputs)
    return () => {
      window.removeEventListener('mouseup', releaseInputs)
      window.removeEventListener('blur', releaseInputs)
    }
  }, [endPan])

  const handleStageMouseDown = useCallback(
    (event: KonvaEventObject<MouseEvent>): void => {
      const stage = event.target.getStage()
      const isEmptyClick = stage !== null && event.target === stage
      const point = pointerInWorld()

      // While routing, every left press places a manual bend; right click
      // cancels. Panning stays available with Space, middle or right drag once
      // the draft is gone.
      if (draft !== null && !isSpaceDown) {
        if (event.evt.button === 2) {
          event.evt.preventDefault()
          setDraft(null)
          return
        }
        if (event.evt.button === 0) {
          event.evt.preventDefault()
          if (point !== null) {
            const target = findPinNear(parts, point, Math.min(16, 14 / viewport.scale))
            if (target !== null) {
              if (pinHasWire(wires, target.ref) || refsEqual(target.ref, draft.start)) return
              addWire(draft.start, target.ref, draft.waypoints)
              setDraft(null)
              return
            }
            const startPart = parts.find((part) => part.id === draft.start.partId)
            const anchor =
              draft.waypoints[draft.waypoints.length - 1] ??
              (startPart === undefined ? null : pinWorldPosition(startPart, draft.start.pinId))
            if (anchor !== null) {
              setDraft({
                ...draft,
                waypoints: [...draft.waypoints, snapWirePoint(anchor, point, !event.evt.ctrlKey)],
              })
            }
          }
          return
        }
      }

      // Left-dragging the empty canvas pans, which is what most people try
      // first. Middle/right drag and Space+left drag keep working as before.
      const wantsPan =
        event.evt.button === 1 ||
        event.evt.button === 2 ||
        (event.evt.button === 0 && (isSpaceDown || isEmptyClick))

      if (wantsPan) {
        if (isEmptyClick && event.evt.button === 0) {
          selectParts([])
          selectWire(null)
          selectNote(null)
          setDraft(null)
        }
        const pointer = stage?.getPointerPosition()
        if (pointer !== null && pointer !== undefined) {
          panStart.current = { pointer, offsetX: 0, offsetY: 0 }
          setIsPanning(true)
          event.evt.preventDefault()
        }
        return
      }
    },
    [
      addWire,
      draft,
      isSpaceDown,
      parts,
      pointerInWorld,
      selectNote,
      selectParts,
      selectWire,
      viewport.scale,
      wires,
    ]
  )

  const handleStageMouseMove = useCallback((): void => {
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition() ?? null
    const panning = panStart.current
    if (pointer !== null && panning !== null) {
      panBy(pointer.x - panning.pointer.x, pointer.y - panning.pointer.y)
      panStart.current = { ...panning, pointer }
      return
    }
    setPointerWorld(pointerInWorld())
  }, [panBy, pointerInWorld])

  const handleAddWaypoint = useCallback(
    (wireId: string): void => {
      const point = pointerInWorld()
      if (point === null) return
      const { document } = useCircuitStore.getState()
      const wire = document.wires.find((entry) => entry.id === wireId)
      if (wire === undefined) return
      const fromPart = document.parts.find((part) => part.id === wire.from.partId)
      const toPart = document.parts.find((part) => part.id === wire.to.partId)
      if (fromPart === undefined || toPart === undefined) return
      setWireWaypoints(
        wireId,
        insertWaypoint(
          pinWorldPosition(fromPart, wire.from.pinId),
          pinWorldPosition(toPart, wire.to.pinId),
          wire.waypoints,
          snapPoint(point)
        )
      )
    },
    [pointerInWorld, setWireWaypoints]
  )

  const handlePointerDownPin = useCallback(
    (ref: PinRef, event: KonvaEventObject<MouseEvent>): void => {
      if (event.evt.button !== 0) return
      setHoveredPin(ref)
      const existingWire = wires.find(
        (wire) => refsEqual(wire.from, ref) || refsEqual(wire.to, ref)
      )
      if (draft === null) {
        selectParts([])
        if (existingWire !== undefined) {
          selectWire(existingWire.id)
          return
        }
        selectWire(null)
        setDraft({ start: ref, waypoints: [] })
        return
      }
      if (refsEqual(draft.start, ref)) {
        setDraft(null)
        return
      }
      // A terminal already has its one wire; ignore a second connection.
      if (pinHasWire(wires, ref)) return
      addWire(draft.start, ref, draft.waypoints)
      setDraft(null)
    },
    [addWire, draft, selectParts, selectWire, wires]
  )

  const draftStart = useMemo(() => {
    if (draft === null) return null
    const part = parts.find((candidate) => candidate.id === draft.start.partId)
    return part === undefined ? null : pinWorldPosition(part, draft.start.pinId)
  }, [draft, parts])

  const snapTarget = useMemo(() => {
    if (draft === null || pointerWorld === null) return null
    const hit = findPinNear(parts, pointerWorld, Math.min(16, 14 / viewport.scale))
    if (hit === null || refsEqual(hit.ref, draft.start) || pinHasWire(wires, hit.ref)) {
      return null
    }
    return hit
  }, [draft, parts, pointerWorld, viewport.scale, wires])

  const previewRoute = useMemo(() => {
    if (draft === null || draftStart === null) return null
    const anchor = draft.waypoints[draft.waypoints.length - 1] ?? draftStart
    const end =
      snapTarget?.point ??
      (pointerWorld === null ? null : snapWirePoint(anchor, pointerWorld, !isCtrlDown))
    if (end === null) return null
    return wireRoute(draftStart, end, draft.waypoints)
  }, [draft, draftStart, isCtrlDown, pointerWorld, snapTarget])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault()
      const parsed = partTypeSchema.safeParse(event.dataTransfer.getData(PART_DRAG_MIME))
      if (!parsed.success) return
      const type: PartType = parsed.data
      const rect = event.currentTarget.getBoundingClientRect()
      const dropped = screenToWorld(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        viewport
      )
      const definition = definitionOf(type)
      addPart(type, {
        x: dropped.x - definition.size.width / 2,
        y: dropped.y - definition.size.height / 2,
      })
    },
    [addPart, viewport]
  )

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const capturePng = useCallback(async (): Promise<string | null> => {
    const stage = stageRef.current
    const bounds = circuitContentBounds()
    if (stage === null || bounds === null) return null

    const viewportState = useViewportStore.getState()
    const selection = useCircuitStore.getState()
    const previousSelection = {
      partIds: selection.selectedPartIds,
      wireId: selection.selectedWireId,
    }

    useViewportStore.getState().setViewport(fitViewport(viewportState.size, bounds))
    useCircuitStore.setState({ selectedPartIds: [], selectedWireId: null })

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    try {
      const source = stage.toCanvas({ pixelRatio: 2 })
      const output = document.createElement('canvas')
      output.width = source.width
      output.height = source.height
      const context = output.getContext('2d')
      if (context === null) return null

      context.fillStyle = canvasBackground()
      context.fillRect(0, 0, output.width, output.height)
      context.drawImage(source, 0, 0)
      return output.toDataURL('image/png')
    } finally {
      useViewportStore.getState().setViewport(viewportState.viewport)
      useCircuitStore.setState({
        selectedPartIds: previousSelection.partIds,
        selectedWireId: previousSelection.wireId,
      })
    }
  }, [])

  useEffect(() => registerPngCapture(capturePng), [capturePng])

  const grid = useMemo(() => {
    const topLeft = screenToWorld({ x: 0, y: 0 }, viewport)
    const bottomRight = screenToWorld({ x: size.width, y: size.height }, viewport)
    const step = gridStepFor(viewport.scale)
    const vertical: number[] = []
    const horizontal: number[] = []

    const startX = Math.floor(topLeft.x / step) * step
    for (let x = startX; x <= bottomRight.x; x += step) vertical.push(x)
    const startY = Math.floor(topLeft.y / step) * step
    for (let y = startY; y <= bottomRight.y; y += step) horizontal.push(y)

    return {
      vertical,
      horizontal,
      step,
      top: topLeft.y,
      bottom: bottomRight.y,
      left: topLeft.x,
      right: bottomRight.x,
    }
  }, [size.height, size.width, viewport])

  return (
    <div
      className={[
        'circuit-canvas',
        isSpaceDown ? 'is-pannable' : '',
        isPanning ? 'is-panning' : '',
        draft !== null ? 'is-routing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      ref={containerRef}
      title="Press a pin to start a wire · Click to place bends · Click a pin to finish · Esc cancels"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onContextMenu={(event) => event.preventDefault()}
      data-testid="circuit-canvas"
      data-note-count={notes.length}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={endPan}
      >
        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          listening={false}
        >
          {grid.vertical.map((x) => (
            <Line
              key={`v-${x}`}
              points={[x, grid.top, x, grid.bottom]}
              stroke={x === 0 ? gridAxisColor : gridColor}
              strokeWidth={1 / viewport.scale}
            />
          ))}
          {grid.horizontal.map((y) => (
            <Line
              key={`h-${y}`}
              points={[grid.left, y, grid.right, y]}
              stroke={y === 0 ? gridAxisColor : gridColor}
              strokeWidth={1 / viewport.scale}
            />
          ))}
        </Layer>

        {/* Breadboard bodies form the mounting surface. */}
        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          {breadboards.map((part) => (
            <PartNode
              key={part.id}
              partId={part.id}
              selected={selectedPartIds.includes(part.id)}
              routing={draft !== null}
            />
          ))}
        </Layer>

        {/* Holes stay below the components, so a part lies on top of the board
            instead of appearing underneath its pin holes. */}
        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          {breadboards.map((part) => (
            <PartPins
              key={part.id}
              partId={part.id}
              scale={viewport.scale}
              hoveredPin={hoveredPin}
              pendingPin={draft?.start ?? null}
              targetPin={snapTarget?.ref ?? null}
              connectedColors={connectedColors}
              onHoverPin={setHoveredPin}
              onPointerDownPin={handlePointerDownPin}
            />
          ))}
        </Layer>

        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          {components.map((part) => (
            <PartNode
              key={part.id}
              partId={part.id}
              selected={selectedPartIds.includes(part.id)}
              routing={draft !== null}
            />
          ))}
        </Layer>

        {/* Wires are drawn above the parts, like Tinkercad, so a connection is
            never hidden behind the board it plugs into. */}
        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          {wires.map((wire) => (
            <WireNode
              key={wire.id}
              wireId={wire.id}
              scale={viewport.scale}
              routing={draft !== null}
              onAddWaypoint={handleAddWaypoint}
            />
          ))}
        </Layer>

        {/* Component pins sit above the wires: their dots stay clickable even
            when a wire ends on them, and their labels are never covered. */}
        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          {components.map((part) => (
            <PartPins
              key={part.id}
              partId={part.id}
              scale={viewport.scale}
              hoveredPin={hoveredPin}
              pendingPin={draft?.start ?? null}
              targetPin={snapTarget?.ref ?? null}
              connectedColors={connectedColors}
              onHoverPin={setHoveredPin}
              onPointerDownPin={handlePointerDownPin}
            />
          ))}
        </Layer>

        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          listening={draft === null}
        >
          {notes.map((note) => (
            <NoteNode
              key={note.id}
              note={note}
              selected={selectedNoteId === note.id}
              routing={draft !== null}
              scale={viewport.scale}
            />
          ))}
        </Layer>

        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          <WaypointHandles scale={viewport.scale} />
          {previewRoute !== null && draft !== null && (
            <>
              <Path
                data={roundedPolylinePath(previewRoute, 9)}
                stroke="#ffc928"
                strokeWidth={(snapTarget === null ? 2 : 2.5) / viewport.scale}
                dash={[7 / viewport.scale, 5 / viewport.scale]}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
              {draft.waypoints.map((waypoint, index) => (
                <Circle
                  key={`draft-bend-${index}`}
                  x={waypoint.x}
                  y={waypoint.y}
                  radius={3.5 / viewport.scale}
                  fill="#ffc928"
                  stroke={handleOutline}
                  strokeWidth={1 / viewport.scale}
                  listening={false}
                />
              ))}
              <Circle
                x={snapTarget?.point.x ?? pointerWorld?.x ?? 0}
                y={snapTarget?.point.y ?? pointerWorld?.y ?? 0}
                radius={(snapTarget === null ? 4 : 6) / viewport.scale}
                fill="#ffc928"
                listening={false}
              />
            </>
          )}
          {useSimStore.getState().status === 'running' &&
            useCircuitStore
              .getState()
              .document.parts.filter((part) => part.type.startsWith('ultrasonic-'))
              .map((part) => {
                const definition = definitionOf(part.type)
                return (
                  <Group
                    key={`range-${part.id}`}
                    x={part.position.x + definition.size.width / 2}
                    y={part.position.y + definition.size.height / 2}
                    rotation={part.rotation}
                    listening={false}
                  >
                    <Wedge
                      x={0}
                      y={0}
                      radius={1500}
                      angle={30}
                      rotation={-105}
                      fill="rgba(255, 201, 40, 0.12)"
                      stroke="rgba(255, 201, 40, 0.42)"
                      strokeWidth={1}
                      listening={false}
                    />
                  </Group>
                )
              })}
        </Layer>
      </Stage>
    </div>
  )
}
