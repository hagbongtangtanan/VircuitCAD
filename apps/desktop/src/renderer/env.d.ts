import type { RpcResponse } from '@vircuitcad/core';
import type { Editor } from '@vircuitcad/editor';

declare global {
  interface Window {
    vircuitcad: {
      invoke(method: string, params?: unknown): Promise<RpcResponse>;
    };
    __editor: Editor | undefined;
  }
}

export {};
