import { expect, it } from 'vitest';

import { DigitalEngine } from './engine';
import { and, drive, nand, not, or, xor } from './levels';

it('evaluates gate truth tables', () => {
  expect(and('1', '1')).toBe('1');
  expect(and('1', '0')).toBe('0');
  expect(and('X', '1')).toBe('X');
  expect(or('0', '0')).toBe('0');
  expect(or('X', '1')).toBe('1');
  expect(not('0')).toBe('1');
  expect(nand('1', '1')).toBe('0');
  expect(xor('1', '0')).toBe('1');
  expect(xor('X', '0')).toBe('X');
});

it('resolves wired drivers (conflict → X, undriven → Z)', () => {
  expect(drive('1', '1')).toBe('1');
  expect(drive('1', 'Z')).toBe('1');
  expect(drive('1', '0')).toBe('X');
  expect(drive('Z', 'Z')).toBe('Z');
});

it('propagates through a gate chain', () => {
  const engine = new DigitalEngine({ a: '1', b: '1', c: '0' });
  engine.addGate({ id: 'g1', inputs: ['a', 'b'], output: 'and', evaluate: (i) => and(i[0] ?? 'X', i[1] ?? 'X') });
  engine.addGate({ id: 'g2', inputs: ['and', 'c'], output: 'out', evaluate: (i) => or(i[0] ?? 'X', i[1] ?? 'X') });
  const result = engine.settle();
  expect(result.settled).toBe(true);
  expect(result.levels.and).toBe('1');
  expect(result.levels.out).toBe('1');
});

it('stops at the iteration cap for a combinational loop', () => {
  const engine = new DigitalEngine({ a: '1' });
  engine.addGate({ id: 'inv', inputs: ['a'], output: 'loop', evaluate: (i) => not(i[0] ?? 'X') });
  engine.addGate({ id: 'feed', inputs: ['loop'], output: 'a', evaluate: (i) => i[0] ?? 'X' });
  const result = engine.settle(10);
  expect(result.iterations).toBe(10);
  expect(result.settled).toBe(false);
});
