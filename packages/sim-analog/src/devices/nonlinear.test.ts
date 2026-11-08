import { expect, it } from 'vitest';

import { setupDevices } from '../context';
import type { Device } from '../device';
import { MnaSystem } from '../mna';
import { solveOperatingPoint } from '../solver';
import { createDiode, createLed, createZener, pnjlim } from './nonlinear';
import { createResistor } from './resistor';
import { createVoltageSource } from './voltage-source';

function dc(nodeCount: number, devices: Device[]) {
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  const result = solveOperatingPoint(system, devices);
  return { system, result, voltage: (node: number) => system.nodeVoltage(result.solution, node) };
}

it('pnjlim limits large voltage steps', () => {
  const vt = 0.02585;
  const vcrit = vt * Math.log(vt / (Math.SQRT2 * 1e-12));
  const limited = pnjlim(vcrit + 10, vcrit, vt, vcrit);
  expect(limited).toBeLessThan(vcrit + 10);
  expect(Number.isFinite(limited)).toBe(true);
});

it('matches the analytic diode operating point', () => {
  const is = 1e-12;
  const vt = 0.02585;
  const { result, voltage } = dc(2, [
    createVoltageSource('v1', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 1000),
    createDiode('d1', 2, 0, { is }),
  ]);
  expect(result.converged).toBe(true);

  let expected = 0.5;
  for (let index = 0; index < 80; index += 1) {
    expected = vt * Math.log((5 - expected) / 1000 / is + 1);
  }
  expect(voltage(2)).toBeCloseTo(expected, 3);
});

it('gives colour-dependent LED forward voltage', () => {
  const red = dc(2, [
    createVoltageSource('v1', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 220),
    createLed('d1', 'red', 2, 0),
  ]);
  const blue = dc(2, [
    createVoltageSource('v1', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 220),
    createLed('d1', 'blue', 2, 0),
  ]);
  expect(red.result.converged).toBe(true);
  expect(red.voltage(2)).toBeGreaterThan(1.6);
  expect(red.voltage(2)).toBeLessThan(2.3);
  expect(blue.voltage(2)).toBeGreaterThan(red.voltage(2));
});

it('flags LED burnout at over-current', () => {
  const led = createLed('d1', 'red', 2, 0);
  dc(2, [
    createVoltageSource('v1', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 10),
    led,
  ]);
  expect(led.burnedOut).toBe(true);
});

it('clamps at the zener breakdown voltage', () => {
  const { result, voltage } = dc(2, [
    createVoltageSource('v1', 1, 0, -9, 0),
    createResistor('r1', 1, 2, 100),
    createZener('z1', 2, 0, 5.1),
  ]);
  expect(result.converged).toBe(true);
  expect(voltage(2)).toBeLessThan(-4.7);
  expect(voltage(2)).toBeGreaterThan(-5.5);
});

it('stays finite when a diode is driven hard (junction limiting)', () => {
  const { result, voltage } = dc(1, [
    createVoltageSource('v1', 1, 0, 1.2, 0),
    createDiode('d1', 1, 0),
  ]);
  expect(result.converged).toBe(true);
  expect(Number.isFinite(voltage(1))).toBe(true);
});
