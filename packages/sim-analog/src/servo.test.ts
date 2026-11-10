import { expect, it } from 'vitest';

import { servoAngle, servoPulse } from './servo';

it('maps pulse width to angle with clamping', () => {
  expect(servoAngle(1500)).toBeCloseTo(90);
  expect(servoAngle(500)).toBe(0);
  expect(servoAngle(2500)).toBe(180);
  expect(servoAngle(1250)).toBeCloseTo(45);
});

it('round-trips angle and pulse width', () => {
  expect(servoPulse(180)).toBeCloseTo(2000);
  expect(servoAngle(servoPulse(30))).toBeCloseTo(30);
});
