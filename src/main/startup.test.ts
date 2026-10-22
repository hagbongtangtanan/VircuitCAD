import { describe, expect, it } from 'vitest'
import { filePathFromArgs } from './startup'

const fileExists = (path: string): boolean =>
  path === '/home/ada/blink.vircuit' || path === 'C:\\work\\blink.ino' || path === '/tmp/data.json'

describe('filePathFromArgs', () => {
  it('finds a project path among electron and chromium flags', () => {
    expect(
      filePathFromArgs(
        [
          '/usr/bin/vircuitcad',
          '--no-sandbox',
          '--enable-logging',
          '--user-data-dir=/tmp/vircuitcad',
          '/home/ada/blink.vircuit',
        ],
        fileExists
      )
    ).toBe('/home/ada/blink.vircuit')
  })

  it('accepts fingerprints of Windows argv paths', () => {
    expect(filePathFromArgs(['VircuitCAD.exe', 'C:\\work\\blink.ino'], fileExists)).toBe(
      'C:\\work\\blink.ino'
    )
  })

  it('ignores unsupported and missing files', () => {
    expect(filePathFromArgs(['VircuitCAD', '/home/ada/photo.png'], fileExists)).toBeNull()
    expect(filePathFromArgs(['VircuitCAD', '/home/ada/missing.vircuit'], fileExists)).toBeNull()
  })

  it('returns null for a plain launch', () => {
    expect(filePathFromArgs(['/usr/bin/vircuitcad'], fileExists)).toBeNull()
  })
})
