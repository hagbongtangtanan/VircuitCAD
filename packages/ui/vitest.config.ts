import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    tags: [{ name: 'slow' }, { name: 'golden' }, { name: 'e2e' }, { name: 'toolchain' }],
  },
});
