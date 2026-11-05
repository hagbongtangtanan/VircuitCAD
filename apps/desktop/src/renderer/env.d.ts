import type { RpcResponse } from '@vircuitcad/core';

declare global {
  interface Window {
    vircuitcad: {
      invoke(method: string, params?: unknown): Promise<RpcResponse>;
    };
  }
}

export {};
