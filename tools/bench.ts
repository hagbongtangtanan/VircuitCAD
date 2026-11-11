import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import {
  createDefaultPartRegistry,
  createEmptyCircuit,
  createPartInstance,
  createWire,
} from '../packages/core/src/index.ts';
import { buildSimulation, solveSimulation } from '../packages/sim-analog/src/index.ts';

const REGRESSION_FACTOR = 1.2; // fail if >20% slower than baseline

function largeCircuit(resistors: number, duplicateWires: number) {
  const circuit = createEmptyCircuit({ board: 'full' });
  circuit.parts.push(
    createPartInstance('battery', { id: 'bt1', position: { x: 0, y: 0 }, params: { voltage: 9 } }),
  );
  for (let index = 0; index < resistors; index += 1) {
    circuit.parts.push(
      createPartInstance('resistor', {
        id: `r${index}`,
        position: { x: 0, y: index + 1 },
        params: { resistance: 220 },
      }),
    );
  }
  circuit.wires.push(
    createWire(
      { kind: 'pin', partId: 'bt1', pinId: 'positive' },
      { kind: 'pin', partId: 'r0', pinId: 'a' },
    ),
  );
  for (let index = 0; index < resistors - 1; index += 1) {
    circuit.wires.push(
      createWire(
        { kind: 'pin', partId: `r${index}`, pinId: 'b' },
        { kind: 'pin', partId: `r${index + 1}`, pinId: 'a' },
      ),
    );
  }
  circuit.wires.push(
    createWire(
      { kind: 'pin', partId: `r${resistors - 1}`, pinId: 'b' },
      { kind: 'pin', partId: 'bt1', pinId: 'negative' },
    ),
  );
  for (let index = 0; index < duplicateWires; index += 1) {
    circuit.wires.push(
      createWire(
        { kind: 'pin', partId: 'bt1', pinId: 'positive' },
        { kind: 'pin', partId: 'r0', pinId: 'a' },
      ),
    );
  }
  return circuit;
}

/** Integer busy work used to normalise for machine speed. */
function referenceWork(): void {
  let value = 0;
  for (let index = 0; index < 5_000_000; index += 1) value = (value + index) % 9973;
  if (value === -1) throw new Error('unreachable');
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function timeMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function measureSolver(): number {
  const simulation = buildSimulation(largeCircuit(100, 199), createDefaultPartRegistry());
  const runs = 5;
  const perRun = 50;
  const samples: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const elapsed = timeMs(() => {
      for (let index = 0; index < perRun; index += 1) solveSimulation(simulation);
    });
    samples.push(elapsed / perRun);
  }
  return median(samples);
}

function measureReference(): number {
  const samples: number[] = [];
  for (let run = 0; run < 5; run += 1) samples.push(timeMs(referenceWork));
  return median(samples);
}

const metrics = {
  solverPerSolveMs: measureSolver(),
  referenceMs: measureReference(),
};
const normalized = metrics.solverPerSolveMs / metrics.referenceMs;

const here = fileURLToPath(new URL('.', import.meta.url));
const baselinePath = `${here}../bench/baseline.json`;
const update = process.argv.includes('--update');

const current = {
  solverPerSolveMs: Number(metrics.solverPerSolveMs.toFixed(4)),
  referenceMs: Number(metrics.referenceMs.toFixed(4)),
  normalized: Number(normalized.toFixed(4)),
};

console.log(`solver: ${current.solverPerSolveMs} ms/solve  reference: ${current.referenceMs} ms  normalized: ${current.normalized}`);

if (update || !existsSync(baselinePath)) {
  mkdirSync(`${here}../bench`, { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`baseline ${update ? 'updated' : 'created'} at bench/baseline.json`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { normalized: number };
const limit = baseline.normalized * REGRESSION_FACTOR;
if (normalized > limit) {
  console.error(
    `✖ perf regression: normalized ${current.normalized} > ${Number(limit.toFixed(4))} (baseline ${baseline.normalized} × ${REGRESSION_FACTOR})`,
  );
  process.exit(1);
}
console.log(`✔ within budget (limit ${Number(limit.toFixed(4))})`);
