import { expect, it } from 'vitest';

import { TextureCache } from './texture-cache';

it('caches values by key and creates each once', () => {
  const cache = new TextureCache<string>();
  let created = 0;
  const create = (): string => {
    created += 1;
    return 'value';
  };

  expect(cache.get('a', create)).toBe('value');
  expect(cache.get('a', create)).toBe('value');
  expect(created).toBe(1);
  expect(cache.has('a')).toBe(true);
  expect(cache.size).toBe(1);
});

it('disposes entries on clear', () => {
  const cache = new TextureCache<{ id: string }>();
  cache.get('a', () => ({ id: 'a' }));
  const disposed: string[] = [];
  cache.clear((item) => disposed.push(item.id));
  expect(disposed).toEqual(['a']);
  expect(cache.size).toBe(0);
});
