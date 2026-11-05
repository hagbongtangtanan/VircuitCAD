import { z } from 'zod';

import { decodeBase64, encodeBase64 } from './base64';
import {
  CompileRequestSchema,
  PlatformError,
  PlatformErrorCodeSchema,
  type PlatformAdapter,
  type PlatformErrorCode,
} from './types';

export const RpcRequestSchema = z.object({
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type RpcRequest = z.infer<typeof RpcRequestSchema>;

export const PathParamsSchema = z.object({
  path: z.string().min(1),
});
export type PathParams = z.infer<typeof PathParamsSchema>;

export const WriteFileParamsSchema = z.object({
  path: z.string().min(1),
  data: z.string(),
});
export type WriteFileParams = z.infer<typeof WriteFileParamsSchema>;

export const RpcResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({
    ok: z.literal(false),
    error: z.object({ code: PlatformErrorCodeSchema, message: z.string() }),
  }),
]);

export type RpcSuccess = { ok: true; result: unknown };
export type RpcFailure = { ok: false; error: { code: PlatformErrorCode; message: string } };
export type RpcResponse = RpcSuccess | RpcFailure;

export function unwrapRpc(payload: unknown): unknown {
  const response = RpcResponseSchema.parse(payload);
  if (!response.ok) throw new PlatformError(response.error.code, response.error.message);
  return response.result;
}

async function dispatch(
  adapter: PlatformAdapter,
  method: string,
  params: unknown,
): Promise<unknown> {
  switch (method) {
    case 'app.info':
      return adapter.app.info();
    case 'toolchain.info':
      return adapter.toolchain.info();
    case 'compile.compile':
      return adapter.compile.compile(CompileRequestSchema.parse(params));
    case 'dialogs.openFile':
      return adapter.dialogs.openFile();
    case 'dialogs.saveFile':
      return adapter.dialogs.saveFile();
    case 'fs.exists':
      return adapter.fs.exists(PathParamsSchema.parse(params).path);
    case 'fs.readFile': {
      const data = await adapter.fs.readFile(PathParamsSchema.parse(params).path);
      return encodeBase64(data);
    }
    case 'fs.writeFile': {
      const { path, data } = WriteFileParamsSchema.parse(params);
      return adapter.fs.writeFile(path, decodeBase64(data));
    }
    case 'fs.readdir':
      return adapter.fs.readdir(PathParamsSchema.parse(params).path);
    case 'fs.mkdir':
      return adapter.fs.mkdir(PathParamsSchema.parse(params).path);
    case 'fs.remove':
      return adapter.fs.remove(PathParamsSchema.parse(params).path);
    default:
      throw new PlatformError('disabled', `Unknown RPC method: ${method}`);
  }
}

export async function handleRpc(adapter: PlatformAdapter, request: unknown): Promise<RpcResponse> {
  try {
    const { method, params } = RpcRequestSchema.parse(request);
    const result = await dispatch(adapter, method, params);
    return { ok: true, result: result ?? null };
  } catch (error) {
    if (error instanceof PlatformError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    return {
      ok: false,
      error: { code: 'disabled', message: error instanceof Error ? error.message : String(error) },
    };
  }
}
