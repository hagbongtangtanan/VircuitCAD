import { expect, it } from 'vitest';

import { CompileCache, cacheKey } from './cache';

it('keeps cache keys stable and sensitive to inputs', () => {
  const base = { sources: 'void setup(){}', board: 'arduino:avr:uno', toolchainVersion: '0.35.0' };
  expect(cacheKey(base)).toBe(cacheKey({ ...base }));
  expect(cacheKey(base)).not.toBe(cacheKey({ ...base, sources: 'x' }));
  expect(cacheKey(base)).not.toBe(cacheKey({ ...base, libraries: ['Servo'] }));
});

it('evicts least-recently-used entries', () => {
  const cache = new CompileCache(2);
  cache.set('a', 'hex-a');
  cache.set('b', 'hex-b');
  expect(cache.get('a')).toBe('hex-a'); // refresh a
  cache.set('c', 'hex-c'); // evict b
  expect(cache.has('b')).toBe(false);
  expect(cache.get('a')).toBe('hex-a');
  expect(cache.get('c')).toBe('hex-c');
  expect(cache.size).toBe(2);
});
