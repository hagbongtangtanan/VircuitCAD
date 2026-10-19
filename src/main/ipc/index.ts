import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc'
import {
  compileRequestSchema,
  pingRequestSchema,
  type CompileResult,
  type PingResponse,
  type ToolchainStatus,
} from '../../shared/schemas'
import { compileSketch, readToolchainStatus } from '../services/compiler'

/**
 * Registers every renderer-callable handler. Payloads arrive as `unknown` and are
 * validated here, so a compromised renderer cannot push unexpected shapes into
 * the main process.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.ping, (_event, payload: unknown): PingResponse => {
    const request = pingRequestSchema.parse(payload)

    return {
      receivedAt: Date.now(),
      echo: request.sentAt,
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
      },
    }
  })

  ipcMain.handle(IpcChannels.compile, async (_event, payload: unknown): Promise<CompileResult> => {
    const request = compileRequestSchema.parse(payload)
    return compileSketch(request.sketch)
  })

  ipcMain.handle(IpcChannels.toolchainStatus, (): Promise<ToolchainStatus> => {
    return readToolchainStatus()
  })
}

/** Removes all handlers; used when tearing the app down in tests. */
export function unregisterIpcHandlers(): void {
  ipcMain.removeHandler(IpcChannels.ping)
  ipcMain.removeHandler(IpcChannels.compile)
  ipcMain.removeHandler(IpcChannels.toolchainStatus)
}
