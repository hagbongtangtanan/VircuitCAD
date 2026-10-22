import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyCircuitDocument } from '../../shared/circuit'
import { ProjectFileError, createProject, serializeProject } from '../../shared/project'
import {
  openFile,
  readProjectFile,
  writeHexFile,
  writePdfFile,
  writePngFile,
  writeProjectFile,
  writeSketchFile,
} from './projectFiles'

let directory = ''

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'hucad-project-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const project = createProject({
  circuit: emptyCircuitDocument(),
  sketch: 'void setup() { pinMode(13, OUTPUT); }\nvoid loop() {}\n',
})

describe('project files on disk', () => {
  it('writes and reads a project', async () => {
    const path = join(directory, 'demo.hucad')
    await writeProjectFile(path, project)
    expect(await readProjectFile(path)).toEqual(project)
  })

  it('opens a project through the extension dispatcher', async () => {
    const path = join(directory, 'demo.hucad')
    await writeProjectFile(path, project)
    const opened = await openFile(path)
    expect(opened.kind).toBe('project')
    if (opened.kind === 'project') expect(opened.project.sketch).toBe(project.sketch)
  })

  it('opens a plain .ino as a sketch', async () => {
    const path = join(directory, 'blink.ino')
    await writeSketchFile(path, 'void setup() {}')
    const opened = await openFile(path)
    expect(opened).toEqual({ kind: 'sketch', path, sketch: 'void setup() {}' })
  })

  it('refuses unknown extensions', async () => {
    const path = join(directory, 'blink.hex')
    await writeFile(path, ':00000001FF\n')
    await expect(openFile(path)).rejects.toThrow(ProjectFileError)
  })

  it('surfaces a corrupt project as a readable error', async () => {
    const path = join(directory, 'broken.hucad')
    await writeFile(path, '{"format":"nope"}')
    await expect(readProjectFile(path)).rejects.toThrow(/not a HuCAD project/)
  })

  it('writes sketches verbatim and HEX with a trailing newline', async () => {
    const sketchPath = join(directory, 'sketch.ino')
    await writeSketchFile(sketchPath, 'void setup() {}')
    expect(await readFile(sketchPath, 'utf8')).toBe('void setup() {}')

    const hexPath = join(directory, 'sketch.hex')
    await writeHexFile(hexPath, ':00000001FF')
    expect(await readFile(hexPath, 'utf8')).toBe(':00000001FF\n')
  })

  it('rejects an export with no HEX payload', async () => {
    await expect(writeHexFile(join(directory, 'empty.hex'), '')).rejects.toThrow(/no compiled HEX/)
  })

  it('writes a validated PNG data URL', async () => {
    const path = join(directory, 'circuit.png')
    const pixel =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    await writePngFile(path, `data:image/png;base64,${pixel}`)

    const bytes = await readFile(path)
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  })

  it('rejects image data that is not a PNG', async () => {
    await expect(
      writePngFile(join(directory, 'fake.png'), 'data:image/png;base64,bm90IGEgcG5n')
    ).rejects.toThrow(/not a PNG/)
    await expect(
      writePngFile(join(directory, 'fake.png'), 'data:image/jpeg;base64,abcd')
    ).rejects.toThrow(/not a PNG/)
  })

  it('writes a validated PDF payload', async () => {
    const path = join(directory, 'schematic.pdf')
    const data = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n').toString('base64')
    await writePdfFile(path, data)

    const bytes = await readFile(path)
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('rejects a payload that is not a PDF', async () => {
    await expect(
      writePdfFile(join(directory, 'fake.pdf'), Buffer.from('not a pdf').toString('base64'))
    ).rejects.toThrow(/not a PDF/)
  })

  it('keeps the serialized project stable for diffing', async () => {
    const path = join(directory, 'demo.hucad')
    await writeProjectFile(path, project)
    expect(await readFile(path, 'utf8')).toBe(serializeProject(project))
  })
})
