// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { THEMES } from './index';

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start, `selector ${selector} present`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name && value) tokens[name] = value.trim();
  }
  return tokens;
}

function channel(component: number): number {
  const c = component / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const BACKGROUNDS = ['bg-app', 'surface-1', 'surface-2', 'surface-3', 'canvas-bg'];
const TEXT = ['text', 'text-muted'];

it('defines both themes', () => {
  const dark = block(':root {');
  const light = block(':root[data-theme="light"]');
  for (const key of [...BACKGROUNDS, ...TEXT, 'accent', 'border']) {
    expect(dark[key], `dark --${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(light[key], `light --${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
  }
  expect(THEMES).toEqual(['dark', 'light']);
});

it.each(THEMES)('meets 4.5:1 contrast for text pairs in the %s theme', (theme) => {
  const tokens = theme === 'dark' ? block(':root {') : block(':root[data-theme="light"]');
  for (const text of TEXT) {
    for (const background of BACKGROUNDS) {
      const ratio = contrast(tokens[text] ?? '#000', tokens[background] ?? '#fff');
      expect(ratio, `${theme}: --${text} on --${background} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
