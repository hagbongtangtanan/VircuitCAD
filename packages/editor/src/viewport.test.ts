import { expect, it } from 'vitest';

import { MAX_SCALE, MIN_SCALE, clampScale, panBy, screenToWorld, worldToScreen, zoomAt } from './viewport';

it('round-trips world/screen coordinates', () => {
  const viewport = { scale: 2, x: 30, y: -10 };
  const world = screenToWorld(viewport, 100, 50);
  expect(worldToScreen(viewport, world.x, world.y)).toEqual({ x: 100, y: 50 });
});

it('keeps the point under the cursor fixed while zooming', () => {
  const viewport = { scale: 1, x: 0, y: 0 };
  const before = screenToWorld(viewport, 200, 120);
  const zoomed = zoomAt(viewport, 1.5, 200, 120);
  const after = screenToWorld(zoomed, 200, 120);
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
  expect(zoomed.scale).toBeCloseTo(1.5);
});

it('clamps the scale to the supported range', () => {
  expect(clampScale(0.001)).toBe(MIN_SCALE);
  expect(clampScale(1000)).toBe(MAX_SCALE);
  expect(zoomAt({ scale: 1, x: 0, y: 0 }, 1000, 0, 0).scale).toBe(MAX_SCALE);
});

it('pans by a screen delta', () => {
  expect(panBy({ scale: 1, x: 5, y: 5 }, -2, 3)).toEqual({ scale: 1, x: 3, y: 8 });
});
