import { contextBridge, ipcRenderer } from 'electron'
import { API_NAMESPACE, IpcChannels, type CircuitApi } from '../shared/ipc'
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
}

contextBridge.exposeInMainWorld(API_NAMESPACE, api)
