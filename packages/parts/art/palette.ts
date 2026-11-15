import type { PartCategory } from '@vircuitcad/core';

/** 1 grid cell = 20 px at 100% zoom (see docs/DESIGN.md 3.5). */
export const ART_UNIT = 20;

/** Token colours (mirror of the dark theme) available to the art DSL. */
export const PALETTE = {
  background: '#0a101a',
  text: '#e6ecf5',
  textMuted: '#9aa8c0',
  outline: '#0b1220',
  pin: '#c9d3e3',
  pinRing: '#2d3b58',
  resistorBody: '#d6b98a',
  ledBody: '#7f1d1d',
  sourceBody: '#64748b',
  capacitorBody: '#38bdf8',
  inductorBody: '#a78bfa',
  switchBody: '#94a3b8',
  displayBody: '#0f172a',
  segment: '#f87171',
  board: '#0b6e4f',
  boardDark: '#083b2b',
  metal: '#9aa8c0',
} as const;

/** Category colours for fallback cards (all ≥ 3:1 against `background`). */
export const CATEGORY_COLORS: Record<PartCategory, string> = {
  passive: '#c9a86a',
  opto: '#e0564f',
  power: '#8b97a8',
  digital: '#5a6b96',
  mcu: '#2f9e6f',
  instrument: '#8b6cf0',
};

/** Fixed extra colours for signature details (resistor bands, LED colours). */
export const RESISTOR_BANDS = ['#1f2937', '#ef4444', '#f59e0b'] as const;
export const LED_COLORS = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#facc15',
  white: '#f8fafc',
} as const;
