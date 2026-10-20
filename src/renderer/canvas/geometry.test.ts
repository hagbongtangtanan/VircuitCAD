import { describe, expect, it } from 'vitest'
import {
  GRID_SIZE,
  insertWaypoint,
  orthogonalRoute,
  pruneSpikes,
  panBy,
  polylineLength,
  polylineMidpoint,
  rotateOffset,
  roundedPolylinePath,
  screenToWorld,
  snapPoint,
  snapToGrid,
  worldToScreen,
  zoomAtPointer,
  type Viewport,
} from './geometry'

describe('snapToGrid', () => {
  it('rounds to the nearest grid line', () => {
    expect(snapToGrid(0)).toBe(0)
    expect(snapToGrid(4)).toBe(0)
    expect(snapToGrid(6)).toBe(10)
    expect(snapToGrid(14.9)).toBe(10)
    expect(snapToGrid(15)).toBe(20)
  })

  it('never returns negative zero', () => {
    expect(Object.is(snapToGrid(-4), 0)).toBe(true)
    expect(Object.is(snapToGrid(-0.2), 0)).toBe(true)
  })

  it('handles negative values symmetrically', () => {
    expect(snapToGrid(-6)).toBe(-10)
    expect(snapToGrid(-14.9)).toBe(-10)
    expect(snapToGrid(-15)).toBe(-20)
  })

  it('honours a custom grid and passes through non-positive grids unchanged', () => {
    expect(snapToGrid(7, 5)).toBe(5)
    expect(snapToGrid(7, 0)).toBe(7)
  })

  it('snaps both axes of a point', () => {
    expect(snapPoint({ x: 23, y: -8 })).toEqual({ x: 20, y: -10 })
  })

  it('defaults to the shared grid size', () => {
    expect(GRID_SIZE).toBe(10)
    expect(snapToGrid(11)).toBe(snapToGrid(11, GRID_SIZE))
  })
})

describe('rotateOffset', () => {
  const size = { width: 40, height: 40 }

  it('is the identity at 0 degrees', () => {
    expect(rotateOffset({ x: 10, y: 0 }, 0, size)).toEqual({ x: 10, y: 0 })
  })

  it('turns offsets exactly a quarter turn about the centre', () => {
    expect(rotateOffset({ x: 10, y: 0 }, 90, size)).toEqual({ x: 40, y: 10 })
    expect(rotateOffset({ x: 0, y: 10 }, 90, size)).toEqual({ x: 30, y: 0 })
  })

  it('turns offsets a half turn', () => {
    expect(rotateOffset({ x: 10, y: 0 }, 180, size)).toEqual({ x: 30, y: 40 })
  })

  it('turns offsets three quarters of a turn', () => {
    expect(rotateOffset({ x: 10, y: 0 }, 270, size)).toEqual({ x: 0, y: 30 })
  })

  it('four quarter turns return to the original offset', () => {
    const once = rotateOffset({ x: 7, y: 3 }, 90, size)
    const twice = rotateOffset(once, 90, size)
    const thrice = rotateOffset(twice, 90, size)
    const full = rotateOffset(thrice, 90, size)
    expect(full).toEqual({ x: 7, y: 3 })
  })
})

describe('viewport transforms', () => {
  const viewport: Viewport = { scale: 2, offsetX: 30, offsetY: -10 }

  it('round trips between world and screen space', () => {
    const world = { x: 12.5, y: -6.25 }
    const roundTripped = screenToWorld(worldToScreen(world, viewport), viewport)
    expect(roundTripped.x).toBeCloseTo(world.x, 10)
    expect(roundTripped.y).toBeCloseTo(world.y, 10)
  })

  it('keeps the world point under the pointer fixed while zooming', () => {
    const pointer = { x: 400, y: 250 }
    const before = screenToWorld(pointer, viewport)
    const zoomed = zoomAtPointer(viewport, pointer, 3)
    const after = screenToWorld(pointer, zoomed)

    expect(zoomed.scale).toBe(3)
    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
  })

  it('clamps zoom to the allowed range', () => {
    expect(zoomAtPointer(viewport, { x: 0, y: 0 }, 100).scale).toBe(4)
    expect(zoomAtPointer(viewport, { x: 0, y: 0 }, 0.01).scale).toBe(0.25)
  })

  it('translates the offset when panning', () => {
    expect(panBy(viewport, 5, -5)).toEqual({ scale: 2, offsetX: 35, offsetY: -15 })
  })
})

describe('orthogonalRoute', () => {
  it('keeps an already axis-aligned route untouched', () => {
    const route = orthogonalRoute({ x: 0, y: 0 }, { x: 50, y: 0 })
    expect(route).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ])
  })

  it('inserts a single elbow for a diagonal leg', () => {
    const route = orthogonalRoute({ x: 0, y: 0 }, { x: 50, y: 30 })
    expect(route).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 30 },
    ])
  })

  it('produces only horizontal and vertical segments through waypoints', () => {
    const route = orthogonalRoute({ x: 0, y: 0 }, { x: 100, y: 100 }, [
      { x: 40, y: 20 },
      { x: 80, y: 60 },
    ])

    for (let index = 1; index < route.length; index += 1) {
      const a = route[index - 1]
      const b = route[index]
      if (a === undefined || b === undefined) continue
      const axisAligned = a.x === b.x || a.y === b.y
      expect(axisAligned).toBe(true)
    }
  })

  it('starts and ends on the requested endpoints', () => {
    const from = { x: 5, y: 5 }
    const to = { x: 95, y: 45 }
    const route = orthogonalRoute(from, to, [{ x: 50, y: 25 }])
    expect(route[0]).toEqual(from)
    expect(route[route.length - 1]).toEqual(to)
  })
})

describe('polyline helpers', () => {
  it('measures total length including elbows', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 40 },
      ])
    ).toBe(70)
  })

  it('finds the midpoint by arc length, not index', () => {
    const midpoint = polylineMidpoint([
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 20 },
    ])
    expect(midpoint).toEqual({ x: 50, y: 0 })
  })
})

describe('roundedPolylinePath', () => {
  it('rounds an interior elbow instead of drawing a hard corner', () => {
    const path = roundedPolylinePath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(path.startsWith('M 0 0')).toBe(true)
    expect(path).toContain('Q 100 0')
    expect(path.endsWith('L 100 100')).toBe(true)
  })

  it('keeps the endpoints unchanged and clamps the radius on short segments', () => {
    const path = roundedPolylinePath(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 40 },
      ],
      9
    )
    expect(path).toContain('M 0 0')
    expect(path).toContain('L 2 0')
    expect(path).toContain('Q 4 0 4 2')
  })

  it('returns a plain move command for a single point', () => {
    expect(roundedPolylinePath([{ x: 5, y: 6 }])).toBe('M 5 6')
    expect(roundedPolylinePath([])).toBe('')
  })
})

describe('insertWaypoint', () => {
  it('inserts a bend on the segment closest to the pointer', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 200, y: 100 }
    const corners = [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ]
    const next = insertWaypoint(from, to, corners, { x: 0, y: 50 })
    expect(next[0]).toEqual({ x: 0, y: 50 })
    expect(next).toHaveLength(3)
  })

  it('appends when the closest segment is the last one', () => {
    const next = insertWaypoint({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ x: 40, y: 0 }], {
      x: 90,
      y: 0,
    })
    expect(next).toEqual([
      { x: 40, y: 0 },
      { x: 90, y: 0 },
    ])
  })
})

describe('pruneSpikes', () => {
  it('removes a bend that the route doubles back over', () => {
    const from = { x: 630, y: 180 }
    const to = { x: 180, y: 320 }
    const next = pruneSpikes(
      from,
      to,
      [
        { x: 630, y: 520 },
        { x: 480, y: 450 },
        { x: 180, y: 520 },
      ],
      1
    )
    expect(next).toEqual([
      { x: 630, y: 520 },
      { x: 480, y: 450 },
    ])
  })

  it('keeps ordinary corners', () => {
    const waypoints = [
      { x: 180, y: 520 },
      { x: 630, y: 520 },
    ]
    expect(pruneSpikes({ x: 180, y: 320 }, { x: 630, y: 180 }, waypoints)).toEqual(waypoints)
  })
})
