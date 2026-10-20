import type { PartInstance, PinRef, Point, Wire } from '../../shared/circuit'
import { definitionOf, pinWorldPosition } from '../parts/definitions'

export interface PinHit {
  readonly ref: PinRef
  readonly point: Point
  readonly distance: number
}

/**
 * Finds the closest pin within `radius` world units. Used for snap targets and
 * endpoint drops: hit-testing geometry keeps every socket clickable even when a
 * wire or a handle is drawn above it.
 */
export function findPinNear(
  parts: readonly PartInstance[],
  point: Point,
  radius: number
): PinHit | null {
  let best: PinHit | null = null

  for (const part of parts) {
    for (const pin of definitionOf(part.type).pins) {
      const world = pinWorldPosition(part, pin.id)
      const distance = Math.hypot(world.x - point.x, world.y - point.y)
      if (distance > radius) continue
      if (best === null || distance < best.distance) {
        best = { ref: { partId: part.id, pinId: pin.id }, point: world, distance }
      }
    }
  }

  return best
}

/** Endpoint of `wire` closest to `point`, used as the source of a branch. */
export function nearestWirePin(
  wire: Wire,
  parts: readonly PartInstance[],
  point: Point
): PinRef | null {
  const fromPart = parts.find((part) => part.id === wire.from.partId)
  const toPart = parts.find((part) => part.id === wire.to.partId)
  if (fromPart === undefined || toPart === undefined) return null

  const from = pinWorldPosition(fromPart, wire.from.pinId)
  const to = pinWorldPosition(toPart, wire.to.pinId)
  const fromDistance = Math.hypot(from.x - point.x, from.y - point.y)
  const toDistance = Math.hypot(to.x - point.x, to.y - point.y)
  return fromDistance <= toDistance ? wire.from : wire.to
}
