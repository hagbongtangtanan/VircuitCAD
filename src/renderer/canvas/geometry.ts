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
