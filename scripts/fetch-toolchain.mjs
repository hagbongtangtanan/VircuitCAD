// Vendors the offline Arduino toolchain for the host platform into
// `resources/toolchain/<platform>/`. Everything is pinned by SHA-256 so a run
// is reproducible, and the download cache (kept outside the shipped directory)
// makes re-runs cheap.
//
//   node scripts/fetch-toolchain.mjs           # fetch once, no-op when present
//   node scripts/fetch-toolchain.mjs --force   # rebuild from scratch
//   node scripts/fetch-toolchain.mjs --verify  # offline check, exits 1 if missing
//
// What it installs on Windows (the shipping platform):
//   bin/, lib/, avr/, libexec/   avr-gcc 7.3.0 + avr-libc 2.0.0 (Arduino 7.3.0-atmel3.6.1)
//   arduino/                     Arduino AVR core sources (1.8.7)
//   core/uno/core.a              the core precompiled for atmega328p
//
// On Linux the same layout is assembled from Ubuntu packages (avr-gcc 14.2.0,
// avr-libc 2.2.1, binutils 2.43) for local development.
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
const verifyOnly = process.argv.includes('--verify')

const IS_WIN = process.platform === 'win32'
// Matches electron-builder's `${os}` macro, which the extraResources rule and
// the runtime both use.
const PLATFORM_DIR = IS_WIN ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'
const EXE = IS_WIN ? '.exe' : ''

const UBUNTU = 'https://archive.ubuntu.com/ubuntu'
const ARDUINO_CORE_VERSION = '1.8.7'

const LINUX_PACKAGES = [
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

// The toolchain Arduino IDE 1.8 used on Windows: GCC 7.3.0, avr-libc 2.0.0.
// It is a prefix-style archive (everything under a top-level `avr/`) and the
// MinGW runtime DLLs sit in `bin/`, next to the executables that need them.
const WINDOWS_TOOLCHAIN = {
  file: 'avr-gcc-7.3.0-atmel3.6.1-arduino7-i686-w64-mingw32.zip',
  url: 'https://downloads.arduino.cc/tools/avr-gcc-7.3.0-atmel3.6.1-arduino7-i686-w64-mingw32.zip',
  sha256: 'a54f64755fff4cb792a1495e5defdd789902a2a3503982e81b898299cf39800e',
}

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

  const env = { ...process.env }
  if (toolchain.hostLibs !== '') env.LD_LIBRARY_PATH = toolchain.hostLibs
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
      join(toolchain.bin, isC ? `avr-gcc${EXE}` : `avr-g++${EXE}`),
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
  run(join(toolchain.bin, `avr-ar${EXE}`), ['rcs', archive, ...objects], { env })
  log(`  ${objects.length} core objects archived into ${archive}`)
}

/**
 * A toolchain is usable when the compiler, its runtime libraries and the
 * precompiled Arduino core are all present. Cheap to check, so ordinary builds
 * can skip the 400 MB re-extraction.
 */
async function toolchainReady(target) {
  return (
    (await exists(join(target, 'manifest.json'))) &&
    (await exists(join(target, 'bin', `avr-g++${EXE}`))) &&
    (await exists(join(target, 'bin', `avr-ar${EXE}`))) &&
    (await exists(join(target, 'core', 'uno', 'core.a'))) &&
    (await exists(join(target, 'arduino', 'cores', 'arduino')))
  )
}

async function installLinux(root, cacheDir, target) {
  log('Fetching AVR toolchain packages')
  for (const spec of LINUX_PACKAGES) {
    const deb = await fetchVerified(spec, cacheDir)
    run('dpkg-deb', ['-x', deb, root])
  }

  await rm(join(target, 'bin'), { recursive: true, force: true })
  await rm(join(target, 'lib'), { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  // avr-gcc locates its headers and libraries relative to argv[0], so keeping
  // `<target>/bin` next to `<target>/lib` is what makes the tree relocatable.
  await rename(join(root, 'usr', 'bin'), join(target, 'bin'))
  await rename(join(root, 'usr', 'lib'), join(target, 'lib'))
}

async function installWindows(cacheDir, staging, target) {
  const archive = await fetchVerified(WINDOWS_TOOLCHAIN, cacheDir)

  log('Extracting the Windows toolchain')
  // Git for Windows and the Windows runners both provide bsdtar, which reads
  // zip archives; no extra npm dependency is needed.
  run('tar', ['-xf', archive, '-C', staging])
  const root = join(staging, 'avr')
  if (!(await exists(join(root, 'bin', 'avr-g++.exe')))) {
    throw new Error(`Unexpected archive layout: ${join(root, 'bin', 'avr-g++.exe')} is missing`)
  }

  await rm(target, { recursive: true, force: true })
  // The archive root is a complete prefix (bin, lib, avr, libexec, ...), so the
  // whole directory becomes the relocatable toolchain.
  await rename(root, target)
}

async function main() {
  if (process.platform !== 'linux' && !IS_WIN) {
    throw new Error(
      `No toolchain is vendored for ${process.platform}. Add a package set before packaging for it.`
    )
  }

  const target = join(repoRoot, 'resources', 'toolchain', PLATFORM_DIR)
  const cacheDir = join(repoRoot, 'resources', 'toolchain', '.cache')

  if (verifyOnly) {
    if (await toolchainReady(target)) {
      log(`Toolchain present in ${target}`)
      return
    }
    throw new Error(
      `No usable toolchain in ${target}. Run \`npm run fetch:toolchain\` before packaging.`
    )
  }

  if (!force && (await toolchainReady(target))) {
    log(`Toolchain already present in ${target} (use --force to rebuild)`)
    return
  }

  const staging = join(repoRoot, 'resources', 'toolchain', '.staging')
  const root = join(staging, 'root')
  await mkdir(cacheDir, { recursive: true })
  await rm(staging, { recursive: true, force: true })
  await mkdir(root, { recursive: true })

  if (IS_WIN) {
    await installWindows(cacheDir, staging, target)
  } else {
    await installLinux(root, cacheDir, target)
  }

  log('Fetching the Arduino AVR core')
  const coreTarball = await fetchVerified(ARDUINO_CORE, cacheDir)

  log(`Installing the Arduino core into ${target}`)
  await rm(join(target, 'arduino'), { recursive: true, force: true })
  await mkdir(join(target, 'arduino'), { recursive: true })
  run('tar', ['-xzf', coreTarball, '-C', join(target, 'arduino'), '--strip-components=1'])
  await rm(staging, { recursive: true, force: true })

  const toolchain = {
    dir: target,
    bin: join(target, 'bin'),
    hostLibs: IS_WIN ? '' : join(target, 'lib', 'x86_64-linux-gnu'),
    arduino: join(target, 'arduino'),
  }

  const avrGxx = join(toolchain.bin, `avr-g++${EXE}`)
  const version = run(avrGxx, ['--version'], {
    env:
      toolchain.hostLibs === ''
        ? process.env
        : { ...process.env, LD_LIBRARY_PATH: toolchain.hostLibs },
  })
    .stdout.split('\n')[0]
    .trim()
  log(`  ${version}`)

  await compileCore(toolchain)

  await writeFile(
    join(target, 'manifest.json'),
    `${JSON.stringify(
      {
        platform: PLATFORM_DIR,
        avrGcc: version,
        avrLibc: IS_WIN ? '2.0.0' : '2.2.1',
        binutils: IS_WIN ? '2.26' : '2.43.50',
        arduinoCore: ARDUINO_CORE_VERSION,
        board: BOARD.key,
        packages: (IS_WIN ? [WINDOWS_TOOLCHAIN] : LINUX_PACKAGES).map(({ file, sha256: hash }) => ({
          file,
          sha256: hash,
        })),
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
