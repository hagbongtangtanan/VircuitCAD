import { z } from 'zod'
import { circuitDocumentSchema, type CircuitDocument } from './circuit'
import { MAX_SKETCH_LENGTH } from './schemas'

/**
 * The on-disk project format. A project is a circuit plus the sketch it runs;
 * keeping both in one file means "open" always restores a runnable state.
 */
export const PROJECT_FORMAT = 'hucad-project'
export const PROJECT_VERSION = 1
export const PROJECT_EXTENSION = 'hucad'
export const SKETCH_EXTENSION = 'ino'
export const HEX_EXTENSION = 'hex'

export const projectFileSchema = z.strictObject({
  format: z.literal(PROJECT_FORMAT),
  version: z.literal(PROJECT_VERSION),
  circuit: circuitDocumentSchema,
  sketch: z.string().max(MAX_SKETCH_LENGTH),
})

export type ProjectFile = z.infer<typeof projectFileSchema>

export interface ProjectSnapshot {
  readonly circuit: CircuitDocument
  readonly sketch: string
}

export function createProject(snapshot: ProjectSnapshot): ProjectFile {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    circuit: snapshot.circuit,
    sketch: snapshot.sketch,
  }
}

export function serializeProject(project: ProjectFile): string {
  return `${JSON.stringify(project, null, 2)}\n`
}

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectFileError'
  }
}

export function parseProjectText(text: string): ProjectFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProjectFileError('The file is not valid JSON.')
  }

  const result = projectFileSchema.safeParse(parsed)
  if (!result.success) {
    const [issue] = result.error.issues
    const location = issue?.path.join('.') ?? 'document'
    throw new ProjectFileError(
      `This is not a HuCAD project: ${location} — ${issue?.message ?? 'invalid data'}`
    )
  }
  return result.data
}

export type OpenFileKind = 'project' | 'sketch'

export type OpenFileResult =
  | { readonly kind: 'project'; readonly path: string; readonly project: ProjectFile }
  | { readonly kind: 'sketch'; readonly path: string; readonly sketch: string }

export function fileExtension(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
}

export function fileBaseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Chooses how an opened file is interpreted from its extension. */
export function openKindForPath(path: string): OpenFileKind | null {
  const extension = fileExtension(path)
  if (extension === PROJECT_EXTENSION || extension === 'json') return 'project'
  if (extension === SKETCH_EXTENSION) return 'sketch'
  return null
}

export function parseSketchText(text: string): string {
  if (text.length > MAX_SKETCH_LENGTH) {
    throw new ProjectFileError(`The sketch is larger than ${MAX_SKETCH_LENGTH} characters.`)
  }
  return text
}

/** Adds the expected extension unless the user already typed one. */
export function withExtension(path: string, extension: string): string {
  return fileExtension(path) === extension ? path : `${path}.${extension}`
}

export const saveProjectRequestSchema = z.strictObject({
  project: projectFileSchema,
  /** Where to write; null asks the user through a save dialog. */
  path: z.string().min(1).nullable(),
})

export const exportSketchRequestSchema = z.strictObject({
  sketch: z.string().max(MAX_SKETCH_LENGTH),
  path: z.string().min(1).nullable(),
})

export const exportHexRequestSchema = z.strictObject({
  hex: z.string().min(1).max(400_000),
  path: z.string().min(1).nullable(),
})

export const savedFileSchema = z.strictObject({ path: z.string().min(1) })

export type SaveProjectRequest = z.infer<typeof saveProjectRequestSchema>
export type ExportSketchRequest = z.infer<typeof exportSketchRequestSchema>
export type ExportHexRequest = z.infer<typeof exportHexRequestSchema>
export type SavedFile = z.infer<typeof savedFileSchema>
