import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vircuitcad', {
  invoke: (method: string, params?: unknown) =>
    ipcRenderer.invoke('vircuitcad:rpc', { method, params }),
});
