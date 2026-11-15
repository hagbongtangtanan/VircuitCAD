import { expect, it } from 'vitest';

import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  fitViewport,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from './viewport';

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

it('fits centered content within the target ratio and zoom cap', () => {
  const bounds = { x: -24, y: -24, width: 648, height: 368 };
  const viewport = fitViewport(710, 648, bounds);

  expect(viewport.scale).toBeCloseTo(0.7);
  expect(viewport.scale).toBeLessThanOrEqual(1);
  expect(
    Math.max(bounds.width, bounds.height) * viewport.scale / Math.min(710, 648),
  ).toBeCloseTo(0.7);

  const center = worldToScreen(
    viewport,
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  expect(center.x).toBeCloseTo(355);
  expect(center.y).toBeCloseTo(324);
});

it('caps the initial fit zoom at 100 percent', () => {
  const viewport = fitViewport(1920, 1080, { x: 0, y: 0, width: 648, height: 368 });
  expect(viewport.scale).toBe(1);
});
