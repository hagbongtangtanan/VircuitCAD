export type CompileDiagnostic = {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

export type Marker = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  severity: number;
  message: string;
};

const MONACO_SEVERITY: Record<CompileDiagnostic['severity'], number> = {
  error: 8,
  warning: 4,
  info: 1,
};

export function toMarkers(diagnostics: readonly CompileDiagnostic[]): Marker[] {
  return diagnostics.map((diagnostic) => {
    const line = Math.max(1, diagnostic.line || 1);
    const column = Math.max(1, diagnostic.column || 1);
    return {
      startLineNumber: line,
      startColumn: column,
      endLineNumber: line,
      endColumn: column + 1,
      severity: MONACO_SEVERITY[diagnostic.severity] ?? 8,
      message: diagnostic.message,
    };
  });
}

/** Markers grouped by file, ready to hand to Monaco (and to clear stale ones). */
export function markersByFile(diagnostics: readonly CompileDiagnostic[]): Record<string, Marker[]> {
  const byFile: Record<string, Marker[]> = {};
  for (const diagnostic of diagnostics) {
    const key = diagnostic.file || 'sketch.ino';
    (byFile[key] ??= []).push(...toMarkers([diagnostic]));
  }
  return byFile;
}
