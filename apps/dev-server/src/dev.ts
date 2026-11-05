import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

import { startDevServer } from './server';

const rpcPort = Number(process.env.VC_RPC_PORT ?? 5174);
const webPort = Number(process.env.VC_WEB_PORT ?? 5173);

const rpc = await startDevServer({ port: rpcPort });
const vite = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  server: { host: '127.0.0.1', port: webPort, strictPort: true },
});
await vite.listen();
vite.printUrls();
console.log(`dev-web RPC listening on ${rpc.url}`);

const shutdown = async (): Promise<void> => {
  await vite.close();
  await rpc.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
