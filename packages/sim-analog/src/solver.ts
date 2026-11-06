import { stampDevices } from './context';
import type { Device } from './device';
import type { MnaSystem } from './mna';

export type SolverOptions = {
  maxIterations?: number;
  reltol?: number;
  vntol?: number;
  abstol?: number;
  gmin?: number;
  gminSteps?: number;
  sourceSteps?: number;
  setSourceScale?: (scale: number) => void;
};

export type OperatingPointResult = {
  solution: Float64Array;
  converged: boolean;
  iterations: number;
  method: 'newton' | 'gmin' | 'source';
};

type ResolvedOptions = Required<Omit<SolverOptions, 'setSourceScale'>> & {
  setSourceScale?: (scale: number) => void;
};

function resolve(options: SolverOptions): ResolvedOptions {
  return {
    maxIterations: options.maxIterations ?? 100,
    reltol: options.reltol ?? 1e-3,
    vntol: options.vntol ?? 1e-6,
    abstol: options.abstol ?? 1e-12,
    gmin: options.gmin ?? 1e-12,
    gminSteps: options.gminSteps ?? 6,
    sourceSteps: options.sourceSteps ?? 5,
    ...(options.setSourceScale ? { setSourceScale: options.setSourceScale } : {}),
  };
}

function converged(
  system: MnaSystem,
  previous: Float64Array,
  next: Float64Array,
  options: ResolvedOptions,
): boolean {
  const size = system.size;
  for (let index = 0; index < size; index += 1) {
    const a = previous[index] ?? 0;
    const b = next[index] ?? 0;
    const delta = Math.abs(b - a);
    if (index >= system.nodeCount) {
      if (delta > options.abstol) return false;
    } else {
      const tolerance = options.reltol * Math.max(Math.abs(a), Math.abs(b)) + options.vntol;
      if (delta > tolerance) return false;
    }
  }
  return true;
}

function newton(
  system: MnaSystem,
  devices: readonly Device[],
  initial: Float64Array | undefined,
  gmin: number,
  options: ResolvedOptions,
): { solution: Float64Array; converged: boolean; iterations: number } {
  let current: Float64Array = initial ? Float64Array.from(initial) : new Float64Array(system.size);

  for (let iteration = 0; iteration < options.maxIterations; iteration += 1) {
    for (const device of devices) device.limit?.(current);
    stampDevices(system, devices, current, gmin);
    const next = system.solve();
    if (system.isSingular()) {
      return { solution: current, converged: false, iterations: iteration + 1 };
    }
    for (const device of devices) device.update?.(next);
    if (converged(system, current, next, options)) {
      return { solution: next, converged: true, iterations: iteration + 1 };
    }
    current = next;
  }

  return { solution: current, converged: false, iterations: options.maxIterations };
}

function gminStepping(
  system: MnaSystem,
  devices: readonly Device[],
  options: ResolvedOptions,
): { solution: Float64Array; converged: boolean; iterations: number } | undefined {
  const base = options.gmin;
  const start = 1e-3;
  const steps = Math.max(1, options.gminSteps);
  let current: Float64Array = new Float64Array(system.size);
  let totalIterations = 0;

  for (let step = steps; step >= 0; step -= 1) {
    const gmin = base * Math.pow(start / base, step / steps);
    const result = newton(system, devices, current, gmin, options);
    totalIterations += result.iterations;
    if (!result.converged) return undefined;
    current = result.solution;
  }

  return { solution: current, converged: true, iterations: totalIterations };
}

function sourceStepping(
  system: MnaSystem,
  devices: readonly Device[],
  options: ResolvedOptions,
): { solution: Float64Array; converged: boolean; iterations: number } | undefined {
  const setScale = options.setSourceScale;
  if (!setScale) return undefined;

  const steps = Math.max(1, options.sourceSteps);
  let current: Float64Array = new Float64Array(system.size);
  let totalIterations = 0;

  for (let step = 1; step <= steps; step += 1) {
    setScale(step / steps);
    const result = newton(system, devices, current, options.gmin, options);
    totalIterations += result.iterations;
    if (!result.converged) {
      setScale(1);
      return undefined;
    }
    current = result.solution;
  }

  setScale(1);
  return { solution: current, converged: true, iterations: totalIterations };
}

export function solveOperatingPoint(
  system: MnaSystem,
  devices: readonly Device[],
  initial?: Float64Array,
  options: SolverOptions = {},
): OperatingPointResult {
  const resolved = resolve(options);

  const direct = newton(system, devices, initial, resolved.gmin, resolved);
  if (direct.converged) return { ...direct, method: 'newton' };

  const gminResult = gminStepping(system, devices, resolved);
  if (gminResult) return { ...gminResult, method: 'gmin' };

  const sourceResult = sourceStepping(system, devices, resolved);
  if (sourceResult) return { ...sourceResult, method: 'source' };

  return { solution: direct.solution, converged: false, iterations: direct.iterations, method: 'newton' };
}
