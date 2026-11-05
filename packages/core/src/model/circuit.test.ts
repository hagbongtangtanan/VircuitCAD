import { expect, it } from 'vitest';

import { createId } from './ids';
import {
  CircuitSchema,
  SCHEMA_VERSION,
  createEmptyCircuit,
  createPartInstance,
  createWire,
} from './circuit';

it('generates distinct, non-empty ids', () => {
  const ids = new Set(Array.from({ length: 100 }, () => createId()));
  expect(ids.size).toBe(100);
  for (const id of ids) expect(id.length).toBeGreaterThan(0);
});

it('round-trips a circuit through JSON', () => {
  const circuit = createEmptyCircuit({ name: 'LED demo', board: 'half' });
  circuit.parts.push(
    createPartInstance('resistor', {
      position: { x: 3, y: 5 },
      rotation: 90,
      params: { resistance: 220, tolerance: '5%' },
    }),
  );
  circuit.wires.push(
    createWire(
      { kind: 'pin', partId: circuit.parts[0]?.id ?? 'p', pinId: 'a' },
      { kind: 'hole', holeId: 'board-1' },
      { waypoints: [{ x: 1, y: 1 }] },
    ),
  );

  const restored = CircuitSchema.parse(JSON.parse(JSON.stringify(circuit)));
  expect(restored).toEqual(circuit);
  expect(restored.schemaVersion).toBe(SCHEMA_VERSION);
});

it('rejects an unknown schema version', () => {
  const circuit = { ...createEmptyCircuit(), schemaVersion: 2 };
  expect(CircuitSchema.safeParse(circuit).success).toBe(false);
});

it('rejects non-integer coordinates, bad rotation and bad wire colour', () => {
  const base = createEmptyCircuit();
  const part = createPartInstance('resistor');

  expect(
    CircuitSchema.safeParse({ ...base, parts: [{ ...part, position: { x: 1.5, y: 0 } }] }).success,
  ).toBe(false);
  expect(CircuitSchema.safeParse({ ...base, parts: [{ ...part, rotation: 45 }] }).success).toBe(
    false,
  );
  expect(
    CircuitSchema.safeParse({
      ...base,
      wires: [
        {
          id: 'w1',
          from: { kind: 'hole', holeId: 'a' },
          to: { kind: 'hole', holeId: 'b' },
          waypoints: [],
          color: 'green',
        },
      ],
    }).success,
  ).toBe(false);
});
