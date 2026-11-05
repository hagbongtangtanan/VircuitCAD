import { z } from 'zod';

import {
  AppInfoSchema,
  CompileResultSchema,
  PlatformError,
  PlatformErrorCodeSchema,
  ToolchainInfoSchema,
  type PlatformAdapter,
} from '@vircuitcad/core';

function bytesToBase64(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

export function createDevWebClient(baseUrl: string): PlatformAdapter {
  const call = async (method: string, params?: unknown): Promise<unknown> => {
    const response = await fetch(`${baseUrl}/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, params }),
    });
    const payload = (await response.json()) as {
      result?: unknown;
      error?: { code?: unknown; message?: unknown };
    };
    if (!response.ok) {
      const code = PlatformErrorCodeSchema.safeParse(payload.error?.code);
      const message = z.string().safeParse(payload.error?.message);
      throw new PlatformError(
        code.success ? code.data : 'disabled',
        message.success ? message.data : `RPC ${method} failed`,
      );
    }
    return payload.result;
  };

  return {
    fs: {
      async exists(path) {
        return z.boolean().parse(await call('fs.exists', { path }));
      },
      async readFile(path) {
        return base64ToBytes(z.string().parse(await call('fs.readFile', { path })));
      },
      async writeFile(path, data) {
        await call('fs.writeFile', { path, data: bytesToBase64(data) });
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
