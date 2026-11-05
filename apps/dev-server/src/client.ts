import { createAdapterClient, unwrapRpc, type PlatformAdapter } from '@vircuitcad/core';

export function createDevWebClient(baseUrl: string): PlatformAdapter {
  return createAdapterClient(async (method, params) => {
    const response = await fetch(`${baseUrl}/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, params }),
    });
    return unwrapRpc(await response.json());
  });
}
