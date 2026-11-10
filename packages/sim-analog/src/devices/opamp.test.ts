import { expect, it } from 'vitest';

import { setupDevices } from '../context';
import type { Device } from '../device';
import { createOpAmp } from './opamp';
import { createVoltageSource } from './voltage-source';
import { MnaSystem } from '../mna';
import { solveOperatingPoint } from '../solver';

function dc(nodeCount: number, devices: Device[]) {
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  const result = solveOperatingPoint(system, devices);
  return { result, voltage: (node: number) => system.nodeVoltage(result.solution, node) };
}

it('behaves as a voltage follower', () => {
  const { result, voltage } = dc(2, [
    createVoltageSource('vin', 1, 0, 2, 0),
    createOpAmp('u1', 2, 1, 2, { vcc: 5, vss: 0 }),
  ]);
  expect(result.converged).toBe(true);
  expect(voltage(2)).toBeGreaterThan(1.95);
  expect(voltage(2)).toBeLessThan(2.05);
});

it('saturates a comparator at the rail', () => {
  const { result, voltage } = dc(3, [
    createVoltageSource('vplus', 1, 0, 5, 0),
    createVoltageSource('vminus', 2, 0, 2, 0),
    createOpAmp('u1', 3, 1, 2, { vcc: 5, vss: 0 }),
  ]);
  expect(result.converged).toBe(true);
  expect(voltage(3)).toBeCloseTo(5, 1);
});
