import type { LedColor } from '../../shared/circuit'

/** Bulb colour per LED option; the glow is a lighter tint over the top. */
export const LED_COLORS: Record<LedColor, { readonly body: string; readonly glow: string }> = {
  red: { body: '#e5484d', glow: '#ff8a8f' },
  green: { body: '#46a758', glow: '#8ce099' },
  blue: { body: '#3b82f6', glow: '#93c5fd' },
  yellow: { body: '#e2b93b', glow: '#fbe38a' },
  white: { body: '#d7dbe3', glow: '#ffffff' },
}

export type RgbChannel = 'red' | 'green' | 'blue'

export interface RgbGlow {
  /** Additive mix of the lit dies, normalised so brightness controls opacity. */
  readonly color: string
  /** Combined intensity, 0 to 1. */
  readonly strength: number
}

/** Saturated primaries used when adding the dies together as light. */
const RGB_MIX_COLORS: Record<RgbChannel, string> = {
  red: '#ff2d2d',
  green: '#2dd94f',
  blue: '#2d6bff',
}

function parseHex(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/**
 * Mixes the RGB LED dice the way light adds: red + blue gives violet, all three
 * gives white. The colour is normalised and the intensity is returned
 * separately so dim colours keep their hue instead of turning muddy.
 */
export function mixRgbGlow(channels: Readonly<Record<RgbChannel, number>>): RgbGlow {
  const levels: Record<RgbChannel, number> = {
    red: Math.min(1, Math.max(0, channels.red)),
    green: Math.min(1, Math.max(0, channels.green)),
    blue: Math.min(1, Math.max(0, channels.blue)),
  }
  const strength = Math.min(1, levels.red + levels.green + levels.blue)
  if (strength <= 0.001) return { color: '#ffffff', strength: 0 }

  let red = 0
  let green = 0
  let blue = 0
  for (const channel of ['red', 'green', 'blue'] as const) {
    const level = levels[channel]
    if (level <= 0) continue
    const [r, g, b] = parseHex(RGB_MIX_COLORS[channel])
    red += r * level
    green += g * level
    blue += b * level
  }

  const peak = Math.max(red, green, blue, 1)
  const scale = 255 / peak
  return {
    color: `rgb(${Math.round(red * scale)}, ${Math.round(green * scale)}, ${Math.round(blue * scale)})`,
    strength,
  }
}

export const PART_BODY_FILL = '#343c4e'
export const PART_BODY_STROKE = '#5b6a82'
export const PART_SELECTED_STROKE = '#2f7df6'
/** Pins sit on the dark canvas, so they read as a light grey rather than near-white. */
export const PIN_FILL = '#a8b4c6'
export const PIN_HOVER_FILL = '#2f7df6'
export const PIN_ACTIVE_FILL = '#d99311'
