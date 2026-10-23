/** World-space sticky note geometry shared by the canvas and fit-to-content. */
export const NOTE_WIDTH = 220
export const NOTE_PADDING = 12
export const NOTE_FONT_SIZE = 14
export const NOTE_LINE_HEIGHT = 1.35
export const NOTE_MIN_HEIGHT = 72
export const DEFAULT_NOTE_TEXT = 'New note'

const NOTE_CHAR_WIDTH = NOTE_FONT_SIZE * 0.6

function wrappedLineCount(line: string): number {
  const usableWidth = NOTE_WIDTH - NOTE_PADDING * 2
  const charsPerLine = Math.max(8, Math.floor(usableWidth / NOTE_CHAR_WIDTH))
  if (line.length === 0) return 1
  return Math.max(1, Math.ceil(line.length / charsPerLine))
}

/** Approximate the wrapped height so the card grows with its text. */
export function noteHeight(text: string): number {
  const lines = text.split('\n').reduce((sum, line) => sum + wrappedLineCount(line), 0)
  const body = lines * NOTE_FONT_SIZE * NOTE_LINE_HEIGHT
  return Math.max(NOTE_MIN_HEIGHT, Math.ceil(NOTE_PADDING * 2 + body))
}
