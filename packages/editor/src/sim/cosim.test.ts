import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createDefaultPartRegistry,
  createEmptyCircuit,
  createPartInstance,
  createWire,
} from '@vircuitcad/core';
import { expect, it } from 'vitest';

import { McuCircuit } from './cosim';

const blinkHex = readFileSync(
  fileURLToPath(new URL('../../../../fixtures/hex/blink.hex', import.meta.url)),
  'utf8',
);

function blinkCircuit() {
  const circuit = createEmptyCircuit({ board: 'full' });
  circuit.parts.push(createPartInstance('arduino-uno', { id: 'u1', position: { x: 0, y: 20 } }));
  circuit.parts.push(
    createPartInstance('resistor', { id: 'r1', position: { x: 0, y: 30 }, params: { resistance: 220 } }),
  );
  circuit.parts.push(
    createPartInstance('led', { id: 'd1', position: { x: 0, y: 32 }, params: { color: 'red' } }),
  );
  circuit.wires.push(
    createWire({ kind: 'pin', partId: 'u1', pinId: 'D13' }, { kind: 'pin', partId: 'r1', pinId: 'a' }),
    createWire({ kind: 'pin', partId: 'r1', pinId: 'b' }, { kind: 'pin', partId: 'd1', pinId: 'anode' }),
    createWire({ kind: 'pin', partId: 'd1', pinId: 'cathode' }, { kind: 'pin', partId: 'u1', pinId: 'GND' }),
  );
  return circuit;
}

it('lights the D13 LED on the blink sketch', () => {
  const mcu = new McuCircuit(blinkCircuit(), createDefaultPartRegistry(), blinkHex);

  mcu.runMicros(250_000); // D13 high for the first half-second
  const on = mcu.ledCurrent('d1');

  mcu.runMicros(500_000); // now ~750 ms, D13 low
  const off = mcu.ledCurrent('d1');

  expect(on).toBeGreaterThan(0.005);
  expect(off).toBeLessThan(0.001);
});
