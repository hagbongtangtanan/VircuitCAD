import { describe, expect, it } from 'vitest'
import { filePathFromArgs } from './startup'

const fileExists = (path: string): boolean =>
  path === '/home/ada/blink.hucad' || path === 'C:\\work\\blink.ino' || path === '/tmp/data.json'

describe('filePathFromArgs', () => {
  it('finds a project path among electron and chromium flags', () => {
    expect(
      filePathFromArgs(
        [
          '/usr/bin/hucad',
          '--no-sandbox',
          '--enable-logging',
          '--user-data-dir=/tmp/hucad',
          '/home/ada/blink.hucad',
        ],
        fileExists
      )
    ).toBe('/home/ada/blink.hucad')
  })

  it('accepts fingerprints of Windows argv paths', () => {
    expect(filePathFromArgs(['HuCAD.exe', 'C:\\work\\blink.ino'], fileExists)).toBe(
      'C:\\work\\blink.ino'
    )
  })

  it('ignores unsupported and missing files', () => {
    expect(filePathFromArgs(['HuCAD', '/home/ada/photo.png'], fileExists)).toBeNull()
    expect(filePathFromArgs(['HuCAD', '/home/ada/missing.hucad'], fileExists)).toBeNull()
  })

  it('returns null for a plain launch', () => {
    expect(filePathFromArgs(['/usr/bin/hucad'], fileExists)).toBeNull()
  })
})
