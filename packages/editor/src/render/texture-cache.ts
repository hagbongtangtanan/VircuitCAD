export class TextureCache<T> {
  private readonly items = new Map<string, T>();

  get(key: string, create: () => T): T {
    const existing = this.items.get(key);
    if (existing !== undefined) return existing;
    const created = create();
    this.items.set(key, created);
    return created;
  }

  has(key: string): boolean {
    return this.items.has(key);
  }

  get size(): number {
    return this.items.size;
  }

  clear(dispose?: (item: T) => void): void {
    if (dispose) for (const item of this.items.values()) dispose(item);
    this.items.clear();
  }
}
