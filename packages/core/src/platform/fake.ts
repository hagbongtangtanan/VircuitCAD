import {
  CompileRequestSchema,
  OpenFileOptionsSchema,
  PlatformError,
  SaveFileOptionsSchema,
  type AppInfo,
  type CompileRequest,
  type CompileResult,
  type OpenFileOptions,
  type PlatformAdapter,
  type SaveFileOptions,
  type ToolchainInfo,
} from './types';

export type InMemoryPlatformAdapter = PlatformAdapter & {
  readonly files: ReadonlyMap<string, Uint8Array>;
  allowPath(path: string): void;
  seedFile(path: string, data: Uint8Array): void;
  setOpenFileResult(path: string | null): void;
  setSaveFileResult(path: string | null): void;
};

function normalizePath(input: string): string {
  const absolute = input.startsWith('/');
  const out: string[] = [];
  for (const segment of input.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return `${absolute ? '/' : ''}${out.join('/')}`;
}

function parentOf(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index <= 0 ? '/' : normalized.slice(0, index);
}

function isWithin(root: string, path: string): boolean {
  const normalizedRoot = normalizePath(root);
  const normalizedPath = normalizePath(path);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

export function createInMemoryPlatformAdapter(overrides?: Partial<AppInfo>): InMemoryPlatformAdapter {
  const appInfo: AppInfo = {
    name: 'VircuitCAD',
    version: '0.0.0-test',
    paths: { appData: '/app-data', temp: '/tmp' },
    ...overrides,
  };

  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  const roots = new Set<string>([normalizePath(appInfo.paths.appData), normalizePath(appInfo.paths.temp)]);
  let openFileResult: string | null = null;
  let saveFileResult: string | null = null;

  const allowPath = (path: string): void => {
    roots.add(normalizePath(path));
  };

  const ensureAllowed = (path: string): string => {
    const normalized = normalizePath(path);
    for (const root of roots) {
      if (isWithin(root, normalized)) return normalized;
    }
    throw new PlatformError('path_not_allowed', `Path is outside the allowed roots: ${path}`);
  };

  const registerDir = (dir: string): void => {
    let current = dir;
    while (current !== '/' && current !== '' && !dirs.has(current)) {
      dirs.add(current);
      current = parentOf(current);
    }
  };

  const fs = {
    async exists(path: string): Promise<boolean> {
      const normalized = normalizePath(path);
      return files.has(normalized) || dirs.has(normalized);
    },
    async readFile(path: string): Promise<Uint8Array> {
      const normalized = ensureAllowed(path);
      const data = files.get(normalized);
      if (!data) throw new PlatformError('not_found', `File does not exist: ${path}`);
      return Uint8Array.from(data);
    },
    async writeFile(path: string, data: Uint8Array): Promise<void> {
      const normalized = ensureAllowed(path);
      registerDir(parentOf(normalized));
      files.set(normalized, Uint8Array.from(data));
    },
    async readdir(path: string): Promise<string[]> {
      const normalized = ensureAllowed(path);
      if (!files.has(normalized) && !dirs.has(normalized)) {
        throw new PlatformError('not_found', `Directory does not exist: ${path}`);
      }
      const prefix = normalized === '/' ? '/' : `${normalized}/`;
      const names = new Set<string>();
      for (const key of [...files.keys(), ...dirs]) {
        if (!key.startsWith(prefix)) continue;
        const name = key.slice(prefix.length).split('/')[0];
        if (name) names.add(name);
      }
      return [...names].sort();
    },
    async mkdir(path: string): Promise<void> {
      const normalized = ensureAllowed(path);
      registerDir(normalized);
    },
    async remove(path: string): Promise<void> {
      const normalized = ensureAllowed(path);
      files.delete(normalized);
      dirs.delete(normalized);
      const prefix = `${normalized}/`;
      for (const key of [...files.keys()]) if (key.startsWith(prefix)) files.delete(key);
      for (const key of [...dirs]) if (key.startsWith(prefix)) dirs.delete(key);
    },
  };

  const dialogs = {
    async openFile(options?: OpenFileOptions): Promise<string | null> {
      if (options) OpenFileOptionsSchema.parse(options);
      if (openFileResult === null) return null;
      allowPath(openFileResult);
      return openFileResult;
    },
    async saveFile(options?: SaveFileOptions): Promise<string | null> {
      if (options) SaveFileOptionsSchema.parse(options);
      if (saveFileResult === null) return null;
      allowPath(saveFileResult);
      return saveFileResult;
    },
  };

  const compile = {
    async compile(request: CompileRequest): Promise<CompileResult> {
      const parsed = CompileRequestSchema.parse(request);
      if (parsed.source.trim().length === 0) {
        return { ok: false, diagnostics: [{ severity: 'error', message: 'Empty sketch' }] };
      }
      return { ok: true, hex: ':00000001FF', diagnostics: [] };
    },
  };

  const toolchain = {
    async info(): Promise<ToolchainInfo> {
      return { installed: true, version: '0.0.0-test' };
    },
  };

  const app = {
    async info(): Promise<AppInfo> {
      return { ...appInfo, paths: { ...appInfo.paths } };
    },
  };

  return {
    fs,
    dialogs,
    compile,
    toolchain,
    app,
    files,
    allowPath,
    seedFile(path: string, data: Uint8Array): void {
      const normalized = normalizePath(path);
      registerDir(parentOf(normalized));
      files.set(normalized, Uint8Array.from(data));
    },
    setOpenFileResult(path: string | null): void {
      openFileResult = path;
    },
    setSaveFileResult(path: string | null): void {
      saveFileResult = path;
    },
  };
}
