import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type JSX } from 'react'
import type Konva from 'konva'
import { Circle, Group, Layer, Line, Path, Rect, Stage, Text } from 'react-konva'
import { partTypeSchema, type PartType, type PinRef, type Point } from '../../shared/circuit'
import { definitionOf, pinWorldPosition } from '../parts/definitions'
import { PartBody } from '../parts/renderers'
import { PIN_ACTIVE_FILL, PIN_FILL, PIN_HOVER_FILL } from '../parts/partColors'
import { useCircuitStore } from '../store/circuitStore'
import { useShallow } from 'zustand/react/shallow'
import { useInteractionStore } from '../store/interactionStore'
import { useSimStore } from '../store/simStore'
import { useViewportStore } from '../store/viewportStore'
import { PART_DRAG_MIME } from './dnd'
import {
  GRID_SIZE,
  insertWaypoint,
  orthogonalRoute,
  polylineMidpoint,
  roundedPolylinePath,
  screenToWorld,
  snapPoint,
  type Size,
} from './geometry'

/** Konva needs concrete colours, so canvas chrome is mirrored from tokens.css. */
const GRID_COLOR = '#151d27'
const GRID_AXIS_COLOR = '#202b3a'

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
  /** Alternate rows avoid collisions where pins are 20 world units apart. */
  readonly labelRow?: 0 | 1
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
  const radius = 4 / props.scale
  const labelOffset = 5 / props.scale

  return (
    <Group>
      {props.state !== 'idle' && (
        <Circle
          x={props.position.x}
          y={props.position.y}
          radius={radius * 2.6}
          fill="transparent"
          stroke={props.state === 'active' ? '#2f7df6' : '#f0a41b'}
          strokeWidth={1.5 / props.scale}
          listening={false}
        />
      )}
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
          y={
            props.position.y -
            labelOffset -
            10 / props.scale -
            (props.labelRow === 1 ? 11 / props.scale : 0)
          }
          text={props.label}
          fontSize={10 / props.scale}
          fontStyle="bold"
          fill="#dce6f4"
          stroke="#0b1017"
          strokeWidth={2.5 / props.scale}
          fillAfterStrokeEnabled
          listening={false}
        />
      )}
    </Group>
  )
}

interface PartNodeProps {
  readonly partId: string
  readonly selected: boolean
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
      onMouseDown={(event) => {
        if (event.evt.button !== 0) return
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
      />
    </Group>
  )
}

interface PartPinsProps {
  readonly partId: string
  readonly scale: number
  readonly hoveredPin: PinRef | null
  readonly pendingPin: PinRef | null
  readonly onHoverPin: (ref: PinRef | null) => void
  readonly onClickPin: (ref: PinRef) => void
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
  const showLabels = definition.pins.length <= 30 && props.scale >= 0.45

  return (
    <>
      {definition.pins.map((pin, index) => {
        const ref: PinRef = { partId: part.id, pinId: pin.id }
        const state = refsEqual(props.pendingPin, ref)
          ? 'active'
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
            labelRow={definition.pins.length > 20 && index % 2 === 1 ? 1 : 0}
            state={state}
            onHover={props.onHoverPin}
            onClick={props.onClickPin}
          />
        )
      })}
    </>
  )
}

interface WireNodeProps {
  readonly wireId: string
  readonly scale: number
  readonly onAddWaypoint: (wireId: string) => void
}

function WireNode({ wireId, scale, onAddWaypoint }: WireNodeProps): JSX.Element | null {
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

  const stroke = selected ? '#4c8dff' : wire.color
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
          event.cancelBubble = true
          selectWire(wireId)
        }}
        onDblClick={(event) => {
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
          stroke="#93a0b4"
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
  const wire = useCircuitStore((state) =>
    state.document.wires.find((w) => w.id === state.selectedWireId)
  )
  const parts = useCircuitStore((state) => state.document.parts)
  const setWireWaypoints = useCircuitStore((state) => state.setWireWaypoints)
  const dragWireWaypoints = useCircuitStore((state) => state.dragWireWaypoints)
  const beginTransientEdit = useCircuitStore((state) => state.beginTransientEdit)
  const commitTransientEdit = useCircuitStore((state) => state.commitTransientEdit)

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
  const handleSize = 10 / scale

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
          cornerRadius={2 / scale}
          fill="#f6c445"
          stroke="#0b1017"
          strokeWidth={1.5 / scale}
          draggable
          onDragStart={() => {
            beginTransientEdit()
          }}
          onDragMove={(event) => {
            const next = wire.waypoints.map((existing, existingIndex) =>
              existingIndex === index ? { x: event.target.x(), y: event.target.y() } : existing
            )
            dragWireWaypoints(wire.id, next)
          }}
          onDragEnd={(event) => {
            const target = snapPoint({ x: event.target.x(), y: event.target.y() })
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
      <Rect
        x={midpoint.x}
        y={midpoint.y}
        width={handleSize}
        height={handleSize}
        offsetX={handleSize / 2}
        offsetY={handleSize / 2}
        cornerRadius={handleSize / 2}
        fill="#4c8dff"
        stroke="#0b1017"
        strokeWidth={1.5 / scale}
        draggable
        onDragEnd={(event) => {
          setWireWaypoints(
            wire.id,
            insertWaypoint(
              pinWorldPosition(fromPart, wire.from.pinId),
              pinWorldPosition(toPart, wire.to.pinId),
              wire.waypoints,
              snapPoint({ x: event.target.x(), y: event.target.y() })
            )
          )
        }}
      />
    </Group>
  )
}

export function CircuitCanvas(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)

  const [size, setSize] = useState<Size>({ width: 800, height: 600 })
  const [hoveredPin, setHoveredPin] = useState<PinRef | null>(null)
  const [pendingPin, setPendingPin] = useState<PinRef | null>(null)
  const [pointerWorld, setPointerWorld] = useState<Point | null>(null)
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ pointer: Point; offsetX: number; offsetY: number } | null>(null)

  const viewport = useViewportStore((state) => state.viewport)
  const setCanvasSize = useViewportStore((state) => state.setSize)
  const zoomBy = useViewportStore((state) => state.zoomBy)
  const panBy = useViewportStore((state) => state.panBy)

  const parts = useCircuitStore((state) => state.document.parts)
  const wires = useCircuitStore((state) => state.document.wires)
  const selectedPartIds = useCircuitStore((state) => state.selectedPartIds)
  const addPart = useCircuitStore((state) => state.addPart)
  const addWire = useCircuitStore((state) => state.addWire)
  const selectParts = useCircuitStore((state) => state.selectParts)
  const selectWire = useCircuitStore((state) => state.selectWire)
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
          setPendingPin(null)
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
    [isSpaceDown, selectParts, selectWire]
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
      className={['circuit-canvas', isSpaceDown ? 'is-pannable' : '', isPanning ? 'is-panning' : '']
        .filter(Boolean)
        .join(' ')}
      ref={containerRef}
      title="Drag empty space to pan · Scroll to zoom · Double-click a wire to bend it"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onContextMenu={(event) => event.preventDefault()}
      data-testid="circuit-canvas"
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
              stroke={x === 0 ? GRID_AXIS_COLOR : GRID_COLOR}
              strokeWidth={1 / viewport.scale}
            />
          ))}
          {grid.horizontal.map((y) => (
            <Line
              key={`h-${y}`}
              points={[grid.left, y, grid.right, y]}
              stroke={y === 0 ? GRID_AXIS_COLOR : GRID_COLOR}
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
          {parts.map((part) => (
            <PartNode key={part.id} partId={part.id} selected={selectedPartIds.includes(part.id)} />
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
              onAddWaypoint={handleAddWaypoint}
            />
          ))}
        </Layer>

        {/* Pins sit above the wires: their dots stay clickable even when a wire
            ends on them, and their labels are never covered. */}
        <Layer
          x={viewport.offsetX}
          y={viewport.offsetY}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          {parts.map((part) => (
            <PartPins
              key={part.id}
              partId={part.id}
              scale={viewport.scale}
              hoveredPin={hoveredPin}
              pendingPin={pendingPin}
              onHoverPin={setHoveredPin}
              onClickPin={handleClickPin}
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
          {pendingPreview !== null && (
            <Line
              points={pendingPreview}
              stroke="#e8a13a"
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
