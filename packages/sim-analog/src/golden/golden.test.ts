import { expect, it } from 'vitest';

import { setupDevices } from '../context';
import { MnaSystem } from '../mna';
import { solveOperatingPoint } from '../solver';
import { runTransient } from '../transient';
import { goldenCircuits } from './oracle';
import results from './results.json';

const lookup = results as Record<string, number[]>;

function solve(circuit: (typeof goldenCircuits)[number]): { system: MnaSystem; solution: Float64Array } {
  const system = new MnaSystem(circuit.nodeCount);
  setupDevices(system, circuit.devices);

  if (circuit.transient) {
    const samples = runTransient(system, circuit.devices, {
      tstop: circuit.transient.tstop,
      dt: circuit.transient.dt,
      method: circuit.transient.method,
      adaptive: false,
    });
    const last = samples[samples.length - 1];
    if (!last) throw new Error('no transient samples');
    return { system, solution: last.solution };
  }

  return { system, solution: solveOperatingPoint(system, circuit.devices).solution };
}

for (const circuit of goldenCircuits) {
  it(
    `golden ${circuit.id}`,
    { tags: ['golden'] },
    () => {
      const expected = lookup[circuit.id] ?? [];
      const { system, solution } = solve(circuit);
      circuit.probes.forEach((node, index) => {
        const value = system.nodeVoltage(solution, node);
        const reference = expected[index] ?? 0;
        const tolerance = circuit.tolerance * Math.max(1, Math.abs(reference));
        expect(Math.abs(value - reference)).toBeLessThanOrEqual(tolerance);
      });
    },
  );
}

it('golden results cover every circuit', { tags: ['golden'] }, () => {
  for (const circuit of goldenCircuits) {
    expect(lookup).toHaveProperty(circuit.id);
  }
  expect(goldenCircuits.length).toBeGreaterThanOrEqual(20);
});
