import { expect, it } from 'vitest';

import {
  createDefaultPartRegistry,
  createEmptyCircuit,
  createPartInstance,
  generateBoardGeometry,
} from '@vircuitcad/core';

import { HitTester, buildHitTestScene, type HitTestScene } from './scene-index';

const scene: HitTestScene = {
  pins: [
    { partId: 'p1', pinId: 'a', pinName: 'A', position: { x: 10, y: 10 } },
    { partId: 'p1', pinId: 'b', pinName: 'B', position: { x: 90, y: 10 } },
  ],
  holes: [{ holeId: 'h1', position: { x: 40, y: 40 } }],
  parts: [{ partId: 'p1', rect: { minX: 0, minY: 0, maxX: 100, maxY: 100 } }],
  wires: [{ wireId: 'w1', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] }],
};
const tester = new HitTester(scene);

it('prefers pins over the part body and wires', () => {
  expect(tester.hitTest({ x: 10, y: 10 }, 1)?.kind).toBe('pin');
});

it('prefers the part body over a wire', () => {
  expect(tester.hitTest({ x: 50, y: 50 }, 1)?.kind).toBe('part');
});

it('honours the tolerance', () => {
  expect(tester.hitTest({ x: 12, y: 10 }, 1)?.kind).toBe('part');
  expect(tester.hitTest({ x: 12, y: 10 }, 3)?.kind).toBe('pin');
  expect(tester.hitTest({ x: 500, y: 500 }, 1)).toBeNull();
});

it('returns the nearest candidate within the same priority', () => {
  const hit = tester.hitTest({ x: 12, y: 10 }, 100, ['pin']);
  expect(hit).toMatchObject({ kind: 'pin', pinId: 'a' });
});

it('filters by allowed kinds', () => {
  expect(tester.hitTest({ x: 50, y: 50 }, 1, ['wire'])?.kind).toBe('wire');
  expect(tester.hitTest({ x: 50, y: 50 }, 1, ['hole'])).toBeNull();
  expect(tester.hitTest({ x: 40, y: 40 }, 1, ['hole'])?.kind).toBe('hole');
});

it('builds a scene from a circuit with world coordinates', () => {
  const registry = createDefaultPartRegistry();
  const circuit = createEmptyCircuit({ board: 'full' });
  circuit.parts.push(createPartInstance('resistor', { id: 'r1', position: { x: 0, y: 5 } }));

  const built = buildHitTestScene(circuit, registry, generateBoardGeometry('full'), 20);
  expect(built.pins).toHaveLength(2);
  expect(built.holes).toHaveLength(420);
  expect(built.parts).toHaveLength(1);
  expect(built.pins.find((pin) => pin.pinId === 'a')?.position).toEqual({ x: 0, y: 100 });
});
