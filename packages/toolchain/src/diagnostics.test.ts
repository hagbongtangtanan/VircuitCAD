import { createHash } from 'node:crypto';

import { expect, it } from 'vitest';

import { parseDiagnostics, parseSizeReport } from './diagnostics';

const sample = [
  "In file included from /tmp/vcad/abc/sketch/sketch.ino:1:",
  "/tmp/vcad/abc/sketch/sketch.ino:3:5: error: 'foo' was not declared in this scope",
  "/tmp/vcad/abc/sketch/sketch.ino:4:1: warning: unused variable 'x'",
  "/tmp/vcad/abc/sketch/sketch.ino:5:2: note: in expansion of macro",
  'Sketch uses 924 bytes (2%) of program storage space.',
  'Global variables use 9 bytes (0%) of dynamic memory.',
].join('\n');

it('parses gcc diagnostics with severity mapping', () => {
  const diagnostics = parseDiagnostics(sample);
  expect(diagnostics).toHaveLength(3);
  expect(diagnostics[0]).toMatchObject({
    line: 3,
    column: 5,
    severity: 'error',
    message: "'foo' was not declared in this scope",
  });
  expect(diagnostics[1]?.severity).toBe('warning');
  expect(diagnostics[2]?.severity).toBe('info');
});

it('parses the size report', () => {
  expect(parseSizeReport(sample)).toEqual({ sketchBytes: 924, dataBytes: 9 });
});

it('ignores unrelated lines', () => {
  expect(parseDiagnostics('compiling...\ndone')).toEqual([]);
});

it('hashes stably via crypto (sanity)', () => {
  const a = createHash('sha256').update('x').digest('hex');
  const b = createHash('sha256').update('x').digest('hex');
  expect(a).toBe(b);
});
