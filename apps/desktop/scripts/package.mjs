import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { build } from 'electron-builder';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
await mkdir(path.join(repoRoot, 'resources/toolchain'), { recursive: true });
await build({ config: 'electron-builder.yml' });
