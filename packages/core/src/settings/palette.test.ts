import { expect, it } from 'vitest';

import { COLORBLIND_WIRE_PALETTE, DEFAULT_WIRE_PALETTE, wirePalette } from './palette';

const HEX = /^#[0-9a-fA-F]{6}$/;

it('provides two palettes with valid, distinct wire colours', () => {
  for (const palette of [DEFAULT_WIRE_PALETTE, COLORBLIND_WIRE_PALETTE]) {
    expect(palette.length).toBeGreaterThanOrEqual(6);
    for (const colour of palette) expect(colour).toMatch(HEX);
    expect(new Set(palette).size).toBe(palette.length);
  }
});

it('selects the palette from the accessibility option', () => {
  expect(wirePalette()).toBe(DEFAULT_WIRE_PALETTE);
  expect(wirePalette({ colourBlindSafe: true })).toBe(COLORBLIND_WIRE_PALETTE);
});
