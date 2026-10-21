import type { PinKind } from '../parts/definitions'

/**
 * How an Arduino Uno pin participates in the simulation. Digital/analog pins
 * map onto an ATmega328P port bit; power pins are fixed sources and the two
 * ground pins are 0 V references.
 */
export type UnoPinSpec =
  | { readonly kind: 'io'; readonly port: 'B' | 'C' | 'D'; readonly bit: number }
  | { readonly kind: 'vcc'; readonly volts: number }
  | { readonly kind: 'gnd' }

export const UNO_PIN_SPECS: Readonly<Record<string, UnoPinSpec>> = {
  D0: { kind: 'io', port: 'D', bit: 0 },
  D1: { kind: 'io', port: 'D', bit: 1 },
  D2: { kind: 'io', port: 'D', bit: 2 },
  D3: { kind: 'io', port: 'D', bit: 3 },
  D4: { kind: 'io', port: 'D', bit: 4 },
  D5: { kind: 'io', port: 'D', bit: 5 },
  D6: { kind: 'io', port: 'D', bit: 6 },
  D7: { kind: 'io', port: 'D', bit: 7 },
  D8: { kind: 'io', port: 'B', bit: 0 },
  D9: { kind: 'io', port: 'B', bit: 1 },
  D10: { kind: 'io', port: 'B', bit: 2 },
  D11: { kind: 'io', port: 'B', bit: 3 },
  D12: { kind: 'io', port: 'B', bit: 4 },
  D13: { kind: 'io', port: 'B', bit: 5 },
  A0: { kind: 'io', port: 'C', bit: 0 },
  A1: { kind: 'io', port: 'C', bit: 1 },
  A2: { kind: 'io', port: 'C', bit: 2 },
  A3: { kind: 'io', port: 'C', bit: 3 },
  A4: { kind: 'io', port: 'C', bit: 4 },
  A5: { kind: 'io', port: 'C', bit: 5 },
  VIN: { kind: 'vcc', volts: 5 },
  '3V3': { kind: 'vcc', volts: 3.3 },
  '5V': { kind: 'vcc', volts: 5 },
  GND: { kind: 'gnd' },
  GND2: { kind: 'gnd' },
}

export function unoPinSpec(pinId: string): UnoPinSpec | undefined {
  return UNO_PIN_SPECS[pinId]
}

/** Digital pins are the ones the simulator can drive high/low. */
export function isDigitalPin(pinId: string): boolean {
  const spec = UNO_PIN_SPECS[pinId]
  return spec?.kind === 'io'
}

export const UNO_IO_PIN_IDS: readonly string[] = Object.keys(UNO_PIN_SPECS).filter(isDigitalPin)

/** The six digital pins wired to an ATmega328P timer output compare channel. */
export const UNO_PWM_PIN_IDS = ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'] as const
export type UnoPwmPinId = (typeof UNO_PWM_PIN_IDS)[number]

export interface UnoPwmRoute {
  readonly timer: 0 | 1 | 2
  readonly channel: 'A' | 'B'
}

/**
 * Physical PWM routing of the Uno R3. D3 and D11 are timer 2, D5/D6 are timer
 * 0, and D9/D10 are the two channels of 16-bit timer 1.
 */
export const UNO_PWM_ROUTES: Readonly<Record<UnoPwmPinId, UnoPwmRoute>> = {
  D3: { timer: 2, channel: 'B' },
  D5: { timer: 0, channel: 'B' },
  D6: { timer: 0, channel: 'A' },
  D9: { timer: 1, channel: 'A' },
  D10: { timer: 1, channel: 'B' },
  D11: { timer: 2, channel: 'A' },
}

export function isPwmPin(pinId: string): pinId is UnoPwmPinId {
  return UNO_PWM_PIN_IDS.includes(pinId as UnoPwmPinId)
}

export type UnoPinKind = PinKind

/** Output resistance of an AVR I/O pin: close enough to the datasheet curves. */
export const PIN_OUTPUT_RESISTANCE_OHMS = 25
/** Internal pull-up, active when a pin is an input with PORTx bit set. */
export const PIN_PULLUP_RESISTANCE_OHMS = 30_000
/** The Uno's 5 V rail comes from USB through a polyfuse; model a little sag. */
export const VCC_5V_RESISTANCE_OHMS = 0.5
export const VCC_3V3_RESISTANCE_OHMS = 1
export const GROUND_RESISTANCE_OHMS = 0.1
