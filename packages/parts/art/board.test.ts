import { expect, it } from 'vitest';

import { generateBoardGeometry, placeholderManifests } from '@vircuitcad/core';

import {
  ART_UNIT,
  BOARD_BODY,
  buildBreadboardArt,
  contrastRatio,
  PALETTE,
  resolvePartArt,
} from './index';

it('places breadboard holes at the manifest geometry positions', () => {
  const geometry = generateBoardGeometry('full');
  const art = buildBreadboardArt('full');
  expect(art.holeMarkers).toHaveLength(geometry.holes.length);
  for (const [index, hole] of geometry.holes.entries()) {
    const marker = art.holeMarkers[index];
    expect(marker?.id).toBe(hole.id);
    expect(marker?.x).toBeCloseTo(hole.position.x * ART_UNIT, 6);
    expect(marker?.y).toBeCloseTo(hole.position.y * ART_UNIT, 6);
  }
});

it('draws the expected number of column and row labels', () => {
  const geometry = generateBoardGeometry('full');
  const art = buildBreadboardArt('full');
  const texts = art.labels.filter((label) => label.kind === 'text');
  const numbers = texts.filter((label) => label.kind === 'text' && /^\d+$/.test(label.text));
  const letters = texts.filter((label) => label.kind === 'text' && /^[a-j]$/.test(label.text));
  const marks = texts.filter((label) => label.kind === 'text' && /^[+−]$/.test(label.text));
  expect(numbers).toHaveLength(geometry.columns * 2);
  expect(letters).toHaveLength(10 * 2);
  expect(marks).toHaveLength(4 * 2);
});

it('keeps the breadboard body readable against the canvas', () => {
  expect(contrastRatio(BOARD_BODY, PALETTE.background)).toBeGreaterThanOrEqual(3);
});

it('places Uno pin anchors and header labels from the manifest', () => {
  const manifest = placeholderManifests.find((candidate) => candidate.id === 'arduino-uno');
  expect(manifest, 'arduino-uno manifest').toBeDefined();
  if (!manifest) return;

  const art = resolvePartArt(manifest);
  expect(art.pins).toHaveLength(manifest.pins.length);
  expect(art.pins).toHaveLength(14 + 6 + 5);

  const origin = manifest.pins[0];
  const artOrigin = art.pins[0];
  expect(origin).toBeDefined();
  expect(artOrigin).toBeDefined();
  if (!origin || !artOrigin) return;
  manifest.pins.forEach((pin, index) => {
    const anchor = art.pins[index];
    expect(anchor).toBeDefined();
    if (!anchor) return;
    expect(anchor.x - artOrigin.x).toBeCloseTo((pin.position.x - origin.position.x) * ART_UNIT, 6);
    expect(anchor.y - artOrigin.y).toBeCloseTo((pin.position.y - origin.position.y) * ART_UNIT, 6);
  });

  const labels = art.primitives.filter((primitive) => primitive.kind === 'text');
  const names = labels.map((label) => (label.kind === 'text' ? label.text : ''));
  expect(names.filter((name) => /^D\d+$/.test(name))).toHaveLength(14);
  expect(names.filter((name) => /^A\d+$/.test(name))).toHaveLength(6);
  for (const power of ['5V', '3V3', 'GND', 'VIN', 'RESET']) {
    expect(names, power).toContain(power);
  }
});
