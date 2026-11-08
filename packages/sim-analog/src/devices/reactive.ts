import type { Device } from '../device';
import type { IntegrationMethod } from '../integration';

export type ReactiveDevice = Device & {
  setTimeStep(dt: number, method: IntegrationMethod): void;
  commit(solution: Float64Array): void;
};

function nodeVoltage(solution: Float64Array, node: number): number {
  return node === 0 ? 0 : (solution[node - 1] ?? 0);
}

export function createCapacitor(
  name: string,
  nodeA: number,
  nodeB: number,
  capacitance: number,
): ReactiveDevice {
  let dt = 1e-3;
  let method: IntegrationMethod = 'be';
  let voltage = 0;
  let current = 0;

  const conductance = (): number => (method === 'be' ? capacitance / dt : (2 * capacitance) / dt);

  return {
    name,
    kind: 'capacitor',
    nodes: [nodeA, nodeB],
    setTimeStep: (nextDt, nextMethod) => {
      dt = nextDt;
      method = nextMethod;
    },
    stamp: (ctx) => {
      const g = conductance();
      const equivalent = method === 'be' ? -g * voltage : -(g * voltage + current);
      ctx.addConductance(nodeA, nodeB, g);
      ctx.addCurrent(nodeA, nodeB, equivalent);
    },
    commit: (solution) => {
      const g = conductance();
      const next = nodeVoltage(solution, nodeA) - nodeVoltage(solution, nodeB);
      current = method === 'be' ? g * (next - voltage) : g * (next - voltage) - current;
      voltage = next;
    },
  };
}

export function createInductor(
  name: string,
  nodeA: number,
  nodeB: number,
  inductance: number,
): ReactiveDevice {
  let dt = 1e-3;
  let method: IntegrationMethod = 'be';
  let current = 0;
  let voltage = 0;
  let branch = -1;
  let nodeCount = 0;

  const resistance = (): number => (method === 'be' ? inductance / dt : (2 * inductance) / dt);

  return {
    name,
    kind: 'inductor',
    nodes: [nodeA, nodeB],
    setup: (system) => {
      branch = system.reserveVoltageSource();
      nodeCount = system.nodeCount;
    },
    setTimeStep: (nextDt, nextMethod) => {
      dt = nextDt;
      method = nextMethod;
    },
    stamp: (ctx) => {
      const r = resistance();
      ctx.stampVoltageSource(nodeA, nodeB, branch);
      ctx.addBranchResistance(branch, r);
      const rhs = method === 'be' ? -r * current : -r * current - voltage;
      ctx.setVoltageSource(branch, rhs);
    },
    commit: (solution) => {
      current = solution[nodeCount + branch] ?? 0;
      voltage = nodeVoltage(solution, nodeA) - nodeVoltage(solution, nodeB);
    },
  };
}
