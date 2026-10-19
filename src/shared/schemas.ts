import { z } from 'zod'

/**
 * Runtime versions reported by the Electron main process. Used by the renderer
 * shell as a smoke test that the IPC boundary is wired correctly.
 */
export const runtimeVersionsSchema = z.strictObject({
  electron: z.string().min(1),
  chrome: z.string().min(1),
  node: z.string().min(1),
})

export const pingRequestSchema = z.strictObject({
  sentAt: z.number().int().nonnegative(),
})

export const pingResponseSchema = z.strictObject({
  /** Milliseconds since the epoch, measured in the main process. */
  receivedAt: z.number().int().nonnegative(),
  /** Echo of `PingRequest.sentAt`, proving the payload survived the round trip. */
  echo: z.number().int().nonnegative(),
  versions: runtimeVersionsSchema,
})

export type RuntimeVersions = z.infer<typeof runtimeVersionsSchema>
export type PingRequest = z.infer<typeof pingRequestSchema>
export type PingResponse = z.infer<typeof pingResponseSchema>

/** Largest sketch we accept, so a runaway paste cannot stall the compiler. */
export const MAX_SKETCH_LENGTH = 200_000

export const compileRequestSchema = z.strictObject({
  /** Arduino C++ source, as typed in the editor. */
  sketch: z.string().max(MAX_SKETCH_LENGTH),
})

export const diagnosticSeveritySchema = z.enum(['error', 'warning', 'note'])

export const diagnosticSchema = z.strictObject({
  severity: diagnosticSeveritySchema,
  /** 1-based, mapped back onto the sketch the user wrote. */
  line: z.number().int().positive().nullable(),
  column: z.number().int().positive().nullable(),
  message: z.string(),
})

/** Flash/RAM usage reported by `avr-size`, in bytes. */
export const memoryUsageSchema = z.strictObject({
  flashBytes: z.number().int().nonnegative(),
  flashCapacity: z.number().int().positive(),
  ramBytes: z.number().int().nonnegative(),
  ramCapacity: z.number().int().positive(),
})

export const compileResultSchema = z.strictObject({
  ok: z.boolean(),
  /** Intel HEX, present only when the sketch linked. */
  hex: z.string().nullable(),
  diagnostics: z.array(diagnosticSchema),
  memory: memoryUsageSchema.nullable(),
  durationMs: z.number().int().nonnegative(),
})

export const toolchainStatusSchema = z.strictObject({
  available: z.boolean(),
  /** e.g. `avr-g++ (GCC) 14.3.0`, or the reason the toolchain is unusable. */
  detail: z.string(),
  avrGcc: z.string().nullable(),
  arduinoCore: z.string().nullable(),
})

export type CompileRequest = z.infer<typeof compileRequestSchema>
export type Diagnostic = z.infer<typeof diagnosticSchema>
export type DiagnosticSeverity = z.infer<typeof diagnosticSeveritySchema>
export type MemoryUsage = z.infer<typeof memoryUsageSchema>
export type CompileResult = z.infer<typeof compileResultSchema>
export type ToolchainStatus = z.infer<typeof toolchainStatusSchema>
