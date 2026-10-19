import { z } from 'zod'

/**
 * The serializable circuit document is the single source of truth. Konva nodes
 * are a derived view, and every command in the undo stack is a transform of this
 * value. Keep it free of anything that cannot round-trip through JSON.
 */

export const partTypeSchema = z.enum([
  'arduino-uno',
  'breadboard',
  'led',
  'resistor',
  'push-button',
  'potentiometer',
  'buzzer',
  'capacitor',
  'diode',
  'inductor',
  'slide-switch',
  'ldr',
  'rgb-led',
  'seven-segment',
  'dc-motor',
  'battery-aa',
  'battery-9v',
  'power-supply',
])

export const pointSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
})

export const rotationSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])

export const ledColorSchema = z.enum(['red', 'green', 'blue', 'yellow', 'white'])

/** Per-part property shapes. Empty objects still parse strictly, so unknown keys fail. */
export const partPropsSchemas = {
  'arduino-uno': z.strictObject({}),
  breadboard: z.strictObject({}),
  led: z.strictObject({ color: ledColorSchema }),
  resistor: z.strictObject({ resistanceOhms: z.number().positive().max(1_000_000) }),
  'push-button': z.strictObject({}),
  potentiometer: z.strictObject({
    resistanceOhms: z.number().positive().max(1_000_000),
  }),
  buzzer: z.strictObject({}),
  capacitor: z.strictObject({ capacitanceMicroFarads: z.number().positive().max(1_000_000) }),
  diode: z.strictObject({}),
  inductor: z.strictObject({ inductanceMilliHenries: z.number().positive().max(1_000_000) }),
  'slide-switch': z.strictObject({}),
  ldr: z.strictObject({}),
  'rgb-led': z.strictObject({}),
  'seven-segment': z.strictObject({ color: ledColorSchema }),
  'dc-motor': z.strictObject({}),
  'battery-aa': z.strictObject({}),
  'battery-9v': z.strictObject({}),
  'power-supply': z.strictObject({}),
} as const

export const pinRefSchema = z.strictObject({
  partId: z.string().min(1),
  pinId: z.string().min(1),
})

export const wireSchema = z.strictObject({
  id: z.string().min(1),
  from: pinRefSchema,
  to: pinRefSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  waypoints: z.array(pointSchema),
})

interface PartVariant<Type extends PartType> {
  readonly id: z.ZodString
  readonly type: z.ZodLiteral<Type>
  readonly position: typeof pointSchema
  readonly rotation: typeof rotationSchema
  readonly props: (typeof partPropsSchemas)[Type]
}

function partVariant<Type extends PartType>(type: Type): PartVariant<Type> {
  return {
    id: z.string().min(1),
    type: z.literal(type),
    position: pointSchema,
    rotation: rotationSchema,
    props: partPropsSchemas[type],
  }
}

export const partSchema = z.discriminatedUnion('type', [
  z.strictObject(partVariant('arduino-uno')),
  z.strictObject(partVariant('breadboard')),
  z.strictObject(partVariant('led')),
  z.strictObject(partVariant('resistor')),
  z.strictObject(partVariant('push-button')),
  z.strictObject(partVariant('potentiometer')),
  z.strictObject(partVariant('buzzer')),
  z.strictObject(partVariant('capacitor')),
  z.strictObject(partVariant('diode')),
  z.strictObject(partVariant('inductor')),
  z.strictObject(partVariant('slide-switch')),
  z.strictObject(partVariant('ldr')),
  z.strictObject(partVariant('rgb-led')),
  z.strictObject(partVariant('seven-segment')),
  z.strictObject(partVariant('dc-motor')),
  z.strictObject(partVariant('battery-aa')),
  z.strictObject(partVariant('battery-9v')),
  z.strictObject(partVariant('power-supply')),
])

export const currentCircuitVersion = 1

export const circuitDocumentSchema = z.strictObject({
  version: z.literal(currentCircuitVersion),
  parts: z.array(partSchema),
  wires: z.array(wireSchema),
})

export type PartType = z.infer<typeof partTypeSchema>
export type Point = z.infer<typeof pointSchema>
export type Rotation = z.infer<typeof rotationSchema>
export type LedColor = z.infer<typeof ledColorSchema>
export type PinRef = z.infer<typeof pinRefSchema>
export type Wire = z.infer<typeof wireSchema>
export type PartInstance = z.infer<typeof partSchema>
export type CircuitDocument = z.infer<typeof circuitDocumentSchema>

/** Maps each part type to its props shape, so definitions stay type-safe per part. */
export type PartPropsMap = {
  [Type in PartType]: z.infer<(typeof partPropsSchemas)[Type]>
}

export function emptyCircuitDocument(): CircuitDocument {
  return { version: currentCircuitVersion, parts: [], wires: [] }
}

/** Stable key for a pin across the whole document. */
export function pinKey(ref: PinRef): string {
  return `${ref.partId}:${ref.pinId}`
}
