export * from './platform/types';
export * from './platform/base64';
export * from './platform/rpc';
export * from './platform/client';
export { createInMemoryPlatformAdapter, type InMemoryPlatformAdapter } from './platform/fake';

export * from './model/ids';
export * from './model/circuit';
export * from './parts/manifest';
export * from './parts/registry';
export * from './parts/catalog';
export * from './board/geometry';

export const packageName = '@vircuitcad/core';
