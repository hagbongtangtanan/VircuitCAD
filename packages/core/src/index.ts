export * from './platform/types';
export * from './platform/base64';
export * from './platform/rpc';
export * from './platform/client';
export { createInMemoryPlatformAdapter, type InMemoryPlatformAdapter } from './platform/fake';

export * from './model/ids';
export * from './model/circuit';
export * from './model/serialize';
export * from './parts/manifest';
export * from './parts/registry';
export * from './parts/catalog';
export * from './board/geometry';
export * from './board/netlist';
export * from './schematic/schematic';
export * from './export/spice';
export * from './export/bom';
export * from './export/ino';
export * from './settings/settings';
export * from './settings/persist';
export * from './settings/palette';
export * from './i18n/i18n';
export * from './recovery/journal';
export * from './recovery/recent';
export * from './capabilities';
export * from './store/document-store';

export const packageName = '@vircuitcad/core';
