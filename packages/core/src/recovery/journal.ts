import { z } from 'zod';

/** FNV-1a checksum, hex-encoded (cheap corruption detection for the autosave journal). */
export function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const JournalSchema = z.object({
  savedAt: z.string().min(1),
  documentId: z.string().min(1),
  checksum: z.string().min(1),
  text: z.string(),
});
export type Journal = z.infer<typeof JournalSchema>;

/** Builds a checksummed journal document for the autosave file. */
export function createJournal(documentId: string, text: string, savedAt: string): string {
  const journal: Journal = { savedAt, documentId, checksum: checksum(text), text };
  return `${JSON.stringify(journal)}\n`;
}

export type JournalRead =
  | { ok: true; savedAt: string; documentId: string; text: string }
  | { ok: false; reason: string };

/** Verifies a journal document; rejects corrupt/truncated files or checksum mismatches. */
export function readJournal(raw: string): JournalRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'corrupt journal (invalid JSON)' };
  }

  const result = JournalSchema.safeParse(parsed);
  if (!result.success) return { ok: false, reason: 'corrupt journal (bad shape)' };

  const journal = result.data;
  if (checksum(journal.text) !== journal.checksum) {
    return { ok: false, reason: 'corrupt journal (checksum mismatch)' };
  }
  return { ok: true, savedAt: journal.savedAt, documentId: journal.documentId, text: journal.text };
}
