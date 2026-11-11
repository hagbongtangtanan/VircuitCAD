import { expect, it } from 'vitest';

import { checksum, createJournal, readJournal } from './journal';
import { addRecent, parseRecent, serializeRecent } from './recent';

it('round-trips a valid journal', () => {
  const raw = createJournal('doc-1', '{"schemaVersion":2}', '2026-11-11T00:00:00Z');
  const result = readJournal(raw);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.documentId).toBe('doc-1');
    expect(result.text).toBe('{"schemaVersion":2}');
  }
});

it('rejects a corrupt or tampered journal (crash safety)', () => {
  expect(readJournal('not json').ok).toBe(false);

  const raw = createJournal('doc-1', 'original', '2026-11-11T00:00:00Z');
  const tampered = raw.replace('original', 'changed!!');
  const result = readJournal(tampered);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toMatch(/checksum mismatch/);
});

it('detects checksum changes', () => {
  expect(checksum('abc')).not.toBe(checksum('abd'));
  expect(checksum('abc')).toBe(checksum('abc'));
});

it('de-duplicates and caps recent files', () => {
  let list: string[] = [];
  for (let index = 0; index < 12; index += 1) list = addRecent(list, `/c/${index}.vcad`);
  expect(list).toHaveLength(10);
  expect(list[0]).toBe('/c/11.vcad');

  list = addRecent(list, '/c/5.vcad');
  expect(list[0]).toBe('/c/5.vcad');
  expect(list.filter((entry) => entry === '/c/5.vcad')).toHaveLength(1);
});

it('round-trips recent files and tolerates bad input', () => {
  const list = ['/a.vcad', '/b.vcad'];
  expect(parseRecent(serializeRecent(list))).toEqual(list);
  expect(parseRecent('nope')).toEqual([]);
  expect(parseRecent('{"files":123}')).toEqual([]);
});
