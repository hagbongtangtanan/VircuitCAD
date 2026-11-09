import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

/** Wires Monaco's web worker locally (Vite bundles it). Call before mounting CodeEditor. */
export function ensureMonacoEnvironment(): void {
  const scope = self as unknown as { MonacoEnvironment?: unknown };
  if (scope.MonacoEnvironment) return;
  scope.MonacoEnvironment = {
    getWorker(): Worker {
      return new EditorWorker();
    },
  };
}
