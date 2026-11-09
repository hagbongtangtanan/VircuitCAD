import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { expect, it } from 'vitest';

import { HexParseError, parseIntelHex } from './intel-hex';

const hexDir = fileURLToPath(new URL('../../../fixtures/hex', import.meta.url));

it('parses a minimal data record and EOF', () => {
  const { bytes, highestAddress } = parseIntelHex(':010000003EC1\n:00000001FF\n');
  expect(bytes[0]).toBe(0x3e);
  expect(highestAddress).toBe(0);
});

it('rejects a bad checksum', () => {
  expect(() => parseIntelHex(':010000003EC2\n:00000001FF\n')).toThrow(HexParseError);
});

it('rejects malformed lines and missing EOF', () => {
  expect(() => parseIntelHex('nope\n')).toThrow(HexParseError);
  expect(() => parseIntelHex(':010000003EC1\n')).toThrow(/end-of-file/);
});

it('parses every committed fixture into program memory', () => {
  const fixtures = readdirSync(hexDir).filter((name) => name.endsWith('.hex'));
  expect(fixtures.length).toBeGreaterThanOrEqual(9);
  for (const name of fixtures) {
    const text = readFileSync(path.join(hexDir, name), 'utf8');
    const { bytes, highestAddress } = parseIntelHex(text);
    expect(highestAddress).toBeGreaterThan(0);
    expect(bytes.filter((value) => value !== 0).length).toBeGreaterThan(16);
  }
});
