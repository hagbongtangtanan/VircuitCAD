import type { Circuit, DocumentStore, RpcResponse } from '@vircuitcad/core';
import type { Editor } from '@vircuitcad/editor';

declare global {
  interface Window {
    vircuitcad: {
      invoke(method: string, params?: unknown): Promise<RpcResponse>;
    };
    __editor: Editor | undefined;
    __app:
      | {
          store: DocumentStore;
          getCircuit: () => Circuit;
          save: () => Promise<void>;
          load: () => Promise<void>;
          refresh: () => void;
        }
      | undefined;
  }
}

export {};
