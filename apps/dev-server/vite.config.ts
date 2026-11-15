import { defineConfig } from 'vite';

import packageJson from '../../package.json' with { type: 'json' };

export default defineConfig(({ mode }) => ({
  root: '../desktop/src/renderer',
  esbuild: { jsx: 'automatic' },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __E2E__: JSON.stringify(mode !== 'production' && process.env.VITE_E2E === 'true'),
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/rpc': { target: 'http://127.0.0.1:5174' },
    },
  },
}));
