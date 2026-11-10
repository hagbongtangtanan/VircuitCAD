import { expect, it } from 'vitest';

import { decodeWs2812, type Edge, type Pixel } from './neopixel';

function encode(pixels: readonly Pixel[]): Edge[] {
  const edges: Edge[] = [];
  let t = 0;
  for (const pixel of pixels) {
    const bits: number[] = [];
    for (const byte of [pixel.g, pixel.r, pixel.b]) {
      for (let index = 7; index >= 0; index -= 1) bits.push((byte >> index) & 1);
    }
    for (const bit of bits) {
      const high = bit === 1 ? 0.8 : 0.4;
      edges.push({ t, high: true });
      t += high;
      edges.push({ t, high: false });
      t += 1.25 - high;
    }
    t += 60; // reset (>50 µs low)
  }
  return edges;
}

it('round-trips a single pixel through encode/decode', () => {
  const pixels = [{ r: 0, g: 255, b: 0 }];
  expect(decodeWs2812(encode(pixels))).toEqual(pixels);
});

it('decodes a multi-pixel frame', () => {
  const pixels = [
    { r: 255, g: 0, b: 0 },
    { r: 10, g: 20, b: 30 },
    { r: 1, g: 2, b: 3 },
  ];
  expect(decodeWs2812(encode(pixels))).toEqual(pixels);
});
