import { describe, expect, it } from 'vitest'
import { FLASH_BYTES, IntelHexError, parseIntelHex, toProgramWords } from './intelhex'

function record(type: number, address: number, data: readonly number[]): string {
  const bytes = [data.length, (address >> 8) & 0xff, address & 0xff, type, ...data]
  const checksum = (0x100 - (bytes.reduce((total, byte) => total + byte, 0) & 0xff)) & 0xff
  return `:${[...bytes, checksum]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

const EOF = record(1, 0, [])

describe('parseIntelHex', () => {
  it('loads data records and reads little-endian program words', () => {
    const hex = [record(0, 0, [0x0c, 0x94, 0x34, 0x00]), EOF].join('\n')
    const flash = parseIntelHex(hex)
    expect(flash.length).toBe(FLASH_BYTES)
    expect([...flash.slice(0, 4)]).toEqual([0x0c, 0x94, 0x34, 0x00])
    expect([...flash.slice(4, 8)]).toEqual([0xff, 0xff, 0xff, 0xff])
    expect([...toProgramWords(flash).slice(0, 2)]).toEqual([0x940c, 0x0034])
  })

  it('honours extended segment addresses', () => {
    const hex = [record(2, 0, [0x00, 0x01]), record(0, 0x0010, [0xaa]), EOF].join('\n')
    const flash = parseIntelHex(hex)
    expect(flash[0x20]).toBe(0xaa)
  })

  it('honours extended linear addresses', () => {
    const hex = [record(4, 0, [0x00, 0x00]), record(0, 0x0010, [0xbb]), EOF].join('\n')
    const flash = parseIntelHex(hex)
    expect(flash[0x10]).toBe(0xbb)
  })

  it('rejects a bad checksum', () => {
    const line = record(0, 0, [1, 2, 3])
    const broken = line.slice(0, -2) + (line.endsWith('00') ? '01' : '00')
    expect(() => parseIntelHex(broken)).toThrow(IntelHexError)
  })

  it('rejects a missing EOF record', () => {
    expect(() => parseIntelHex(record(0, 0, [1]))).toThrow(/EOF/)
  })

  it('rejects data past the end of flash', () => {
    const hex = [record(4, 0, [0x00, 0x80]), record(0, 0, [1]), EOF].join('\n')
    expect(() => parseIntelHex(hex)).toThrow(/beyond/)
  })

  it('rejects malformed records', () => {
    expect(() => parseIntelHex(':0000\n' + EOF)).toThrow(IntelHexError)
    expect(() => parseIntelHex('00000001FF')).toThrow(IntelHexError)
  })
})
