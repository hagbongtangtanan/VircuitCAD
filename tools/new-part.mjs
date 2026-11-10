#!/usr/bin/env node
// Scaffolds a new part: manifest snippet + demo placeholder + test placeholder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [id, simModel = id] = process.argv.slice(2);
if (!id) {
  console.error('usage: node tools/new-part.mjs <id> [simModel]');
  process.exit(1);
}

const dir = path.join(fileURLToPath(new URL('../parts/', import.meta.url)), id);
mkdirSync(dir, { recursive: true });

writeFileSync(
  path.join(dir, 'manifest.snippet.ts'),
  `  parsePartManifest({
    id: '${id}',
    name: '${id}',
    category: 'passive',
    pins: [
      { id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' },
      { id: 'b', name: 'B', position: { x: 2, y: 0 }, role: 'passive' },
    ],
    params: [],
    simModel: '${simModel}',
    svg: 'parts/${id}.svg',
  }),
`,
);

writeFileSync(
  path.join(dir, 'README.md'),
  `# ${id}\n\nAdd the manifest snippet to packages/core/src/parts/catalog.ts, a sim-model case in\npackages/sim-analog/src/bridge.ts, art in packages/editor/src/render/part-textures.ts,\na demo example in examples/ and a unit test.\n`,
);

writeFileSync(
  path.join(dir, `${id}.test.ts`),
  `import { expect, it } from 'vitest';\n\nit('${id} is defined', () => {\n  expect(true).toBe(true);\n});\n`,
);

console.log(`created parts/${id} (simModel: ${simModel})`);
