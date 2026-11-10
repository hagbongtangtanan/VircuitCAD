import { expect, it } from 'vitest';

import { setupDevices } from '../context';
import type { Device } from '../device';
import { createRelay } from './relay';
import { createResistor } from './resistor';
import { createVoltageSource } from './voltage-source';
import { MnaSystem } from '../mna';
import { solveOperatingPoint } from '../solver';

function dc(nodeCount: number, devices: Device[]) {
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  const result = solveOperatingPoint(system, devices);
  return { result, voltage: (node: number) => system.nodeVoltage(result.solution, node) };
}

function relayCircuit(coilVoltage: number): Device[] {
  return [
    createVoltageSource('coil-drive', 1, 0, coilVoltage, 0),
    createRelay('k1', 1, 0, 2, 0),
    createVoltageSource('vcc', 3, 0, 5, 0),
    createResistor('load', 3, 2, 1000),
  ];
}

it('pulls in and drops out the relay contact', () => {
  const on = dc(3, relayCircuit(5));
  expect(on.result.converged).toBe(true);
  expect(on.voltage(2)).toBeLessThan(0.5); // contact closed pulls the load node down

  const off = dc(3, relayCircuit(0));
  expect(off.result.converged).toBe(true);
  expect(off.voltage(2)).toBeGreaterThan(4); // contact open: load node floats to 5 V
});
