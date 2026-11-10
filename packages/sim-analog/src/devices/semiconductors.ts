import type { Device } from '../device';
import { pnjlim } from './nonlinear';

const DEFAULT_VT = 0.02585;
const MAX_EXPONENT = 80;

function clamp(value: number): number {
  return Math.max(-MAX_EXPONENT, Math.min(MAX_EXPONENT, value));
}

export type MosfetOptions = {
  type?: 'n' | 'p';
  threshold?: number;
  k?: number;
  lambda?: number;
};

/** Level-1 square-law MOSFET (N or P). */
export function createMosfet(
  name: string,
  drain: number,
  gate: number,
  source: number,
  options: MosfetOptions = {},
): Device {
  const type = options.type ?? 'n';
  const sign = type === 'n' ? 1 : -1;
  const vt = options.threshold ?? (type === 'n' ? 2 : -2);
  const k = options.k ?? 0.02;
  const lambda = options.lambda ?? 0.01;

  return {
    name,
    kind: 'mosfet',
    nodes: [drain, gate, source],
    stamp: (ctx) => {
      const vgs = sign * (ctx.voltage(gate) - ctx.voltage(source));
      const vds = sign * (ctx.voltage(drain) - ctx.voltage(source));

      let ids = 0;
      let gm = 0;
      let gds = 1e-12;
      if (vgs > vt) {
        const overdrive = vgs - vt;
        if (vds < overdrive) {
          ids = k * (overdrive * vds - (vds * vds) / 2);
          gm = k * vds;
          gds = k * (overdrive - vds);
        } else {
          ids = (k / 2) * overdrive * overdrive * (1 + lambda * vds);
          gm = k * overdrive * (1 + lambda * vds);
          gds = (k / 2) * overdrive * overdrive * lambda;
        }
      }
      gds = Math.max(gds, 1e-12);

      if (type === 'n') {
        ctx.addConductance(drain, source, gds);
        ctx.stampTransconductance(drain, source, gate, source, gm);
        ctx.addCurrent(drain, source, ids - gm * vgs - gds * vds);
      } else {
        ctx.addConductance(source, drain, gds);
        ctx.stampTransconductance(source, drain, gate, source, gm);
        ctx.addCurrent(source, drain, ids - gm * vgs - gds * vds);
      }
    },
  };
}

export type BjtOptions = {
  type?: 'npn' | 'pnp';
  is?: number;
  bf?: number;
  br?: number;
  vt?: number;
};

/** Ebers–Moll BJT (NPN or PNP) with junction limiting. */
export function createBjt(
  name: string,
  collector: number,
  base: number,
  emitter: number,
  options: BjtOptions = {},
): Device {
  const sign = options.type === 'pnp' ? -1 : 1;
  const is = options.is ?? 1e-14;
  const bf = options.bf ?? 100;
  const br = options.br ?? 1;
  const vt = options.vt ?? DEFAULT_VT;
  const vcrit = vt * Math.log(vt / (Math.SQRT2 * is));
  let vbePrev = 0;
  let vbcPrev = 0;

  const nodeV = (solution: Float64Array, node: number): number =>
    node === 0 ? 0 : (solution[node - 1] ?? 0);

  return {
    name,
    kind: 'bjt',
    nodes: [collector, base, emitter],
    limit: (solution) => {
      const vbe = sign * (nodeV(solution, base) - nodeV(solution, emitter));
      const vbc = sign * (nodeV(solution, base) - nodeV(solution, collector));
      const limitedBe = pnjlim(vbe, vbePrev, vt, vcrit);
      const limitedBc = pnjlim(vbc, vbcPrev, vt, vcrit);
      const dbe = limitedBe - vbe;
      const dbc = limitedBc - vbc;
      vbePrev = limitedBe;
      vbcPrev = limitedBc;
      if (base !== 0) solution[base - 1] = (solution[base - 1] ?? 0) + sign * (dbe + dbc);
      if (emitter !== 0) solution[emitter - 1] = (solution[emitter - 1] ?? 0) - sign * dbe;
      if (collector !== 0) solution[collector - 1] = (solution[collector - 1] ?? 0) - sign * dbc;
      return dbe !== 0 || dbc !== 0;
    },
    stamp: (ctx) => {
      const vbe = sign * (ctx.voltage(base) - ctx.voltage(emitter));
      const vbc = sign * (ctx.voltage(base) - ctx.voltage(collector));
      const evbe = Math.exp(clamp(vbe / vt));
      const evbc = Math.exp(clamp(vbc / vt));
      const ifwd = is * (evbe - 1);
      const irwd = is * (evbc - 1);
      const gmF = (is / vt) * evbe;
      const gmR = (is / vt) * evbc;
      const ic = ifwd - irwd * (1 + 1 / br);
      const ib = ifwd / bf + irwd / br;
      const gcf = gmF;
      const gcr = -gmR * (1 + 1 / br);
      const gbf = gmF / bf;
      const gbr = gmR / br;

      ctx.addConductance(collector, emitter, 1e-12);
      ctx.addConductance(base, emitter, 1e-12);
      ctx.stampTransconductance(collector, emitter, base, emitter, sign * gcf);
      ctx.stampTransconductance(collector, emitter, base, collector, sign * gcr);
      ctx.stampTransconductance(base, emitter, base, emitter, sign * gbf);
      ctx.stampTransconductance(base, emitter, base, collector, sign * gbr);
      ctx.addCurrent(collector, emitter, sign * (ic - gcf * vbe - gcr * vbc));
      ctx.addCurrent(base, emitter, sign * (ib - gbf * vbe - gbr * vbc));
    },
  };
}
