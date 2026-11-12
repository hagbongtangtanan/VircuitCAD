import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { McuCpu } from './mcu';

const hexDir = fileURLToPath(new URL('../../../fixtures/hex', import.meta.url));

function load(name: string): string {
  return readFileSync(path.join(hexDir, `${name}.hex`), 'utf8');
}

it(
  'toggles D13 at 1 Hz for the blink fixture (deterministic cycles)',
  { timeout: 30_000 },
  () => {
  const mcu = new McuCpu(load('blink'));
  const changes: number[] = [];
  let last = 0;
  mcu.onPortChange('B', (value) => {
    const bit = (value >> 5) & 1; // PB5 = D13
    if (bit !== last) {
      last = bit;
      changes.push(mcu.micros);
    }
  });

  mcu.runMicros(1_200_000);

  expect(changes.length).toBeGreaterThanOrEqual(3);
  const deltas = changes.slice(1).map((t, index) => t - (changes[index] ?? 0));
  for (const delta of deltas.slice(0, 2)) {
    expect(Math.abs(delta - 500_000)).toBeLessThan(500); // 0.1 %
  }
});

it('resets without throwing and keeps running', () => {
  const mcu = new McuCpu(load('blink'));
  mcu.runMicros(10_000);
  expect(mcu.cycles).toBeGreaterThan(0);
  mcu.reset();
  mcu.runMicros(10_000);
  expect(mcu.cycles).toBeGreaterThan(0);
});
