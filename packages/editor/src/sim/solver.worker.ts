import { createDefaultPartRegistry, type Circuit } from '@vircuitcad/core';
import {
  buildSimulation,
  SimError,
  solveSimulation,
  WorkerCommandSchema,
  type SimSnapshot,
  type Simulation,
} from '@vircuitcad/sim-analog';

type WorkerScope = {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};

const scope = self as unknown as WorkerScope;
const registry = createDefaultPartRegistry();
let current: Circuit | undefined;

function snapshotOf(simulation: Simulation, solution: Float64Array): SimSnapshot {
  const nodeVoltages: Record<string, number> = {};
  for (const [name, node] of simulation.nodeMap) {
    nodeVoltages[name] = simulation.system.nodeVoltage(solution, node);
  }

  const leds = (current?.parts ?? [])
    .filter((part) => registry.get(part.partId)?.simModel === 'led')
    .map((part) => {
      const device = simulation.deviceByName(part.id) as
        | { current?: number; burnedOut?: boolean }
        | undefined;
      return {
        partId: part.id,
        current: device?.current ?? 0,
        burnedOut: device?.burnedOut ?? false,
      };
    });

  return { type: 'snapshot', time: 0, nodeVoltages, leds };
}

function run(): void {
  if (!current) return;
  scope.postMessage({ type: 'status', state: 'running', time: 0 });
  try {
    const simulation = buildSimulation(current, registry);
    const result = solveSimulation(simulation);
    if (!result.converged) throw new SimError('NO_CONVERGENCE', 'did not converge');
    scope.postMessage(snapshotOf(simulation, result.solution));
  } catch (error) {
    if (error instanceof SimError) {
      scope.postMessage({ type: 'error', code: error.code, message: error.message });
    } else {
      scope.postMessage({ type: 'error', code: 'UNKNOWN', message: String(error) });
    }
  }
}

scope.onmessage = (event: MessageEvent): void => {
  const parsed = WorkerCommandSchema.safeParse(event.data);
  if (!parsed.success) {
    scope.postMessage({ type: 'error', code: 'BAD_COMMAND', message: 'invalid command' });
    return;
  }

  const command = parsed.data;
  switch (command.type) {
    case 'start':
      current = command.circuit;
      run();
      break;
    case 'stop':
      current = undefined;
      scope.postMessage({ type: 'status', state: 'stopped', time: 0 });
      break;
    case 'pause':
      scope.postMessage({ type: 'status', state: 'paused', time: 0 });
      break;
    case 'resume':
      run();
      break;
    case 'setParam': {
      const part = current?.parts.find((candidate) => candidate.id === command.partId);
      if (part) part.params[command.key] = command.value;
      run();
      break;
    }
  }
};
