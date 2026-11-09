import { expect, it } from 'vitest';

import { SerialBuffer, withLineEnding } from './buffer';

it('keeps only the most recent lines up to capacity', () => {
  const buffer = new SerialBuffer(10);
  for (let index = 0; index < 25; index += 1) buffer.append(`line ${index}`, index);
  expect(buffer.size).toBe(10);
  expect(buffer.toArray()[0]?.text).toBe('line 15');
  expect(buffer.toArray().at(-1)?.text).toBe('line 24');
});

it('clears the transcript', () => {
  const buffer = new SerialBuffer();
  buffer.append('a', 0);
  buffer.clear();
  expect(buffer.size).toBe(0);
});

it('applies line endings', () => {
  expect(withLineEnding('x', 'none')).toBe('x');
  expect(withLineEnding('x', 'lf')).toBe('x\n');
  expect(withLineEnding('x', 'crlf')).toBe('x\r\n');
});

it('handles 10 000 appends quickly', () => {
  const buffer = new SerialBuffer();
  const start = Date.now();
  for (let index = 0; index < 10_000; index += 1) buffer.append(`tick ${index}`, index);
  expect(buffer.size).toBe(10_000);
  expect(Date.now() - start).toBeLessThan(500);
});
