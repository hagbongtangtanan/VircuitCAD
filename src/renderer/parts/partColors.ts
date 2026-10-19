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
export const PART_BODY_STROKE = '#3f4859'
export const PART_SELECTED_STROKE = '#2f7df6'
/** Pins sit on a light canvas, so they read as a mid grey rather than near-white. */
export const PIN_FILL = '#8b96a8'
export const PIN_HOVER_FILL = '#2f7df6'
export const PIN_ACTIVE_FILL = '#d99311'
