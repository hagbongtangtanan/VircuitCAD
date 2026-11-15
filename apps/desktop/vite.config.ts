import { defineConfig } from 'vite';

import packageJson from '../../package.json' with { type: 'json' };

export default defineConfig(({ mode }) => ({
  root: 'src/renderer',
  base: './',
  esbuild: { jsx: 'automatic' },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __E2E__: JSON.stringify(mode !== 'production' && process.env.VITE_E2E === 'true'),
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
}));
