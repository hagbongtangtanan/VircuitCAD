/** Conventional defaults for the two supply nets. */
export const POWER_WIRE_COLOR = '#d64545'
export const GROUND_WIRE_COLOR = '#2f7df6'
/** Signal wires keep a distinct colour so power and ground remain obvious. */
export const DEFAULT_WIRE_COLOR = '#1f9d55'

export type WireKind = 'power' | 'ground' | 'signal'

/** Ground wins when a net somehow reaches both supply kinds. */
export function wireKindFor(kinds: readonly string[]): WireKind {
  if (kinds.includes('ground')) return 'ground'
  if (kinds.includes('power')) return 'power'
  return 'signal'
}

export function wireColorFor(kind: WireKind): string {
  if (kind === 'ground') return GROUND_WIRE_COLOR
  if (kind === 'power') return POWER_WIRE_COLOR
  return DEFAULT_WIRE_COLOR
}
