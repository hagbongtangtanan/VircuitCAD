import { expect, it } from 'vitest';

import { parsePartManifest } from '@vircuitcad/core';

import { layoutPart } from './part-layout';

const resistor = parsePartManifest({
  id: 'resistor',
  name: 'Resistor',
  category: 'passive',
  pins: [
    { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
    { id: 'b', name: 'B', position: { x: 4, y: 0 }, role: 'passive' },
  ],
  params: [],
  simModel: 'resistor',
  svg: 'parts/resistor.svg',
});

it('places pins at their rotated absolute positions', () => {
  const layout = layoutPart(resistor, { x: 2, y: 5 }, 0);
  expect(layout.pins).toEqual([
    { id: 'a', position: { x: 2, y: 5 } },
    { id: 'b', position: { x: 6, y: 5 } },
  ]);
  expect(layout.bounds).toEqual({ minX: 2, minY: 5, width: 4, height: 0 });
});

it('rotates the bounds with the part', () => {
  expect(layoutPart(resistor, { x: 2, y: 5 }, 90).bounds).toEqual({
    minX: 2,
    minY: 5,
    width: 0,
    height: 4,
  });
  expect(layoutPart(resistor, { x: 2, y: 5 }, 180).pins[0]?.position).toEqual({ x: 2, y: 5 });
});
