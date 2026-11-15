import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { build } from 'electron-builder';

import packageJson from '../../../package.json' with { type: 'json' };

const repoRoot = path.resolve(import.meta.dirname, '../../..');
await mkdir(path.join(repoRoot, 'resources/toolchain'), { recursive: true });
await build({
  config: {
    extends: 'electron-builder.yml',
    extraMetadata: { version: packageJson.version },
  },
});
