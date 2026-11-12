import { expect, it } from 'vitest';

import { formatQuantity } from './quantity';

it('formats values with SI prefixes and unit symbols', () => {
  expect(formatQuantity(220, 'ohm')).toBe('220 Ω');
  expect(formatQuantity(10000, 'ohm')).toBe('10 kΩ');
  expect(formatQuantity(0.001, 'A')).toBe('1 mA');
  expect(formatQuantity(1e-6, 'F')).toBe('1 µF');
  expect(formatQuantity(1e-9, 'F')).toBe('1 nF');
  expect(formatQuantity(4.5, 'V')).toBe('4.5 V');
  expect(formatQuantity(500, 'lx')).toBe('500 lx');
});

it('handles zero and non-finite values', () => {
  expect(formatQuantity(0, 'V')).toBe('0 V');
  expect(formatQuantity(Number.NaN, 'V')).toBe('— V');
  expect(formatQuantity(Number.POSITIVE_INFINITY)).toBe('—');
});
