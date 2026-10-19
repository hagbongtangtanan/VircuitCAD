import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  ProjectFileError,
  SAMPLE_NAME_PATTERN,
  sampleLabel,
  type OpenFileResult,
  type SampleEntry,
} from '../../shared/project'
import { openFile } from './projectFiles'

/**
 * Shipped example projects. They live outside the app bundle so the installer
 * can ship them as plain, user-inspectable files.
 */

export async function listSamples(directory: string): Promise<SampleEntry[]> {
  let names: string[]
  try {
    names = await readdir(directory)
  } catch {
    return []
  }

  return names
    .filter((name) => SAMPLE_NAME_PATTERN.test(name))
    .sort()
    .map((name) => ({ name, label: sampleLabel(name) }))
}

export async function readSample(directory: string, name: string): Promise<OpenFileResult> {
  // The pattern forbids separators and dots, so this cannot escape the folder.
  if (!SAMPLE_NAME_PATTERN.test(name)) {
    throw new ProjectFileError('Unknown sample.')
  }

  const opened = await openFile(join(directory, name))
  if (opened.kind !== 'project') {
    throw new ProjectFileError('Unknown sample.')
  }
  return opened
}
