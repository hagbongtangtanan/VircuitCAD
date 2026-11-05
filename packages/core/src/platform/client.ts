import { z } from 'zod';

import { decodeBase64, encodeBase64 } from './base64';
import {
  AppInfoSchema,
  CompileResultSchema,
  ToolchainInfoSchema,
  type PlatformAdapter,
} from './types';

export type AdapterCaller = (method: string, params?: unknown) => Promise<unknown>;

export function createAdapterClient(call: AdapterCaller): PlatformAdapter {
  return {
    fs: {
      async exists(path) {
        return z.boolean().parse(await call('fs.exists', { path }));
      },
      async readFile(path) {
        return decodeBase64(z.string().parse(await call('fs.readFile', { path })));
      },
      async writeFile(path, data) {
        await call('fs.writeFile', { path, data: encodeBase64(data) });
      },
      async readdir(path) {
        return z.array(z.string()).parse(await call('fs.readdir', { path }));
      },
      async mkdir(path) {
        await call('fs.mkdir', { path });
      },
      async remove(path) {
        await call('fs.remove', { path });
      },
    },
    dialogs: {
      async openFile() {
        return z.union([z.string(), z.null()]).parse(await call('dialogs.openFile'));
      },
      async saveFile() {
        return z.union([z.string(), z.null()]).parse(await call('dialogs.saveFile'));
      },
    },
    compile: {
      async compile(request) {
        return CompileResultSchema.parse(await call('compile.compile', request));
      },
    },
    toolchain: {
      async info() {
        return ToolchainInfoSchema.parse(await call('toolchain.info'));
      },
    },
    app: {
      async info() {
        return AppInfoSchema.parse(await call('app.info'));
      },
    },
  };
}
