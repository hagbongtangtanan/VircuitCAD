import { z } from 'zod';

export const McuPortSchema = z.enum(['B', 'C', 'D']);
export type McuPort = z.infer<typeof McuPortSchema>;

export const McuCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), hex: z.string().min(1) }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('reset') }),
  z.object({
    type: z.literal('setPin'),
    port: McuPortSchema,
    bit: z.number().int().min(0).max(7),
    high: z.boolean(),
  }),
]);
export type McuCommand = z.infer<typeof McuCommandSchema>;

export const PinChangeEventSchema = z.object({
  type: z.literal('pinChange'),
  cycles: z.number().int().nonnegative(),
  port: McuPortSchema,
  value: z.number().int().min(0).max(255),
  oldValue: z.number().int().min(0).max(255),
});
export type McuPinChangeEvent = z.infer<typeof PinChangeEventSchema>;

export const SerialEventSchema = z.object({
  type: z.literal('serial'),
  byte: z.number().int().min(0).max(255),
});
export type McuSerialEvent = z.infer<typeof SerialEventSchema>;

export const McuStateEventSchema = z.object({
  type: z.literal('state'),
  running: z.boolean(),
  cycles: z.number().int().nonnegative(),
  realTimeFactor: z.number().optional(),
  overloaded: z.boolean().optional(),
});
export type McuStateEvent = z.infer<typeof McuStateEventSchema>;

export const McuEventSchema = z.discriminatedUnion('type', [
  PinChangeEventSchema,
  SerialEventSchema,
  McuStateEventSchema,
]);
export type McuEvent = z.infer<typeof McuEventSchema>;
