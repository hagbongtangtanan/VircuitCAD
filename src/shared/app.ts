/**
 * Product identity. Every user-visible mention of the application name comes
 * from here so a rename is a single-line change; `package.json` metadata is the
 * only other place the name appears.
 */
export const APP_NAME = 'VircuitCAD'

/** Publisher shown in the About panel, installer metadata and copyright line. */
export const APP_AUTHOR = 'Kheil27'

export const APP_TAGLINE = 'Offline Arduino circuit simulator'

/** Default project name shown until the user renames or opens a project. */
export const DEFAULT_PROJECT_NAME = 'untitled'

/** Trims a title, falling back to the default when the user leaves it blank. */
export function normalizeProjectName(name: string): string {
  const trimmed = name.trim()
  return trimmed === '' ? DEFAULT_PROJECT_NAME : trimmed
}
