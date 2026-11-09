import { expect, it } from 'vitest';

import { ldrResistance, ntcResistance, potentiometerResistances } from './sensors';

it('models the LDR as brighter = lower resistance', () => {
  expect(ldrResistance(10)).toBeCloseTo(10_000);
  expect(ldrResistance(100)).toBeLessThan(ldrResistance(10));
  expect(ldrResistance(0.1)).toBeGreaterThan(100_000);
});

it('models the NTC thermistor as hotter = lower resistance', () => {
  expect(ntcResistance(25)).toBeCloseTo(10_000);
  expect(ntcResistance(50)).toBeLessThan(ntcResistance(25));
  expect(ntcResistance(0)).toBeGreaterThan(ntcResistance(25));
});

it('splits a potentiometer into two legs', () => {
  expect(potentiometerResistances(10_000, 0.25)).toEqual({ low: 2500, high: 7500 });
  expect(potentiometerResistances(10_000, 2)).toEqual({ low: 10_000, high: 0 });
});
