import { readFile, writeFile } from 'node:fs/promises'
import {
  parseProjectText,
  parseSketchText,
  openKindForPath,
  serializeProject,
  ProjectFileError,
  type OpenFileResult,
  type ProjectFile,
} from '../../shared/project'

/**
 * File-system side of opening and saving. Electron-free so the round-trip can
 * be tested against a temporary directory; the IPC layer owns the dialogs.
 */

const MAX_FILE_BYTES = 4 * 1024 * 1024

async function readText(path: string): Promise<string> {
  const buffer = await readFile(path)
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new ProjectFileError('The file is too large to open.')
  }
  return buffer.toString('utf8')
}

export async function readProjectFile(path: string): Promise<ProjectFile> {
  return parseProjectText(await readText(path))
}

export async function writeProjectFile(path: string, project: ProjectFile): Promise<void> {
  await writeFile(path, serializeProject(project), 'utf8')
}

/** Reads either a project or a plain `.ino` sketch, based on the extension. */
export async function openFile(path: string): Promise<OpenFileResult> {
  const kind = openKindForPath(path)
  if (kind === null) {
    throw new ProjectFileError('Open a HuCAD (.hucad) project or an .ino sketch.')
  }

  const text = await readText(path)
  if (kind === 'sketch') {
    return { kind, path, sketch: parseSketchText(text) }
  }
  return { kind, path, project: parseProjectText(text) }
}

export async function writeSketchFile(path: string, sketch: string): Promise<void> {
  await writeFile(path, parseSketchText(sketch), 'utf8')
}

export async function writeHexFile(path: string, hex: string): Promise<void> {
  if (hex.length > MAX_FILE_BYTES || !hex.startsWith(':')) {
    throw new ProjectFileError('There is no compiled HEX to export.')
  }
  await writeFile(path, hex.endsWith('\n') ? hex : `${hex}\n`, 'utf8')
}
