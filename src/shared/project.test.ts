import { describe, expect, it } from 'vitest'
import { emptyCircuitDocument } from './circuit'
import {
  ProjectFileError,
  createProject,
  exportPngRequestSchema,
  fileBaseName,
  fileExtension,
  openKindForPath,
  parseProjectText,
  parseSketchText,
  serializeProject,
} from './project'

const project = createProject({ circuit: emptyCircuitDocument(), sketch: 'void setup() {}\n' })

describe('project files', () => {
  it('round-trips through JSON', () => {
    const parsed = parseProjectText(serializeProject(project))
    expect(parsed).toEqual(project)
    expect(serializeProject(parsed).endsWith('\n')).toBe(true)
  })

  it('rejects malformed JSON with a readable message', () => {
    expect(() => parseProjectText('{ nope')).toThrow(ProjectFileError)
    expect(() => parseProjectText('{ nope')).toThrow(/valid JSON/)
  })

  it('rejects JSON that is not a project', () => {
    expect(() => parseProjectText('{"hello":1}')).toThrow(/not a HuCAD project/)
    expect(() => parseProjectText(JSON.stringify({ ...project, version: 99 }))).toThrow(
      ProjectFileError
    )
  })

  it('rejects a circuit payload that fails the document schema', () => {
    const broken = JSON.parse(serializeProject(project))
    broken.circuit.parts.push({ id: 'x', type: 'led', position: { x: 0, y: 0 } })
    expect(() => parseProjectText(JSON.stringify(broken))).toThrow(/circuit\.parts/)
  })

  it('maps extensions to open behaviour', () => {
    expect(openKindForPath('/tmp/demo.hucad')).toBe('project')
    expect(openKindForPath('/tmp/demo.json')).toBe('project')
    expect(openKindForPath('/tmp/blink.ino')).toBe('sketch')
    expect(openKindForPath('/tmp/blink.hex')).toBeNull()
    expect(openKindForPath('/tmp/blink')).toBeNull()
  })

  it('reads names and extensions without touching the file system', () => {
    expect(fileExtension('/home/me/Blink.INO')).toBe('ino')
    expect(fileExtension('/home/me/no-extension')).toBe('')
    expect(fileBaseName('/home/me/Blink.ino')).toBe('Blink.ino')
  })

  it('caps imported sketches', () => {
    expect(parseSketchText('void setup() {}')).toBe('void setup() {}')
    expect(() => parseSketchText('x'.repeat(200_001))).toThrow(/larger/)
  })
})

describe('PNG export requests', () => {
  const valid = {
    dataUrl: `data:image/png;base64,${'A'.repeat(48)}`,
    name: 'Blink led',
    path: null,
  }

  it('accepts a PNG data URL and a plain name', () => {
    expect(exportPngRequestSchema.parse(valid)).toEqual(valid)
  })

  it('rejects other image types and suspicious names', () => {
    expect(() =>
      exportPngRequestSchema.parse({ ...valid, dataUrl: 'data:image/jpeg;base64,AAAA' })
    ).toThrow()
    expect(() => exportPngRequestSchema.parse({ ...valid, name: '' })).toThrow()
  })
})
