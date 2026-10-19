// Vendors the offline Arduino toolchain for the host platform into
// `resources/toolchain/<platform>/`. Everything is pinned by SHA-256 so a run
// is reproducible, and the download cache (kept outside the shipped directory)
// makes re-runs cheap.
//
//   node scripts/fetch-toolchain.mjs [--force]
//
// What it installs on Linux:
//   bin/, lib/         avr-gcc 14.3.0 + avr-libc 2.2.1 + binutils 2.43
//   arduino/           Arduino AVR core sources (1.8.7)
//   core/uno/core.a    the core precompiled for atmega328p
//
// The result is self-contained: the app runs it with no network and no system
// packages. `resources/toolchain/` is gitignored and is shipped by
// electron-builder as an extra resource when packaging.

import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const force = process.argv.includes('--force')

const UBUNTU = 'https://archive.ubuntu.com/ubuntu'
const ARDUINO_CORE_VERSION = '1.8.7'

const PACKAGES = [
  {
    file: 'gcc-avr_14.2.0-2build1_amd64.deb',
    url: `${UBUNTU}/pool/universe/g/gcc-avr/gcc-avr_14.2.0-2build1_amd64.deb`,
    sha256: 'b9af2ab8d7393881e6cfbaa7036909732cf3ae9595de538b5ca6de6a8c4ef891',
  },
  {
    file: 'avr-libc_2.2.1-1build1_all.deb',
    url: `${UBUNTU}/pool/universe/a/avr-libc/avr-libc_2.2.1-1build1_all.deb`,
    sha256: 'daae655e7ba56cf0c16c808219b520cd5a7a29f6dae304864a27015ef5af784f',
  },
  {
    file: 'binutils-avr_2.43.50.20250108-1build1_amd64.deb',
    url: `${UBUNTU}/pool/universe/b/binutils-avr/binutils-avr_2.43.50.20250108-1build1_amd64.deb`,
    sha256: '75f9552af6921e70ed26dcf674b359438676a533fe121ccde61e3587319bcd3c',
  },
  {
    // avr-gcc's cc1 links against libmpc, which the AVR packages do not carry.
    file: 'libmpc3_1.3.1-3_amd64.deb',
    url: `${UBUNTU}/pool/main/m/mpclib3/libmpc3_1.3.1-3_amd64.deb`,
    sha256: 'a95c75b486f26fe8b140a632fd9e2883b7e2efc21f7586e155d27d2d2ff0ddc0',
  },
]

const ARDUINO_CORE = {
  file: `ArduinoCore-avr-${ARDUINO_CORE_VERSION}.tar.gz`,
  url: `https://github.com/arduino/ArduinoCore-avr/archive/refs/tags/${ARDUINO_CORE_VERSION}.tar.gz`,
  sha256: 'eb06ac7cbce5667bff1fbb08b6085fe911db4b3bb9f3494ab83a8cc08d04aaf8',
}

/** The Uno is the only board the simulator targets, so it is the only profile. */
const BOARD = {
  key: 'uno',
  mcu: 'atmega328p',
  variant: 'standard',
  defines: ['-DF_CPU=16000000L', '-DARDUINO=10819', '-DARDUINO_AVR_UNO', '-DARDUINO_ARCH_AVR'],
}

const log = (message) => console.log(message)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.error) throw result.error
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error(
      `${command} ${args.join(' ')} failed (exit ${result.status})\n${result.stdout ?? ''}${result.stderr ?? ''}`
    )
  }
  return result
}

async function sha256(file) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

async function exists(path) {
  return stat(path).then(
    () => true,
    () => false
  )
}

async function download(url, destination) {
  log(`  downloading ${url}`)
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || response.body === null) {
    throw new Error(`GET ${url} -> ${response.status} ${response.statusText}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

async function fetchVerified(spec, cacheDir) {
  const cached = join(cacheDir, spec.file)
  if (force || !(await exists(cached))) {
    await download(spec.url, cached)
  }
  const digest = await sha256(cached)
  if (digest !== spec.sha256) {
    throw new Error(
      `${spec.file} has the wrong checksum.\n  expected ${spec.sha256}\n  actual   ${digest}`
    )
  }
  return cached
}

async function compileCore(toolchain) {
  log(`Precompiling the Arduino core for ${BOARD.key} (${BOARD.mcu})`)
  const objectsDir = join(toolchain.dir, 'core', BOARD.key)
  await rm(objectsDir, { recursive: true, force: true })
  await mkdir(objectsDir, { recursive: true })

  const env = { ...process.env, LD_LIBRARY_PATH: toolchain.hostLibs }
  const commonArgs = [
    `-mmcu=${BOARD.mcu}`,
    ...BOARD.defines,
    '-Os',
    '-g',
    '-ffunction-sections',
    '-fdata-sections',
    '-Wall',
    `-I${join(toolchain.arduino, 'cores', 'arduino')}`,
    `-I${join(toolchain.arduino, 'variants', BOARD.variant)}`,
  ]

  const coreDir = join(toolchain.arduino, 'cores', 'arduino')
  const sources = (await readdir(coreDir)).filter((name) => /\.(c|cpp|cc|S)$/.test(name))
  for (const name of sources) {
    const isC = /\.(c|S)$/.test(name)
    run(
      join(toolchain.bin, isC ? 'avr-gcc' : 'avr-g++'),
      [
        ...commonArgs,
        ...(isC ? [] : ['-fno-exceptions', '-fno-threadsafe-statics']),
        '-c',
        join(coreDir, name),
        '-o',
        join(objectsDir, `${name.replace(/\.[^.]+$/, '')}.o`),
      ],
      { env }
    )
  }

  const objects = (await readdir(objectsDir))
    .filter((name) => name.endsWith('.o'))
    .map((name) => join(objectsDir, name))
  const archive = join(objectsDir, 'core.a')
  run(join(toolchain.bin, 'avr-ar'), ['rcs', archive, ...objects], { env })
  log(`  ${objects.length} core objects archived into ${archive}`)
}

async function main() {
  if (process.platform !== 'linux') {
    throw new Error(
      `Only Linux toolchains are vendored today (running on ${process.platform}). ` +
        'Add a matching package set before packaging for this platform.'
    )
  }

  const target = join(repoRoot, 'resources', 'toolchain', 'linux')
  const cacheDir = join(repoRoot, 'resources', 'toolchain', '.cache')
  const staging = join(repoRoot, 'resources', 'toolchain', '.staging')
  const root = join(staging, 'root')
  await mkdir(cacheDir, { recursive: true })
  await rm(staging, { recursive: true, force: true })
  await mkdir(root, { recursive: true })

  log('Fetching AVR toolchain packages')
  for (const spec of PACKAGES) {
    const deb = await fetchVerified(spec, cacheDir)
    run('dpkg-deb', ['-x', deb, root])
  }

  log('Fetching the Arduino AVR core')
  const coreTarball = await fetchVerified(ARDUINO_CORE, cacheDir)

  log(`Installing into ${target}`)
  await rm(join(target, 'bin'), { recursive: true, force: true })
  await rm(join(target, 'lib'), { recursive: true, force: true })
  await rm(join(target, 'arduino'), { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  // avr-gcc locates its headers and libraries relative to argv[0], so keeping
  // `<target>/bin` next to `<target>/lib` is what makes the tree relocatable.
  await rename(join(root, 'usr', 'bin'), join(target, 'bin'))
  await rename(join(root, 'usr', 'lib'), join(target, 'lib'))
  await mkdir(join(target, 'arduino'), { recursive: true })
  run('tar', ['-xzf', coreTarball, '-C', join(target, 'arduino'), '--strip-components=1'])
  await rm(staging, { recursive: true, force: true })

  const toolchain = {
    dir: target,
    bin: join(target, 'bin'),
    hostLibs: join(target, 'lib', 'x86_64-linux-gnu'),
    arduino: join(target, 'arduino'),
  }

  const avrGxx = join(toolchain.bin, 'avr-g++')
  const version = run(avrGxx, ['--version'], {
    env: { ...process.env, LD_LIBRARY_PATH: toolchain.hostLibs },
  })
    .stdout.split('\n')[0]
    .trim()
  log(`  ${version}`)

  await compileCore(toolchain)

  await writeFile(
    join(target, 'manifest.json'),
    `${JSON.stringify(
      {
        platform: 'linux',
        avrGcc: version,
        avrLibc: '2.2.1',
        binutils: '2.43.50',
        arduinoCore: ARDUINO_CORE_VERSION,
        board: BOARD.key,
        packages: PACKAGES.map(({ file, sha256: hash }) => ({ file, sha256: hash })),
      },
      null,
      2
    )}\n`
  )

  log('')
  log(`Toolchain ready in ${target}`)
  log('Re-run with --force to rebuild it from scratch.')
}

await main()
