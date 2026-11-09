import { createHash } from 'node:crypto';

export type CacheKeyInputs = {
  sources: string;
  libraries?: string[];
  board: string;
  toolchainVersion: string;
};

export function cacheKey(inputs: CacheKeyInputs): string {
  return createHash('sha256')
    .update(JSON.stringify([inputs.sources, inputs.libraries ?? [], inputs.board, inputs.toolchainVersion]))
    .digest('hex');
}

export class CompileCache {
  private readonly entries = new Map<string, string>();

  constructor(private readonly capacity = 50) {}

  get(key: string): string | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  set(key: string, hex: string): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, hex);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
