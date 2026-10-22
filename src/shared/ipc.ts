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
} from './project'
import type {
  CompileRequest,
  CompileResult,
  PingRequest,
  PingResponse,
  ToolchainStatus,
} from './schemas'

/**
 * Every IPC channel the renderer may reach, in one place. Main and preload both
 * import from here so a channel name can never drift between the two sides.
 */
export const IpcChannels = {
  ping: 'app:ping',
  compile: 'build:compile',
  toolchainStatus: 'build:toolchain-status',
  openFile: 'file:open',
  takeLaunchFile: 'file:take-launch',
  fileOpened: 'file:opened',
  fileOpenError: 'file:open-error',
  saveProject: 'file:save-project',
  exportSketch: 'file:export-sketch',
  exportHex: 'file:export-hex',
  exportPng: 'file:export-png',
  exportPdf: 'file:export-pdf',
  listSamples: 'file:list-samples',
  openSample: 'file:open-sample',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export interface IpcExchange<Request, Response> {
  readonly request: Request
  readonly response: Response
}

/** Maps each channel to its request/response payload shapes. */
export interface IpcContract {
  readonly [IpcChannels.ping]: IpcExchange<PingRequest, PingResponse>
  readonly [IpcChannels.compile]: IpcExchange<CompileRequest, CompileResult>
  /** No request payload; the status is read on demand. */
  readonly [IpcChannels.toolchainStatus]: IpcExchange<undefined, ToolchainStatus>
  readonly [IpcChannels.openFile]: IpcExchange<undefined, OpenFileResult | null>
  readonly [IpcChannels.takeLaunchFile]: IpcExchange<undefined, OpenFileResult | null>
  readonly [IpcChannels.fileOpened]: IpcExchange<OpenFileResult, void>
  readonly [IpcChannels.fileOpenError]: IpcExchange<string, void>
  readonly [IpcChannels.saveProject]: IpcExchange<SaveProjectRequest, SavedFile | null>
  readonly [IpcChannels.exportSketch]: IpcExchange<ExportSketchRequest, SavedFile | null>
  readonly [IpcChannels.exportHex]: IpcExchange<ExportHexRequest, SavedFile | null>
  readonly [IpcChannels.exportPng]: IpcExchange<ExportPngRequest, SavedFile | null>
  readonly [IpcChannels.exportPdf]: IpcExchange<ExportPdfRequest, SavedFile | null>
  readonly [IpcChannels.listSamples]: IpcExchange<undefined, readonly SampleEntry[]>
  readonly [IpcChannels.openSample]: IpcExchange<OpenSampleRequest, OpenFileResult>
}

export type IpcRequest<Channel extends IpcChannel> = IpcContract[Channel]['request']
export type IpcResponse<Channel extends IpcChannel> = IpcContract[Channel]['response']

/** The API surface exposed to the renderer through `contextBridge`. */
export interface CircuitApi {
  ping(request: PingRequest): Promise<PingResponse>
  compile(request: CompileRequest): Promise<CompileResult>
  toolchainStatus(): Promise<ToolchainStatus>
  openFile(): Promise<OpenFileResult | null>
  /** Consumes a file passed by the OS at launch. */
  takeLaunchFile(): Promise<OpenFileResult | null>
  /** A project/sketch opened by the OS while the app is already running. */
  onFileOpened(listener: (opened: OpenFileResult) => void): () => void
  onFileOpenError(listener: (message: string) => void): () => void
  saveProject(request: SaveProjectRequest): Promise<SavedFile | null>
  exportSketch(request: ExportSketchRequest): Promise<SavedFile | null>
  exportHex(request: ExportHexRequest): Promise<SavedFile | null>
  exportPng(request: ExportPngRequest): Promise<SavedFile | null>
  exportPdf(request: ExportPdfRequest): Promise<SavedFile | null>
  listSamples(): Promise<readonly SampleEntry[]>
  openSample(request: OpenSampleRequest): Promise<OpenFileResult>
}

/** Property name under which `CircuitApi` is installed on `window`. */
export const API_NAMESPACE = 'api'
