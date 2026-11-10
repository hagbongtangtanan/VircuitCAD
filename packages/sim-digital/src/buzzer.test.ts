import { expect, it } from 'vitest';

import { buzzerLevel } from './buzzer';

it('follows the drive level', () => {
  expect(buzzerLevel(true)).toBe('1');
  expect(buzzerLevel(false)).toBe('0');
});
