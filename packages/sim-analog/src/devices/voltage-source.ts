import type { Device } from '../device';

export type VoltageSourceDevice = Device & {
  setScale(scale: number): void;
};

export function createVoltageSource(
  name: string,
  positive: number,
  negative: number,
  voltage: number,
  internalResistance = 1e-6,
): VoltageSourceDevice {
  let branch = -1;
  let scale = 1;
  return {
    name,
    kind: 'voltage-source',
    nodes: [positive, negative],
    setup: (system) => {
      branch = system.reserveVoltageSource();
    },
    setScale: (next) => {
      scale = next;
    },
    stamp: (ctx) => {
      ctx.stampVoltageSource(positive, negative, branch);
      if (internalResistance > 0) ctx.addBranchResistance(branch, internalResistance);
      ctx.setVoltageSource(branch, voltage * scale);
    },
  };
}
