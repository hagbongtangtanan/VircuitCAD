import { contextBridge, ipcRenderer } from 'electron'
import { API_NAMESPACE, IpcChannels, type CircuitApi } from '../shared/ipc'
import type { PingRequest, PingResponse } from '../shared/schemas'

const api: CircuitApi = {
  ping(request: PingRequest): Promise<PingResponse> {
    return ipcRenderer.invoke(IpcChannels.ping, request) as Promise<PingResponse>
  },
}

contextBridge.exposeInMainWorld(API_NAMESPACE, api)
