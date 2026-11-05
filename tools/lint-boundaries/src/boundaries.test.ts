import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url)).replace(/\/+$/, '');
const configFile = fileURLToPath(new URL('../../../eslint.config.mjs', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: configFile });

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId ?? '');
}

it('rejects Node, Electron, DOM and UI usage inside sim-* packages', async () => {
  const filePath = `${repoRoot}/packages/sim-analog/src/forbidden.ts`;
  const code = [
    "import { app } from 'electron';",
    "import { readFileSync } from 'node:fs';",
    "import { Panel } from '@vircuitcad/ui';",
    'export const bad = [app, readFileSync, Panel, document];',
  ].join('\n');

  const ruleIds = await ruleIdsFor(filePath, code);
  expect(ruleIds).toContain('@typescript-eslint/no-restricted-imports');
  expect(ruleIds).toContain('no-restricted-globals');
});

it('allows pure relative and core imports inside sim-* packages', async () => {
  const filePath = `${repoRoot}/packages/sim-analog/src/allowed.ts`;
  const code = [
    "import { greet } from './greet';",
    "import { Value } from '@vircuitcad/core';",
    'export const ok: Value = greet;',
  ].join('\n');

  const ruleIds = await ruleIdsFor(filePath, code);
  expect(ruleIds).not.toContain('@typescript-eslint/no-restricted-imports');
  expect(ruleIds).not.toContain('no-restricted-globals');
});
