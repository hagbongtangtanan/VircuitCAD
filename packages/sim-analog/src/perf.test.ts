import {
  createDefaultPartRegistry,
  createEmptyCircuit,
  createPartInstance,
  createWire,
} from '@vircuitcad/core';
import { expect, it } from 'vitest';

import { buildSimulation, solveSimulation } from './bridge';

function largeCircuit(resistorCount: number, duplicateWires: number) {
  const circuit = createEmptyCircuit({ board: 'full' });
  circuit.parts.push(
    createPartInstance('battery', { id: 'bt1', position: { x: 0, y: 0 }, params: { voltage: 9 } }),
  );
  for (let index = 0; index < resistorCount; index += 1) {
    circuit.parts.push(
      createPartInstance('resistor', {
        id: `r${index}`,
        position: { x: 0, y: index + 1 },
        params: { resistance: 220 },
      }),
    );
  }
  circuit.wires.push(
    createWire(
      { kind: 'pin', partId: 'bt1', pinId: 'positive' },
      { kind: 'pin', partId: 'r0', pinId: 'a' },
    ),
  );
  for (let index = 0; index < resistorCount - 1; index += 1) {
    circuit.wires.push(
      createWire(
        { kind: 'pin', partId: `r${index}`, pinId: 'b' },
        { kind: 'pin', partId: `r${index + 1}`, pinId: 'a' },
      ),
    );
  }
  circuit.wires.push(
    createWire(
      { kind: 'pin', partId: `r${resistorCount - 1}`, pinId: 'b' },
      { kind: 'pin', partId: 'bt1', pinId: 'negative' },
    ),
  );
  for (let index = 0; index < duplicateWires; index += 1) {
    circuit.wires.push(
      createWire(
        { kind: 'pin', partId: 'bt1', pinId: 'positive' },
        { kind: 'pin', partId: 'r0', pinId: 'a' },
      ),
    );
  }
  return circuit;
}

it(
  'solves a 100-part / 300-wire circuit within the per-solve budget',
  { tags: ['slow'], timeout: 15_000 },
  () => {
    const circuit = largeCircuit(100, 199);
    expect(circuit.parts.length).toBeGreaterThanOrEqual(100);
    expect(circuit.wires.length).toBe(300);

    const simulation = buildSimulation(circuit, createDefaultPartRegistry());
    const runs = 100;
    const start = Date.now();
    let converged = false;
    for (let index = 0; index < runs; index += 1) {
      converged = solveSimulation(simulation).converged;
    }
    const perSolveMs = (Date.now() - start) / runs;

    expect(converged).toBe(true);
    expect(perSolveMs).toBeLessThan(50);
  },
);
