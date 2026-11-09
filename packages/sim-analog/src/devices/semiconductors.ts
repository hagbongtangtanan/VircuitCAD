import type { Device } from '../device';

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
