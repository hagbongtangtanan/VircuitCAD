#!/usr/bin/env node
// Compiles fixtures/sketches/*.ino with the local toolchain into committed .hex
// fixtures (+ a sidecar .json placeholder for expected traces). No network.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(repoRoot, 'resources/toolchain');
const platformKey = `${process.platform}-${process.arch}`;
const binary = platformKey === 'win32-x64' ? 'arduino-cli.exe' : 'arduino-cli';
const cli = path.join(target, binary);
if (!existsSync(cli)) {
  console.error('✖ toolchain not found; run `node tools/fetch-toolchain.mjs` first');
  process.exit(1);
}

const env = {
  ...process.env,
  ARDUINO_DIRECTORIES_DATA: path.join(target, 'data'),
  ARDUINO_DIRECTORIES_USER: path.join(target, 'user'),
  ARDUINO_DIRECTORIES_DOWNLOADS: path.join(target, 'staging'),
  ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false',
};

const sketchesDir = path.join(repoRoot, 'fixtures/sketches');
const outDir = path.join(repoRoot, 'fixtures/hex');
const workRoot = path.join(target, 'staging/fixtures');
mkdirSync(outDir, { recursive: true });
mkdirSync(workRoot, { recursive: true });

const board = 'arduino:avr:uno';
const sketches = readdirSync(sketchesDir).filter((name) => name.endsWith('.ino'));
let total = 0;

for (const sketch of sketches) {
  const name = sketch.replace(/\.ino$/, '');
  const sketchDir = path.join(workRoot, name);
  mkdirSync(sketchDir, { recursive: true });
  copyFileSync(path.join(sketchesDir, sketch), path.join(sketchDir, sketch));

  execFileSync(
    cli,
    ['compile', '--fqbn', board, '--no-color', '--build-path', path.join(sketchDir, 'build'), sketchDir],
    { env, stdio: 'inherit' },
  );

  const built = path.join(sketchDir, 'build', `${sketch}.hex`);
  const hex = readFileSync(built, 'utf8');
  writeFileSync(path.join(outDir, `${name}.hex`), hex);
  writeFileSync(
    path.join(outDir, `${name}.json`),
    `${JSON.stringify({ board, sketch, note: 'expected traces filled in S06' }, null, 2)}\n`,
  );
  total += hex.length;
  rmSync(sketchDir, { recursive: true, force: true });
  console.log(`✔ ${name} (${hex.length} hex chars)`);
}

if (total > 2 * 1024 * 1024) {
  console.error(`✖ fixtures exceed 2 MB (${total} bytes)`);
  process.exit(1);
}
console.log(`✔ ${sketches.length} fixtures, ${(total / 1024).toFixed(1)} KiB total`);
