import type { Circuit, DocumentStore, RpcResponse } from '@vircuitcad/core';
import type { Editor } from '@vircuitcad/editor';

declare global {
  const __APP_VERSION__: string;
  const __E2E__: boolean;

  interface Window {
    vircuitcad: {
      invoke(method: string, params?: unknown): Promise<RpcResponse>;
      onMenu(callback: (command: string) => void): void;
    };
    __editor: Editor | undefined;
    __renderCount: number;
    __app:
      | {
          store: DocumentStore;
          getCircuit: () => Circuit;
          save: () => Promise<void>;
          load: () => Promise<void>;
          refresh: () => void;
          loadText: (text: string) => void;
        }
      | undefined;
  }
}

export {};
