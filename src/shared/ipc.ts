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
}

export type IpcRequest<Channel extends IpcChannel> = IpcContract[Channel]['request']
export type IpcResponse<Channel extends IpcChannel> = IpcContract[Channel]['response']

/** The API surface exposed to the renderer through `contextBridge`. */
export interface CircuitApi {
  ping(request: PingRequest): Promise<PingResponse>
  compile(request: CompileRequest): Promise<CompileResult>
  toolchainStatus(): Promise<ToolchainStatus>
}

/** Property name under which `CircuitApi` is installed on `window`. */
export const API_NAMESPACE = 'api'
