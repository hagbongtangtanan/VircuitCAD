import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { isolatedEnv, locateToolchain } from './locator';

function fakeRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'vc-toolchain-'));
  writeFileSync(path.join(root, 'arduino-cli'), '#!/bin/sh\n');
  mkdirSync(path.join(root, 'libraries'), { recursive: true });
  return root;
}

it('locates a dev toolchain by the CLI binary', () => {
  const root = fakeRoot();
  const layout = locateToolchain({ devRoots: [root], platform: 'linux' });
  expect(layout?.root).toBe(root);
  expect(layout?.arduinoCli).toBe(path.join(root, 'arduino-cli'));
});

it('returns undefined when no toolchain is present', () => {
  expect(locateToolchain({ devRoots: ['/nonexistent'], platform: 'linux' })).toBeUndefined();
});

it('prefers the packaged root and names the CLI per platform', () => {
  const root = fakeRoot();
  const layout = locateToolchain({ devRoots: [root], platform: 'win32' });
  expect(layout).toBeUndefined(); // only arduino-cli (no .exe) exists

  const winRoot = mkdtempSync(path.join(tmpdir(), 'vc-toolchain-win-'));
  writeFileSync(path.join(winRoot, 'arduino-cli.exe'), '');
  expect(locateToolchain({ packagedRoot: winRoot, devRoots: [root], platform: 'win32' })?.root).toBe(
    winRoot,
  );
});

it('builds an isolated env inside the toolchain dir', () => {
  const env = isolatedEnv({
    root: '/tc',
    arduinoCli: '/tc/arduino-cli',
    sketch: '/tc/sketch',
    libraries: '/tc/libraries',
    cores: '/tc/cores',
  });
  expect(env.ARDUINO_DIRECTORIES_DATA).toBe('/tc/data');
  expect(env.ARDUINO_DIRECTORIES_USER).toBe('/tc/user');
  expect(env.ARDUINO_UPDATER_ENABLE_NOTIFICATION).toBe('false');
});
