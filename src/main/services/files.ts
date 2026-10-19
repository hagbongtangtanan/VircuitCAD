/**
 * File service boundary. The implementation lands with the `.circuit` / `.ino` /
 * `.hex` save-open flows in Milestone 5. Operations only ever touch paths that
 * came from a native dialog, so no path is accepted from the renderer verbatim.
 */

export type CircuitFileKind = 'circuit' | 'ino' | 'hex'

export interface SaveFileRequest {
  readonly suggestedName: string
  readonly kind: CircuitFileKind
  readonly contents: string
}

export interface SaveFileResult {
  readonly canceled: boolean
  readonly path: string | null
}

export interface OpenFileRequest {
  readonly kind: CircuitFileKind
}

export interface OpenFileResult {
  readonly canceled: boolean
  readonly path: string | null
  readonly contents: string | null
}

export interface FileService {
  save(request: SaveFileRequest): Promise<SaveFileResult>
  open(request: OpenFileRequest): Promise<OpenFileResult>
}

export function createFileService(): FileService {
  return {
    save(request: SaveFileRequest): Promise<SaveFileResult> {
      return Promise.reject(
        new Error(`Saving ${request.kind} files is not wired up until Milestone 5.`)
      )
    },
    open(request: OpenFileRequest): Promise<OpenFileResult> {
      return Promise.reject(
        new Error(`Opening ${request.kind} files is not wired up until Milestone 5.`)
      )
    },
  }
}
