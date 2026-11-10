const LN2 = Math.LN2;

export type AstableTiming = { frequency: number; duty: number; period: number };

/** 555 astable: tHigh = ln2·(R1+R2)C, tLow = ln2·R2·C. */
export function astable555(
  r1: number,
  r2: number,
  capacitance: number,
): AstableTiming {
  const tHigh = LN2 * (r1 + r2) * capacitance;
  const tLow = LN2 * r2 * capacitance;
  const period = tHigh + tLow;
  return { frequency: 1 / period, duty: tHigh / period, period };
}

/** 555 monostable pulse width: ≈ 1.1·R·C. */
export function monostable555(resistance: number, capacitance: number): number {
  return 1.1 * resistance * capacitance;
}
