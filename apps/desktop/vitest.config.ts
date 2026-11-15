import { defineConfig } from 'vitest/config';

import packageJson from '../../package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __E2E__: 'false',
  },
  test: {
    tags: [{ name: 'slow' }, { name: 'golden' }, { name: 'e2e' }, { name: 'toolchain' }],
  },
});
