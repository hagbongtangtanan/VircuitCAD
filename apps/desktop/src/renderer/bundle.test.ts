import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';
import { expect, it } from 'vitest';

const viteConfig = fileURLToPath(new URL('../../vite.config.ts', import.meta.url));

it('excludes E2E globals from the production renderer bundle', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'vircuitcad-renderer-'));

  try {
    await build({
      configFile: viteConfig,
      mode: 'production',
      build: { outDir, emptyOutDir: true },
    });

    const assetDirectory = path.join(outDir, 'assets');
    const assetNames = await readdir(assetDirectory);
    const scriptNames = assetNames.filter((name) => name.endsWith('.js'));
    expect(scriptNames.length).toBeGreaterThan(0);

    const scripts = await Promise.all(
      scriptNames.map((name) => readFile(path.join(assetDirectory, name), 'utf8')),
    );
    const bundle = scripts.join('\n');

    expect(bundle).not.toContain('__renderCount');
    expect(bundle).not.toContain('__editor');
    expect(bundle).not.toContain('__app');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}, 30_000);
