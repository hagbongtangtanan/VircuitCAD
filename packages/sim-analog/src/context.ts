import type { Device, MnaContext } from './device';
import type { MnaSystem } from './mna';

export const DEFAULT_GMIN = 1e-12;

export function createMnaContext(system: MnaSystem, previous?: Float64Array): MnaContext {
  return {
    numNodes: system.nodeCount,
    voltage: (node) => (previous ? system.nodeVoltage(previous, node) : 0),
    addConductance: (a, b, conductance) => system.addConductance(a, b, conductance),
    addCurrent: (from, to, current) => system.addCurrent(from, to, current),
    stampTransconductance: (drain, source, controlPositive, controlNegative, gm) =>
      system.stampTransconductance(drain, source, controlPositive, controlNegative, gm),
    stampVoltageSource: (positive, negative, branch) =>
      system.stampVoltageSource(positive, negative, branch),
    addBranchResistance: (branch, resistance) => system.addBranchResistance(branch, resistance),
    setVoltageSource: (branch, voltage) => system.setVoltageSource(branch, voltage),
  };
}

export function setupDevices(system: MnaSystem, devices: readonly Device[]): void {
  for (const device of devices) device.setup?.(system);
}

export function stampDevices(
  system: MnaSystem,
  devices: readonly Device[],
  previous?: Float64Array,
  gmin = DEFAULT_GMIN,
): void {
  system.reset();
  system.addGmin(gmin);
  const ctx = createMnaContext(system, previous);
  for (const device of devices) device.stamp(ctx);
}
