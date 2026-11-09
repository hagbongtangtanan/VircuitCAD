import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { recordTrace } from '../packages/sim-mcu/src/index.ts';

const hexDir = fileURLToPath(new URL('../fixtures/hex/', import.meta.url));
const WINDOW_MICROS = 500_000;

for (const file of readdirSync(hexDir).filter((name) => name.endsWith('.hex'))) {
  const name = file.replace(/\.hex$/, '');
  const hex = readFileSync(path.join(hexDir, file), 'utf8');
  const trace = recordTrace(hex, WINDOW_MICROS);

  const sidecarPath = path.join(hexDir, `${name}.json`);
  const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as Record<string, unknown>;
  sidecar.trace = trace;
  writeFileSync(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
  console.log(`✔ ${name}: ${trace.length} changes`);
}
