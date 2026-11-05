import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
};

await esbuild({ ...shared, entryPoints: ['src/main/index.ts'], outfile: 'dist/main/index.cjs' });
await esbuild({ ...shared, entryPoints: ['src/preload/index.ts'], outfile: 'dist/preload/index.cjs' });
await viteBuild();
