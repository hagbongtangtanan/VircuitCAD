import type { Device } from '../device';

export type OpAmpOptions = {
  gain?: number;
  outputResistance?: number;
  vcc?: number;
  vss?: number;
};

/** Finite-gain op-amp / comparator with output-current saturation (soft rail clamp). */
export function createOpAmp(
  name: string,
  output: number,
  inputPositive: number,
  inputNegative: number,
  options: OpAmpOptions = {},
): Device {
  const gain = options.gain ?? 1e5;
  const outputResistance = options.outputResistance ?? 100;
  const vcc = options.vcc ?? 5;
  const vss = options.vss ?? 0;
  const gm = gain / outputResistance;
  const minCurrent = vss / outputResistance;
  const maxCurrent = vcc / outputResistance;

  return {
    name,
    kind: 'opamp',
    nodes: [output, inputPositive, inputNegative],
    stamp: (ctx) => {
      const difference = ctx.voltage(inputPositive) - ctx.voltage(inputNegative);
      const wanted = gm * difference;
      const current = Math.max(minCurrent, Math.min(maxCurrent, wanted));
      const saturated = current !== wanted;

      ctx.addConductance(output, 0, 1 / outputResistance);
      ctx.addConductance(inputPositive, inputNegative, 1e-12);
      // Transconductance when linear; a fixed injected current when saturated.
      ctx.stampTransconductance(0, output, inputPositive, inputNegative, saturated ? 0 : gm);
      ctx.addCurrent(0, output, current);
    },
  };
}
