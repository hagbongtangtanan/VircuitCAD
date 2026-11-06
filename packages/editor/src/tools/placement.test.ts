import { expect, it } from 'vitest';

import { createDefaultPartRegistry } from '@vircuitcad/core';

import {
  type HoleLookup,
  boardGridBounds,
  isPlacementValid,
  partGridBounds,
  rectsOverlap,
  snapPartPosition,
} from './placement';
import { generateBoardGeometry } from '@vircuitcad/core';

const registry = createDefaultPartRegistry();
const resistor = registry.require('resistor');
const geometry = generateBoardGeometry('full');
const board = boardGridBounds(geometry);

const holesAt = (points: { x: number; y: number }[]): HoleLookup => ({
  nearest: (from, tolerance) => {
    let best: { x: number; y: number } | null = null;
    let bestDistance = tolerance;
    for (const point of points) {
      const distance = Math.hypot(point.x - from.x, point.y - from.y);
      if (distance <= bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    return best;
  },
});

it('snaps a part so its first pin lands on a hole', () => {
  const result = snapPartPosition(resistor, 0, { x: 4.4, y: 2.7 }, holesAt([{ x: 5, y: 3 }]));
  expect(result.snapped).toBe(true);
  // pin offset is (0,0); pin a lands on (5,3)
  expect(result.position).toEqual({ x: 5, y: 3 });
});

it('falls back to integer rounding when no hole is near', () => {
  const result = snapPartPosition(resistor, 0, { x: 4.4, y: 2.7 }, holesAt([]));
  expect(result.snapped).toBe(false);
  expect(result.position).toEqual({ x: 4, y: 3 });
});

it('computes part bounds and overlap', () => {
  const rect = partGridBounds(resistor, 0, { x: 2, y: 5 });
  expect(rect).toEqual({ minX: 2, minY: 5, maxX: 6, maxY: 5 });
  expect(rectsOverlap(rect, { minX: 4, minY: 5, maxX: 8, maxY: 5 })).toBe(true);
  expect(rectsOverlap(rect, { minX: 7, minY: 5, maxX: 9, maxY: 5 })).toBe(false);
});

it('validates placement against the board and other parts', () => {
  const occupied = [partGridBounds(resistor, 0, { x: 2, y: 5 })];
  expect(isPlacementValid(resistor, 0, { x: 10, y: 5 }, board, occupied)).toBe(true);
  expect(isPlacementValid(resistor, 0, { x: 3, y: 5 }, board, occupied)).toBe(false);
  expect(isPlacementValid(resistor, 0, { x: -1, y: 5 }, board, occupied)).toBe(false);
});
