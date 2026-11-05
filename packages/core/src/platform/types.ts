import { z } from 'zod';

export const PlatformErrorCodeSchema = z.enum(['not_found', 'path_not_allowed', 'disabled']);
export type PlatformErrorCode = z.infer<typeof PlatformErrorCodeSchema>;

export class PlatformError extends Error {
  readonly code: PlatformErrorCode;

  constructor(code: PlatformErrorCode, message: string) {
    super(message);
    this.name = 'PlatformError';
    this.code = code;
  }
}

export const DialogFilterSchema = z.object({
  name: z.string().min(1),
  extensions: z.array(z.string().min(1)).min(1),
});
export type DialogFilter = z.infer<typeof DialogFilterSchema>;

export const DialogOptionsSchema = z.object({
  title: z.string().optional(),
  filters: z.array(DialogFilterSchema).optional(),
  defaultPath: z.string().optional(),
});
export type DialogOptions = z.infer<typeof DialogOptionsSchema>;

export const OpenFileOptionsSchema = DialogOptionsSchema;
export type OpenFileOptions = DialogOptions;

export const SaveFileOptionsSchema = DialogOptionsSchema;
export type SaveFileOptions = DialogOptions;

export type FsAdapter = {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
};

export type DialogsAdapter = {
  openFile(options?: OpenFileOptions): Promise<string | null>;
  saveFile(options?: SaveFileOptions): Promise<string | null>;
};

export const DiagnosticSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const CompileRequestSchema = z.object({
  source: z.string(),
  fqbn: z.string().min(1),
  libraries: z.array(z.string().min(1)).optional(),
});
export type CompileRequest = z.infer<typeof CompileRequestSchema>;

export const CompileResultSchema = z.object({
  ok: z.boolean(),
  hex: z.string().optional(),
  diagnostics: z.array(DiagnosticSchema),
});
export type CompileResult = z.infer<typeof CompileResultSchema>;

export type CompileAdapter = {
  compile(request: CompileRequest): Promise<CompileResult>;
};

export const ToolchainInfoSchema = z.object({
  installed: z.boolean(),
  version: z.string().optional(),
});
export type ToolchainInfo = z.infer<typeof ToolchainInfoSchema>;

export type ToolchainAdapter = {
  info(): Promise<ToolchainInfo>;
};

export const AppInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  paths: z.object({
    appData: z.string().min(1),
    temp: z.string().min(1),
  }),
});
export type AppInfo = z.infer<typeof AppInfoSchema>;

export type AppAdapter = {
  info(): Promise<AppInfo>;
};

export type PlatformAdapter = {
  readonly fs: FsAdapter;
  readonly dialogs: DialogsAdapter;
  readonly compile: CompileAdapter;
  readonly toolchain: ToolchainAdapter;
  readonly app: AppAdapter;
};
