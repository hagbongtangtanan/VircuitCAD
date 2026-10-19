import { describe, expect, it } from 'vitest'
import { appendSerialText, createSerialBuffer, MAX_SERIAL_LINE_LENGTH } from './serialBuffer'

describe('appendSerialText', () => {
  it('keeps a partial line pending until a terminator arrives', () => {
    const first = appendSerialText(createSerialBuffer(), 'Hel')
    expect(first).toEqual({ lines: [], pending: 'Hel' })
    const second = appendSerialText(first, 'lo\n')
    expect(second).toEqual({ lines: ['Hello'], pending: '' })
  })

  it('splits several lines from one chunk', () => {
    const buffer = appendSerialText(createSerialBuffer(), 'a\nb\nc')
    expect(buffer.lines).toEqual(['a', 'b'])
    expect(buffer.pending).toBe('c')
  })

  it('treats the CR of a CRLF pair as part of the terminator', () => {
    expect(appendSerialText(createSerialBuffer(), 'line\r\n').lines).toEqual(['line'])
  })

  it('drops the oldest lines once the limit is reached', () => {
    let buffer = createSerialBuffer()
    for (let index = 0; index < 5; index += 1) {
      buffer = appendSerialText(buffer, `line ${index}\n`, { limit: 3 })
    }
    expect(buffer.lines).toEqual(['line 2', 'line 3', 'line 4'])
  })

  it('emits an over-long line instead of growing without bound', () => {
    const buffer = appendSerialText(
      createSerialBuffer(),
      `${'x'.repeat(MAX_SERIAL_LINE_LENGTH + 5)}`
    )
    expect(buffer.lines).toHaveLength(1)
    expect(buffer.pending).toBe('xxxxx')
  })
})
