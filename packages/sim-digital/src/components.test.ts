import { expect, it } from 'vitest';

import { Counter, DFlipFlop, ShiftRegister } from './components';

it('captures D on the rising clock edge', () => {
  const ff = new DFlipFlop();
  ff.step(false, true); // clock low: nothing
  expect(ff.Q).toBe(false);
  ff.step(true, true); // rising edge: capture 1
  expect(ff.Q).toBe(true);
  ff.step(true, false); // still high: no change
  expect(ff.Q).toBe(true);
  ff.step(false, false);
  ff.step(true, false); // rising edge: capture 0
  expect(ff.Q).toBe(false);
});

it('counts on rising edges and wraps', () => {
  const counter = new Counter(3);
  for (let index = 0; index < 9; index += 1) {
    counter.step({ clock: true });
    counter.step({ clock: false });
  }
  expect(counter.count).toBe(9 & 0b111); // 1
  counter.step({ clock: true, reset: true });
  expect(counter.count).toBe(0);
});

it('shifts serial data in', () => {
  const shift = new ShiftRegister(8);
  const bits = [1, 0, 1, 1, 0, 0, 0, 1];
  for (const bit of bits) {
    shift.step({ clock: true, serial: bit === 1 });
    shift.step({ clock: false, serial: false });
  }
  expect(shift.value).toBe(0b10110001);
});
