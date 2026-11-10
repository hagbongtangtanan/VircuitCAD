export type Edge = { t: number; high: boolean };
export type Pixel = { r: number; g: number; b: number };

const BIT_THRESHOLD_US = 0.65;
const MIN_HIGH_US = 0.3;

function byteFrom(bits: readonly number[], start: number): number {
  let value = 0;
  for (let index = 0; index < 8; index += 1) value = (value << 1) | (bits[start + index] ?? 0);
  return value;
}

/** Decodes a WS2812 (~800 kHz) pin-edge stream into GRB pixels. */
export function decodeWs2812(edges: readonly Edge[]): Pixel[] {
  const bits: number[] = [];
  let lastHigh = -1;

  for (const edge of edges) {
    if (edge.high) {
      lastHigh = edge.t;
    } else if (lastHigh >= 0) {
      const duration = edge.t - lastHigh;
      if (duration >= MIN_HIGH_US) bits.push(duration > BIT_THRESHOLD_US ? 1 : 0);
      lastHigh = -1;
    }
  }

  const pixels: Pixel[] = [];
  for (let start = 0; start + 23 < bits.length; start += 24) {
    const g = byteFrom(bits, start);
    const r = byteFrom(bits, start + 8);
    const b = byteFrom(bits, start + 16);
    pixels.push({ r, g, b });
  }
  return pixels;
}
