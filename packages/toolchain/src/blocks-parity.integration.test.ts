import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateArduino, REFERENCE_PROGRAMS } from '@vircuitcad/blocks';
import { expect, it } from 'vitest';

import { CompileService } from './compile';
import { locateToolchain } from './locator';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const layout = locateToolchain({
  devRoots: [path.join(repoRoot, 'resources/toolchain')],
  platform: process.platform,
});

it.skipIf(!layout)(
  'block-generated sketches compile to the same hex as the handwritten references (offline)',
  { tags: ['toolchain'], timeout: 240_000 },
  async () => {
    if (!layout) return;
    const service = new CompileService({
      layout,
      tempRoot: mkdtempSync(path.join(tmpdir(), 'vc-blocks-parity-')),
    });

    for (const { name, program } of REFERENCE_PROGRAMS) {
      const generated = generateArduino(program);
      const reference = readFileSync(
        path.join(repoRoot, `fixtures/blocks/${name}.ino`),
        'utf8',
      );
      expect(generated).toBe(reference);

      const result = await service.compile({ source: generated, fqbn: 'arduino:avr:uno' });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(result.ok, `${name}: ${JSON.stringify(errors)}`).toBe(true);
      expect(result.hex ?? '', `${name} produced no hex`).toContain(':');
    }
  },
);
