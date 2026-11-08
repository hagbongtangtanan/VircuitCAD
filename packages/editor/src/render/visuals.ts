export function ledGlow(current: number, ratedCurrent = 0.02): number {
  if (!Number.isFinite(current) || current <= 0) return 0;
  return Math.max(0, Math.min(1, current / ratedCurrent));
}

export function ledTint(glow: number, burnedOut: boolean): number {
  if (burnedOut) return 0x333333;
  if (glow <= 0) return 0x552222;
  return 0xff5555;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): number {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return (r << 16) | (g << 8) | bl;
}

const LOW: [number, number, number] = [0x38, 0xbd, 0xf8];
const MID: [number, number, number] = [0x94, 0xa3, 0xb8];
const HIGH: [number, number, number] = [0xef, 0x44, 0x44];

export function voltageToColor(voltage: number, min: number, max: number): number {
  if (!Number.isFinite(voltage) || max <= min) return mix(MID, MID, 0);
  const t = Math.max(0, Math.min(1, (voltage - min) / (max - min)));
  return t < 0.5 ? mix(LOW, MID, t * 2) : mix(MID, HIGH, (t - 0.5) * 2);
}
