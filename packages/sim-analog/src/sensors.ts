export function ldrResistance(lux: number, options: { r10?: number; gamma?: number } = {}): number {
  const r10 = options.r10 ?? 10_000;
  const gamma = options.gamma ?? 0.8;
  const light = Math.max(0.01, lux);
  return r10 * Math.pow(10 / light, gamma);
}

export function ntcResistance(celsius: number, options: { r25?: number; beta?: number } = {}): number {
  const r25 = options.r25 ?? 10_000;
  const beta = options.beta ?? 3950;
  const kelvin = Math.max(1, celsius + 273.15);
  const kelvin25 = 298.15;
  return r25 * Math.exp(beta * (1 / kelvin - 1 / kelvin25));
}

export function potentiometerResistances(
  total: number,
  position: number,
): { low: number; high: number } {
  const clamped = Math.max(0, Math.min(1, position));
  return { low: total * clamped, high: total * (1 - clamped) };
}
