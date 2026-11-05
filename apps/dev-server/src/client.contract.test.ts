import { definePlatformAdapterContract } from '@vircuitcad/core/contract';
import { afterAll, beforeAll } from 'vitest';

import { createDevWebClient } from './client';
import { startDevServer, type DevServer } from './server';

let dev: DevServer;

beforeAll(async () => {
  dev = await startDevServer();
});

afterAll(async () => {
  await dev.close();
});

definePlatformAdapterContract('dev-web', () => createDevWebClient(dev.url));
