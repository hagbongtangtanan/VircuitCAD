import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { generateArduino } from './generate';
import { REFERENCE_PROGRAMS } from './programs';

function reference(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../fixtures/blocks/${name}.ino`, import.meta.url)),
    'utf8',
  );
}

/**
 * Blocks→text parity. Each IR program is the exact program a Blockly workspace produces
 * (via `workspaceToProgram`); its generated C++ must equal the committed handwritten
 * reference sketch. Identical source compiles to identical hex, so the pin traces match.
 */
it.each(REFERENCE_PROGRAMS)('generates $name identical to the handwritten reference', ({
  name,
  program,
}) => {
  expect(generateArduino(program)).toBe(reference(name));
});
