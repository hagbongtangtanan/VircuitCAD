import { createInMemoryPlatformAdapter, encodeBase64, handleRpc } from '@vircuitcad/core';
import { expect, it } from 'vitest';

it('rejects malformed IPC requests', async () => {
  const adapter = createInMemoryPlatformAdapter();
  expect((await handleRpc(adapter, {})).ok).toBe(false);
  expect((await handleRpc(adapter, { method: 'fs.writeFile', params: { path: 'x' } })).ok).toBe(
    false,
  );
  expect((await handleRpc(adapter, { method: 'unknown.method' })).ok).toBe(false);
});

it('serves valid IPC calls and round-trips bytes', async () => {
  const adapter = createInMemoryPlatformAdapter();
  const info = await adapter.app.info();
  const file = `${info.paths.appData}/a.bin`;
  const bytes = Uint8Array.from([1, 2, 3, 255]);

  const write = await handleRpc(adapter, {
    method: 'fs.writeFile',
    params: { path: file, data: encodeBase64(bytes) },
  });
  expect(write.ok).toBe(true);

  const read = await handleRpc(adapter, { method: 'fs.readFile', params: { path: file } });
  expect(read.ok).toBe(true);
  if (read.ok) expect(read.result).toBe(encodeBase64(bytes));
});
