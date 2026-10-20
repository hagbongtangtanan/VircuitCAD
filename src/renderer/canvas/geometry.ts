import type { Point, Rotation } from '../../shared/circuit'

/** One grid square, in world units. Everything snaps to this. */
export const GRID_SIZE = 10

export interface Size {
  readonly width: number
  readonly height: number
}

/** Pan/zoom state of the canvas: screen = world * scale + offset. */
export interface Viewport {
  readonly scale: number
  readonly offsetX: number
  readonly offsetY: number
}

export const MIN_SCALE = 0.25
export const MAX_SCALE = 4

/**
 * Rounds to the nearest grid line, half away from zero so that `-15` and `15`
 * land on `-20` and `20` rather than the asymmetric result `Math.round` gives.
 * `+ 0` collapses the `-0` that rounding small negatives would otherwise
 * produce, so snapped coordinates compare cleanly.
 */
export function snapToGrid(value: number, grid: number = GRID_SIZE): number {
  if (grid <= 0) return value
  return Math.sign(value) * Math.round(Math.abs(value) / grid) * grid + 0
}

export function snapPoint(point: Point, grid: number = GRID_SIZE): Point {
  return { x: snapToGrid(point.x, grid), y: snapToGrid(point.y, grid) }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Rotates an offset that is expressed relative to a part's top-left origin,
 * about that part's centre. Quarter turns are done with exact integer maths so
 * pins land on exact grid coordinates rather than `Math.cos(Math.PI / 2)` noise.
 */
export function rotateOffset(offset: Point, rotation: Rotation, size: Size): Point {
  const centerX = size.width / 2
  const centerY = size.height / 2
  const dx = offset.x - centerX
  const dy = offset.y - centerY

  switch (rotation) {
    case 0:
      return { x: offset.x, y: offset.y }
    case 90:
      return { x: centerX - dy, y: centerY + dx }
    case 180:
      return { x: centerX - dx, y: centerY - dy }
    case 270:
      return { x: centerX + dy, y: centerY - dx }
  }
}

export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.scale + viewport.offsetX,
    y: point.y * viewport.scale + viewport.offsetY,
  }
}

export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.offsetX) / viewport.scale,
    y: (point.y - viewport.offsetY) / viewport.scale,
  }
}

/** Zooms while keeping the world point under `pointer` pinned to the pointer. */
export function zoomAtPointer(viewport: Viewport, pointer: Point, nextScale: number): Viewport {
  const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
  const world = screenToWorld(pointer, viewport)
  return {
    scale,
    offsetX: pointer.x - world.x * scale,
    offsetY: pointer.y - world.y * scale,
  }
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, offsetX: viewport.offsetX + dx, offsetY: viewport.offsetY + dy }
}

/**
 * Builds an axis-aligned polyline through the given waypoints. Any diagonal leg
 * gets an elbow inserted, so the result is always made of horizontal and
 * vertical segments.
 */
export function orthogonalRoute(from: Point, to: Point, waypoints: readonly Point[] = []): Point[] {
  const stops: Point[] = [from, ...waypoints, to]
  const route: Point[] = [from]
  let previous: Point = from

  for (let index = 1; index < stops.length; index += 1) {
    const next = stops[index]
    if (next === undefined) continue
    if (previous.x !== next.x && previous.y !== next.y) {
      route.push({ x: next.x, y: previous.y })
    }
    route.push(next)
    previous = next
  }

  return route
}

export function polylineLength(points: readonly Point[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    if (a === undefined || b === undefined) continue
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

/** Point at the middle of the polyline's total length; used to anchor wire controls. */
export function polylineMidpoint(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  const half = polylineLength(points) / 2
  let travelled = 0

  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    if (a === undefined || b === undefined) continue
    const segment = Math.hypot(b.x - a.x, b.y - a.y)
    if (travelled + segment >= half) {
      const ratio = segment === 0 ? 0 : (half - travelled) / segment
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio }
    }
    travelled += segment
  }

  const last = points[points.length - 1]
  return last ?? { x: 0, y: 0 }
}

/**
 * SVG path for an orthogonal polyline with rounded elbows, used by wires so a
 * bend reads as a curve instead of a hard right angle. Segments shorter than
 * twice the radius are rounded by half their length, so tiny detours never
 * overshoot into the next segment.
 */
export function roundedPolylinePath(points: readonly Point[], radius = 8): string {
  const first = points[0]
  if (first === undefined) return ''
  if (points.length === 1) return `M ${first.x} ${first.y}`

  const segments: string[] = [`M ${first.x} ${first.y}`]
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const corner = points[index]
    const next = points[index + 1]
    if (previous === undefined || corner === undefined || next === undefined) continue

    const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y)
    const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y)
    if (incoming < 0.01 || outgoing < 0.01) continue

    const r = Math.min(radius, incoming / 2, outgoing / 2)
    const before = {
      x: corner.x + ((previous.x - corner.x) / incoming) * r,
      y: corner.y + ((previous.y - corner.y) / incoming) * r,
    }
    const after = {
      x: corner.x + ((next.x - corner.x) / outgoing) * r,
      y: corner.y + ((next.y - corner.y) / outgoing) * r,
    }
    segments.push(`L ${before.x} ${before.y}`, `Q ${corner.x} ${corner.y} ${after.x} ${after.y}`)
  }

  const last = points[points.length - 1]
  if (last !== undefined) segments.push(`L ${last.x} ${last.y}`)
  return segments.join(' ')
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

/**
 * Inserts a bend at the position along the wire that is closest to `point`,
 * instead of always appending. Appending made a new bend jump to the far end of
 * the route, which is not what dragging a handle in the middle of a wire
 * suggests.
 */
export function insertWaypoint(
  from: Point,
  to: Point,
  waypoints: readonly Point[],
  point: Point
): Point[] {
  const stops: Point[] = [from, ...waypoints, to]
  let bestDistance = Number.POSITIVE_INFINITY
  let bestIndex = waypoints.length

  let previous = from
  for (let index = 1; index < stops.length; index += 1) {
    const next = stops[index]
    if (next === undefined) continue
    const elbow =
      previous.x !== next.x && previous.y !== next.y ? { x: next.x, y: previous.y } : null
    const firstLeg = distanceToSegment(point, previous, elbow ?? next)
    if (firstLeg < bestDistance) {
      bestDistance = firstLeg
      bestIndex = index - 1
    }
    if (elbow !== null) {
      const secondLeg = distanceToSegment(point, elbow, next)
      if (secondLeg < bestDistance) {
        bestDistance = secondLeg
        bestIndex = index - 1
      }
    }
    previous = next
  }

  const inserted = [...waypoints.slice(0, bestIndex), point, ...waypoints.slice(bestIndex)]
  return pruneSpikes(from, to, inserted, bestIndex)
}

function routeVertexIndex(route: readonly Point[], point: Point): number {
  for (let index = 1; index < route.length - 1; index += 1) {
    const vertex = route[index]
    if (vertex !== undefined && vertex.x === point.x && vertex.y === point.y) return index
  }
  return -1
}

/**
 * Drops bends that the new point turned into a there-and-back spike (the wire
 * would double back over itself). The freshly inserted bend is protected so a
 * deliberate drag is never undone.
 */
export function pruneSpikes(
  from: Point,
  to: Point,
  waypoints: readonly Point[],
  protectedIndex = -1
): Point[] {
  const current = [...waypoints]
  let keepIndex = protectedIndex

  for (let guard = 0; guard <= current.length; guard += 1) {
    const route = orthogonalRoute(from, to, current)
    let removed = false

    for (let index = 0; index < current.length; index += 1) {
      if (index === keepIndex) continue
      const waypoint = current[index]
      if (waypoint === undefined) continue
      const vertex = routeVertexIndex(route, waypoint)
      if (vertex < 0) continue
      const before = route[vertex - 1]
      const after = route[vertex + 1]
      if (before === undefined || after === undefined) continue

      const inX = waypoint.x - before.x
      const inY = waypoint.y - before.y
      const outX = after.x - waypoint.x
      const outY = after.y - waypoint.y
      const collinear = inX * outY - inY * outX === 0
      const opposite = inX * outX + inY * outY < 0

      if (collinear && opposite) {
        current.splice(index, 1)
        if (index < keepIndex) keepIndex -= 1
        removed = true
        break
      }
    }

    if (!removed) break
  }

  return current
}
