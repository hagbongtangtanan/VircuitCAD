import { CircuitSchema } from '@vircuitcad/core';
import { z } from 'zod';

export const SimStateSchema = z.enum(['idle', 'running', 'paused', 'stopped']);
export type SimState = z.infer<typeof SimStateSchema>;

export const ParamValueSchema = z.union([z.number(), z.string(), z.boolean()]);

export const WorkerCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), circuit: CircuitSchema }),
  z.object({ type: z.literal('stop') }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({
    type: z.literal('setParam'),
    partId: z.string().min(1),
    key: z.string().min(1),
    value: ParamValueSchema,
  }),
]);
export type WorkerCommand = z.infer<typeof WorkerCommandSchema>;

export const LedCurrentSchema = z.object({ partId: z.string(), current: z.number(), burnedOut: z.boolean() });

export const SnapshotSchema = z.object({
  type: z.literal('snapshot'),
  time: z.number(),
  nodeVoltages: z.record(z.string(), z.number()),
  leds: z.array(LedCurrentSchema),
});
export type SimSnapshot = z.infer<typeof SnapshotSchema>;

export const StatusSchema = z.object({
  type: z.literal('status'),
  state: SimStateSchema,
  time: z.number(),
});
export type SimStatus = z.infer<typeof StatusSchema>;

export const SimErrorEventSchema = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
});
export type SimErrorEvent = z.infer<typeof SimErrorEventSchema>;

export const WorkerEventSchema = z.discriminatedUnion('type', [
  SnapshotSchema,
  StatusSchema,
  SimErrorEventSchema,
]);
export type WorkerEvent = z.infer<typeof WorkerEventSchema>;
