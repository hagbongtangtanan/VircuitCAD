import { expect, it } from 'vitest';

import { definePlatformAdapterContract } from './contract';
import { createInMemoryPlatformAdapter } from './fake';

definePlatformAdapterContract('in-memory fake', () => createInMemoryPlatformAdapter());

it('grants read access to a path chosen in the open dialog', async () => {
  const adapter = createInMemoryPlatformAdapter();
  adapter.seedFile('/picked/board.vcad', new Uint8Array([123, 125]));
  adapter.setOpenFileResult('/picked/board.vcad');

  const picked = await adapter.dialogs.openFile({ title: 'Open circuit' });
  expect(picked).toBe('/picked/board.vcad');
  expect(Array.from(await adapter.fs.readFile('/picked/board.vcad'))).toEqual([123, 125]);
});

it('writes to a path chosen in the save dialog', async () => {
  const adapter = createInMemoryPlatformAdapter();
  adapter.setSaveFileResult('/picked/out.vcad');

  const target = await adapter.dialogs.saveFile();
  if (target === null) throw new Error('expected a save path');

  await adapter.fs.writeFile(target, new Uint8Array([1]));
  expect(await adapter.fs.exists('/picked/out.vcad')).toBe(true);
});
