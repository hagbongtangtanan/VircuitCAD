import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  BrowserWindow,
  app,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron'
import { IpcChannels } from '../../shared/ipc'
import {
  PROJECT_EXTENSION,
  SKETCH_EXTENSION,
  HEX_EXTENSION,
  exportHexRequestSchema,
  exportSketchRequestSchema,
  openSampleRequestSchema,
  saveProjectRequestSchema,
  withExtension,
  type SampleEntry,
  type SavedFile,
} from '../../shared/project'
import {
  compileRequestSchema,
  pingRequestSchema,
  type CompileResult,
  type PingResponse,
  type ToolchainStatus,
} from '../../shared/schemas'
import { compileSketch, readToolchainStatus } from '../services/compiler'
import { openFile, writeHexFile, writeProjectFile, writeSketchFile } from '../services/projectFiles'
import { listSamples, readSample } from '../services/sampleFiles'

/** Example projects ship beside the app resources, not inside the asar. */
function samplesDirectory(): string {
  const candidates = [
    join(process.resourcesPath, 'samples'),
    join(app.getAppPath(), 'resources', 'samples'),
    join(process.cwd(), 'resources', 'samples'),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[1]!
}

/**
 * Paths the user picked in a dialog during this session. A save may only reuse
 * one of these; otherwise it goes back through a dialog, so a compromised
 * renderer cannot write over an arbitrary file.
 */
const approvedPaths = new Set<string>()

function ownerWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

async function showOpenDialog(
  event: IpcMainInvokeEvent,
  options: OpenDialogOptions
): Promise<string | null> {
  const window = ownerWindow(event)
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled) return null
  return result.filePaths[0] ?? null
}

async function showSaveDialog(
  event: IpcMainInvokeEvent,
  options: SaveDialogOptions
): Promise<string | null> {
  const window = ownerWindow(event)
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled) return null
  return result.filePath ?? null
}

async function resolveSavePath(
  event: IpcMainInvokeEvent,
  requested: string | null,
  extension: string,
  options: SaveDialogOptions
): Promise<string | null> {
  if (requested !== null && approvedPaths.has(requested)) {
    return withExtension(requested, extension)
  }
  const picked = await showSaveDialog(event, {
    ...options,
    defaultPath: requested === null ? options.defaultPath : withExtension(requested, extension),
  })
  return picked === null ? null : withExtension(picked, extension)
}

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

  ipcMain.handle(IpcChannels.openFile, async (event) => {
    const path = await showOpenDialog(event, {
      title: 'Open project or sketch',
      properties: ['openFile'],
      filters: [
        { name: 'HuCAD project', extensions: [PROJECT_EXTENSION, 'json'] },
        { name: 'Arduino sketch', extensions: [SKETCH_EXTENSION] },
      ],
    })
    if (path === null) return null

    const opened = await openFile(path)
    approvedPaths.add(path)
    return opened
  })

  ipcMain.handle(
    IpcChannels.saveProject,
    async (event, payload: unknown): Promise<SavedFile | null> => {
      const request = saveProjectRequestSchema.parse(payload)
      const path = await resolveSavePath(event, request.path, PROJECT_EXTENSION, {
        title: 'Save project',
        defaultPath: `untitled.${PROJECT_EXTENSION}`,
        filters: [{ name: 'HuCAD project', extensions: [PROJECT_EXTENSION] }],
      })
      if (path === null) return null

      await writeProjectFile(path, request.project)
      approvedPaths.add(path)
      return { path }
    }
  )

  ipcMain.handle(
    IpcChannels.exportSketch,
    async (event, payload: unknown): Promise<SavedFile | null> => {
      const request = exportSketchRequestSchema.parse(payload)
      const path = await resolveSavePath(event, request.path, SKETCH_EXTENSION, {
        title: 'Export sketch',
        defaultPath: `sketch.${SKETCH_EXTENSION}`,
        filters: [{ name: 'Arduino sketch', extensions: [SKETCH_EXTENSION] }],
      })
      if (path === null) return null

      await writeSketchFile(path, request.sketch)
      approvedPaths.add(path)
      return { path }
    }
  )

  ipcMain.handle(IpcChannels.listSamples, (): Promise<readonly SampleEntry[]> => {
    return listSamples(samplesDirectory())
  })

  ipcMain.handle(IpcChannels.openSample, async (_event, payload: unknown) => {
    const request = openSampleRequestSchema.parse(payload)
    return readSample(samplesDirectory(), request.name)
  })

  ipcMain.handle(
    IpcChannels.exportHex,
    async (event, payload: unknown): Promise<SavedFile | null> => {
      const request = exportHexRequestSchema.parse(payload)
      const path = await resolveSavePath(event, request.path, HEX_EXTENSION, {
        title: 'Export HEX',
        defaultPath: `sketch.${HEX_EXTENSION}`,
        filters: [{ name: 'Intel HEX', extensions: [HEX_EXTENSION] }],
      })
      if (path === null) return null

      await writeHexFile(path, request.hex)
      approvedPaths.add(path)
      return { path }
    }
  )
}

/** Removes all handlers; used when tearing the app down in tests. */
export function unregisterIpcHandlers(): void {
  ipcMain.removeHandler(IpcChannels.ping)
  ipcMain.removeHandler(IpcChannels.compile)
  ipcMain.removeHandler(IpcChannels.toolchainStatus)
  ipcMain.removeHandler(IpcChannels.openFile)
  ipcMain.removeHandler(IpcChannels.saveProject)
  ipcMain.removeHandler(IpcChannels.exportSketch)
  ipcMain.removeHandler(IpcChannels.exportHex)
  ipcMain.removeHandler(IpcChannels.listSamples)
  ipcMain.removeHandler(IpcChannels.openSample)
}
