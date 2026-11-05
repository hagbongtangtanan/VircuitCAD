import { createAdapterClient, unwrapRpc, type PlatformAdapter } from '@vircuitcad/core';

async function call(method: string, params?: unknown): Promise<unknown> {
  if ('vircuitcad' in window) {
    return window.vircuitcad.invoke(method, params);
  }
  const response = await fetch('/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
  return response.json();
}

export function createClient(): PlatformAdapter {
  return createAdapterClient(async (method, params) => unwrapRpc(await call(method, params)));
}
