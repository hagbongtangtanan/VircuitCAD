export class HexParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HexParseError';
  }
}

export type ProgramMemory = {
  bytes: Uint8Array;
  highestAddress: number;
};

const HEX = /^[0-9A-Fa-f]+$/;

function toBytes(record: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < record.length; index += 2) {
    bytes.push(Number.parseInt(record.slice(index, index + 2), 16));
  }
  return bytes;
}

export function parseIntelHex(text: string, size = 0x8000): ProgramMemory {
  const bytes = new Uint8Array(size);
  let highestAddress = -1;
  let base = 0;
  let sawEof = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    if (!line.startsWith(':')) throw new HexParseError(`record must start with ':' (${line})`);

    const body = line.slice(1);
    if (body.length % 2 !== 0 || !HEX.test(body)) throw new HexParseError(`invalid hex (${line})`);

    const record = toBytes(body);
    const byteCount = record[0];
    const address = ((record[1] ?? 0) << 8) | (record[2] ?? 0);
    const type = record[3];
    if (byteCount === undefined || type === undefined || record.length !== byteCount + 5) {
      throw new HexParseError(`record length mismatch (${line})`);
    }

    const data = record.slice(4, 4 + byteCount);
    const checksum = record[4 + byteCount] ?? 0;
    const sum = record.slice(0, 4 + byteCount).reduce((total, value) => total + value, 0);
    if (((sum + checksum) & 0xff) !== 0) throw new HexParseError(`checksum mismatch (${line})`);

    if (type === 0x00) {
      const start = base + address;
      if (start + data.length > size) throw new HexParseError(`address out of range (${line})`);
      for (let index = 0; index < data.length; index += 1) bytes[start + index] = data[index] ?? 0;
      highestAddress = Math.max(highestAddress, start + data.length - 1);
    } else if (type === 0x01) {
      sawEof = true;
      break;
    } else if (type === 0x02) {
      base = (((data[0] ?? 0) << 8) | (data[1] ?? 0)) << 4;
    } else if (type === 0x04) {
      base = (((data[0] ?? 0) << 8) | (data[1] ?? 0)) << 16;
    } else if (type === 0x03 || type === 0x05) {
      // start-address records are ignored
    } else {
      throw new HexParseError(`unsupported record type 0x${type.toString(16)} (${line})`);
    }
  }

  if (!sawEof) throw new HexParseError('missing end-of-file record');
  return { bytes, highestAddress };
}
