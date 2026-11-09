import { expect, it } from 'vitest';

import { markersByFile, toMarkers } from './diagnostics';

const diagnostics = [
  { file: 'sketch.ino', line: 3, column: 5, severity: 'error' as const, message: "expected ';'" },
  { file: 'sketch.ino', line: 0, column: 0, severity: 'warning' as const, message: 'unused' },
  { file: 'helper.h', line: 2, column: 1, severity: 'info' as const, message: 'note' },
];

it('maps diagnostics to Monaco markers', () => {
  const markers = toMarkers(diagnostics);
  expect(markers[0]).toEqual({
    startLineNumber: 3,
    startColumn: 5,
    endLineNumber: 3,
    endColumn: 6,
    severity: 8,
    message: "expected ';'",
  });
  // line/column default to 1
  expect(markers[1]?.startLineNumber).toBe(1);
  expect(markers[1]?.startColumn).toBe(1);
  expect(markers[1]?.severity).toBe(4);
  expect(markers[2]?.severity).toBe(1);
});

it('groups markers by file', () => {
  const grouped = markersByFile(diagnostics);
  expect(Object.keys(grouped).sort()).toEqual(['helper.h', 'sketch.ino']);
  expect(grouped['sketch.ino']).toHaveLength(2);
  expect(grouped['helper.h']).toHaveLength(1);
});

it('defaults a missing file name', () => {
  const grouped = markersByFile([
    { file: '', line: 1, column: 1, severity: 'error', message: 'x' },
  ]);
  expect(grouped['sketch.ino']).toHaveLength(1);
});
