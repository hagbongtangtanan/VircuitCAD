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
  'electrolytic-capacitor',
  'zener-diode',
  'light-bulb',
  'vibration-motor',
  'gear-motor',
  'thermistor',
  'flex-sensor',
  'force-sensor',
  'photodiode',
  'phototransistor',
  'tilt-sensor',
  'soil-moisture',
  'gas-sensor',
  'tmp36',
  'coin-cell',
  'solar-cell',
  'potato-battery',
  'dip-switch-4',
  'dip-switch-6',
  'lm7805',
  'ld1117v33',
  'ir-receiver',
  'ultrasonic-3pin',
  'ultrasonic-hcsr04',
  'pir-sensor',
  'keypad-4x4',
  'neopixel-strip',
  'neopixel-ring',
  'ir-remote',
  'encoder-motor',
  'servo',
  'lcd-16x2',
  'lcd-16x2-i2c',
  'seven-segment-clock',
  'microbit',
  'attiny85',
  'multimeter',
  'function-generator',
  'oscilloscope',
  'ic-555',
  'ic-556',
  'opamp-741',
  'comparator-lm393',
  'comparator-lm339',
  'optocoupler-4n35',
  'transistor-npn',
  'transistor-pnp',
  'tip120',
  'mosfet-n',
  'mosfet-p',
  'relay-spdt',
  'relay-dpdt',
  'l293d',
  'header-8',
  'usb-a',
  'breadboard-small',
  'breadboard-mini',
  '74hc00',
  '74hc02',
  '74hc08',
  '74hc32',
  '74hc86',
  '74hc04',
  '74hc14',
  '74hc131',
  '74hc132',
  '74hc10',
  '74hc11',
  '74hc27',
  '74hc20',
  '74hc21',
  '74hc73',
  '74hc74',
  '74hc75',
  '74hc93',
  '74hc283',
  '74hc595',
  '74hc4017',
  'cd4511',
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
  'electrolytic-capacitor': z.strictObject({
    capacitanceMicroFarads: z.number().positive().max(1_000_000),
  }),
  'zener-diode': z.strictObject({ zenerVoltage: z.number().min(2).max(30) }),
  'light-bulb': z.strictObject({
    ratedVolts: z.number().positive().max(24),
    resistanceOhms: z.number().positive().max(100_000),
  }),
  'vibration-motor': z.strictObject({}),
  'gear-motor': z.strictObject({}),
  thermistor: z.strictObject({}),
  'flex-sensor': z.strictObject({}),
  'force-sensor': z.strictObject({}),
  photodiode: z.strictObject({}),
  phototransistor: z.strictObject({}),
  'tilt-sensor': z.strictObject({}),
  'soil-moisture': z.strictObject({}),
  'gas-sensor': z.strictObject({}),
  tmp36: z.strictObject({}),
  'coin-cell': z.strictObject({}),
  'solar-cell': z.strictObject({}),
  'potato-battery': z.strictObject({}),
  'dip-switch-4': z.strictObject({}),
  'dip-switch-6': z.strictObject({}),
  lm7805: z.strictObject({}),
  ld1117v33: z.strictObject({}),
  'ir-receiver': z.strictObject({}),
  'ultrasonic-3pin': z.strictObject({}),
  'ultrasonic-hcsr04': z.strictObject({}),
  'pir-sensor': z.strictObject({}),
  'keypad-4x4': z.strictObject({}),
  'neopixel-strip': z.strictObject({
    pixelCount: z.number().int().min(4).max(24),
    color: ledColorSchema,
  }),
  'neopixel-ring': z.strictObject({
    pixelCount: z.number().int().min(12).max(24),
    color: ledColorSchema,
  }),
  'ir-remote': z.strictObject({}),
  'encoder-motor': z.strictObject({}),
  servo: z.strictObject({}),
  'lcd-16x2': z.strictObject({}),
  'lcd-16x2-i2c': z.strictObject({}),
  'seven-segment-clock': z.strictObject({}),
  microbit: z.strictObject({}),
  attiny85: z.strictObject({}),
  multimeter: z.strictObject({ mode: z.enum(['volts', 'amps', 'ohms']) }),
  'function-generator': z.strictObject({
    waveform: z.enum(['sine', 'square', 'triangle']),
    frequencyHz: z.number().positive().max(100_000),
    amplitudeVolts: z.number().min(0).max(12),
    offsetVolts: z.number().min(-12).max(12),
  }),
  oscilloscope: z.strictObject({}),
  'ic-555': z.strictObject({}),
  'ic-556': z.strictObject({}),
  'opamp-741': z.strictObject({}),
  'comparator-lm393': z.strictObject({}),
  'comparator-lm339': z.strictObject({}),
  'optocoupler-4n35': z.strictObject({}),
  'transistor-npn': z.strictObject({}),
  'transistor-pnp': z.strictObject({}),
  tip120: z.strictObject({}),
  'mosfet-n': z.strictObject({}),
  'mosfet-p': z.strictObject({}),
  'relay-spdt': z.strictObject({}),
  'relay-dpdt': z.strictObject({}),
  l293d: z.strictObject({}),
  'header-8': z.strictObject({}),
  'usb-a': z.strictObject({}),
  'breadboard-small': z.strictObject({}),
  'breadboard-mini': z.strictObject({}),
  '74hc00': z.strictObject({}),
  '74hc02': z.strictObject({}),
  '74hc08': z.strictObject({}),
  '74hc32': z.strictObject({}),
  '74hc86': z.strictObject({}),
  '74hc04': z.strictObject({}),
  '74hc14': z.strictObject({}),
  '74hc131': z.strictObject({}),
  '74hc132': z.strictObject({}),
  '74hc10': z.strictObject({}),
  '74hc11': z.strictObject({}),
  '74hc27': z.strictObject({}),
  '74hc20': z.strictObject({}),
  '74hc21': z.strictObject({}),
  '74hc73': z.strictObject({}),
  '74hc74': z.strictObject({}),
  '74hc75': z.strictObject({}),
  '74hc93': z.strictObject({}),
  '74hc283': z.strictObject({}),
  '74hc595': z.strictObject({}),
  '74hc4017': z.strictObject({}),
  cd4511: z.strictObject({}),
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
  /** Mirrored across the vertical axis; omitted in projects saved before flipping. */
  readonly flipX: z.ZodOptional<z.ZodBoolean>
  /** Mirrored across the horizontal axis; omitted in projects saved before flipping. */
  readonly flipY: z.ZodOptional<z.ZodBoolean>
  readonly props: (typeof partPropsSchemas)[Type]
}

function partVariant<Type extends PartType>(type: Type): PartVariant<Type> {
  return {
    id: z.string().min(1),
    type: z.literal(type),
    position: pointSchema,
    rotation: rotationSchema,
    flipX: z.boolean().optional(),
    flipY: z.boolean().optional(),
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
  z.strictObject(partVariant('electrolytic-capacitor')),
  z.strictObject(partVariant('zener-diode')),
  z.strictObject(partVariant('light-bulb')),
  z.strictObject(partVariant('vibration-motor')),
  z.strictObject(partVariant('gear-motor')),
  z.strictObject(partVariant('thermistor')),
  z.strictObject(partVariant('flex-sensor')),
  z.strictObject(partVariant('force-sensor')),
  z.strictObject(partVariant('photodiode')),
  z.strictObject(partVariant('phototransistor')),
  z.strictObject(partVariant('tilt-sensor')),
  z.strictObject(partVariant('soil-moisture')),
  z.strictObject(partVariant('gas-sensor')),
  z.strictObject(partVariant('tmp36')),
  z.strictObject(partVariant('coin-cell')),
  z.strictObject(partVariant('solar-cell')),
  z.strictObject(partVariant('potato-battery')),
  z.strictObject(partVariant('dip-switch-4')),
  z.strictObject(partVariant('dip-switch-6')),
  z.strictObject(partVariant('lm7805')),
  z.strictObject(partVariant('ld1117v33')),
  z.strictObject(partVariant('ir-receiver')),
  z.strictObject(partVariant('ultrasonic-3pin')),
  z.strictObject(partVariant('ultrasonic-hcsr04')),
  z.strictObject(partVariant('pir-sensor')),
  z.strictObject(partVariant('keypad-4x4')),
  z.strictObject(partVariant('neopixel-strip')),
  z.strictObject(partVariant('neopixel-ring')),
  z.strictObject(partVariant('ir-remote')),
  z.strictObject(partVariant('encoder-motor')),
  z.strictObject(partVariant('servo')),
  z.strictObject(partVariant('lcd-16x2')),
  z.strictObject(partVariant('lcd-16x2-i2c')),
  z.strictObject(partVariant('seven-segment-clock')),
  z.strictObject(partVariant('microbit')),
  z.strictObject(partVariant('attiny85')),
  z.strictObject(partVariant('multimeter')),
  z.strictObject(partVariant('function-generator')),
  z.strictObject(partVariant('oscilloscope')),
  z.strictObject(partVariant('ic-555')),
  z.strictObject(partVariant('ic-556')),
  z.strictObject(partVariant('opamp-741')),
  z.strictObject(partVariant('comparator-lm393')),
  z.strictObject(partVariant('comparator-lm339')),
  z.strictObject(partVariant('optocoupler-4n35')),
  z.strictObject(partVariant('transistor-npn')),
  z.strictObject(partVariant('transistor-pnp')),
  z.strictObject(partVariant('tip120')),
  z.strictObject(partVariant('mosfet-n')),
  z.strictObject(partVariant('mosfet-p')),
  z.strictObject(partVariant('relay-spdt')),
  z.strictObject(partVariant('relay-dpdt')),
  z.strictObject(partVariant('l293d')),
  z.strictObject(partVariant('header-8')),
  z.strictObject(partVariant('usb-a')),
  z.strictObject(partVariant('breadboard-small')),
  z.strictObject(partVariant('breadboard-mini')),
  z.strictObject(partVariant('74hc00')),
  z.strictObject(partVariant('74hc02')),
  z.strictObject(partVariant('74hc08')),
  z.strictObject(partVariant('74hc32')),
  z.strictObject(partVariant('74hc86')),
  z.strictObject(partVariant('74hc04')),
  z.strictObject(partVariant('74hc14')),
  z.strictObject(partVariant('74hc131')),
  z.strictObject(partVariant('74hc132')),
  z.strictObject(partVariant('74hc10')),
  z.strictObject(partVariant('74hc11')),
  z.strictObject(partVariant('74hc27')),
  z.strictObject(partVariant('74hc20')),
  z.strictObject(partVariant('74hc21')),
  z.strictObject(partVariant('74hc73')),
  z.strictObject(partVariant('74hc74')),
  z.strictObject(partVariant('74hc75')),
  z.strictObject(partVariant('74hc93')),
  z.strictObject(partVariant('74hc283')),
  z.strictObject(partVariant('74hc595')),
  z.strictObject(partVariant('74hc4017')),
  z.strictObject(partVariant('cd4511')),
])

export const noteSchema = z.strictObject({
  id: z.string().min(1),
  text: z.string().max(4000),
  position: pointSchema,
})

export const currentCircuitVersion = 1

export const circuitDocumentSchema = z.strictObject({
  version: z.literal(currentCircuitVersion),
  parts: z.array(partSchema),
  wires: z.array(wireSchema),
  /** Canvas annotations; omitted in projects saved before notes existed. */
  notes: z.array(noteSchema).optional(),
})

export type PartType = z.infer<typeof partTypeSchema>
export type Point = z.infer<typeof pointSchema>
export type Rotation = z.infer<typeof rotationSchema>
export type LedColor = z.infer<typeof ledColorSchema>
export type PinRef = z.infer<typeof pinRefSchema>
export type Wire = z.infer<typeof wireSchema>
export type Note = z.infer<typeof noteSchema>
export type PartInstance = z.infer<typeof partSchema>
export type CircuitDocument = z.infer<typeof circuitDocumentSchema>

/** Maps each part type to its props shape, so definitions stay type-safe per part. */
export type PartPropsMap = {
  [Type in PartType]: z.infer<(typeof partPropsSchemas)[Type]>
}

export function emptyCircuitDocument(): CircuitDocument {
  return { version: currentCircuitVersion, parts: [], wires: [], notes: [] }
}

/** Stable key for a pin across the whole document. */
export function pinKey(ref: PinRef): string {
  return `${ref.partId}:${ref.pinId}`
}

export function pinRefEquals(a: PinRef, b: PinRef): boolean {
  return a.partId === b.partId && a.pinId === b.pinId
}

/**
 * A physical terminal accepts exactly one wire. `ignoreWireId` lets a wire keep
 * its own endpoints while it is being edited.
 */
export function pinHasWire(wires: readonly Wire[], ref: PinRef, ignoreWireId?: string): boolean {
  return wires.some(
    (wire) =>
      wire.id !== ignoreWireId && (pinRefEquals(wire.from, ref) || pinRefEquals(wire.to, ref))
  )
}
