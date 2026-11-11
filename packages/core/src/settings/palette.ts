/** Wire colour palettes. The colour-blind-safe set is the Okabe–Ito palette. */

export const DEFAULT_WIRE_PALETTE: readonly string[] = [
  '#22c55e',
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#a855f7',
  '#f97316',
];

/** Okabe–Ito: distinguishable with all common forms of colour-vision deficiency. */
export const COLORBLIND_WIRE_PALETTE: readonly string[] = [
  '#0072b2',
  '#e69f00',
  '#009e73',
  '#d55e00',
  '#cc79a7',
  '#56b4e9',
];

export type WirePaletteOptions = { colourBlindSafe?: boolean };

export function wirePalette(options: WirePaletteOptions = {}): readonly string[] {
  return options.colourBlindSafe ? COLORBLIND_WIRE_PALETTE : DEFAULT_WIRE_PALETTE;
}
