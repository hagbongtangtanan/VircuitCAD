import { promises as fs } from 'node:fs';
import path from 'node:path';

import { dialog, app as electronApp } from 'electron';

import {
  CompileRequestSchema,
  PlatformError,
  type AppInfo,
  type OpenFileOptions,
  type PlatformAdapter,
  type ToolchainInfo,
} from '@vircuitcad/core';

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

function toFilters(filters: OpenFileOptions['filters']): { name: string; extensions: string[] }[] | undefined {
  return filters?.map((filter) => ({ name: filter.name, extensions: [...filter.extensions] }));
}

export function createElectronPlatformAdapter(): PlatformAdapter {
  const appData = path.resolve(electronApp.getPath('userData'));
  const temp = path.resolve(electronApp.getPath('temp'));
  const granted = new Set<string>([appData, temp]);
  const appInfo: AppInfo = {
    name: 'VircuitCAD',
    version: electronApp.getVersion(),
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

  const grantPicked = (picked: string): string => {
    granted.add(path.resolve(path.dirname(picked)));
    return picked;
  };

  const dialogs: PlatformAdapter['dialogs'] = {
    async openFile(options) {
      const title = options?.title;
      const filters = toFilters(options?.filters);
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        ...(title !== undefined ? { title } : {}),
        ...(filters !== undefined ? { filters } : {}),
      });
      const picked = result.filePaths[0];
      if (result.canceled || picked === undefined) return null;
      return grantPicked(picked);
    },
    async saveFile(options) {
      const title = options?.title;
      const defaultPath = options?.defaultPath;
      const filters = toFilters(options?.filters);
      const result = await dialog.showSaveDialog({
        ...(title !== undefined ? { title } : {}),
        ...(defaultPath !== undefined ? { defaultPath } : {}),
        ...(filters !== undefined ? { filters } : {}),
      });
      if (result.canceled || result.filePath === undefined) return null;
      return grantPicked(result.filePath);
    },
  };

  const compile: PlatformAdapter['compile'] = {
    async compile(request) {
      const parsed = CompileRequestSchema.parse(request);
      if (parsed.source.trim().length === 0) {
        return { ok: false, diagnostics: [{ severity: 'error', message: 'Empty sketch' }] };
      }
      return { ok: true, hex: ':00000001FF', diagnostics: [] };
    },
  };

  const toolchain: PlatformAdapter['toolchain'] = {
    async info(): Promise<ToolchainInfo> {
      return { installed: false };
    },
  };

  const app: PlatformAdapter['app'] = {
    async info() {
      return { ...appInfo, paths: { ...appInfo.paths } };
    },
  };

  return { fs: fsAdapter, dialogs, compile, toolchain, app };
}
