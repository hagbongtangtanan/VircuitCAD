import { expect, it } from 'vitest';

import { ledGlow, ledTint, voltageToColor } from './visuals';

it('maps LED current to glow brightness', () => {
  expect(ledGlow(0)).toBe(0);
  expect(ledGlow(0.01)).toBeCloseTo(0.5);
  expect(ledGlow(0.05)).toBe(1);
  expect(ledGlow(-1)).toBe(0);
  expect(ledGlow(Number.NaN)).toBe(0);
});

it('tints LEDs by glow and burnout', () => {
  expect(ledTint(0, false)).toBe(0x552222);
  expect(ledTint(0.5, false)).toBe(0xff5555);
  expect(ledTint(1, true)).toBe(0x333333);
});

it('maps voltage to a blue→grey→red gradient', () => {
  expect(voltageToColor(0, 0, 10)).toBe(0x38bdf8);
  expect(voltageToColor(10, 0, 10)).toBe(0xef4444);
  expect(voltageToColor(5, 0, 10)).toBe(0x94a3b8);
  expect(voltageToColor(50, 0, 10)).toBe(0xef4444);
  expect(voltageToColor(0, 5, 5)).toBe(0x94a3b8);
});
