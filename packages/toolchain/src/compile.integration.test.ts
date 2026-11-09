import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { CompileService } from './compile';
import { locateToolchain } from './locator';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const layout = locateToolchain({
  devRoots: [path.join(repoRoot, 'resources/toolchain')],
  platform: process.platform,
});

it.skipIf(!layout)(
  'compiles blink with the local toolchain (offline)',
  { tags: ['toolchain'], timeout: 60_000 },
  async () => {
    if (!layout) return;
    const source = readFileSync(path.join(repoRoot, 'fixtures/sketches/blink.ino'), 'utf8');
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'vc-toolchain-it-'));
    const result = await new CompileService({ layout, tempRoot }).compile({
      source,
      fqbn: 'arduino:avr:uno',
    });
    expect(result.ok).toBe(true);
    expect(result.hex ?? '').toContain(':');
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  },
);
