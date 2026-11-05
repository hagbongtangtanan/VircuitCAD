import { promises as fs } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { CompileRequestSchema, PlatformError, type PlatformAdapter } from '@vircuitcad/core';

import { createNodePlatformAdapter } from './node-adapter';
import { PathParamsSchema, RpcRequestSchema, WriteFileParamsSchema } from './protocol';

export type DevServer = {
  url: string;
  port: number;
  adapter: PlatformAdapter;
  close: () => Promise<void>;
};

export type StartDevServerOptions = {
  port?: number;
  host?: string;
  appData?: string;
  temp?: string;
};

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function encodeBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

function decodeBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

function send(response: http.ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function readBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function statusFor(code: string): number {
  if (code === 'not_found') return 404;
  if (code === 'path_not_allowed') return 400;
  return 500;
}

async function dispatch(adapter: PlatformAdapter, method: string, params: unknown): Promise<unknown> {
  switch (method) {
    case 'app.info':
      return adapter.app.info();
    case 'toolchain.info':
      return adapter.toolchain.info();
    case 'compile.compile':
      return adapter.compile.compile(CompileRequestSchema.parse(params));
    case 'dialogs.openFile':
      return adapter.dialogs.openFile();
    case 'dialogs.saveFile':
      return adapter.dialogs.saveFile();
    case 'fs.exists':
      return adapter.fs.exists(PathParamsSchema.parse(params).path);
    case 'fs.readFile':
      return encodeBase64(await adapter.fs.readFile(PathParamsSchema.parse(params).path));
    case 'fs.writeFile': {
      const { path: filePath, data } = WriteFileParamsSchema.parse(params);
      return adapter.fs.writeFile(filePath, decodeBase64(data));
    }
    case 'fs.readdir':
      return adapter.fs.readdir(PathParamsSchema.parse(params).path);
    case 'fs.mkdir':
      return adapter.fs.mkdir(PathParamsSchema.parse(params).path);
    case 'fs.remove':
      return adapter.fs.remove(PathParamsSchema.parse(params).path);
    default:
      throw new PlatformError('disabled', `Unknown RPC method: ${method}`);
  }
}

function createHandler(adapter: PlatformAdapter): http.RequestListener {
  return (request, response) => {
    void (async () => {
      if (request.method !== 'POST' || request.url !== '/rpc') {
        send(response, 404, { error: { code: 'not_found', message: 'Only POST /rpc is served' } });
        return;
      }
      const remote = request.socket.remoteAddress ?? '';
      if (!LOOPBACK.has(remote)) {
        send(response, 403, { error: { code: 'path_not_allowed', message: 'Non-loopback client' } });
        return;
      }
      try {
        const parsed = RpcRequestSchema.parse(JSON.parse(await readBody(request)));
        send(response, 200, { result: await dispatch(adapter, parsed.method, parsed.params) });
      } catch (error) {
        if (error instanceof PlatformError) {
          send(response, statusFor(error.code), {
            error: { code: error.code, message: error.message },
          });
          return;
        }
        send(response, 400, {
          error: { code: 'disabled', message: error instanceof Error ? error.message : String(error) },
        });
      }
    })();
  };
}

export async function startDevServer(options: StartDevServerOptions = {}): Promise<DevServer> {
  const host = options.host ?? '127.0.0.1';
  const appData = options.appData ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'vircuitcad-dev-')));
  const temp = options.temp ?? os.tmpdir();
  const adapter = createNodePlatformAdapter({ appData, temp });
  const server = http.createServer(createHandler(adapter));

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => resolve());
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new PlatformError('disabled', 'Failed to determine the dev server address');
  }

  return {
    url: `http://${host}:${address.port}`,
    port: address.port,
    adapter,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
