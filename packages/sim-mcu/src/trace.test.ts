import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { recordTrace } from './trace';

const hexDir = fileURLToPath(new URL('../../../fixtures/hex', import.meta.url));
const WINDOW_MICROS = 500_000;

it('reproduces the committed trace for every fixture', { tags: ['slow'], timeout: 30_000 }, () => {
  const files = readdirSync(hexDir).filter((name) => name.endsWith('.json'));
  expect(files.length).toBeGreaterThanOrEqual(9);

  for (const file of files) {
    const sidecar = JSON.parse(readFileSync(path.join(hexDir, file), 'utf8')) as {
      sketch?: string;
      trace?: unknown;
    };
    if (sidecar.trace === undefined) continue; // trace not generated yet
    const name = file.replace(/\.json$/, '');
    const hex = readFileSync(path.join(hexDir, `${name}.hex`), 'utf8');
    expect(recordTrace(hex, WINDOW_MICROS), name).toEqual(sidecar.trace);
  }
});
