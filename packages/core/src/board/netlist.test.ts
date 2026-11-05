import { expect, it } from 'vitest';

import {
  type Circuit,
  createPartInstance,
  createWire,
} from '../model/circuit';
import { createDefaultPartRegistry } from '../parts/catalog';
import { extractNetlist } from './netlist';

const registry = createDefaultPartRegistry();

function seriesCircuit(): Circuit {
  return {
    schemaVersion: 1,
    id: 'c1',
    name: 'battery-resistor-led',
    board: { id: 'b1', kind: 'full' },
    parts: [
      createPartInstance('resistor', { id: 'r1', position: { x: 0, y: 5 } }),
      createPartInstance('led', { id: 'd1', position: { x: 4, y: 5 } }),
      createPartInstance('battery', { id: 'bt1', position: { x: 8, y: 5 } }),
    ],
    wires: [
      createWire({ kind: 'hole', holeId: 'c9' }, { kind: 'hole', holeId: 'c1' }, { id: 'w1' }),
      createWire({ kind: 'hole', holeId: 'c11' }, { kind: 'hole', holeId: 'c7' }, { id: 'w2' }),
    ],
  };
}

it('extracts the expected 3-net netlist for battery -> resistor -> LED', () => {
  const netlist = extractNetlist(seriesCircuit(), registry);

  expect(netlist.nets).toHaveLength(3);
  expect(netlist.floatingPins).toEqual([]);

  const netOf = (partId: string, pinId: string) =>
    netlist.nets.find((net) => net.pins.some((pin) => pin.partId === partId && pin.pinId === pinId));

  expect(netOf('bt1', 'positive')?.pins).toEqual([
    { partId: 'bt1', pinId: 'positive' },
    { partId: 'r1', pinId: 'a' },
  ]);
  expect(netOf('r1', 'b')?.pins).toEqual([
    { partId: 'd1', pinId: 'anode' },
    { partId: 'r1', pinId: 'b' },
  ]);

  const ground = netOf('bt1', 'negative');
  expect(ground?.isGround).toBe(true);
  expect(ground?.name).toBe('GND');
  expect(ground?.pins).toEqual([
    { partId: 'bt1', pinId: 'negative' },
    { partId: 'd1', pinId: 'cathode' },
  ]);
});

it('is deterministic regardless of wire order', () => {
  const forward = extractNetlist(seriesCircuit(), registry);
  const reversed = seriesCircuit();
  reversed.wires.reverse();
  const backward = extractNetlist(reversed, registry);

  expect(backward.nets.map((net) => [net.name, net.pins])).toEqual(
    forward.nets.map((net) => [net.name, net.pins]),
  );
});

it('reports floating pins for unconnected parts', () => {
  const circuit: Circuit = {
    schemaVersion: 1,
    id: 'c2',
    name: 'dangling',
    board: { id: 'b2', kind: 'half' },
    parts: [createPartInstance('resistor', { id: 'r1', position: { x: 0, y: 3 } })],
    wires: [],
  };
  const netlist = extractNetlist(circuit, registry);
  expect(netlist.floatingPins).toEqual([
    { partId: 'r1', pinId: 'a' },
    { partId: 'r1', pinId: 'b' },
  ]);
});

it('unions two pins that land in the same hole without crashing', () => {
  const circuit: Circuit = {
    schemaVersion: 1,
    id: 'c3',
    name: 'same-hole',
    board: { id: 'b3', kind: 'full' },
    parts: [
      createPartInstance('resistor', { id: 'r1', position: { x: 0, y: 5 } }),
      createPartInstance('led', { id: 'd1', position: { x: 0, y: 5 } }),
    ],
    wires: [
      createWire({ kind: 'hole', holeId: 'c1' }, { kind: 'hole', holeId: 'c1' }, { id: 'self' }),
    ],
  };
  const netlist = extractNetlist(circuit, registry);
  const shared = netlist.nets.find((net) =>
    net.pins.some((pin) => pin.partId === 'r1' && pin.pinId === 'a'),
  );
  expect(shared?.pins).toContainEqual({ partId: 'd1', pinId: 'anode' });
});

it('throws a clear error for an unknown part', () => {
  const circuit: Circuit = {
    schemaVersion: 1,
    id: 'c4',
    name: 'unknown',
    board: { id: 'b4', kind: 'half' },
    parts: [createPartInstance('mystery', { id: 'x1', position: { x: 0, y: 3 } })],
    wires: [],
  };
  expect(() => extractNetlist(circuit, registry)).toThrow('unknown part "mystery"');
});
