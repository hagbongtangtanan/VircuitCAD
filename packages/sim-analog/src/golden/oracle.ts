import type { Device } from '../device';
import { createCurrentSource } from '../devices/current-source';
import { createCapacitor } from '../devices/reactive';
import { createResistor } from '../devices/resistor';
import { createVoltageSource } from '../devices/voltage-source';
import type { IntegrationMethod } from '../integration';

export type GoldenCircuit = {
  id: string;
  tolerance: number;
  nodeCount: number;
  devices: Device[];
  probes: number[];
  expected: number[];
  transient?: { tstop: number; dt: number; method: IntegrationMethod };
};

const dividerCases: Array<[number, number, number]> = [
  [5, 10, 10],
  [9, 100, 100],
  [12, 1000, 2000],
  [3.3, 220, 470],
  [10, 1, 9],
  [1, 100, 100],
  [24, 10000, 4700],
  [5, 47, 100],
  [2.5, 1, 4],
  [7.5, 330, 680],
  [15, 2200, 3300],
  [0.5, 10, 90],
  [18, 560, 560],
  [6, 82, 150],
  [4.5, 1000, 1000],
  [20, 100, 300],
];

const currentCases: Array<[number, number]> = [
  [0.001, 1000],
  [0.02, 220],
];

const rcCases: Array<[number, number]> = [
  [1000, 1e-6],
  [4700, 2.2e-6],
];

function divider(index: number, vs: number, r1: number, r2: number): GoldenCircuit {
  return {
    id: `divider-${index}`,
    tolerance: 1e-6,
    nodeCount: 2,
    devices: [
      createVoltageSource('v1', 1, 0, vs, 0),
      createResistor('r1', 1, 2, r1),
      createResistor('r2', 2, 0, r2),
    ],
    probes: [1, 2],
    expected: [vs, (vs * r2) / (r1 + r2)],
  };
}

function current(index: number, currentA: number, resistance: number): GoldenCircuit {
  return {
    id: `current-${index}`,
    tolerance: 1e-6,
    nodeCount: 1,
    devices: [
      createCurrentSource('i1', 0, 1, currentA),
      createResistor('r1', 1, 0, resistance),
    ],
    probes: [1],
    expected: [currentA * resistance],
  };
}

function rc(index: number, resistance: number, capacitance: number): GoldenCircuit {
  const tau = resistance * capacitance;
  return {
    id: `rc-${index}`,
    tolerance: 0.01,
    nodeCount: 2,
    devices: [
      createVoltageSource('v1', 1, 0, 1, 0),
      createResistor('r1', 1, 2, resistance),
      createCapacitor('c1', 2, 0, capacitance),
    ],
    probes: [2],
    expected: [1 - Math.exp(-5)],
    transient: { tstop: 5 * tau, dt: tau / 100, method: 'be' },
  };
}

export const goldenCircuits: GoldenCircuit[] = [
  ...dividerCases.map(([vs, r1, r2], index) => divider(index, vs, r1, r2)),
  ...currentCases.map(([currentA, resistance], index) => current(index, currentA, resistance)),
  ...rcCases.map(([resistance, capacitance], index) => rc(index, resistance, capacitance)),
];

export function goldenResults(): Record<string, number[]> {
  const results: Record<string, number[]> = {};
  for (const circuit of goldenCircuits) results[circuit.id] = circuit.expected;
  return results;
}
