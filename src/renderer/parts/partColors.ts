import type { LedColor } from '../../shared/circuit'

/** Bulb colour per LED option; the glow is a lighter tint over the top. */
export const LED_COLORS: Record<LedColor, { readonly body: string; readonly glow: string }> = {
  red: { body: '#e5484d', glow: '#ff8a8f' },
  green: { body: '#46a758', glow: '#8ce099' },
  blue: { body: '#3b82f6', glow: '#93c5fd' },
  yellow: { body: '#e2b93b', glow: '#fbe38a' },
  white: { body: '#d7dbe3', glow: '#ffffff' },
}

export const PART_BODY_FILL = '#2b3140'
export const PART_BODY_STROKE = '#4a5468'
export const PART_SELECTED_STROKE = '#4f9cf9'
export const PIN_FILL = '#c9ced8'
export const PIN_HOVER_FILL = '#4f9cf9'
export const PIN_ACTIVE_FILL = '#f2c14e'
