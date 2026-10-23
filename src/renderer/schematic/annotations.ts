import type { PartInstance, PartType } from '../../shared/circuit'

/** Standard reference-letter prefixes, one namespace per prefix. */
const PREFIX: Readonly<Record<PartType, string>> = {
  'arduino-uno': 'U',
  breadboard: 'BB',
  led: 'D',
  resistor: 'R',
  'push-button': 'SW',
  potentiometer: 'RV',
  buzzer: 'BZ',
  capacitor: 'C',
  diode: 'D',
  inductor: 'L',
  'slide-switch': 'SW',
  ldr: 'LDR',
  'rgb-led': 'D',
  'seven-segment': 'DS',
  'dc-motor': 'M',
  'battery-aa': 'BT',
  'battery-9v': 'BT',
  'power-supply': 'PS',
  'electrolytic-capacitor': 'C',
  'zener-diode': 'D',
  'light-bulb': 'LP',
  'vibration-motor': 'M',
  'gear-motor': 'M',
  thermistor: 'TH',
  'flex-sensor': 'FS',
  'force-sensor': 'FSR',
  photodiode: 'PD',
  phototransistor: 'PT',
  'tilt-sensor': 'TS',
  'soil-moisture': 'MS',
  'gas-sensor': 'GS',
  tmp36: 'U',
  'coin-cell': 'BT',
  'solar-cell': 'SC',
  'potato-battery': 'BT',
  'dip-switch-4': 'SW',
  'dip-switch-6': 'SW',
  lm7805: 'U',
  ld1117v33: 'U',
  'ir-receiver': 'IR',
  'ultrasonic-3pin': 'US',
  'ultrasonic-hcsr04': 'US',
  'pir-sensor': 'PIR',
  'keypad-4x4': 'KP',
  'neopixel-strip': 'DS',
  'neopixel-ring': 'DS',
  'ir-remote': 'IR',
  'encoder-motor': 'M',
  servo: 'M',
  'lcd-16x2': 'DS',
  'lcd-16x2-i2c': 'DS',
  'seven-segment-clock': 'DS',
  microbit: 'U',
  attiny85: 'U',
  multimeter: 'MM',
  'function-generator': 'FG',
  oscilloscope: 'OSC',
  'ic-555': 'U',
  'ic-556': 'U',
  'opamp-741': 'U',
  'comparator-lm393': 'U',
  'comparator-lm339': 'U',
  'optocoupler-4n35': 'U',
  'transistor-npn': 'Q',
  'transistor-pnp': 'Q',
  tip120: 'Q',
  'mosfet-n': 'Q',
  'mosfet-p': 'Q',
  'relay-spdt': 'K',
  'relay-dpdt': 'K',
  l293d: 'U',
  'header-8': 'J',
  'usb-a': 'J',
  'breadboard-small': 'BB',
  'breadboard-mini': 'BB',
  '74hc00': 'U',
  '74hc02': 'U',
  '74hc08': 'U',
  '74hc32': 'U',
  '74hc86': 'U',
  '74hc04': 'U',
  '74hc14': 'U',
  '74hc131': 'U',
  '74hc132': 'U',
  '74hc10': 'U',
  '74hc11': 'U',
  '74hc27': 'U',
  '74hc20': 'U',
  '74hc21': 'U',
  '74hc73': 'U',
  '74hc74': 'U',
  '74hc75': 'U',
  '74hc93': 'U',
  '74hc283': 'U',
  '74hc595': 'U',
  '74hc4017': 'U',
  cd4511: 'U',
}

/** Assigns R1, R2, D1, … in document order, so the drawing stays stable. */
export function referenceDesignators(parts: readonly PartInstance[]): ReadonlyMap<string, string> {
  const counts = new Map<string, number>()
  const designators = new Map<string, string>()

  for (const part of parts) {
    const prefix = PREFIX[part.type]
    const next = (counts.get(prefix) ?? 0) + 1
    counts.set(prefix, next)
    designators.set(part.id, `${prefix}${next}`)
  }

  return designators
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)))
}

function formatResistance(ohms: number): string {
  if (ohms >= 1_000_000) return `${formatNumber(ohms / 1_000_000)} MΩ`
  if (ohms >= 1_000) return `${formatNumber(ohms / 1_000)} kΩ`
  return `${formatNumber(ohms)} Ω`
}

/** Engineering-style value annotation, or null when the part has no value. */
export function partValue(part: PartInstance): string | null {
  switch (part.type) {
    case 'resistor':
    case 'potentiometer':
      return formatResistance(part.props.resistanceOhms)
    case 'capacitor':
    case 'electrolytic-capacitor':
      return `${part.props.capacitanceMicroFarads} µF`
    case 'inductor':
      return `${part.props.inductanceMilliHenries} mH`
    case 'led':
      return part.props.color.toUpperCase()
    case 'rgb-led':
      return 'RGB'
    case 'zener-diode':
      return `${formatNumber(part.props.zenerVoltage)} V`
    case 'light-bulb':
      return `${formatNumber(part.props.ratedVolts)} V`
    case 'coin-cell':
      return '3 V'
    case 'solar-cell':
      return '0.6 V'
    case 'potato-battery':
      return '0.9 V'
    case 'lm7805':
      return '5 V'
    case 'ld1117v33':
      return '3.3 V'
    case 'neopixel-strip':
    case 'neopixel-ring':
      return `${part.props.pixelCount} px`
    case 'multimeter':
      return part.props.mode.toUpperCase()
    case 'function-generator':
      return `${part.props.waveform} ${formatNumber(part.props.frequencyHz)} Hz`
    case 'lcd-16x2':
    case 'lcd-16x2-i2c':
      return '16x2'
    default:
      return null
  }
}
