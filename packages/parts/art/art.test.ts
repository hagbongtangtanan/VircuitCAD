import { expect, it } from 'vitest';

import { parsePartManifest, placeholderManifests } from '@vircuitcad/core';

import {
  ART_UNIT,
  contrastRatio,
  fallbackArt,
  PALETTE,
  primitiveBounds,
  resolvePartArt,
  toSvg,
} from './index';

it('resolves every manifest to art with one pin pad per manifest pin', () => {
  for (const manifest of placeholderManifests) {
    const art = resolvePartArt(manifest);
    expect(art.width, `${manifest.id} width`).toBeGreaterThan(0);
    expect(art.height, `${manifest.id} height`).toBeGreaterThan(0);
    expect(art.primitives.length, `${manifest.id} primitives`).toBeGreaterThan(0);
    expect(
      art.pins.map((pin) => pin.id),
      manifest.id,
    ).toEqual(manifest.pins.map((pin) => pin.id));
  }
});

it('aligns pin anchors with manifest pin spacing within 0.5 px', () => {
  for (const manifest of placeholderManifests) {
    const art = resolvePartArt(manifest);
    const origin = manifest.pins[0];
    const artOrigin = art.pins[0];
    expect(origin, `${manifest.id} has a pin`).toBeDefined();
    expect(artOrigin, `${manifest.id} has art`).toBeDefined();
    if (!origin || !artOrigin) continue;
    manifest.pins.forEach((source, index) => {
      const pin = art.pins[index];
      expect(pin, `${manifest.id} pin ${index}`).toBeDefined();
      if (!pin) return;
      const expectedX = (source.position.x - origin.position.x) * ART_UNIT;
      const expectedY = (source.position.y - origin.position.y) * ART_UNIT;
      expect(Math.abs(pin.x - artOrigin.x - expectedX), `${manifest.id}:${pin.id} x`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(pin.y - artOrigin.y - expectedY), `${manifest.id}:${pin.id} y`).toBeLessThanOrEqual(0.5);
    });
  }
});

it('keeps every shape primitive and pin pad inside the art bounds', () => {
  for (const manifest of placeholderManifests) {
    const art = resolvePartArt(manifest);
    for (const primitive of art.primitives) {
      if (primitive.kind === 'text') continue;
      const bounds = primitiveBounds(primitive);
      const where = `${manifest.id} ${primitive.kind}`;
      expect(bounds.minX, `${where} minX`).toBeGreaterThanOrEqual(-0.5);
      expect(bounds.minY, `${where} minY`).toBeGreaterThanOrEqual(-0.5);
      expect(bounds.maxX, `${where} maxX`).toBeLessThanOrEqual(art.width + 0.5);
      expect(bounds.maxY, `${where} maxY`).toBeLessThanOrEqual(art.height + 0.5);
    }
    for (const pin of art.pins) {
      expect(pin.x - pin.r, `${manifest.id}:${pin.id} left`).toBeGreaterThanOrEqual(-0.5);
      expect(pin.y - pin.r, `${manifest.id}:${pin.id} top`).toBeGreaterThanOrEqual(-0.5);
    }
  }
});

it('keeps every part body at least 3:1 against the canvas background', () => {
  for (const manifest of placeholderManifests) {
    const art = resolvePartArt(manifest);
    const ratio = contrastRatio(art.body, PALETTE.background);
    expect(ratio, `${manifest.id} body contrast ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
  }
});

it('serialises art to SVG with a shape per primitive and a marker per pin', () => {
  const resistor = placeholderManifests.find((manifest) => manifest.id === 'resistor');
  expect(resistor, 'resistor manifest present').toBeDefined();
  if (!resistor) return;
  const art = resolvePartArt(resistor);
  const svg = toSvg(art);
  expect(svg.startsWith('<svg ')).toBe(true);
  expect(svg).toContain(`width="${art.width}"`);
  expect(svg).toContain('viewBox="0 0 ');
  expect(svg.match(/<rect /g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  expect(svg.match(/data-pin=/g)?.length ?? 0).toBe(art.pins.length);
  expect(svg.endsWith('</svg>')).toBe(true);
});

it('uses a hand-made svg override when provided', () => {
  const manifest = placeholderManifests[0];
  expect(manifest).toBeDefined();
  if (!manifest) return;
  const art = resolvePartArt(manifest, { [manifest.id]: '<svg id="hand-made"></svg>' });
  expect(art.svgOverride).toBe('<svg id="hand-made"></svg>');
  expect(toSvg(art)).toBe('<svg id="hand-made"></svg>');
});

it('falls back to a labelled category card for manifests without art', () => {
  const manifest = parsePartManifest({
    id: 'mystery',
    name: 'Mystery Chip',
    category: 'digital',
    pins: [
      { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'b', name: 'B', position: { x: 2, y: 0 }, role: 'passive' },
    ],
    params: [],
    simModel: 'unmodelled',
    svg: 'parts/mystery.svg',
  });
  const art = resolvePartArt(manifest);
  expect(art.fallback).toBe(true);
  expect(art.label?.text).toBe('Mystery Chip');
  expect(art.pins).toHaveLength(2);
  expect(toSvg(art)).toContain('Mystery Chip');
  expect(fallbackArt(manifest).fallback).toBe(true);
});
