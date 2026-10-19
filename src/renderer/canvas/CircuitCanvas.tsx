import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type JSX } from 'react'
import type Konva from 'konva'
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import { partTypeSchema, type PartType, type PinRef, type Point } from '../../shared/circuit'
import { definitionOf, pinWorldPosition } from '../parts/definitions'
import { PartBody } from '../parts/renderers'
import { PIN_ACTIVE_FILL, PIN_FILL, PIN_HOVER_FILL } from '../parts/partColors'
import { useCircuitStore } from '../store/circuitStore'
import { PART_DRAG_MIME } from './dnd'
import {
  GRID_SIZE,
  MAX_SCALE,
  MIN_SCALE,
  orthogonalRoute,
  polylineMidpoint,
  screenToWorld,
  snapPoint,
  zoomAtPointer,
  type Size,
  type Viewport,
} from './geometry'

const INITIAL_VIEWPORT: Viewport = { scale: 1, offsetX: 60, offsetY: 60 }

function refsEqual(a: PinRef | null, b: PinRef | null): boolean {
  return a !== null && b !== null && a.partId === b.partId && a.pinId === b.pinId
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
  readonly state: 'idle' | 'hovered' | 'active'
  readonly onHover: (ref: PinRef | null) => void
  readonly onClick: (ref: PinRef) => void
}

function PinMarker(props: PinMarkerProps): JSX.Element {
  const ref: PinRef = { partId: props.partId, pinId: props.pinId }
  const fill =
    props.state === 'active'
      ? PIN_ACTIVE_FILL
      : props.state === 'hovered'
        ? PIN_HOVER_FILL
        : PIN_FILL
  // Pin dots and labels keep a constant on-screen size, like Tinkercad.
  const radius = 3.5 / props.scale
  const labelOffset = 6 / props.scale

  return (
    <Group>
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
        }}
        onClick={(event) => {
          event.cancelBubble = true
          props.onClick(ref)
        }}
      />
      {props.showLabel && (
        <Text
          x={props.position.x + labelOffset}
          y={props.position.y - labelOffset - 4 / props.scale}
          text={props.label}
          fontSize={8 / props.scale}
          fill="#8f98a8"
          listening={false}
        />
      )}
    </Group>
  )
}

interface PartNodeProps {
  readonly partId: string
  readonly selected: boolean
  readonly scale: number
  readonly hoveredPin: PinRef | null
  readonly pendingPin: PinRef | null
  readonly onHoverPin: (ref: PinRef | null) => void
  readonly onClickPin: (ref: PinRef) => void
}

function PartNode(props: PartNodeProps): JSX.Element | null {
  const part = useCircuitStore((state) => state.document.parts.find((p) => p.id === props.partId))
  const movePart = useCircuitStore((state) => state.movePart)
  const beginTransientEdit = useCircuitStore((state) => state.beginTransientEdit)
  const commitTransientEdit = useCircuitStore((state) => state.commitTransientEdit)
  const selectParts = useCircuitStore((state) => state.selectParts)

  if (part === undefined) return null

  const definition = definitionOf(part.type)
  const { width, height } = definition.size
  const showPinLabels = definition.pins.length <= 30 && props.scale >= 0.6

  return (
    <Group
      x={part.position.x + width / 2}
      y={part.position.y + height / 2}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={part.rotation}
      draggable
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
      onClick={(event) => {
        event.cancelBubble = true
        selectParts([part.id], event.evt.shiftKey)
      }}
    >
      <PartBody part={part} selected={props.selected} />
      {definition.pins.map((pin) => {
        const state = refsEqual(props.pendingPin, { partId: part.id, pinId: pin.id })
          ? 'active'
          : refsEqual(props.hoveredPin, { partId: part.id, pinId: pin.id })
            ? 'hovered'
            : 'idle'
        return (
          <PinMarker
            key={pin.id}
            partId={part.id}
            pinId={pin.id}
            label={pin.label}
            position={pin.position}
            scale={props.scale}
            showLabel={showPinLabels}
            state={state}
            onHover={props.onHoverPin}
            onClick={props.onClickPin}
          />
        )
      })}
    </Group>
  )
}

interface WireNodeProps {
  readonly wireId: string
  readonly scale: number
}

function WireNode({ wireId, scale }: WireNodeProps): JSX.Element | null {
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
  const route = orthogonalRoute(from, to, wire.waypoints)
  const flat: number[] = []
  for (const point of route) {
    flat.push(point.x, point.y)
  }

  return (
    <Line
      points={flat}
      stroke={selected ? '#4f9cf9' : wire.color}
      strokeWidth={(selected ? 4 : 2.5) / scale}
      hitStrokeWidth={12 / scale}
      lineCap="round"
      lineJoin="round"
      onClick={(event) => {
        event.cancelBubble = true
        selectWire(wireId)
      }}
    />
  )
}

interface WaypointHandlesProps {
  readonly scale: number
}

function WaypointHandles({ scale }: WaypointHandlesProps): JSX.Element | null {
  const wire = useCircuitStore((state) =>
    state.document.wires.find((w) => w.id === state.selectedWireId)
  )
  const parts = useCircuitStore((state) => state.document.parts)
  const setWireWaypoints = useCircuitStore((state) => state.setWireWaypoints)

  if (wire === undefined) return null

  const fromPart = parts.find((part) => part.id === wire.from.partId)
  const toPart = parts.find((part) => part.id === wire.to.partId)
  if (fromPart === undefined || toPart === undefined) return null

  const route = orthogonalRoute(
    pinWorldPosition(fromPart, wire.from.pinId),
    pinWorldPosition(toPart, wire.to.pinId),
    wire.waypoints
  )
  const midpoint = polylineMidpoint(route)
  const handleSize = 8 / scale

  return (
    <Group>
      {wire.waypoints.map((waypoint, index) => (
        <Rect
          key={`waypoint-${index}`}
          x={waypoint.x}
          y={waypoint.y}
          width={handleSize}
          height={handleSize}
          offsetX={handleSize / 2}
          offsetY={handleSize / 2}
          fill="#f2c14e"
          stroke="#11131a"
          strokeWidth={1 / scale}
          draggable
          onDragEnd={(event) => {
            const next = wire.waypoints.map((existing, existingIndex) =>
              existingIndex === index
                ? snapPoint({ x: event.target.x(), y: event.target.y() })
                : existing
            )
            setWireWaypoints(wire.id, next)
          }}
        />
      ))}
      <Rect
        x={midpoint.x}
        y={midpoint.y}
        width={handleSize}
        height={handleSize}
        offsetX={handleSize / 2}
        offsetY={handleSize / 2}
        fill="#4f9cf9"
        stroke="#11131a"
        strokeWidth={1 / scale}
        draggable
        onDragEnd={(event) => {
          setWireWaypoints(wire.id, [
            ...wire.waypoints,
            snapPoint({ x: event.target.x(), y: event.target.y() }),
          ])
        }}
      />
    </Group>
  )
}

export function CircuitCanvas(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)

  const [size, setSize] = useState<Size>({ width: 800, height: 600 })
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT)
  const [hoveredPin, setHoveredPin] = useState<PinRef | null>(null)
  const [pendingPin, setPendingPin] = useState<PinRef | null>(null)
  const [pointerWorld, setPointerWorld] = useState<Point | null>(null)
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const panStart = useRef<{ pointer: Point; offsetX: number; offsetY: number } | null>(null)

  const parts = useCircuitStore((state) => state.document.parts)
  const wires = useCircuitStore((state) => state.document.wires)
  const selectedPartIds = useCircuitStore((state) => state.selectedPartIds)
  const addPart = useCircuitStore((state) => state.addPart)
  const addWire = useCircuitStore((state) => state.addWire)
  const selectParts = useCircuitStore((state) => state.selectParts)
  const selectWire = useCircuitStore((state) => state.selectWire)

  useEffect(() => {
    const element = containerRef.current
    if (element === null) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) return
      setSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setIsSpaceDown(true)
      if (event.key === 'Escape') setPendingPin(null)
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setIsSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const pointerInWorld = useCallback((): Point | null => {
    const stage = stageRef.current
    if (stage === null) return null
    const pointer = stage.getPointerPosition()
    if (pointer === null) return null
    return screenToWorld(pointer, viewport)
  }, [viewport])

  const handleWheel = useCallback((event: KonvaEventObject<WheelEvent>): void => {
    event.evt.preventDefault()
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition() ?? { x: 0, y: 0 }
    const factor = event.evt.deltaY > 0 ? 0.9 : 1.1
    setViewport((current) =>
      zoomAtPointer(
        current,
        pointer,
        Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor))
      )
    )
  }, [])

  const handleStageMouseDown = useCallback(
    (event: KonvaEventObject<MouseEvent>): void => {
      const stage = event.target.getStage()
      const isEmptyClick = stage !== null && event.target === stage
      if (event.evt.button === 1 || isSpaceDown) {
        const pointer = stage?.getPointerPosition()
        if (pointer !== null && pointer !== undefined) {
          panStart.current = {
            pointer,
            offsetX: viewport.offsetX,
            offsetY: viewport.offsetY,
          }
          event.evt.preventDefault()
        }
        return
      }

      if (isEmptyClick) {
        selectParts([])
        selectWire(null)
        setPendingPin(null)
      }
    },
    [isSpaceDown, selectParts, selectWire, viewport.offsetX, viewport.offsetY]
  )

  const handleStageMouseMove = useCallback((): void => {
    const stage = stageRef.current
    const pointer = stage?.getPointerPosition() ?? null
    const panning = panStart.current
    if (pointer !== null && panning !== null) {
      setViewport((current) => ({
        ...current,
        offsetX: panning.offsetX + (pointer.x - panning.pointer.x),
        offsetY: panning.offsetY + (pointer.y - panning.pointer.y),
      }))
      return
    }
    setPointerWorld(pointerInWorld())
  }, [pointerInWorld])

  const handleStageMouseUp = useCallback((): void => {
    panStart.current = null
  }, [])

  const handleClickPin = useCallback(
    (ref: PinRef): void => {
      if (pendingPin === null) {
        setPendingPin(ref)
        return
      }
      if (refsEqual(pendingPin, ref)) {
        setPendingPin(null)
        return
      }
      addWire(pendingPin, ref)
      setPendingPin(null)
    },
    [addWire, pendingPin]
  )

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

  const pendingPreview = useMemo(() => {
    if (pendingPin === null || pointerWorld === null) return null
    const part = parts.find((candidate) => candidate.id === pendingPin.partId)
    if (part === undefined) return null
    const start = pinWorldPosition(part, pendingPin.pinId)
    const route = orthogonalRoute(start, pointerWorld)
    const flat: number[] = []
    for (const point of route) flat.push(point.x, point.y)
    return flat
  }, [pendingPin, pointerWorld, parts])

  return (
    <div
      className="circuit-canvas"
      ref={containerRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      data-testid="circuit-canvas"
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
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
              stroke={x === 0 ? '#3a4256' : '#232936'}
              strokeWidth={1 / viewport.scale}
            />
          ))}
          {grid.horizontal.map((y) => (
            <Line
              key={`h-${y}`}
              points={[grid.left, y, grid.right, y]}
              stroke={y === 0 ? '#3a4256' : '#232936'}
              strokeWidth={1 / viewport.scale}
            />
          ))}
        </Layer>

        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          {wires.map((wire) => (
            <WireNode key={wire.id} wireId={wire.id} scale={viewport.scale} />
          ))}
          {parts.map((part) => (
            <PartNode
              key={part.id}
              partId={part.id}
              selected={selectedPartIds.includes(part.id)}
              scale={viewport.scale}
              hoveredPin={hoveredPin}
              pendingPin={pendingPin}
              onHoverPin={setHoveredPin}
              onClickPin={handleClickPin}
            />
          ))}
          <WaypointHandles scale={viewport.scale} />
          {pendingPreview !== null && (
            <Line
              points={pendingPreview}
              stroke="#f2c14e"
              strokeWidth={2 / viewport.scale}
              dash={[6 / viewport.scale, 4 / viewport.scale]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
}
