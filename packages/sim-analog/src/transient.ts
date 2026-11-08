import type { Device } from './device';
import type { IntegrationMethod } from './integration';
import type { MnaSystem } from './mna';
import { solveOperatingPoint, type SolverOptions } from './solver';

export type ReactiveLike = Device & {
  setTimeStep?(dt: number, method: IntegrationMethod): void;
  commit?(solution: Float64Array): void;
};

export type TransientOptions = SolverOptions & {
  tstop: number;
  dt?: number;
  minDt?: number;
  maxDt?: number;
  method?: IntegrationMethod;
  breakpoints?: number[];
  adaptive?: boolean;
};

export type TransientSample = { time: number; solution: Float64Array };

function timeStep(options: TransientOptions): number {
  const dt = options.dt ?? options.tstop / 100;
  const min = options.minDt ?? dt / 1000;
  const max = options.maxDt ?? dt * 10;
  return Math.min(Math.max(dt, min), max);
}

export function runTransient(
  system: MnaSystem,
  devices: readonly ReactiveLike[],
  options: TransientOptions,
): TransientSample[] {
  const method: IntegrationMethod = options.method ?? 'be';
  const breakpoints = [...(options.breakpoints ?? [])].sort((a, b) => a - b);
  const baseStep = timeStep(options);
  const adaptive = options.adaptive ?? true;

  let time = 0;
  let solution: Float64Array = new Float64Array(system.size);
  const samples: TransientSample[] = [{ time, solution: Float64Array.from(solution) }];

  let step = baseStep;
  let guard = 0;
  while (time < options.tstop - 1e-12 && guard < 1_000_000) {
    guard += 1;

    let h = Math.min(step, options.tstop - time);
    for (const breakpoint of breakpoints) {
      if (breakpoint > time && breakpoint < time + h) {
        h = breakpoint - time;
        break;
      }
    }

    for (const device of devices) device.setTimeStep?.(h, method);
    const result = solveOperatingPoint(system, devices, solution, options);
    solution = result.solution;
    for (const device of devices) device.commit?.(solution);

    time = Math.round((time + h) * 1e12) / 1e12;
    samples.push({ time, solution: Float64Array.from(solution) });

    if (adaptive && result.iterations <= 4) step = Math.min(step * 1.5, baseStep * 10);
    else if (adaptive && result.iterations >= 12) step = Math.max(step * 0.5, baseStep / 1000);
  }

  return samples;
}
