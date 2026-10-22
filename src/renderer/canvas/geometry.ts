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

/**
 * Constrains a wire point to the horizontal or vertical axis through `from`,
 * whichever the pointer is closer to. Holding Ctrl bypasses this, but points
 * still land on the grid. Pins use their exact world position as `from`, so the
 * snapped segment starts cleanly at the terminal.
 */
export function snapWirePoint(from: Point, point: Point, orthographic = true): Point {
  const snapped = snapPoint(point)
  if (!orthographic) return snapped
  return Math.abs(point.x - from.x) >= Math.abs(point.y - from.y)
    ? { x: snapped.x, y: from.y }
    : { x: from.x, y: snapped.y }
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
 * The wire path the user actually drew: direct segments between the two pins
 * and the bends they placed. Unlike an autorouter, no extra elbow is injected,
 * so diagonal runs stay diagonal like a wire in Tinkercad.
 */
export function wireRoute(from: Point, to: Point, waypoints: readonly Point[] = []): Point[] {
  return [from, ...waypoints, to]
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
 * SVG path for a wire polyline with rounded bends. Tinkercad wires can run at
 * any angle, so only the corners are softened. Segments shorter than twice the
 * radius are rounded by half their length, so tiny detours never overshoot into
 * the next segment.
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
 * Inserts a bend on the direct wire segment nearest to `point`, so adding a
 * handle in the middle of a wire does not make it jump to the far end.
 */
export function insertWaypoint(
  from: Point,
  to: Point,
  waypoints: readonly Point[],
  point: Point
): Point[] {
  const stops = wireRoute(from, to, waypoints)
  let bestDistance = Number.POSITIVE_INFINITY
  let bestIndex = waypoints.length

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]
    const next = stops[index]
    if (previous === undefined || next === undefined) continue
    const distance = distanceToSegment(point, previous, next)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index - 1
    }
  }

  return [...waypoints.slice(0, bestIndex), point, ...waypoints.slice(bestIndex)]
}
