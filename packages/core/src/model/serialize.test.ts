import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { extractNetlist } from '../board/netlist';
import { createDefaultPartRegistry } from '../parts/catalog';
import { createEmptyCircuit, createPartInstance } from './circuit';
import {
  type Migration,
  deserializeCircuit,
  runMigrations,
  serializeCircuit,
} from './serialize';

it('round-trips a circuit through serialize/deserialize', () => {
  const circuit = createEmptyCircuit({ name: 'Round trip', board: 'half' });
  circuit.parts.push(createPartInstance('resistor', { id: 'r1', position: { x: 2, y: 4 } }));

  const restored = deserializeCircuit(serializeCircuit(circuit));
  expect(restored).toEqual(circuit);
});

it('migrates the v1 fixture to v2 and extracts the expected netlist', () => {
  const path = fileURLToPath(new URL('../../../../fixtures/vcad/v1/led-series.vcad', import.meta.url));
  const circuit = deserializeCircuit(readFileSync(path, 'utf8'));

  expect(circuit.schemaVersion).toBe(2);
  expect(circuit.mode).toBe('text');
  expect(circuit.blocks).toBeUndefined();
  expect(circuit.parts).toHaveLength(3);

  const netlist = extractNetlist(circuit, createDefaultPartRegistry());
  expect(netlist.nets).toHaveLength(3);
  expect(netlist.nets.some((net) => net.isGround)).toBe(true);
});

it('loads the v2 blocks fixture and preserves the workspace', () => {
  const path = fileURLToPath(
    new URL('../../../../fixtures/vcad/v2/blocks-blink.vcad', import.meta.url),
  );
  const circuit = deserializeCircuit(readFileSync(path, 'utf8'));

  expect(circuit.schemaVersion).toBe(2);
  expect(circuit.mode).toBe('blocks');
  expect(circuit.blocks?.blocks).toHaveLength(2);
});

it('round-trips a blocks-mode project', () => {
  const circuit = createEmptyCircuit({ name: 'Blocks', mode: 'blocks' });
  circuit.blocks = { blocks: [{ type: 'arduino_loop', id: 'b1' }] };

  const restored = deserializeCircuit(serializeCircuit(circuit));
  expect(restored).toEqual(circuit);
});

it('rejects a document newer than the supported version', () => {
  expect(() => deserializeCircuit(JSON.stringify({ schemaVersion: 3 }))).toThrow(
    /newer than supported/,
  );
});

it('runs a migration chain from v1 to v3', () => {
  const migrations: Migration[] = [
    { from: 1, to: 2, migrate: (doc) => ({ ...(doc as object), schemaVersion: 2, added: true }) },
    { from: 2, to: 3, migrate: (doc) => ({ ...(doc as object), schemaVersion: 3, chained: true }) },
  ];

  const result = runMigrations({ schemaVersion: 1, name: 'x' }, migrations, 3) as Record<
    string,
    unknown
  >;
  expect(result).toMatchObject({ schemaVersion: 3, added: true, chained: true });
});

it('errors on a missing migration and on a migration cycle', () => {
  expect(() => runMigrations({ schemaVersion: 1 }, [], 2)).toThrow(
    /no migration from schemaVersion 1/,
  );
  expect(() =>
    runMigrations({ schemaVersion: 1 }, [{ from: 1, to: 1, migrate: (doc) => doc }], 2),
  ).toThrow(/migration cycle/);
});
