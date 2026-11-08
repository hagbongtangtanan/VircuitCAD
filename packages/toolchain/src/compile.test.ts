import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { CompileService, type CompileRunner } from './compile';
import type { ToolchainLayout } from './locator';

const layout: ToolchainLayout = {
  root: '/tc',
  arduinoCli: '/tc/arduino-cli',
  sketch: '/tc/sketch',
  libraries: '/tc/libraries',
  cores: '/tc/cores',
};

it('compiles a sketch, parses diagnostics and reads the hex', async () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'vc-compile-'));
  const runner: CompileRunner = async (_command, args) => {
    const buildPath = args[args.indexOf('--build-path') + 1] ?? '';
    mkdirSync(buildPath, { recursive: true });
    writeFileSync(path.join(buildPath, 'sketch.ino.hex'), ':00000001FF\n');
    return { code: 0, stdout: 'Sketch uses 100 bytes (0%) of program storage space.', stderr: '' };
  };

  const service = new CompileService({ layout, tempRoot, runner });
  const result = await service.compile({ source: 'void setup(){}', fqbn: 'arduino:avr:uno' });
  expect(result.ok).toBe(true);
  expect(result.hex).toBe(':00000001FF\n');
});

it('reports diagnostics on failure', async () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'vc-compile-'));
  const runner: CompileRunner = async () => ({
    code: 1,
    stdout: '',
    stderr: 'sketch/sketch.ino:2:1: error: expected ; before } token',
  });

  const service = new CompileService({ layout, tempRoot, runner });
  const result = await service.compile({ source: 'void setup(){}', fqbn: 'arduino:avr:uno' });
  expect(result.ok).toBe(false);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.severity).toBe('error');
});
