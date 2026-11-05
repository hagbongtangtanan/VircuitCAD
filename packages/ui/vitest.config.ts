import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    tags: [{ name: 'slow' }, { name: 'golden' }, { name: 'e2e' }, { name: 'toolchain' }],
  },
});
