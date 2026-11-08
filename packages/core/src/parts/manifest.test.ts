import { expect, it } from 'vitest';

import { createDefaultPartRegistry } from './catalog';
import { PartManifestSchema, type PartManifest } from './manifest';
import { PartRegistry, parsePartManifest } from './registry';

const valid: PartManifest = {
  id: 'demo',
  name: 'Demo',
  category: 'passive',
  pins: [
    { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
    { id: 'b', name: 'B', position: { x: 1, y: 0 }, role: 'passive' },
  ],
  params: [{ id: 'value', label: 'Value', unit: 'V', min: 0, max: 10, default: 5 }],
  simModel: 'demo',
  svg: 'parts/demo.svg',
};

it('registers the three placeholder parts', () => {
  const registry = createDefaultPartRegistry();
  expect(registry.list().map((manifest) => manifest.id)).toEqual([
    'battery',
    'battery-pack',
    'capacitor',
    'inductor',
    'led',
    'pushbutton',
    'resistor',
    'slide-switch',
  ]);
  expect(registry.require('led').pins).toHaveLength(2);
});

it('rejects duplicate pin ids with a clear error', () => {
  const result = PartManifestSchema.safeParse({
    ...valid,
    pins: [
      { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'a', name: 'A2', position: { x: 1, y: 0 }, role: 'passive' },
    ],
  });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map((issue) => issue.message).join(' ')).toContain(
      'duplicate pin id "a"',
    );
  }
});

it('rejects params whose default is outside the range', () => {
  const result = PartManifestSchema.safeParse({
    ...valid,
    params: [{ id: 'value', label: 'Value', min: 0, max: 10, default: 12 }],
  });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map((issue) => issue.message).join(' ')).toContain(
      'default is above max',
    );
  }
});

it('rejects unknown parts and duplicate registration', () => {
  const registry = new PartRegistry([parsePartManifest(valid)]);
  expect(registry.has('demo')).toBe(true);
  expect(() => registry.require('nope')).toThrow('unknown part "nope"');
  expect(() => registry.register(parsePartManifest(valid))).toThrow('already registered');
});
