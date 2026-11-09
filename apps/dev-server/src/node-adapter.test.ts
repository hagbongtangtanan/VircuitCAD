import { expect, it } from 'vitest';

import { createNodePlatformAdapter } from './node-adapter';

it('returns a toolchain diagnostic when arduino-cli is not installed', async () => {
  const adapter = createNodePlatformAdapter({ appData: '/tmp/vc-app', temp: '/tmp' });
  const result = await adapter.compile.compile({ source: 'void setup() {}', fqbn: 'arduino:avr:uno' });
  expect(result.ok).toBe(false);
  expect(result.diagnostics.length).toBeGreaterThan(0);
});

it('reports toolchain info', async () => {
  const adapter = createNodePlatformAdapter({ appData: '/tmp/vc-app', temp: '/tmp' });
  const info = await adapter.toolchain.info();
  expect(typeof info.installed).toBe('boolean');
});
