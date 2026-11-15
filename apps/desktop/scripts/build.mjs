import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';

import packageJson from '../../../package.json' with { type: 'json' };

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
};

await esbuild({ ...shared, entryPoints: ['src/main/index.ts'], outfile: 'dist/main/index.cjs' });
await esbuild({ ...shared, entryPoints: ['src/preload/index.ts'], outfile: 'dist/preload/index.cjs' });
await viteBuild();
