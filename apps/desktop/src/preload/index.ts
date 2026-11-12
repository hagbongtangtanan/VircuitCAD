import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vircuitcad', {
  invoke: (method: string, params?: unknown) =>
    ipcRenderer.invoke('vircuitcad:rpc', { method, params }),
  onMenu: (callback: (command: string) => void) => {
    ipcRenderer.on('vircuitcad:menu', (_event, command: unknown) => {
      if (typeof command === 'string') callback(command);
    });
  },
});
