export type SerialLine = { text: string; timestamp: number };
export type LineEnding = 'none' | 'lf' | 'crlf';

export function withLineEnding(text: string, ending: LineEnding): string {
  if (ending === 'crlf') return `${text}\r\n`;
  if (ending === 'lf') return `${text}\n`;
  return text;
}

/** Bounded serial transcript (default 10 000 lines, oldest dropped first). */
export class SerialBuffer {
  private lines: SerialLine[] = [];

  constructor(private readonly limit = 10_000) {}

  append(text: string, timestamp: number): void {
    this.lines.push({ text, timestamp });
    if (this.lines.length > this.limit) {
      this.lines.splice(0, this.lines.length - this.limit);
    }
  }

  clear(): void {
    this.lines = [];
  }

  toArray(): SerialLine[] {
    return [...this.lines];
  }

  get size(): number {
    return this.lines.length;
  }

  get capacity(): number {
    return this.limit;
  }
}
