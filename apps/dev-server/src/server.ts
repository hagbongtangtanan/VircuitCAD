import { promises as fs } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { handleRpc, PlatformError, type PlatformAdapter } from '@vircuitcad/core';

import { createNodePlatformAdapter } from './node-adapter';

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

function createHandler(adapter: PlatformAdapter): http.RequestListener {
  return (request, response) => {
    void (async () => {
      if (request.method !== 'POST' || request.url !== '/rpc') {
        send(response, 404, {
          ok: false,
          error: { code: 'not_found', message: 'Only POST /rpc is served' },
        });
        return;
      }
      const remote = request.socket.remoteAddress ?? '';
      if (!LOOPBACK.has(remote)) {
        send(response, 403, {
          ok: false,
          error: { code: 'path_not_allowed', message: 'Non-loopback client' },
        });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readBody(request));
      } catch {
        send(response, 400, {
          ok: false,
          error: { code: 'disabled', message: 'Invalid JSON body' },
        });
        return;
      }
      const envelope = await handleRpc(adapter, parsed);
      send(response, envelope.ok ? 200 : statusFor(envelope.error.code), envelope);
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
