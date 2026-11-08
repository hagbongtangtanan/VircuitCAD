import type { Device } from './device';
import { SimError } from './errors';
import type { MnaSystem } from './mna';
import { solveOperatingPoint, type SolverOptions } from './solver';

export function assertHasGround(hasGround: boolean): void {
  if (!hasGround) throw new SimError('NO_GROUND', 'the circuit has no ground reference');
}

export function findFloatingNodes(nodeCount: number, devices: readonly Device[]): number[] {
  const touched = new Set<number>();
  for (const device of devices) {
    for (const node of device.nodes) if (node !== 0) touched.add(node);
  }
  const floating: number[] = [];
  for (let node = 1; node <= nodeCount; node += 1) {
    if (!touched.has(node)) floating.push(node);
  }
  return floating;
}

export function countVoltageSources(devices: readonly Device[]): number {
  return devices.filter((device) => device.kind === 'voltage-source').length;
}

export function solveDcOrThrow(
  system: MnaSystem,
  devices: readonly Device[],
  options: SolverOptions = {},
): Float64Array {
  const floating = findFloatingNodes(system.nodeCount, devices);
  if (floating.length > 0) {
    throw new SimError(
      'FLOATING',
      `floating node(s): ${floating.join(', ')}`,
      floating.map((node) => ({ kind: 'node', id: String(node) })),
    );
  }

  const result = solveOperatingPoint(system, devices, undefined, options);
  if (result.converged) return result.solution;

  if (system.isSingular()) {
    if (countVoltageSources(devices) >= 2) {
      throw new SimError('SOURCE_LOOP', 'ideal voltage-source loop or parallel sources');
    }
    throw new SimError('SHORT_CIRCUIT', 'singular matrix: short circuit near a node');
  }

  throw new SimError(
    'NO_CONVERGENCE',
    `did not converge after ${result.iterations} iterations`,
  );
}
