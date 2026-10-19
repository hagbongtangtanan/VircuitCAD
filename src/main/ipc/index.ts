import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/ipc'
import { pingRequestSchema, type PingResponse } from '../../shared/schemas'

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
}

/** Removes all handlers; used when tearing the app down in tests. */
export function unregisterIpcHandlers(): void {
  ipcMain.removeHandler(IpcChannels.ping)
}
