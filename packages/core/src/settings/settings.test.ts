import { expect, it } from 'vitest';

import { createInMemoryPlatformAdapter } from '../platform/fake';
import { loadSettings, saveSettings } from './persist';
import {
  defaultSettings,
  deserializeSettings,
  mergeSettings,
  parseSettings,
  serializeSettings,
} from './settings';

it('parses partial settings onto defaults', () => {
  const settings = parseSettings({ theme: 'light', simSpeed: 2 });
  expect(settings.theme).toBe('light');
  expect(settings.simSpeed).toBe(2);
  expect(settings.grid).toBe(true);
});

it('falls back to defaults for invalid settings', () => {
  expect(parseSettings({ simSpeed: 99, theme: 'neon' })).toEqual(defaultSettings());
  expect(parseSettings(null)).toEqual(defaultSettings());
  expect(deserializeSettings('not json')).toEqual(defaultSettings());
});

it('merges a patch and round-trips through text', () => {
  const merged = mergeSettings(defaultSettings(), { units: 'imperial', grid: false });
  expect(merged.units).toBe('imperial');
  expect(merged.grid).toBe(false);
  expect(deserializeSettings(serializeSettings(merged))).toEqual(merged);
});

it('persists settings through the platform adapter', async () => {
  const adapter = createInMemoryPlatformAdapter();
  expect(await loadSettings(adapter)).toEqual(defaultSettings());

  await saveSettings(adapter, mergeSettings(defaultSettings(), { theme: 'light' }));
  expect((await loadSettings(adapter)).theme).toBe('light');
});
