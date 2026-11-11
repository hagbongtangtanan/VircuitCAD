/** English UI strings (i18n scaffold — English is the only locale for now). */

export const MESSAGES_EN = {
  'app.title': 'VircuitCAD',
  'menu.file': 'File',
  'menu.edit': 'Edit',
  'menu.view': 'View',
  'menu.help': 'Help',
  'action.run': 'Run',
  'action.stop': 'Stop',
  'action.save': 'Save',
  'action.export': 'Export',
  'settings.title': 'Settings',
  'settings.theme': 'Theme',
  'settings.grid': 'Show grid',
  'settings.simSpeed': 'Simulation speed',
  'settings.autosave': 'Autosave interval',
  'settings.units': 'Units',
  'panel.code': 'Code',
  'panel.blocks': 'Blocks',
  'panel.serial': 'Serial',
  'panel.scope': 'Scope',
  'panel.schematic': 'Schematic',
  'status.running': 'Running',
  'status.stopped': 'Stopped',
} as const;

export type MessageKey = keyof typeof MESSAGES_EN;

export const LOCALES = ['en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

const CATALOGUES: Record<Locale, Readonly<Record<string, string>>> = { en: MESSAGES_EN };

/** Looks up a message; falls back to the key itself when missing. */
export function t(key: MessageKey, locale: Locale = DEFAULT_LOCALE): string {
  return CATALOGUES[locale][key] ?? key;
}
