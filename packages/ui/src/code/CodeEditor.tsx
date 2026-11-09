import { useEffect, useRef } from 'react';

import { arduinoCompletions } from './arduino-keywords';

export type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  theme?: 'dark' | 'light';
  readOnly?: boolean;
};

type EditorHandle = { dispose?: () => void; getValue?: () => string };

/** Monaco editor bundled locally and lazy-loaded (no CDN). */
export function CodeEditor({ value, onChange, theme = 'dark', readOnly = false }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorHandle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let disposed = false;

    void (async () => {
      const monaco = await import('monaco-editor');
      if (disposed || !host.current) return;

      const editor = monaco.editor.create(host.current, {
        value,
        language: 'cpp',
        theme: theme === 'dark' ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        readOnly,
      });
      editor.onDidChangeModelContent(() => onChangeRef.current?.(editor.getValue()));

      monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          );
          return {
            suggestions: arduinoCompletions().map((completion) => ({
              label: completion.label,
              kind:
                completion.kind === 'function'
                  ? monaco.languages.CompletionItemKind.Function
                  : completion.kind === 'constant'
                    ? monaco.languages.CompletionItemKind.Constant
                    : monaco.languages.CompletionItemKind.Keyword,
              insertText: completion.label,
              range,
            })),
          };
        },
      });

      editorRef.current = editor;
    })();

    return () => {
      disposed = true;
      editorRef.current?.dispose?.();
      editorRef.current = null;
    };
  }, []);

  return (
    <div
      ref={host}
      data-testid="code-editor"
      style={{ width: '100%', height: '100%', minHeight: 200 }}
    />
  );
}
