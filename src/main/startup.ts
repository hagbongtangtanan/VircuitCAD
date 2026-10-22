import { existsSync } from 'node:fs'
import { extname } from 'node:path'

/**
 * File types the OS may hand to HuCAD through argv or macOS `open-file`.
 * Keep this in step with the file association in electron-builder.yml.
 */
const LAUNCH_EXTENSIONS = new Set(['.hucad', '.ino', '.json'])

/**
 * Finds the project/sketch path in a process argument list. Windows and Linux
 * pass file associations as ordinary argv entries; electron/vite flags and the
 * application path are ignored.
 */
export function filePathFromArgs(
  args: readonly string[],
  exists: (path: string) => boolean = existsSync
): string | null {
  for (const arg of args) {
    if (arg === '' || arg.startsWith('-')) continue
    if (!LAUNCH_EXTENSIONS.has(extname(arg).toLowerCase())) continue
    if (exists(arg)) return arg
  }
  return null
}
