import { createEmptyCircuit } from '@vircuitcad/core';
import { expect, it } from 'vitest';

import { WorkerCommandSchema, WorkerEventSchema } from './protocol';

it('accepts valid commands', () => {
  expect(
    WorkerCommandSchema.safeParse({ type: 'start', circuit: createEmptyCircuit() }).success,
  ).toBe(true);
  expect(WorkerCommandSchema.safeParse({ type: 'stop' }).success).toBe(true);
  expect(
    WorkerCommandSchema.safeParse({ type: 'setParam', partId: 'r1', key: 'resistance', value: 470 })
      .success,
  ).toBe(true);
});

it('rejects malformed commands', () => {
  expect(WorkerCommandSchema.safeParse({ type: 'start' }).success).toBe(false);
  expect(WorkerCommandSchema.safeParse({ type: 'nope' }).success).toBe(false);
  expect(
    WorkerCommandSchema.safeParse({ type: 'setParam', partId: 'r1', key: 'x', value: {} }).success,
  ).toBe(false);
});

it('accepts snapshots, status and error events', () => {
  expect(
    WorkerEventSchema.safeParse({
      type: 'snapshot',
      time: 0,
      nodeVoltages: { N1: 5 },
      leds: [{ partId: 'd1', current: 0.02, burnedOut: false }],
    }).success,
  ).toBe(true);
  expect(WorkerEventSchema.safeParse({ type: 'status', state: 'running', time: 1 }).success).toBe(
    true,
  );
  expect(WorkerEventSchema.safeParse({ type: 'error', code: 'SHORT_CIRCUIT', message: 'x' }).success).toBe(
    true,
  );
});
