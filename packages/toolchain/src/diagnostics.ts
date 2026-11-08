export type Diagnostic = {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

const DIAGNOSTIC = /^(.+?):(\d+):(\d+):\s+(fatal error|error|warning|note):\s+(.*)$/;

function severityOf(kind: string): Diagnostic['severity'] {
  if (kind === 'warning') return 'warning';
  if (kind === 'note') return 'info';
  return 'error';
}

export function parseDiagnostics(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const match = DIAGNOSTIC.exec(raw.trim());
    if (!match) continue;
    diagnostics.push({
      file: match[1] ?? '',
      line: Number(match[2]),
      column: Number(match[3]),
      severity: severityOf(match[4] ?? 'error'),
      message: match[5] ?? '',
    });
  }
  return diagnostics;
}

export function parseSizeReport(output: string): { sketchBytes?: number; dataBytes?: number } {
  const report: { sketchBytes?: number; dataBytes?: number } = {};
  const sketch = /Sketch uses (\d+) bytes/.exec(output);
  if (sketch?.[1]) report.sketchBytes = Number(sketch[1]);
  const data = /Global variables use (\d+) bytes/.exec(output);
  if (data?.[1]) report.dataBytes = Number(data[1]);
  return report;
}
