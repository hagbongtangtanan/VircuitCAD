import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MISSING_TOOLCHAIN_RESULT,
  MISSING_TOOLCHAIN_STATUS,
  compileWithToolchain,
  toolchainFromDir,
  toolchainStatusOf,
} from './toolchain'

/**
 * Integration tests against the real vendored avr-gcc. They need the toolchain
 * (`node scripts/fetch-toolchain.mjs`), so they skip themselves when it is
 * absent instead of failing a fresh clone.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const toolchainDir = join(repoRoot, 'resources', 'toolchain', 'linux')
const toolchain = toolchainFromDir(toolchainDir)
const installed = toolchain !== null && existsSync(toolchain.coreArchive)

const BLINK = `int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(1000);
  digitalWrite(ledPin, LOW);
  delay(1000);
}
`

describe.skipIf(!installed)('avr-gcc toolchain', () => {
  it('compiles a blink sketch into Intel HEX', async () => {
    const result = await compileWithToolchain(toolchain!, BLINK)
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.hex).toContain(':00000001FF')
    expect(result.memory?.flashBytes).toBeGreaterThan(100)
    expect(result.memory?.flashCapacity).toBe(32_256)
  })

  it('compiles a sketch that calls a helper defined further down', async () => {
    const sketch = [
      'void setup() { pinMode(13, OUTPUT); }',
      '',
      'void loop() { pulse(); }',
      '',
      'void pulse() { digitalWrite(13, HIGH); }',
    ].join('\n')
    const result = await compileWithToolchain(toolchain!, sketch)
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('resolves a bundled library such as EEPROM', async () => {
    const sketch = [
      '#include <EEPROM.h>',
      'void setup() { EEPROM.write(0, 42); }',
      'void loop() {}',
    ].join('\n')
    const result = await compileWithToolchain(toolchain!, sketch)
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('resolves a bundled library with utility sources such as Wire', async () => {
    const sketch = ['#include <Wire.h>', 'void setup() { Wire.begin(); }', 'void loop() {}'].join(
      '\n'
    )
    const result = await compileWithToolchain(toolchain!, sketch)
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('reports errors against the lines the user typed', async () => {
    const sketch = ['void setup() {', '  unknownCall();', '}', '', 'void loop() {}'].join('\n')
    const result = await compileWithToolchain(toolchain!, sketch)
    expect(result.ok).toBe(false)
    expect(result.hex).toBeNull()
    const [first] = result.diagnostics
    expect(first?.severity).toBe('error')
    expect(first?.line).toBe(2)
    expect(first?.message).toContain('unknownCall')
  })

  it('describes the toolchain it found', async () => {
    const status = await toolchainStatusOf(toolchain!)
    expect(status.available).toBe(true)
    expect(status.avrGcc).toContain('avr-g++ (GCC)')
    expect(status.arduinoCore).toBe('1.8.7')
  })
})

describe('toolchain layout', () => {
  it('resolves .exe executables and no host library path on Windows', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vircuitcad-toolchain-'))
    try {
      await mkdir(join(dir, 'bin'))
      await writeFile(join(dir, 'bin', 'avr-g++.exe'), '')

      const windows = toolchainFromDir(dir, 'win32')
      expect(windows?.avrGxx).toBe(join(dir, 'bin', 'avr-g++.exe'))
      expect(windows?.avrGcc).toBe(join(dir, 'bin', 'avr-gcc.exe'))
      expect(windows?.avrObjcopy).toBe(join(dir, 'bin', 'avr-objcopy.exe'))
      expect(windows?.avrSize).toBe(join(dir, 'bin', 'avr-size.exe'))
      expect(windows?.hostLibs).toBe('')

      expect(toolchainFromDir(dir, 'linux')).toBeNull()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe.skipIf(installed)('avr-gcc toolchain (not installed)', () => {
  it('explains how to install it', async () => {
    expect(toolchainFromDir(toolchainDir)).toBeNull()
    expect(MISSING_TOOLCHAIN_STATUS.available).toBe(false)
    expect(MISSING_TOOLCHAIN_STATUS.detail).toContain('fetch-toolchain')
    expect(MISSING_TOOLCHAIN_RESULT.diagnostics[0]?.message).toContain('fetch-toolchain')
  })
})
