import { expect, it } from 'vitest';

import { hBridgeOutput, stepMotor, type MotorParams } from './motor';

it('drives the H-bridge from input/enable states', () => {
  expect(hBridgeOutput(true, false, true)).toBe(1);
  expect(hBridgeOutput(false, true, true)).toBe(-1);
  expect(hBridgeOutput(true, true, true)).toBe(0);
  expect(hBridgeOutput(false, false, true)).toBe(0);
  expect(hBridgeOutput(true, false, false)).toBe(0);
});

it('spins up a DC motor toward no-load speed', () => {
  const params: MotorParams = { resistance: 1, backEmf: 1, inertia: 0.01, friction: 0 };
  let state = { omega: 0, current: 0 };
  for (let step = 0; step < 5000; step += 1) state = stepMotor(state, 10, params, 0.001);
  expect(state.omega).toBeGreaterThan(9.9);
  expect(Math.abs(state.current)).toBeLessThan(0.1);
});

it('decays speed to zero with no applied voltage', () => {
  const params: MotorParams = { resistance: 1, backEmf: 1, inertia: 0.01, friction: 0.1 };
  let state = { omega: 5, current: 0 };
  for (let step = 0; step < 2000; step += 1) state = stepMotor(state, 0, params, 0.001);
  expect(state.omega).toBeLessThan(0.1);
});
