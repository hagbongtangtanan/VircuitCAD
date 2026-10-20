import { contextBridge, ipcRenderer } from 'electron'
import { API_NAMESPACE, IpcChannels, type CircuitApi } from '../shared/ipc'
import type {
  ExportHexRequest,
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
  listSamples(): Promise<readonly SampleEntry[]> {
    return ipcRenderer.invoke(IpcChannels.listSamples) as Promise<readonly SampleEntry[]>
  },
  openSample(request: OpenSampleRequest): Promise<OpenFileResult> {
    return ipcRenderer.invoke(IpcChannels.openSample, request) as Promise<OpenFileResult>
  },
}

contextBridge.exposeInMainWorld(API_NAMESPACE, api)
