import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createDefaultPartRegistry,
  deserializeCircuit,
  extractNetlist,
} from '@vircuitcad/core';
import { expect, it } from 'vitest';

import { buildSimulation, solveSimulation } from './bridge';

type ManifestEntry = {
  id: string;
  file: string;
  title: string;
  category: string;
  difficulty: string;
  description: string;
};

const examplesDir = fileURLToPath(new URL('../../../examples/', import.meta.url));
const manifest = JSON.parse(readFileSync(`${examplesDir}manifest.json`, 'utf8')) as {
  examples: ManifestEntry[];
};

it('ships at least 25 examples with complete metadata', () => {
  expect(manifest.examples.length).toBeGreaterThanOrEqual(25);
  for (const entry of manifest.examples) {
    expect(entry.id, entry.file).toBeTruthy();
    expect(entry.title, entry.file).toBeTruthy();
    expect(entry.category, entry.file).toBeTruthy();
    expect(['beginner', 'intermediate', 'advanced']).toContain(entry.difficulty);
    expect(entry.description.length, entry.file).toBeGreaterThan(10);
  }
});

it.each(manifest.examples)('loads and solves example $file', (entry) => {
  const circuit = deserializeCircuit(readFileSync(`${examplesDir}${entry.file}`, 'utf8'));
  expect(circuit.name).toBe(entry.title);

  const registry = createDefaultPartRegistry();
  expect(extractNetlist(circuit, registry).nets.length).toBeGreaterThan(0);

  const simulation = buildSimulation(circuit, registry);
  const result = solveSimulation(simulation);
  expect(result.converged, `${entry.file} did not converge`).toBe(true);
});
