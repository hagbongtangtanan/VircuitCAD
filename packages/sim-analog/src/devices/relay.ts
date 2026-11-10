import type { Device } from '../device';

export type RelayOptions = {
  coilResistance?: number;
  pullInCurrent?: number;
  dropOutCurrent?: number;
  contactResistance?: number;
};

export type RelayDevice = Device & {
  readonly engaged: boolean;
  setEngaged(value: boolean): void;
};

function nodeVoltage(solution: Float64Array, node: number): number {
  return node === 0 ? 0 : (solution[node - 1] ?? 0);
}

/** Electromagnetic relay: coil resistance with a hysteretic contact. */
export function createRelay(
  name: string,
  coilA: number,
  coilB: number,
  contactA: number,
  contactB: number,
  options: RelayOptions = {},
): RelayDevice {
  const coilResistance = options.coilResistance ?? 100;
  const pullIn = options.pullInCurrent ?? 0.02;
  const dropOut = options.dropOutCurrent ?? 0.01;
  const contactResistance = options.contactResistance ?? 0.01;
  let engaged = false;

  return {
    name,
    kind: 'relay',
    nodes: [coilA, coilB, contactA, contactB],
    stamp: (ctx) => {
      ctx.addConductance(coilA, coilB, 1 / coilResistance);
      if (engaged) ctx.addConductance(contactA, contactB, 1 / contactResistance);
    },
    update: (solution) => {
      const current = Math.abs((nodeVoltage(solution, coilA) - nodeVoltage(solution, coilB)) / coilResistance);
      if (current >= pullIn) engaged = true;
      else if (current <= dropOut) engaged = false;
    },
    get engaged() {
      return engaged;
    },
    setEngaged(value: boolean) {
      engaged = value;
    },
  };
}
