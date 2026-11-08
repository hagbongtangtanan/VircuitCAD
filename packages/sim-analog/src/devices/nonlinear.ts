import type { Device } from '../device';
import type { MnaSystem } from '../mna';

const DEFAULT_VT = 0.02585;
const MAX_EXPONENT = 80;

export function pnjlim(vnew: number, vold: number, vt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    }
    return vt * Math.log(vnew / vt);
  }
  return vnew;
}

export type DiodeOptions = {
  is?: number;
  vt?: number;
  n?: number;
  seriesResistance?: number;
  breakdownVoltage?: number;
  isBreakdown?: number;
  maxCurrent?: number;
};

export type DiodeDevice = Device & {
  readonly burnedOut: boolean;
  readonly current: number;
};

type DiodeState = { vd: number; current: number; burnedOut: boolean };

const LED_FORWARD_VOLTAGE: Record<string, number> = {
  red: 1.8,
  orange: 2,
  yellow: 2.1,
  green: 2.2,
  blue: 3,
  white: 3,
};

function clampExponent(value: number): number {
  return Math.max(-MAX_EXPONENT, Math.min(MAX_EXPONENT, value));
}

function nodeVoltage(solution: Float64Array, node: number): number {
  return node === 0 ? 0 : (solution[node - 1] ?? 0);
}

function buildDiode(
  name: string,
  anode: number,
  cathode: number,
  options: DiodeOptions,
): DiodeDevice {
  const is = options.is ?? 1e-12;
  const vt = (options.vt ?? DEFAULT_VT) * (options.n ?? 1);
  const rs = options.seriesResistance ?? 0;
  const vz = options.breakdownVoltage;
  const isz = options.isBreakdown ?? is;
  const vcrit = vt * Math.log(vt / (Math.SQRT2 * is));
  const state: DiodeState = { vd: 0, current: 0, burnedOut: false };

  let internal = -1;
  const nodes: number[] = [anode, cathode];
  const anodeNode = (): number => (rs > 0 ? internal : anode);

  const currentAndConductance = (vd: number): { current: number; conductance: number } => {
    const forward = Math.exp(clampExponent(vd / vt));
    let current = is * (forward - 1);
    let conductance = (is / vt) * forward + 1e-12;
    if (vz !== undefined) {
      const reverse = Math.exp(clampExponent((-vd - vz) / vt));
      current -= isz * (reverse - 1);
      conductance += (isz / vt) * reverse;
    }
    return { current, conductance };
  };

  return {
    name,
    kind: 'nonlinear',
    nodes,
    setup: (system: MnaSystem) => {
      if (rs > 0) {
        internal = system.addNode();
        nodes.push(internal);
      }
    },
    stamp: (ctx) => {
      if (rs > 0) ctx.addConductance(anode, internal, 1 / rs);
      const p = anodeNode();
      const vd = ctx.voltage(p) - ctx.voltage(cathode);
      const { current, conductance } = currentAndConductance(vd);
      ctx.addConductance(p, cathode, conductance);
      ctx.addCurrent(p, cathode, current - conductance * vd);
    },
    limit: (solution) => {
      const p = anodeNode();
      const vd = nodeVoltage(solution, p) - nodeVoltage(solution, cathode);
      let limited = pnjlim(vd, state.vd, vt, vcrit);
      if (vz !== undefined) {
        const lower = -vz - 30 * vt;
        if (limited < lower) limited = lower;
      }
      if (limited !== vd && p !== 0) {
        solution[p - 1] = (solution[p - 1] ?? 0) + (limited - vd);
      }
      state.vd = limited;
      return limited !== vd;
    },
    update: (solution) => {
      const p = anodeNode();
      const vd = nodeVoltage(solution, p) - nodeVoltage(solution, cathode);
      state.vd = vd;
      const { current } = currentAndConductance(vd);
      state.current = current;
      if (options.maxCurrent !== undefined && Math.abs(current) > options.maxCurrent) {
        state.burnedOut = true;
      }
    },
    get burnedOut() {
      return state.burnedOut;
    },
    get current() {
      return state.current;
    },
  };
}

export function createDiode(
  name: string,
  anode: number,
  cathode: number,
  options: DiodeOptions = {},
): DiodeDevice {
  return buildDiode(name, anode, cathode, options);
}

export function createZener(
  name: string,
  anode: number,
  cathode: number,
  breakdownVoltage: number,
  options: DiodeOptions = {},
): DiodeDevice {
  return buildDiode(name, anode, cathode, {
    isBreakdown: 1e-3,
    ...options,
    breakdownVoltage,
  });
}

export function createLed(
  name: string,
  color: string,
  anode: number,
  cathode: number,
  options: DiodeOptions = {},
): DiodeDevice {
  const vt = (options.vt ?? DEFAULT_VT) * (options.n ?? 1);
  const forwardVoltage = LED_FORWARD_VOLTAGE[color] ?? LED_FORWARD_VOLTAGE.red ?? 1.8;
  const is = 0.02 / (Math.exp(forwardVoltage / vt) - 1);
  return buildDiode(name, anode, cathode, {
    seriesResistance: 20,
    maxCurrent: 0.06,
    ...options,
    is,
  });
}
