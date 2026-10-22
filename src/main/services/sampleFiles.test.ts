import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { projectFileSchema } from '../../shared/project'
import { compileWithToolchain, toolchainFromDir } from './toolchain'
import { listSamples, readSample } from './sampleFiles'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const samplesDir = join(repoRoot, 'resources', 'samples')
const toolchain = toolchainFromDir(join(repoRoot, 'resources', 'toolchain', 'linux'))
const installed = toolchain !== null && existsSync(toolchain.coreArchive)

let directory = ''

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vircuitcad-samples-'))
})

afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('sample projects', () => {
  it('lists the shipped samples with readable labels', async () => {
    const samples = await listSamples(samplesDir)
    expect(samples.map((sample) => sample.name)).toEqual([
      'blink-led.vircuit',
      'traffic-light.vircuit',
    ])
    expect(samples[0]?.label).toBe('Blink led')
  })

  it('ignores unrelated files and missing directories', async () => {
    await writeFile(join(directory, 'notes.txt'), 'ignore me')
    await writeFile(join(directory, 'Bad Name.vircuit'), '{}')
    expect(await listSamples(directory)).toEqual([])
    expect(await listSamples(join(directory, 'missing'))).toEqual([])
  })

  it('refuses names that could escape the folder', async () => {
    await expect(readSample(directory, '../secrets.vircuit')).rejects.toThrow(/Unknown sample/)
    await expect(readSample(directory, 'sub/dir.vircuit')).rejects.toThrow(/Unknown sample/)
  })

  it('loads every shipped sample as a valid project', async () => {
    for (const name of ['blink-led.vircuit', 'traffic-light.vircuit']) {
      const opened = await readSample(samplesDir, name)
      expect(opened.kind).toBe('project')
      if (opened.kind !== 'project') continue
      expect(projectFileSchema.safeParse(opened.project).success).toBe(true)
      expect(opened.project.circuit.parts.length).toBeGreaterThan(2)
      expect(opened.project.circuit.wires.length).toBeGreaterThan(2)
    }
  })

  it.skipIf(!installed)('compiles the sketch in every sample', async () => {
    const samples = await listSamples(samplesDir)
    for (const sample of samples) {
      const opened = await readSample(samplesDir, sample.name)
      if (opened.kind !== 'project') throw new Error('not a project')
      const compiled = await compileWithToolchain(toolchain!, opened.project.sketch)
      expect(compiled.diagnostics).toEqual([])
      expect(compiled.ok).toBe(true)
    }
  })
})
