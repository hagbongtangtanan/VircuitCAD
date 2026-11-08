import {
  createDefaultPartRegistry,
  createEmptyCircuit,
  createPartInstance,
  createWire,
  type Endpoint,
} from '@vircuitcad/core';

import { buildSimulation, solveSimulation } from '../src/bridge';

const resistors = 49;

const circuit = createEmptyCircuit({ name: '50-part ladder' });
circuit.parts.push(
  createPartInstance('battery', { id: 'bt', position: { x: 0, y: 20 }, params: { voltage: 9 } }),
);
for (let index = 0; index < resistors; index += 1) {
  circuit.parts.push(
    createPartInstance('resistor', {
      id: `r${index}`,
      position: { x: 0, y: 22 + index },
      params: { resistance: 100 },
    }),
  );
}

const pin = (partId: string, pinId: string): Endpoint => ({ kind: 'pin', partId, pinId });
circuit.wires.push(createWire(pin('bt', 'positive'), pin('r0', 'a')));
for (let index = 0; index < resistors - 1; index += 1) {
  circuit.wires.push(createWire(pin(`r${index}`, 'b'), pin(`r${index + 1}`, 'a')));
}
circuit.wires.push(createWire(pin(`r${resistors - 1}`, 'b'), pin('bt', 'negative')));

const registry = createDefaultPartRegistry();
const iterations = 100;
const start = Date.now();
for (let index = 0; index < iterations; index += 1) {
  const simulation = buildSimulation(circuit, registry);
  solveSimulation(simulation);
}
const elapsed = Date.now() - start;

console.log(
  `50-part circuit: ${(elapsed / iterations).toFixed(2)} ms/solve over ${iterations} solves`,
);
