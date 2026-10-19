/**
 * Line assembly for the serial monitor. A sketch writes bytes whenever it likes,
 * so incoming text is buffered and only emitted as a line when a terminator
 * arrives — exactly how a hardware terminal behaves.
 */

export interface SerialBuffer {
  /** Complete lines, oldest first. */
  readonly lines: readonly string[]
  /** Text received since the last line terminator. */
  readonly pending: string
}

export interface SerialBufferOptions {
  /** Maximum number of retained lines; oldest lines are dropped first. */
  readonly limit?: number
}

export const DEFAULT_SERIAL_LINE_LIMIT = 1_000
export const MAX_SERIAL_LINE_LENGTH = 2_000

export function createSerialBuffer(): SerialBuffer {
  return { lines: [], pending: '' }
}

/**
 * Appends text and splits out any complete lines. Both `\n` and `\r\n` are
 * accepted, and a stray `\r` returns the cursor to the start of the line the way
 * a terminal does.
 */
export function appendSerialText(
  buffer: SerialBuffer,
  text: string,
  options: SerialBufferOptions = {}
): SerialBuffer {
  const limit = options.limit ?? DEFAULT_SERIAL_LINE_LIMIT
  const lines = [...buffer.lines]
  let pending = buffer.pending
  let index = 0

  while (index < text.length) {
    const character = text[index] ?? ''
    if (character === '\r') {
      index += 1
      continue
    }
    if (character === '\n') {
      lines.push(pending)
      pending = ''
      index += 1
      continue
    }
    if (pending.length >= MAX_SERIAL_LINE_LENGTH) {
      lines.push(pending)
      pending = ''
    }
    pending += character
    index += 1
  }

  while (lines.length > limit) lines.shift()
  return { lines, pending }
}
