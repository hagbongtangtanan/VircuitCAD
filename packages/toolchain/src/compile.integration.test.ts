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

// blink + one sketch per bundled library (LiquidCrystal, Servo, Adafruit NeoPixel).
const sketches = ['blink', 'lcd-hello', 'servo-sweep', 'neopixel'];

it.skipIf(!layout)(
  'compiles the bundled sketches with the local toolchain (offline)',
  { tags: ['toolchain'], timeout: 240_000 },
  async () => {
    if (!layout) return;
    const service = new CompileService({
      layout,
      tempRoot: mkdtempSync(path.join(tmpdir(), 'vc-toolchain-it-')),
    });
    for (const name of sketches) {
      const source = readFileSync(path.join(repoRoot, `fixtures/sketches/${name}.ino`), 'utf8');
      const result = await service.compile({ source, fqbn: 'arduino:avr:uno' });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(result.ok, `${name}: ${JSON.stringify(errors)}`).toBe(true);
      expect(result.hex ?? '', `${name} produced no hex`).toContain(':');
      expect(errors, `${name} reported errors`).toHaveLength(0);
    }
  },
);
