import { expect, it } from 'vitest';

import { Counter, DFlipFlop, JohnsonCounter, ShiftRegister, decode } from './components';

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

it('decodes binary selects', () => {
  expect(decode(5, 3)).toBe(5);
  expect(decode(5, 3, false)).toBe(-1);
  expect(decode(9, 3)).toBe(1);
});

it('cycles a 4017 Johnson counter through ten outputs', () => {
  const counter = new JohnsonCounter();
  for (let index = 0; index < 10; index += 1) {
    counter.step(true);
    counter.step(false);
  }
  expect(counter.active).toBe(0);
  counter.step(true);
  expect(counter.active).toBe(1);
  expect(counter.output(1)).toBe(true);
  expect(counter.output(2)).toBe(false);
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
