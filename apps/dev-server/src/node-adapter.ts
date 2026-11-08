import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  CompileRequestSchema,
  PlatformError,
  type AppInfo,
  type PlatformAdapter,
  type ToolchainInfo,
} from '@vircuitcad/core';
import { CompileService, locateToolchain, type ToolchainLayout } from '@vircuitcad/toolchain';

export type NodePlatformOptions = {
  appData: string;
  temp: string;
  name?: string;
  version?: string;
};

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toPlatformError(error: unknown, target: string): PlatformError {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ENOENT') return new PlatformError('not_found', `Not found: ${target}`);
  if (code === 'EACCES' || code === 'EPERM') {
    return new PlatformError('path_not_allowed', `Access denied: ${target}`);
  }
  return new PlatformError('disabled', error instanceof Error ? error.message : String(error));
}

export function createNodePlatformAdapter(options: NodePlatformOptions): PlatformAdapter {
  const appData = path.resolve(options.appData);
  const temp = path.resolve(options.temp);
  const granted = new Set<string>([appData, temp]);
  const appInfo: AppInfo = {
    name: options.name ?? 'VircuitCAD',
    version: options.version ?? '0.0.0-dev',
    paths: { appData, temp },
  };

  const resolveAllowed = (input: string): string => {
    const resolved = path.resolve(input);
    for (const root of granted) {
      if (isWithin(root, resolved)) return resolved;
    }
    throw new PlatformError('path_not_allowed', `Path is outside the allowed roots: ${input}`);
  };

  const fsAdapter: PlatformAdapter['fs'] = {
    async exists(input) {
      try {
        await fs.access(resolveAllowed(input));
        return true;
      } catch {
        return false;
      }
    },
    async readFile(input) {
      const target = resolveAllowed(input);
      try {
        return new Uint8Array(await fs.readFile(target));
      } catch (error) {
        throw toPlatformError(error, target);
      }
    },
    async writeFile(input, data) {
      const target = resolveAllowed(input);
      try {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, data);
      } catch (error) {
        throw toPlatformError(error, target);
      }
    },
    async readdir(input) {
      const target = resolveAllowed(input);
      try {
        return await fs.readdir(target);
      } catch (error) {
        throw toPlatformError(error, target);
      }
    },
    async mkdir(input) {
      const target = resolveAllowed(input);
      try {
        await fs.mkdir(target, { recursive: true });
      } catch (error) {
        throw toPlatformError(error, target);
      }
    },
    async remove(input) {
      const target = resolveAllowed(input);
      try {
        await fs.rm(target, { recursive: true, force: true });
      } catch (error) {
        throw toPlatformError(error, target);
      }
    },
  };

  const dialogs: PlatformAdapter['dialogs'] = {
    async openFile() {
      return null;
    },
    async saveFile() {
      return null;
    },
  };

  const toolchainRoot = path.resolve('resources/toolchain');
  let layout: ToolchainLayout | undefined;
  try {
    layout = locateToolchain({ devRoots: [toolchainRoot], platform: process.platform });
  } catch {
    layout = undefined;
  }

  const compile: PlatformAdapter['compile'] = {
    async compile(request) {
      const parsed = CompileRequestSchema.parse(request);
      if (parsed.source.trim().length === 0) {
        return { ok: false, diagnostics: [{ severity: 'error', message: 'Empty sketch' }] };
      }
      if (!layout) {
        return {
          ok: false,
          diagnostics: [
            { severity: 'error', message: 'Arduino toolchain not installed (run tools/fetch-toolchain.mjs)' },
          ],
        };
      }
      return new CompileService({ layout }).compile(parsed);
    },
  };

  const toolchain: PlatformAdapter['toolchain'] = {
    async info(): Promise<ToolchainInfo> {
      return layout ? { installed: true, version: 'arduino-cli' } : { installed: false };
    },
  };

  const app: PlatformAdapter['app'] = {
    async info() {
      return { ...appInfo, paths: { ...appInfo.paths } };
    },
  };

  return { fs: fsAdapter, dialogs, compile, toolchain, app };
}
