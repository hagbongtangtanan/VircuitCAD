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
      return `${part.props.capacitanceMicroFarads} µF`
    case 'inductor':
      return `${part.props.inductanceMilliHenries} mH`
    case 'led':
    case 'rgb-led':
      return part.props.color.toUpperCase()
    default:
      return null
  }
}
