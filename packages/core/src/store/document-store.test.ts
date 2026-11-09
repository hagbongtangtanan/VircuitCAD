import { expect, it } from 'vitest';

import { createEmptyCircuit, createPartInstance, sketchOf } from '../model/circuit';
import { DocumentStore } from './document-store';

function storeWithResistor(): DocumentStore {
  const store = new DocumentStore(createEmptyCircuit({ board: 'full' }));
  store.addPart('resistor', { id: 'r1', position: { x: 0, y: 5 } });
  return store;
}

it('adds, moves, rotates and sets params with undo/redo', () => {
  const store = storeWithResistor();
  expect(store.getCircuit().parts).toHaveLength(1);
  expect(store.asPart('r1')?.position).toEqual({ x: 0, y: 5 });

  expect(store.movePart('r1', { x: 3, y: 5 })).toBe(true);
  expect(store.rotatePart('r1', 90)).toBe(true);
  expect(store.setParam('r1', 'resistance', 470)).toBe(true);
  expect(store.asPart('r1')).toMatchObject({
    position: { x: 3, y: 5 },
    rotation: 90,
    params: { resistance: 470 },
  });

  store.undo();
  expect(store.asPart('r1')?.params).toEqual({});
  store.undo();
  expect(store.asPart('r1')?.rotation).toBe(0);
  store.undo();
  expect(store.asPart('r1')?.position).toEqual({ x: 0, y: 5 });

  store.redo();
  store.redo();
  store.redo();
  expect(store.asPart('r1')).toMatchObject({
    position: { x: 3, y: 5 },
    rotation: 90,
    params: { resistance: 470 },
  });
});

it('deletes attached wires when a part is deleted', () => {
  const store = storeWithResistor();
  store.addWire(
    { kind: 'pin', partId: 'r1', pinId: 'a' },
    { kind: 'hole', holeId: 'c5' },
    { id: 'w1' },
  );
  expect(store.getCircuit().wires).toHaveLength(1);

  expect(store.deletePart('r1')).toBe(true);
  expect(store.getCircuit().parts).toHaveLength(0);
  expect(store.getCircuit().wires).toHaveLength(0);

  store.undo();
  expect(store.getCircuit().parts).toHaveLength(1);
  expect(store.getCircuit().wires).toHaveLength(1);
});

it('treats self wires and duplicate wires as no-ops', () => {
  const store = storeWithResistor();
  expect(store.addWire({ kind: 'hole', holeId: 'c1' }, { kind: 'hole', holeId: 'c1' })).toBe(
    undefined,
  );

  expect(
    store.addWire(
      { kind: 'hole', holeId: 'c1' },
      { kind: 'hole', holeId: 'c5' },
      { id: 'w1' },
    ),
  ).toBe('w1');
  // reversed duplicate is still a no-op
  expect(
    store.addWire(
      { kind: 'hole', holeId: 'c5' },
      { kind: 'hole', holeId: 'c1' },
      { id: 'w2' },
    ),
  ).toBe(undefined);

  expect(store.getCircuit().wires).toHaveLength(1);
  expect(store.historySize().undo).toBe(2); // addPart + one wire
});

it('groups a transaction into a single undo entry', () => {
  const store = storeWithResistor();
  const before = store.getCircuit();

  store.transaction('gesture', (draft) => {
    const part = draft.parts[0];
    if (!part) return;
    part.position = { x: 1, y: 5 };
    part.rotation = 90;
  });
  expect(store.historySize().undo).toBe(2);

  store.undo();
  expect(store.getCircuit()).toEqual(before);
});

it('notifies change listeners for autosave until unsubscribed', () => {
  const store = new DocumentStore(createEmptyCircuit());
  const labels: string[] = [];
  const off = store.onChange((event) => labels.push(event.label));

  store.addPart('led', { id: 'd1', position: { x: 0, y: 4 } });
  off();
  store.addPart('battery', { id: 'b1', position: { x: 0, y: 5 } });

  expect(labels).toEqual(['addPart']);
});

it('round-trips a 100-step undo/redo history', () => {
  const store = storeWithResistor();
  const initial = store.getCircuit();

  for (let step = 0; step < 100; step += 1) {
    store.movePart('r1', { x: step % 10, y: 5 });
  }
  const final = store.getCircuit();

  for (let step = 0; step < 100; step += 1) expect(store.undo()).toBe(true);
  expect(store.getCircuit()).toEqual(initial);

  for (let step = 0; step < 100; step += 1) expect(store.redo()).toBe(true);
  expect(store.getCircuit()).toEqual(final);
});

it('moves a wire endpoint and updates its colour', () => {
  const store = storeWithResistor();
  store.addWire({ kind: 'hole', holeId: 'c1' }, { kind: 'hole', holeId: 'c5' }, { id: 'w1' });

  expect(store.moveWireEndpoint('w1', 'to', { kind: 'hole', holeId: 'c9' })).toBe(true);
  expect(store.getCircuit().wires[0]?.to).toEqual({ kind: 'hole', holeId: 'c9' });

  expect(store.setWireColor('w1', '#ef4444')).toBe(true);
  expect(store.getCircuit().wires[0]?.color).toBe('#ef4444');

  store.undo();
  expect(store.getCircuit().wires[0]?.color).toBe('#22c55e');
});

it('edits sketch files', () => {
  const store = new DocumentStore(createEmptyCircuit());
  expect(store.setSketchFile('helper.h', '#pragma once\n')).toBe(true);
  expect(sketchOf(store.getCircuit()).files['helper.h']).toContain('pragma');
  store.undo();
  expect(sketchOf(store.getCircuit()).files['helper.h']).toBeUndefined();
});

it('replaces the circuit and clears history', () => {
  const store = storeWithResistor();
  expect(store.canUndo()).toBe(true);

  store.replace(createEmptyCircuit({ name: 'loaded' }));
  expect(store.getCircuit().name).toBe('loaded');
  expect(store.getCircuit().parts).toHaveLength(0);
  expect(store.canUndo()).toBe(false);
  expect(store.canRedo()).toBe(false);
});

it('ignores commands for unknown parts', () => {
  const store = storeWithResistor();
  expect(store.movePart('missing', { x: 1, y: 1 })).toBe(false);
  expect(store.deletePart('missing')).toBe(false);
  expect(store.historySize().undo).toBe(1);
});

it('produces valid part instances', () => {
  const store = new DocumentStore(createEmptyCircuit());
  store.addPart('led', { position: { x: 1, y: 4 } });
  const [part] = store.getCircuit().parts;
  expect(part).toBeDefined();
  expect(createPartInstance('led').partId).toBe('led');
});
