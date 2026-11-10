import { expect, it } from 'vitest';

import { ScopeBuffer, decimate, findTrigger } from './buffer';

it('keeps only the newest samples up to capacity', () => {
  const buffer = new ScopeBuffer(3);
  for (let index = 0; index < 5; index += 1) buffer.push({ t: index, v: index });
  expect(buffer.size).toBe(3);
  expect(buffer.toArray()[0]?.t).toBe(2);
});

it('decimates samples to per-pixel min/max buckets', () => {
  const samples = [
    { t: 0, v: 0 },
    { t: 1, v: 5 },
    { t: 2, v: -3 },
    { t: 3, v: 2 },
  ];
  const buckets = decimate(samples, 2);
  expect(buckets).toHaveLength(2);
  expect(buckets[0]?.min).toBe(0);
  expect(buckets[0]?.max).toBe(5);
  expect(buckets[1]?.min).toBe(-3);
  expect(buckets[1]?.max).toBe(2);
});

it('finds the edge trigger', () => {
  const samples = [
    { t: 0, v: 0 },
    { t: 1, v: 4 },
    { t: 2, v: 4 },
    { t: 3, v: 0 },
  ];
  expect(findTrigger(samples, 2, 'rising')).toBe(1);
  expect(findTrigger(samples, 2, 'falling')).toBe(3);
  expect(findTrigger(samples, 9, 'rising')).toBe(-1);
});
