import type { Device } from '../device';

export function createVoltageSource(
  name: string,
  positive: number,
  negative: number,
  voltage: number,
  internalResistance = 1e-6,
): Device {
  let branch = -1;
  return {
    name,
    kind: 'voltage-source',
    nodes: [positive, negative],
    setup: (system) => {
      branch = system.reserveVoltageSource();
    },
    stamp: (ctx) => {
      ctx.stampVoltageSource(positive, negative, branch);
      if (internalResistance > 0) ctx.addBranchResistance(branch, internalResistance);
      ctx.setVoltageSource(branch, voltage);
    },
  };
}
