import { expect, it } from 'vitest';

import { DEFAULT_LOCALE, LOCALES, MESSAGES_EN, t } from './i18n';

it('looks up English messages', () => {
  expect(t('action.run')).toBe('Run');
  expect(t('panel.schematic')).toBe('Schematic');
  expect(t('app.title', DEFAULT_LOCALE)).toBe('VircuitCAD');
});

it('ships only the English locale for now', () => {
  expect(LOCALES).toEqual(['en']);
  expect(Object.keys(MESSAGES_EN).length).toBeGreaterThan(10);
});
