#!/usr/bin/env node
// The ONLY script allowed to use the network. Downloads a pinned arduino-cli,
// verifies its sha256 and installs the pinned core + curated libraries into
// resources/toolchain/ (gitignored). Idempotent.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(path.join(repoRoot, 'tools/toolchain.lock.json'), 'utf8'));
const target = path.join(repoRoot, 'resources/toolchain');
const staging = path.join(target, 'staging');

const platformKey = `${process.platform}-${process.arch}`;
const asset = lock.arduinoCli.assets[platformKey];
if (!asset) {
  console.error(`✖ no arduino-cli asset for ${platformKey}`);
  process.exit(1);
}

mkdirSync(staging, { recursive: true });
const env = {
  ...process.env,
  ARDUINO_DIRECTORIES_DATA: path.join(target, 'data'),
  ARDUINO_DIRECTORIES_USER: path.join(target, 'user'),
  ARDUINO_DIRECTORIES_DOWNLOADS: staging,
  ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false',
};
const cliPath = path.join(target, asset.binary);

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function ensureCli() {
  if (existsSync(cliPath)) {
    try {
      const version = execFileSync(cliPath, ['version'], { encoding: 'utf8' });
      if (version.includes(lock.arduinoCli.version)) {
        console.log(`✔ arduino-cli ${lock.arduinoCli.version} already present`);
        return;
      }
    } catch {
      // fall through to re-download
    }
  }

  const archive = path.join(staging, path.basename(new URL(asset.url).pathname));
  if (!existsSync(archive) || sha256(archive) !== asset.sha256) {
    console.log(`▸ downloading ${asset.url}`);
    const response = await fetch(asset.url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`download failed: ${response.status}`);
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }
  const digest = sha256(archive);
  if (digest !== asset.sha256) throw new Error(`checksum mismatch: ${digest} != ${asset.sha256}`);
  console.log('✔ checksum verified');

  if (asset.archive === 'zip') {
    execFileSync('unzip', ['-o', '-j', archive, asset.binary, '-d', target], { stdio: 'inherit' });
  } else {
    execFileSync('tar', ['xzf', archive, '-C', target, asset.binary], { stdio: 'inherit' });
  }
  chmodSync(cliPath, 0o755);
}

try {
  await ensureCli();
  console.log('▸ installing core', `${lock.core}@${lock.coreVersion}`);
  execFileSync(cliPath, ['core', 'install', `${lock.core}@${lock.coreVersion}`], { env, stdio: 'inherit' });
  if (lock.libraries.length) {
    console.log('▸ installing libraries', lock.libraries.join(', '));
    execFileSync(cliPath, ['lib', 'install', ...lock.libraries], { env, stdio: 'inherit' });
  }
  console.log('✔ toolchain ready in', target);
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exit(1);
}
