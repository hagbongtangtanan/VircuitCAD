import { expect, it } from 'vitest';

import { joystickAxis } from './joystick';

it('normalises the joystick axis with a dead-zone', () => {
  expect(joystickAxis(512)).toBe(0);
  expect(joystickAxis(520)).toBe(0); // within dead-zone
  expect(joystickAxis(1023)).toBeCloseTo(1);
  expect(joystickAxis(0)).toBeCloseTo(-1);
  expect(joystickAxis(768)).toBeCloseTo(0.5, 2); // (768-512)/(1023-512)
});
