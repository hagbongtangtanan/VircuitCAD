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
