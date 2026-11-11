import { z } from 'zod';

export const ThemeSchema = z.enum(['dark', 'light', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

export const UnitsSchema = z.enum(['metric', 'imperial']);
export type Units = z.infer<typeof UnitsSchema>;

export const SettingsSchema = z.object({
  theme: ThemeSchema,
  grid: z.boolean(),
  simSpeed: z.number().min(0.1).max(4),
  autosaveIntervalMs: z.number().int().min(0).max(3_600_000),
  units: UnitsSchema,
  language: z.string().min(2),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const SETTINGS_FILE = 'settings.json';

export function defaultSettings(): Settings {
  return {
    theme: 'dark',
    grid: true,
    simSpeed: 1,
    autosaveIntervalMs: 30_000,
    units: 'metric',
    language: 'en',
  };
}

/** Parses a settings document, filling missing/invalid fields from defaults. */
export function parseSettings(raw: unknown): Settings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const defaults = defaultSettings();
  const merged: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof Settings)[]) {
    if (source[key] !== undefined) merged[key] = source[key];
  }
  const result = SettingsSchema.safeParse(merged);
  return result.success ? result.data : defaults;
}

export function mergeSettings(current: Settings, patch: Partial<Settings>): Settings {
  return parseSettings({ ...current, ...patch });
}

export function serializeSettings(settings: Settings): string {
  return `${JSON.stringify(SettingsSchema.parse(settings), null, 2)}\n`;
}

export function deserializeSettings(text: string): Settings {
  try {
    return parseSettings(JSON.parse(text));
  } catch {
    return defaultSettings();
  }
}
