import { z } from 'zod';

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

export const RpcErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type RpcError = z.infer<typeof RpcErrorSchema>;
