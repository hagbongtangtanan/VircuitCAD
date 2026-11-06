import { expect, it } from 'vitest';

import { setupDevices, stampDevices } from './context';
import type { Device } from './device';
import { createCurrentSource } from './devices/current-source';
import { createResistor } from './devices/resistor';
import { createSwitch } from './devices/switch';
import { createVoltageSource } from './devices/voltage-source';
import { MnaSystem } from './mna';

function dc(
  nodeCount: number,
  devices: Device[],
): { voltage: (node: number) => number; singular: boolean } {
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  stampDevices(system, devices);
  const solution = system.solve();
  return { voltage: (node) => system.nodeVoltage(solution, node), singular: system.isSingular() };
}

it('solves a resistive divider', () => {
  const result = dc(2, [
    createVoltageSource('v1', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 10),
    createResistor('r2', 2, 0, 10),
  ]);
  expect(result.singular).toBe(false);
  expect(result.voltage(1)).toBeCloseTo(5, 6);
  expect(result.voltage(2)).toBeCloseTo(2.5, 6);
});

it('models a Thevenin source with internal resistance', () => {
  const result = dc(1, [
    createVoltageSource('v1', 1, 0, 5, 1),
    createResistor('load', 1, 0, 4),
  ]);
  expect(result.voltage(1)).toBeCloseTo(4, 6);
});

it('sources current into a load', () => {
  const result = dc(1, [createCurrentSource('i1', 0, 1, 2), createResistor('r1', 1, 0, 2)]);
  expect(result.voltage(1)).toBeCloseTo(4, 6);
});

it('models open and closed switches', () => {
  const closed = dc(2, [
    createVoltageSource('v1', 1, 0, 5, 0),
    createSwitch('sw', 1, 2, { closed: true }),
    createResistor('r1', 2, 0, 10),
  ]);
  expect(closed.voltage(2)).toBeCloseTo(5, 3);

  const open = dc(2, [
    createVoltageSource('v1', 1, 0, 5, 0),
    createSwitch('sw', 1, 2, { closed: false }),
    createResistor('r1', 2, 0, 10),
  ]);
  expect(open.voltage(2)).toBeCloseTo(0, 6);
});
