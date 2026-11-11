export const MAX_RECENT_FILES = 10;

/** Adds a path to the front of the recent list, de-duplicating and capping the size. */
export function addRecent(list: readonly string[], path: string, max = MAX_RECENT_FILES): string[] {
  const next = [path, ...list.filter((entry) => entry !== path)];
  return next.slice(0, max);
}

export function serializeRecent(list: readonly string[]): string {
  return `${JSON.stringify({ files: [...list].slice(0, MAX_RECENT_FILES) }, null, 2)}\n`;
}

export function parseRecent(text: string): string[] {
  try {
    const parsed = JSON.parse(text) as { files?: unknown };
    if (!Array.isArray(parsed.files)) return [];
    return parsed.files.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}
