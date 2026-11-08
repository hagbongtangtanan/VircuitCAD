import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createEmptyCircuit,
  createPartInstance,
  createWire,
  serializeCircuit,
  type Circuit,
} from '../../packages/core/src/index.ts';

function wire(partA: string, pinA: string, partB: string, pinB: string) {
  return createWire(
    { kind: 'pin', partId: partA, pinId: pinA },
    { kind: 'pin', partId: partB, pinId: pinB },
  );
}

function ledResistor(): Circuit {
  const circuit = createEmptyCircuit({ name: 'LED + resistor' });
  circuit.parts.push(
    createPartInstance('battery', { id: 'bt1', position: { x: 0, y: 20 }, params: { voltage: 9 } }),
    createPartInstance('resistor', {
      id: 'r1',
      position: { x: 0, y: 22 },
      params: { resistance: 220 },
    }),
    createPartInstance('led', { id: 'd1', position: { x: 0, y: 24 }, params: { color: 'red' } }),
  );
  circuit.wires.push(
    wire('bt1', 'positive', 'r1', 'a'),
    wire('r1', 'b', 'd1', 'anode'),
    wire('d1', 'cathode', 'bt1', 'negative'),
  );
  return circuit;
}

function voltageDivider(): Circuit {
  const circuit = createEmptyCircuit({ name: 'Voltage divider' });
  circuit.parts.push(
    createPartInstance('battery', { id: 'bt1', position: { x: 0, y: 20 }, params: { voltage: 9 } }),
    createPartInstance('resistor', {
      id: 'r1',
      position: { x: 0, y: 22 },
      params: { resistance: 1000 },
    }),
    createPartInstance('resistor', {
      id: 'r2',
      position: { x: 0, y: 24 },
      params: { resistance: 1000 },
    }),
    createPartInstance('multimeter', {
      id: 'm1',
      position: { x: 0, y: 26 },
      params: { mode: 'V' },
    }),
  );
  circuit.wires.push(
    wire('bt1', 'positive', 'r1', 'a'),
    wire('r1', 'b', 'r2', 'a'),
    wire('r1', 'b', 'm1', 'probe+'),
    wire('r2', 'b', 'bt1', 'negative'),
    wire('m1', 'probe-', 'r2', 'b'),
  );
  return circuit;
}

function rcCharge(): Circuit {
  const circuit = createEmptyCircuit({ name: 'RC charge' });
  circuit.parts.push(
    createPartInstance('power-supply', {
      id: 'ps1',
      position: { x: 0, y: 20 },
      params: { voltage: 5 },
    }),
    createPartInstance('resistor', {
      id: 'r1',
      position: { x: 0, y: 22 },
      params: { resistance: 1000 },
    }),
    createPartInstance('capacitor', {
      id: 'c1',
      position: { x: 0, y: 24 },
      params: { capacitance: 1e-6 },
    }),
  );
  circuit.wires.push(
    wire('ps1', 'positive', 'r1', 'a'),
    wire('r1', 'b', 'c1', 'a'),
    wire('c1', 'b', 'ps1', 'negative'),
  );
  return circuit;
}

function switchLed(): Circuit {
  const circuit = createEmptyCircuit({ name: 'Switch + LED' });
  circuit.parts.push(
    createPartInstance('battery-pack', {
      id: 'pack1',
      position: { x: 0, y: 20 },
      params: { voltage: 4.5 },
    }),
    createPartInstance('slide-switch', {
      id: 'sw1',
      position: { x: 0, y: 22 },
      params: { closed: true },
    }),
    createPartInstance('resistor', {
      id: 'r1',
      position: { x: 0, y: 24 },
      params: { resistance: 100 },
    }),
    createPartInstance('led', { id: 'd1', position: { x: 0, y: 26 }, params: { color: 'green' } }),
  );
  circuit.wires.push(
    wire('pack1', 'positive', 'sw1', 'a'),
    wire('sw1', 'b', 'r1', 'a'),
    wire('r1', 'b', 'd1', 'anode'),
    wire('d1', 'cathode', 'pack1', 'negative'),
  );
  return circuit;
}

const examples: Record<string, Circuit> = {
  'led-resistor.vcad': ledResistor(),
  'voltage-divider.vcad': voltageDivider(),
  'rc-charge.vcad': rcCharge(),
  'switch-led.vcad': switchLed(),
};

const dir = fileURLToPath(new URL('../../examples/', import.meta.url));
mkdirSync(dir, { recursive: true });
for (const [name, circuit] of Object.entries(examples)) {
  writeFileSync(`${dir}${name}`, serializeCircuit(circuit));
}
console.log(`wrote ${Object.keys(examples).length} examples to ${dir}`);
