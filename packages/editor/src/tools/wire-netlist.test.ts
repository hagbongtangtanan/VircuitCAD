import { expect, it } from 'vitest';

import {
  DocumentStore,
  createDefaultPartRegistry,
  createEmptyCircuit,
  extractNetlist,
} from '@vircuitcad/core';

const registry = createDefaultPartRegistry();

it('builds the expected netlist through store wire commands', () => {
  const store = new DocumentStore(createEmptyCircuit({ board: 'full' }));
  store.addPart('resistor', { id: 'r1', position: { x: 0, y: 5 } });
  store.addPart('led', { id: 'd1', position: { x: 4, y: 5 } });
  store.addPart('battery', { id: 'bt1', position: { x: 8, y: 5 } });

  store.addWire({ kind: 'hole', holeId: 'c9' }, { kind: 'hole', holeId: 'c1' }, { id: 'w1' });
  store.addWire({ kind: 'hole', holeId: 'c11' }, { kind: 'hole', holeId: 'c7' }, { id: 'w2' });

  const netlist = extractNetlist(store.getCircuit(), registry);
  expect(netlist.nets).toHaveLength(3);

  store.undo();
  const afterUndo = extractNetlist(store.getCircuit(), registry);
  expect(afterUndo.nets).toHaveLength(4);
  expect(afterUndo.floatingPins).toHaveLength(2);
});

it('reconnects when a wire endpoint is moved', () => {
  const store = new DocumentStore(createEmptyCircuit({ board: 'full' }));
  store.addPart('battery', { id: 'bt1', position: { x: 0, y: 5 } });
  store.addWire({ kind: 'pin', partId: 'bt1', pinId: 'positive' }, { kind: 'hole', holeId: 'c7' }, { id: 'w1' });

  const before = extractNetlist(store.getCircuit(), registry);
  expect(before.nets).toHaveLength(2);

  store.moveWireEndpoint('w1', 'to', { kind: 'hole', holeId: 'c9' });
  const after = extractNetlist(store.getCircuit(), registry);
  expect(after.nets.flatMap((net) => net.holes)).toContain('c9');
  expect(after.nets.flatMap((net) => net.holes)).not.toContain('c7');
});

it('does not merge crossing wires that share no endpoint', () => {
  const store = new DocumentStore(createEmptyCircuit({ board: 'full' }));
  store.addPart('resistor', { id: 'r1', position: { x: 0, y: 5 } });
  store.addWire({ kind: 'hole', holeId: 'c1' }, { kind: 'hole', holeId: 'c9' }, { id: 'w1' });
  store.addWire({ kind: 'hole', holeId: 'a5' }, { kind: 'hole', holeId: 'e5' }, { id: 'w2' });

  const netlist = extractNetlist(store.getCircuit(), registry);
  const netOf = (pinId: string) =>
    netlist.nets.find((net) => net.pins.some((pin) => pin.partId === 'r1' && pin.pinId === pinId));
  expect(netOf('a')?.name).not.toBe(netOf('b')?.name);
});
