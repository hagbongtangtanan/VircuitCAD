import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { CompileRequest, CompileResult } from '@vircuitcad/core';

import { parseDiagnostics } from './diagnostics';
import { isolatedEnv, type ToolchainLayout } from './locator';

export type CompileRunnerResult = { code: number; stdout: string; stderr: string };
export type CompileRunner = (
  command: string,
  args: string[],
  options: {
    env: Record<string, string>;
    cwd: string;
    timeoutMs: number;
    signal?: AbortSignal;
  },
) => Promise<CompileRunnerResult>;

export type CompileServiceOptions = {
  layout: ToolchainLayout;
  tempRoot?: string;
  timeoutMs?: number;
  runner?: CompileRunner;
};

export type CompileHooks = {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
};

function findHex(dir: string): string | undefined {
  try {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        const nested = findHex(full);
        if (nested) return nested;
      } else if (entry.endsWith('.hex')) {
        return full;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

const defaultRunner: CompileRunner = (command, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: options.env, cwd: options.cwd });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs);
    options.signal?.addEventListener('abort', () => child.kill('SIGKILL'), { once: true });
    child.stdout.on('data', (chunk) => (stdout += String(chunk)));
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });

export class CompileService {
  constructor(private readonly options: CompileServiceOptions) {}

  async compile(request: CompileRequest, hooks: CompileHooks = {}): Promise<CompileResult> {
    const tempRoot = this.options.tempRoot ?? path.join(os.tmpdir());
    const hash = createHash('sha256').update(request.source).digest('hex').slice(0, 8);
    const workDir = path.join(tempRoot, 'vcad', hash);
    const sketchDir = path.join(workDir, 'sketch');
    const buildPath = path.join(workDir, 'build');
    mkdirSync(sketchDir, { recursive: true });
    writeFileSync(path.join(sketchDir, 'sketch.ino'), request.source);

    hooks.onProgress?.('compiling');
    const env = { ...process.env, ...isolatedEnv(this.options.layout) } as Record<string, string>;
    const args = [
      'compile',
      '--fqbn',
      request.fqbn,
      '--build-path',
      buildPath,
      '--no-color',
      ...(request.libraries ?? []).flatMap((library) => ['--library', library]),
      sketchDir,
    ];

    const runner = this.options.runner ?? defaultRunner;
    const result = await runner(this.options.layout.arduinoCli, args, {
      env,
      cwd: workDir,
      timeoutMs: this.options.timeoutMs ?? 60_000,
      ...(hooks.signal ? { signal: hooks.signal } : {}),
    });

    const output = `${result.stdout}\n${result.stderr}`;
    const diagnostics = parseDiagnostics(output);
    hooks.onProgress?.(result.code === 0 ? 'done' : 'failed');

    const hexPath = result.code === 0 ? findHex(buildPath) : undefined;
    const hex = hexPath ? readFileSync(hexPath, 'utf8') : undefined;
    return { ok: result.code === 0 && Boolean(hex), ...(hex ? { hex } : {}), diagnostics };
  }
}
