import { expect, it } from 'vitest';

import { Keypad4x4, KEYPAD_4X4, pirLevel } from './keypad';

it('reports the pressed key', () => {
  const keypad = new Keypad4x4();
  expect(keypad.key).toBeNull();
  keypad.press(1, 2);
  expect(keypad.key).toBe('6');
  keypad.release();
  expect(keypad.key).toBeNull();
  keypad.press(3, 3);
  expect(keypad.key).toBe('D');
});

it('has the standard 4x4 layout', () => {
  expect(KEYPAD_4X4[0]?.[3]).toBe('A');
  expect(KEYPAD_4X4[3]?.[0]).toBe('*');
});

it('drives a PIR digital level', () => {
  expect(pirLevel(true)).toBe('1');
  expect(pirLevel(false)).toBe('0');
});
