const DIGIT_COLORS = [
  '#11131a',
  '#6b4a2f',
  '#c0392b',
  '#d97706',
  '#eab308',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#6b7280',
  '#e5e7eb',
] as const

const TOLERANCE_GOLD = '#d4a017'

/**
 * Four-band resistor colours: two significant digits, a multiplier and the gold
 * tolerance band. Values below 10 Ω are rounded to a single digit, which is the
 * level of fidelity the simplified model needs.
 */
export function resistorBands(ohms: number): readonly string[] {
  const safe = Number.isFinite(ohms) && ohms > 0 ? ohms : 1

  let digits = Math.round(safe)
  let multiplier = 0
  while (digits >= 100 && multiplier < 9) {
    digits = Math.round(digits / 10)
    multiplier += 1
  }

  const first = Math.floor(digits / 10)
  const second = digits % 10

  return [
    DIGIT_COLORS[Math.min(first, 9)] ?? DIGIT_COLORS[0],
    DIGIT_COLORS[Math.min(second, 9)] ?? DIGIT_COLORS[0],
    DIGIT_COLORS[multiplier] ?? DIGIT_COLORS[9],
    TOLERANCE_GOLD,
  ]
}
