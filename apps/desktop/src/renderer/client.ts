import { createAdapterClient, unwrapRpc, type PlatformAdapter } from '@vircuitcad/core';

export function createDesktopClient(): PlatformAdapter {
  return createAdapterClient(async (method, params) =>
    unwrapRpc(await window.vircuitcad.invoke(method, params)),
  );
}
