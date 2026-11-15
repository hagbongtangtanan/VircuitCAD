import { expect, it } from 'vitest';

import { partTextureKey } from './texture-key';
import { TextureCache } from './texture-cache';

it('varies the key by part, variant and resolution', () => {
  const base = partTextureKey('resistor', 'default', 1);
  expect(base).toBe(partTextureKey('resistor', 'default', 1));
  expect(base).not.toBe(partTextureKey('resistor', 'default', 2));
  expect(base).not.toBe(partTextureKey('resistor', 'selected', 1));
  expect(base).not.toBe(partTextureKey('led', 'default', 1));
});

it('returns the cached texture for a repeated key', () => {
  const cache = new TextureCache<string>();
  let created = 0;
  const create = (): string => {
    created += 1;
    return 'texture';
  };
  const key = partTextureKey('led', 'default', 2);
  expect(cache.get(key, create)).toBe('texture');
  expect(cache.get(key, create)).toBe('texture');
  expect(created).toBe(1);
  expect(cache.size).toBe(1);
});
