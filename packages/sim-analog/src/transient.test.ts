import { expect, it } from 'vitest';

import { setupDevices } from './context';
import { createCapacitor, createInductor } from './devices/reactive';
import { createResistor } from './devices/resistor';
import { createVoltageSource } from './devices/voltage-source';
import { MnaSystem } from './mna';
import { runTransient, type TransientOptions, type TransientSample } from './transient';
import type { ReactiveLike } from './transient';

function simulate(
  nodeCount: number,
  devices: ReactiveLike[],
  options: TransientOptions,
): { system: MnaSystem; samples: TransientSample[] } {
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  return { system, samples: runTransient(system, devices, options) };
}

function lastOf(samples: TransientSample[]): TransientSample {
  const sample = samples[samples.length - 1];
  if (!sample) throw new Error('no samples');
  return sample;
}

it('charges an RC circuit to the analytic value (backward Euler)', () => {
  const { system, samples } = simulate(
    2,
    [
      createVoltageSource('v1', 1, 0, 1, 0),
      createResistor('r1', 1, 2, 1000),
      createCapacitor('c1', 2, 0, 1e-6),
    ],
    { tstop: 5e-3, dt: 1e-5, method: 'be', adaptive: false },
  );
  const expected = 1 - Math.exp(-5);
  const value = system.nodeVoltage(lastOf(samples).solution, 2);
  expect(Math.abs(value - expected) / expected).toBeLessThan(0.01);
});

it('charges an RC circuit (trapezoidal) within 1%', () => {
  const { system, samples } = simulate(
    2,
    [
      createVoltageSource('v1', 1, 0, 1, 0),
      createResistor('r1', 1, 2, 1000),
      createCapacitor('c1', 2, 0, 1e-6),
    ],
    { tstop: 5e-3, dt: 1e-5, method: 'trapezoidal', adaptive: false },
  );
  const expected = 1 - Math.exp(-5);
  const value = system.nodeVoltage(lastOf(samples).solution, 2);
  expect(Math.abs(value - expected) / expected).toBeLessThan(0.01);
});

it('ramps an RL current to Vs/R within 1%', () => {
  const { system, samples } = simulate(
    2,
    [
      createVoltageSource('v1', 1, 0, 1, 0),
      createResistor('r1', 1, 2, 22),
      createInductor('l1', 2, 0, 1e-3),
    ],
    { tstop: 3e-4, dt: 2e-6, method: 'be', adaptive: false },
  );
  const expected = 1 / 22;
  const current = system.branchCurrent(lastOf(samples).solution, 1);
  expect(Math.abs(current - expected) / expected).toBeLessThan(0.01);
  expect(Math.abs(system.nodeVoltage(lastOf(samples).solution, 2))).toBeLessThan(0.02);
});

it('settles an underdamped RLC step with overshoot', () => {
  const { system, samples } = simulate(
    3,
    [
      createVoltageSource('v1', 1, 0, 1, 0),
      createResistor('r1', 1, 2, 10),
      createInductor('l1', 2, 3, 1e-3),
      createCapacitor('c1', 3, 0, 1e-6),
    ],
    { tstop: 10e-3, dt: 1e-6, method: 'be', adaptive: false },
  );

  const peak = Math.max(...samples.map((sample) => system.nodeVoltage(sample.solution, 3)));
  expect(peak).toBeGreaterThan(1.05);

  const final = system.nodeVoltage(lastOf(samples).solution, 3);
  expect(Math.abs(final - 1)).toBeLessThan(0.02);
});
