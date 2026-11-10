import { expect, it } from 'vitest';

import { setupDevices } from '../context';
import type { Device } from '../device';
import { createSchottky } from './nonlinear';
import { createResistor } from './resistor';
import { createBjt, createMosfet } from './semiconductors';
import { createVoltageSource } from './voltage-source';
import { MnaSystem } from '../mna';
import { solveOperatingPoint } from '../solver';

function dc(nodeCount: number, devices: Device[]) {
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  const result = solveOperatingPoint(system, devices, undefined, {
    setSourceScale: (scale) => {
      for (const device of devices) {
        (device as { setScale?: (value: number) => void }).setScale?.(scale);
      }
    },
  });
  return { result, voltage: (node: number) => system.nodeVoltage(result.solution, node) };
}

it('switches an N-MOSFET on and off', () => {
  const make = (gate: number): Device[] => [
    createVoltageSource('vdd', 3, 0, 5, 0),
    createResistor('load', 3, 1, 1000),
    createMosfet('m1', 1, 2, 0, { type: 'n', threshold: 2, k: 0.02 }),
    createVoltageSource('vg', 2, 0, gate, 0),
  ];

  const on = dc(3, make(5));
  expect(on.result.converged).toBe(true);
  expect(on.voltage(1)).toBeLessThan(1);

  const off = dc(3, make(0));
  expect(off.result.converged).toBe(true);
  expect(off.voltage(1)).toBeGreaterThan(4);
});

it('saturates an NPN transistor as a low-side switch', () => {
  const { result, voltage } = dc(3, [
    createVoltageSource('vcc', 1, 0, 5, 0),
    createResistor('rb', 1, 2, 10_000),
    createResistor('rc', 1, 3, 1000),
    createBjt('q1', 3, 2, 0, { type: 'npn' }),
  ]);
  expect(result.converged).toBe(true);
  expect(voltage(3)).toBeLessThan(0.6);
  expect(voltage(2)).toBeGreaterThan(0.5);
  expect(voltage(2)).toBeLessThan(0.9);
});

it('drops ~0.24 V across a Schottky diode', () => {
  const { result, voltage } = dc(2, [
    createVoltageSource('v1', 1, 0, 1, 0),
    createResistor('r1', 1, 2, 100),
    createSchottky('d1', 2, 0),
  ]);
  expect(result.converged).toBe(true);
  expect(voltage(2)).toBeGreaterThan(0.15);
  expect(voltage(2)).toBeLessThan(0.35);
});


