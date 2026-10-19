/**
 * Minimal Intel HEX reader. The compiler is the only producer, so we accept the
 * record types avr-gcc emits (data, EOF, extended linear/segment, start) and
 * reject everything else instead of guessing.
 */

export const FLASH_BYTES = 32 * 1024

export class IntelHexError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntelHexError'
  }
}

function parseHexByte(text: string, context: string): number {
  if (!/^[0-9a-fA-F]{2}$/.test(text)) {
    throw new IntelHexError(`${context}: expected a hex byte, got "${text}"`)
  }
  return Number.parseInt(text, 16)
}

/**
 * Parses an Intel HEX payload into a 32 KiB flash image. Unused bytes stay at
 * 0xff, which is what erased AVR flash reads as.
 */
export function parseIntelHex(source: string): Uint8Array {
  const flash = new Uint8Array(FLASH_BYTES).fill(0xff)
  let extendedAddress = 0
  let sawEof = false
  let lineNumber = 0

  for (const rawLine of source.split(/\r?\n/)) {
    lineNumber += 1
    const line = rawLine.trim()
    if (line === '') continue
    if (sawEof) throw new IntelHexError(`line ${lineNumber}: data after the EOF record`)
    if (!line.startsWith(':')) {
      throw new IntelHexError(`line ${lineNumber}: record does not start with ":"`)
    }

    const payload = line.slice(1)
    if (payload.length % 2 !== 0) {
      throw new IntelHexError(`line ${lineNumber}: odd number of hex digits`)
    }
    if (payload.length < 10) {
      throw new IntelHexError(`line ${lineNumber}: record is too short`)
    }

    const fields = payload.match(/.{2}/g)
    if (fields === null) throw new IntelHexError(`line ${lineNumber}: malformed record`)

    const bytes = fields.map((field) => parseHexByte(field, `line ${lineNumber}`))
    const length = bytes[0] ?? 0
    const address = ((bytes[1] ?? 0) << 8) | (bytes[2] ?? 0)
    const type = bytes[3] ?? 0
    const data = bytes.slice(4, 4 + length)
    const checksum = bytes[4 + length]

    if (checksum === undefined || bytes.length !== length + 5) {
      throw new IntelHexError(`line ${lineNumber}: record length does not match its header`)
    }
    if (data.length !== length) {
      throw new IntelHexError(`line ${lineNumber}: truncated data`)
    }

    const sum = bytes.slice(0, 4 + length).reduce((total, byte) => total + byte, 0)
    if (((sum + checksum) & 0xff) !== 0) {
      throw new IntelHexError(`line ${lineNumber}: checksum mismatch`)
    }

    switch (type) {
      case 0x00: {
        const base = extendedAddress + address
        if (base + data.length > flash.length) {
          throw new IntelHexError(`line ${lineNumber}: data beyond the 32 KiB flash`)
        }
        flash.set(data, base)
        break
      }
      case 0x01:
        sawEof = true
        break
      case 0x02: {
        if (data.length !== 2) throw new IntelHexError(`line ${lineNumber}: bad segment record`)
        extendedAddress = (((data[0] ?? 0) << 8) | (data[1] ?? 0)) * 16
        break
      }
      case 0x04: {
        if (data.length !== 2) throw new IntelHexError(`line ${lineNumber}: bad linear record`)
        extendedAddress = (((data[0] ?? 0) << 8) | (data[1] ?? 0)) * 65536
        break
      }
      case 0x03:
      case 0x05:
        // Start addresses are irrelevant for a bare-metal reset.
        break
      default:
        throw new IntelHexError(
          `line ${lineNumber}: unsupported record type 0x${type.toString(16)}`
        )
    }
  }

  if (!sawEof) throw new IntelHexError('missing EOF record')
  return flash
}

/** Little-endian flash image to the AVR program-memory representation. */
export function toProgramWords(flash: Uint8Array): Uint16Array {
  if (flash.length % 2 !== 0) throw new IntelHexError('flash image has an odd length')
  const words = new Uint16Array(flash.length / 2)
  for (let index = 0; index < words.length; index += 1) {
    words[index] = (flash[index * 2] ?? 0) | ((flash[index * 2 + 1] ?? 0) << 8)
  }
  return words
}
