let electron = require("electron");
//#region src/shared/ipc.ts
/**
* Every IPC channel the renderer may reach, in one place. Main and preload both
* import from here so a channel name can never drift between the two sides.
*/
var IpcChannels = {
	ping: "app:ping",
	compile: "build:compile",
	toolchainStatus: "build:toolchain-status",
	openFile: "file:open",
	takeLaunchFile: "file:take-launch",
	fileOpened: "file:opened",
	fileOpenError: "file:open-error",
	saveProject: "file:save-project",
	exportSketch: "file:export-sketch",
	exportHex: "file:export-hex",
	exportPng: "file:export-png",
	exportPdf: "file:export-pdf",
	listSamples: "file:list-samples",
	openSample: "file:open-sample"
};
//#endregion
//#region src/preload/index.ts
electron.contextBridge.exposeInMainWorld("api", {
	ping(request) {
		return electron.ipcRenderer.invoke(IpcChannels.ping, request);
	},
	compile(request) {
		return electron.ipcRenderer.invoke(IpcChannels.compile, request);
	},
	toolchainStatus() {
		return electron.ipcRenderer.invoke(IpcChannels.toolchainStatus);
	},
	openFile() {
		return electron.ipcRenderer.invoke(IpcChannels.openFile);
	},
	takeLaunchFile() {
		return electron.ipcRenderer.invoke(IpcChannels.takeLaunchFile);
	},
	onFileOpened(listener) {
		const handler = (_event, opened) => listener(opened);
		electron.ipcRenderer.on(IpcChannels.fileOpened, handler);
		return () => electron.ipcRenderer.removeListener(IpcChannels.fileOpened, handler);
	},
	onFileOpenError(listener) {
		const handler = (_event, message) => listener(message);
		electron.ipcRenderer.on(IpcChannels.fileOpenError, handler);
		return () => electron.ipcRenderer.removeListener(IpcChannels.fileOpenError, handler);
	},
	saveProject(request) {
		return electron.ipcRenderer.invoke(IpcChannels.saveProject, request);
	},
	exportSketch(request) {
		return electron.ipcRenderer.invoke(IpcChannels.exportSketch, request);
	},
	exportHex(request) {
		return electron.ipcRenderer.invoke(IpcChannels.exportHex, request);
	},
	exportPng(request) {
		return electron.ipcRenderer.invoke(IpcChannels.exportPng, request);
	},
	exportPdf(request) {
		return electron.ipcRenderer.invoke(IpcChannels.exportPdf, request);
	},
	listSamples() {
		return electron.ipcRenderer.invoke(IpcChannels.listSamples);
	},
	openSample(request) {
		return electron.ipcRenderer.invoke(IpcChannels.openSample, request);
	}
});
//#endregion
