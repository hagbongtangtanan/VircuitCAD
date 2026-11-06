import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    tags: [{ name: 'slow' }, { name: 'golden' }, { name: 'e2e' }, { name: 'toolchain' }],
    coverage: {
      provider: 'v8',
      include: ['src/board/netlist.ts'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 80 },
    },
  },
});
