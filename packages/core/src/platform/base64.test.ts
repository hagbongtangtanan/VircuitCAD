import { expect, it } from 'vitest';

import { decodeBase64, encodeBase64 } from './base64';

const cases: number[][] = [
  [],
  [0],
  [0, 1],
  [0, 1, 2],
  [255, 254, 253, 252],
  Array.from({ length: 256 }, (_, index) => index),
];

it('round-trips arbitrary bytes through base64', () => {
  for (const bytes of cases) {
    const encoded = encodeBase64(Uint8Array.from(bytes));
    expect(Array.from(decodeBase64(encoded))).toEqual(bytes);
  }
});

it('matches known base64 vectors', () => {
  expect(encodeBase64(Uint8Array.from([77, 97, 110]))).toBe('TWFu');
  expect(encodeBase64(Uint8Array.from([77, 97]))).toBe('TWE=');
  expect(encodeBase64(Uint8Array.from([77]))).toBe('TQ==');
  expect(Array.from(decodeBase64('TWFu'))).toEqual([77, 97, 110]);
});
