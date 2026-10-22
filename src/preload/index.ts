import { contextBridge, ipcRenderer } from 'electron'
import { API_NAMESPACE, IpcChannels, type CircuitApi } from '../shared/ipc'
import type { IpcRendererEvent } from 'electron'
import type {
  ExportHexRequest,
  ExportPdfRequest,
  ExportPngRequest,
  ExportSketchRequest,
  OpenFileResult,
  OpenSampleRequest,
  SampleEntry,
  SaveProjectRequest,
  SavedFile,
} from '../shared/project'
import type {
  CompileRequest,
  CompileResult,
  PingRequest,
  PingResponse,
  ToolchainStatus,
} from '../shared/schemas'

const api: CircuitApi = {
  ping(request: PingRequest): Promise<PingResponse> {
    return ipcRenderer.invoke(IpcChannels.ping, request) as Promise<PingResponse>
  },
  compile(request: CompileRequest): Promise<CompileResult> {
    return ipcRenderer.invoke(IpcChannels.compile, request) as Promise<CompileResult>
  },
  toolchainStatus(): Promise<ToolchainStatus> {
    return ipcRenderer.invoke(IpcChannels.toolchainStatus) as Promise<ToolchainStatus>
  },
  openFile(): Promise<OpenFileResult | null> {
    return ipcRenderer.invoke(IpcChannels.openFile) as Promise<OpenFileResult | null>
  },
  takeLaunchFile(): Promise<OpenFileResult | null> {
    return ipcRenderer.invoke(IpcChannels.takeLaunchFile) as Promise<OpenFileResult | null>
  },
  onFileOpened(listener: (opened: OpenFileResult) => void): () => void {
    const handler = (_event: IpcRendererEvent, opened: OpenFileResult): void => listener(opened)
    ipcRenderer.on(IpcChannels.fileOpened, handler)
    return () => ipcRenderer.removeListener(IpcChannels.fileOpened, handler)
  },
  onFileOpenError(listener: (message: string) => void): () => void {
    const handler = (_event: IpcRendererEvent, message: string): void => listener(message)
    ipcRenderer.on(IpcChannels.fileOpenError, handler)
    return () => ipcRenderer.removeListener(IpcChannels.fileOpenError, handler)
  },
  saveProject(request: SaveProjectRequest): Promise<SavedFile | null> {
    return ipcRenderer.invoke(IpcChannels.saveProject, request) as Promise<SavedFile | null>
  },
  exportSketch(request: ExportSketchRequest): Promise<SavedFile | null> {
    return ipcRenderer.invoke(IpcChannels.exportSketch, request) as Promise<SavedFile | null>
  },
  exportHex(request: ExportHexRequest): Promise<SavedFile | null> {
    return ipcRenderer.invoke(IpcChannels.exportHex, request) as Promise<SavedFile | null>
  },
  exportPng(request: ExportPngRequest): Promise<SavedFile | null> {
    return ipcRenderer.invoke(IpcChannels.exportPng, request) as Promise<SavedFile | null>
  },
  exportPdf(request: ExportPdfRequest): Promise<SavedFile | null> {
    return ipcRenderer.invoke(IpcChannels.exportPdf, request) as Promise<SavedFile | null>
  },
  listSamples(): Promise<readonly SampleEntry[]> {
    return ipcRenderer.invoke(IpcChannels.listSamples) as Promise<readonly SampleEntry[]>
  },
  openSample(request: OpenSampleRequest): Promise<OpenFileResult> {
    return ipcRenderer.invoke(IpcChannels.openSample, request) as Promise<OpenFileResult>
  },
}

contextBridge.exposeInMainWorld(API_NAMESPACE, api)
