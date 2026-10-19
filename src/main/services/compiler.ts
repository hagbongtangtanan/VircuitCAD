/**
 * Compiler service boundary. The implementation lands in Milestone 5, where it
 * will shell out to the bundled `avr-gcc` + `avr-objcopy` toolchain in
 * `resources/toolchain/<platform>/` and return a `.hex` payload plus diagnostics.
 */

export interface CompileRequest {
  readonly source: string
  readonly board: 'uno'
}

export interface CompileDiagnostic {
  readonly severity: 'error' | 'warning'
  readonly message: string
  readonly line?: number
  readonly column?: number
}

export interface CompileResult {
  readonly ok: boolean
  readonly hex: string | null
  readonly diagnostics: readonly CompileDiagnostic[]
}

export interface CompilerService {
  compile(request: CompileRequest): Promise<CompileResult>
}

export function createCompilerService(): CompilerService {
  return {
    compile(request: CompileRequest): Promise<CompileResult> {
      return Promise.reject(
        new Error(
          `The Arduino toolchain is not bundled yet; refusing to compile ${request.source.length} bytes of source.`
        )
      )
    },
  }
}
