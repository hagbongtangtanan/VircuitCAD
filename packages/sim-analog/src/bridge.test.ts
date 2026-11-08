import {
  createDefaultPartRegistry,
  createEmptyCircuit,
  createPartInstance,
  createWire,
} from '@vircuitcad/core';
import { expect, it } from 'vitest';

import { buildSimulation, solveSimulation } from './bridge';
import type { DiodeDevice } from './devices/nonlinear';

function seriesCircuit() {
  const circuit = createEmptyCircuit({ board: 'full' });
  circuit.parts.push(
    createPartInstance('battery', { id: 'bt1', position: { x: 0, y: 20 }, params: { voltage: 9 } }),
  );
  circuit.parts.push(
    createPartInstance('resistor', {
      id: 'r1',
      position: { x: 0, y: 22 },
      params: { resistance: 220 },
    }),
  );
  circuit.parts.push(
    createPartInstance('led', { id: 'd1', position: { x: 0, y: 24 }, params: { color: 'red' } }),
  );
  circuit.wires.push(
    createWire(
      { kind: 'pin', partId: 'bt1', pinId: 'positive' },
      { kind: 'pin', partId: 'r1', pinId: 'a' },
    ),
    createWire(
      { kind: 'pin', partId: 'r1', pinId: 'b' },
      { kind: 'pin', partId: 'd1', pinId: 'anode' },
    ),
    createWire(
      { kind: 'pin', partId: 'd1', pinId: 'cathode' },
      { kind: 'pin', partId: 'bt1', pinId: 'negative' },
    ),
  );
  return circuit;
}

it('maps a battery-resistor-LED circuit to devices and solves', () => {
  const simulation = buildSimulation(seriesCircuit(), createDefaultPartRegistry());
  expect(simulation.nodeMap.size).toBe(3);
  expect(simulation.system.nodeCount).toBeGreaterThanOrEqual(2);
  expect(simulation.devices).toHaveLength(3);

  const result = solveSimulation(simulation);
  expect(result.converged).toBe(true);

  const led = simulation.deviceByName('d1') as DiodeDevice | undefined;
  expect(led).toBeDefined();
  expect(led?.current).toBeGreaterThan(0.015);
  expect(led?.current).toBeLessThan(0.045);
  expect(led?.burnedOut).toBe(false);
});

it('burns the LED when the resistor is too small', () => {
  const circuit = seriesCircuit();
  const resistor = circuit.parts.find((part) => part.id === 'r1');
  if (resistor) resistor.params.resistance = 5;

  const simulation = buildSimulation(circuit, createDefaultPartRegistry());
  solveSimulation(simulation);
  const led = simulation.deviceByName('d1') as DiodeDevice | undefined;
  expect(led?.burnedOut).toBe(true);
});
