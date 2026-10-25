import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildTranslationUnit, parseCompilerOutput, parseSizeOutput } from '../../shared/compile'
import type { CompileResult, Diagnostic, ToolchainStatus } from '../../shared/schemas'

/**
 * Real avr-gcc integration, with no Electron dependency so it can be tested
 * directly. The toolchain is vendored into `resources/toolchain/<platform>/` by
 * `scripts/fetch-toolchain.mjs`, so every step here runs offline: no network, no
 * system packages, no shell.
 */

/** Uno profile; the only board milestone 3 supports. */
const BOARD = {
  mcu: 'atmega328p',
  variant: 'standard',
  defines: ['-DF_CPU=16000000L', '-DARDUINO=10819', '-DARDUINO_AVR_UNO', '-DARDUINO_ARCH_AVR'],
  flashCapacity: 32_256,
  ramCapacity: 2_048,
} as const

/** A runaway sketch must not hold the compiler hostage. */
const COMPILE_TIMEOUT_MS = 60_000

export interface Toolchain {
  readonly dir: string
  readonly bin: string
  readonly hostLibs: string
  readonly arduino: string
  readonly coreArchive: string
  readonly avrGcc: string
  readonly avrGxx: string
  readonly avrObjcopy: string
  readonly avrSize: string
}

interface CommandOutcome {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
}

/**
 * Describes a toolchain directory, or null when it is not installed. Windows
 * toolchains use `.exe` executables and keep their runtime DLLs next to them,
 * so only the Linux build needs the extra library search path.
 */
export function toolchainFromDir(
  dir: string,
  platform: NodeJS.Platform = process.platform
): Toolchain | null {
  const bin = join(dir, 'bin')
  const exe = platform === 'win32' ? '.exe' : ''
  const avrGxx = join(bin, `avr-g++${exe}`)
  if (!existsSync(avrGxx)) return null
  return {
    dir,
    bin,
    hostLibs: platform === 'linux' ? join(dir, 'lib', 'x86_64-linux-gnu') : '',
    arduino: join(dir, 'arduino'),
    coreArchive: join(dir, 'core', 'uno', 'core.a'),
    avrGcc: join(bin, `avr-gcc${exe}`),
    avrGxx,
    avrObjcopy: join(bin, `avr-objcopy${exe}`),
    avrSize: join(bin, `avr-size${exe}`),
  }
}

function run(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  cwd: string
): Promise<CommandOutcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, env, timeout: COMPILE_TIMEOUT_MS })
    let stdout = ''
    let stderr = ''
    let timedOut = false

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      timedOut = signal === 'SIGTERM' || signal === 'SIGKILL'
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

function toolchainEnv(toolchain: Toolchain): NodeJS.ProcessEnv {
  const env = { ...process.env }
  if (toolchain.hostLibs !== '') env.LD_LIBRARY_PATH = toolchain.hostLibs
  return env
}

async function readVersion(command: string, env: NodeJS.ProcessEnv): Promise<string> {
  const outcome = await run(command, ['--version'], env, tmpdir())
  return (outcome.stdout.split('\n')[0] ?? '').trim()
}

/** Libraries the sketch pulls in with `#include <X.h>`, resolved by file name. */
async function resolveLibraries(
  toolchain: Toolchain,
  sketch: string
): Promise<readonly { dir: string; sources: readonly string[] }[]> {
  const librariesRoot = join(toolchain.arduino, 'libraries')
  if (!existsSync(librariesRoot)) return []

  const requested = new Set<string>()
  for (const match of sketch.matchAll(/^\s*#\s*include\s*<([^>]+)>/gm)) {
    const header = match[1]
    if (header !== undefined) requested.add(header.trim())
  }
  if (requested.size === 0) return []

  const resolved: { dir: string; sources: readonly string[] }[] = []
  for (const name of await readdir(librariesRoot)) {
    // Arduino layouts: either sources at the root, or an `src/` subdirectory.
    for (const candidate of [join(librariesRoot, name), join(librariesRoot, name, 'src')]) {
      if (!requested.has(`${name}.h`) || !existsSync(join(candidate, `${name}.h`))) continue
      const sources = (await readdir(candidate))
        .filter((file) => /\.(c|cpp|S)$/.test(file))
        .map((file) => join(candidate, file))
      // Libraries such as Wire keep C sources in `utility/`.
      const utility = join(candidate, 'utility')
      if (existsSync(utility)) {
        const nested = (await readdir(utility))
          .filter((file) => /\.(c|cpp|S)$/.test(file))
          .map((file) => join(utility, file))
        sources.push(...nested)
      }
      resolved.push({ dir: candidate, sources })
    }
  }
  return resolved
}

function dedupeDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>()
  const unique: Diagnostic[] = []
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.severity}:${diagnostic.line}:${diagnostic.column}:${diagnostic.message}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(diagnostic)
  }
  return unique
}

export async function compileWithToolchain(
  toolchain: Toolchain,
  sketch: string
): Promise<CompileResult> {
  const startedAt = Date.now()
  const env = toolchainEnv(toolchain)
  const buildDir = await mkdtemp(join(tmpdir(), 'vircuitcad-build-'))
  const keepBuild = process.env.VIRCUITCAD_KEEP_BUILD === '1'
  const diagnostics: Diagnostic[] = []

  try {
    const unit = buildTranslationUnit(sketch, 'sketch.ino')
    const sourcePath = join(buildDir, `${unit.fileName}.cpp`)
    await writeFile(sourcePath, unit.source)

    const libraries = await resolveLibraries(toolchain, sketch)
    const includeArgs = [
      `-I${join(toolchain.arduino, 'cores', 'arduino')}`,
      `-I${join(toolchain.arduino, 'variants', BOARD.variant)}`,
      ...libraries.map((library) => `-I${library.dir}`),
    ]
    const compileArgs = [
      `-mmcu=${BOARD.mcu}`,
      ...BOARD.defines,
      '-Os',
      '-g',
      '-ffunction-sections',
      '-fdata-sections',
      '-Wall',
      '-fno-exceptions',
      '-fno-threadsafe-statics',
      ...includeArgs,
    ]

    const sketchObject = join(buildDir, 'sketch.ino.o')
    const sketchBuild = await run(
      toolchain.avrGxx,
      [...compileArgs, '-c', sourcePath, '-o', sketchObject],
      env,
      buildDir
    )
    diagnostics.push(...parseCompilerOutput(sketchBuild.stderr))

    const objects = [sketchObject]
    for (const library of libraries) {
      for (const source of library.sources) {
        const object = join(buildDir, `${source.replace(/[^\w.-]/g, '_')}.o`)
        const isC = /\.(c|S)$/.test(source)
        const outcome = await run(
          isC ? toolchain.avrGcc : toolchain.avrGxx,
          [...compileArgs, '-c', source, '-o', object],
          env,
          buildDir
        )
        diagnostics.push(...parseCompilerOutput(outcome.stderr))
        objects.push(object)
      }
    }

    if (sketchBuild.timedOut) {
      diagnostics.push({
        severity: 'error',
        line: null,
        column: null,
        message: `Compilation timed out after ${COMPILE_TIMEOUT_MS / 1000} seconds.`,
      })
    }

    const elfPath = join(buildDir, 'sketch.elf')
    const linkOutcome = await run(
      toolchain.avrGxx,
      [
        `-mmcu=${BOARD.mcu}`,
        '-Os',
        '-g',
        '-Wl,--gc-sections',
        '-Wl,--relax',
        '-o',
        elfPath,
        ...objects,
        toolchain.coreArchive,
        '-lm',
      ],
      env,
      buildDir
    )
    diagnostics.push(...parseCompilerOutput(linkOutcome.stderr))

    const unique = dedupeDiagnostics(diagnostics)
    const hasErrors = unique.some((diagnostic) => diagnostic.severity === 'error')

    if (!existsSync(elfPath) || hasErrors) {
      return {
        ok: false,
        hex: null,
        diagnostics: unique,
        memory: null,
        durationMs: Date.now() - startedAt,
      }
    }

    const hexPath = join(buildDir, 'sketch.hex')
    const objcopyOutcome = await run(
      toolchain.avrObjcopy,
      ['-O', 'ihex', '-R', '.eeprom', elfPath, hexPath],
      env,
      buildDir
    )
    if (objcopyOutcome.code !== 0 || !existsSync(hexPath)) {
      return {
        ok: false,
        hex: null,
        diagnostics: dedupeDiagnostics([
          ...unique,
          {
            severity: 'error',
            line: null,
            column: null,
            message: objcopyOutcome.stderr.trim() || 'avr-objcopy failed.',
          },
        ]),
        memory: null,
        durationMs: Date.now() - startedAt,
      }
    }

    const sizeOutcome = await run(
      toolchain.avrSize,
      ['--mcu', BOARD.mcu, '--format=avr', elfPath],
      env,
      buildDir
    )

    return {
      ok: true,
      hex: await readFile(hexPath, 'utf8'),
      diagnostics: unique,
      memory: parseSizeOutput(
        `${sizeOutcome.stdout}\n${sizeOutcome.stderr}`,
        BOARD.flashCapacity,
        BOARD.ramCapacity
      ),
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      ok: false,
      hex: null,
      diagnostics: dedupeDiagnostics([
        ...diagnostics,
        {
          severity: 'error',
          line: null,
          column: null,
          message: error instanceof Error ? error.message : String(error),
        },
      ]),
      memory: null,
      durationMs: Date.now() - startedAt,
    }
  } finally {
    if (!keepBuild) {
      await rm(buildDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}

export async function toolchainStatusOf(toolchain: Toolchain): Promise<ToolchainStatus> {
  try {
    const version = await readVersion(toolchain.avrGxx, toolchainEnv(toolchain))
    const hasCore = existsSync(toolchain.coreArchive)
    const manifest = await readFile(join(toolchain.dir, 'manifest.json'), 'utf8').catch(() => null)
    return {
      available: hasCore,
      detail: hasCore
        ? version
        : `${version} (the precompiled Arduino core is missing; re-run the toolchain script)`,
      avrGcc: version,
      arduinoCore: readArduinoCoreVersion(manifest),
    }
  } catch (error) {
    return {
      available: false,
      detail: error instanceof Error ? error.message : String(error),
      avrGcc: null,
      arduinoCore: null,
    }
  }
}

export const MISSING_TOOLCHAIN_STATUS: ToolchainStatus = {
  available: false,
  detail:
    'Not installed. Reinstall VircuitCAD, or run "node scripts/fetch-toolchain.mjs" in a source checkout.',
  avrGcc: null,
  arduinoCore: null,
}

export const MISSING_TOOLCHAIN_RESULT: CompileResult = {
  ok: false,
  hex: null,
  diagnostics: [
    {
      severity: 'error',
      line: null,
      column: null,
      message:
        'The Arduino toolchain is missing from this installation. Reinstall VircuitCAD, or run "node scripts/fetch-toolchain.mjs" in a source checkout.',
    },
  ],
  memory: null,
  durationMs: 0,
}

/** Reads `arduinoCore` out of the toolchain manifest, tolerating a missing file. */
function readArduinoCoreVersion(manifest: string | null): string | null {
  if (manifest === null) return null
  try {
    const parsed: unknown = JSON.parse(manifest)
    if (typeof parsed === 'object' && parsed !== null && 'arduinoCore' in parsed) {
      const value = (parsed as { arduinoCore?: unknown }).arduinoCore
      return typeof value === 'string' ? value : null
    }
  } catch {
    return null
  }
  return null
}
