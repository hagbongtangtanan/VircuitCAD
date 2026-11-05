import { defineConfig } from 'vite';

export default defineConfig({
  root: '../desktop/src/renderer',
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/rpc': { target: 'http://127.0.0.1:5174' },
    },
  },
});
