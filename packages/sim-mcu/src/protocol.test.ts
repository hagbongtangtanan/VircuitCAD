import { expect, it } from 'vitest';

import { McuCommandSchema, McuEventSchema } from './protocol';

it('accepts valid commands', () => {
  expect(McuCommandSchema.safeParse({ type: 'start', hex: ':00000001FF' }).success).toBe(true);
  expect(McuCommandSchema.safeParse({ type: 'pause' }).success).toBe(true);
  expect(
    McuCommandSchema.safeParse({ type: 'setPin', port: 'D', bit: 2, high: true }).success,
  ).toBe(true);
});

it('rejects malformed commands', () => {
  expect(McuCommandSchema.safeParse({ type: 'start' }).success).toBe(false);
  expect(McuCommandSchema.safeParse({ type: 'setPin', port: 'X', bit: 2, high: true }).success).toBe(
    false,
  );
  expect(
    McuCommandSchema.safeParse({ type: 'setPin', port: 'D', bit: 9, high: true }).success,
  ).toBe(false);
});

it('accepts pin-change, serial and state events', () => {
  expect(
    McuEventSchema.safeParse({
      type: 'pinChange',
      cycles: 8000000,
      port: 'B',
      value: 32,
      oldValue: 0,
    }).success,
  ).toBe(true);
  expect(McuEventSchema.safeParse({ type: 'serial', byte: 65 }).success).toBe(true);
  expect(McuEventSchema.safeParse({ type: 'state', running: true, cycles: 10 }).success).toBe(true);
  expect(McuEventSchema.safeParse({ type: 'pinChange', cycles: -1, port: 'B', value: 0, oldValue: 0 }).success).toBe(false);
});
