import { describe, expect, it } from 'vitest'
import { circuitDocumentSchema, emptyCircuitDocument } from './circuit'
import {
  ProjectFileError,
  createProject,
  exportPngRequestSchema,
  fileBaseName,
  fileStem,
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

  it('writes a v2 header with metadata and viewport', () => {
    expect(project.version).toBe(2)
    if (project.version !== 2) throw new Error('expected v2')
    expect(project.metadata.created_at).not.toBe('')
    expect(project.metadata.app_version).not.toBe('')
    expect(project.viewport).toEqual({ scale: 1, offsetX: 60, offsetY: 60 })
  })

  it('parses a legacy v1 project without metadata or viewport', () => {
    const legacy = JSON.parse(serializeProject(project))
    legacy.version = 1
    delete legacy.metadata
    delete legacy.viewport
    const parsed = parseProjectText(JSON.stringify(legacy))
    expect(parsed.version).toBe(1)
    expect('metadata' in parsed).toBe(false)
    expect('viewport' in parsed).toBe(false)
  })

  it('persists a project title and accepts older files without one', () => {
    const named = createProject({
      name: 'Blink Led',
      circuit: emptyCircuitDocument(),
      sketch: 'void setup() {}\n',
    })
    expect(parseProjectText(serializeProject(named)).name).toBe('Blink Led')

    const legacy = JSON.parse(serializeProject(named))
    delete legacy.name
    expect(parseProjectText(JSON.stringify(legacy)).name).toBeUndefined()
  })

  it('round-trips notes and flips and accepts legacy circuits without them', () => {
    const circuit = circuitDocumentSchema.parse({
      version: 1,
      parts: [
        {
          id: 'led',
          type: 'led',
          position: { x: 10, y: 20 },
          rotation: 0,
          flipX: true,
          props: { color: 'red' },
        },
      ],
      wires: [],
      notes: [{ id: 'note-1', text: 'Mind the polarity', position: { x: 40, y: 50 } }],
    })
    const withExtras = createProject({ circuit, sketch: 'void setup() {}\n' })
    const parsed = parseProjectText(serializeProject(withExtras))
    expect(parsed.circuit.parts[0]?.flipX).toBe(true)
    expect(parsed.circuit.notes).toEqual(circuit.notes)

    const legacy = JSON.parse(serializeProject(withExtras))
    delete legacy.circuit.notes
    delete legacy.circuit.parts[0].flipX
    const legacyParsed = parseProjectText(JSON.stringify(legacy))
    expect(legacyParsed.circuit.notes).toBeUndefined()
    expect(legacyParsed.circuit.parts[0]?.flipX).toBeUndefined()
  })

  it('rejects malformed JSON with a readable message', () => {
    expect(() => parseProjectText('{ nope')).toThrow(ProjectFileError)
    expect(() => parseProjectText('{ nope')).toThrow(/valid JSON/)
  })

  it('rejects JSON that is not a project', () => {
    expect(() => parseProjectText('{"hello":1}')).toThrow(/not a VircuitCAD project/)
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
    expect(openKindForPath('/tmp/demo.vcc')).toBe('project')
    expect(openKindForPath('/tmp/demo.vircuit')).toBe('project')
    expect(openKindForPath('/tmp/demo.json')).toBe('project')
    expect(openKindForPath('/tmp/blink.ino')).toBe('sketch')
    expect(openKindForPath('/tmp/blink.hex')).toBeNull()
    expect(openKindForPath('/tmp/blink')).toBeNull()
  })

  it('reads names and extensions without touching the file system', () => {
    expect(fileExtension('/home/me/Blink.INO')).toBe('ino')
    expect(fileExtension('/home/me/no-extension')).toBe('')
    expect(fileBaseName('/home/me/Blink.ino')).toBe('Blink.ino')
    expect(fileStem('/home/me/Blink.ino')).toBe('Blink')
    expect(fileStem('/home/me/traffic-light.vcc')).toBe('traffic-light')
    expect(fileStem('/home/me/legacy.vircuit')).toBe('legacy')
    expect(fileStem('/home/me/no-extension')).toBe('no-extension')
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
