import { expect, it } from 'vitest';

import { setupDevices } from './context';
import type { Device } from './device';
import { createResistor } from './devices/resistor';
import { createVoltageSource } from './devices/voltage-source';
import { MnaSystem } from './mna';
import { solveOperatingPoint } from './solver';

function createDiode(name: string, a: number, b: number, is = 1e-12, vt = 0.02585): Device {
  return {
    name,
    nodes: [a, b],
    stamp: (ctx) => {
      const vd = ctx.voltage(a) - ctx.voltage(b);
      const limited = Math.min(vd, 40 * vt);
      const exponential = Math.exp(limited / vt);
      const current = is * (exponential - 1);
      const conductance = (is / vt) * exponential + 1e-12;
      ctx.addConductance(a, b, conductance);
      ctx.addCurrent(a, b, current - conductance * vd);
    },
  };
}

function systemFor(nodeCount: number, devices: Device[]): MnaSystem {
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  return system;
}

it('solves a linear divider in one Newton iteration', () => {
  const devices = [
    createVoltageSource('v1', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 10),
    createResistor('r2', 2, 0, 10),
  ];
  const system = systemFor(2, devices);
  const result = solveOperatingPoint(system, devices);
  expect(result.converged).toBe(true);
  expect(result.method).toBe('newton');
  expect(result.iterations).toBeLessThanOrEqual(2);
  expect(system.nodeVoltage(result.solution, 2)).toBeCloseTo(2.5, 6);
});

it('converges on a diode circuit', () => {
  const devices = [
    createVoltageSource('v1', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 1000),
    createDiode('d1', 2, 0),
  ];
  const system = systemFor(2, devices);
  const result = solveOperatingPoint(system, devices);

  expect(result.converged).toBe(true);
  expect(result.iterations).toBeGreaterThan(1);

  const vd = system.nodeVoltage(result.solution, 2);
  expect(vd).toBeGreaterThan(0.5);
  expect(vd).toBeLessThan(0.65);

  const current = (5 - vd) / 1000;
  expect(current).toBeGreaterThan(0.004);
  expect(current).toBeLessThan(0.005);
});

it('reports non-convergence when the iteration cap is too low', () => {
  const devices = [
    createVoltageSource('v1', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 1000),
    createDiode('d1', 2, 0),
  ];
  const system = systemFor(2, devices);
  const result = solveOperatingPoint(system, devices, undefined, { maxIterations: 1 });
  expect(result.converged).toBe(false);
});
