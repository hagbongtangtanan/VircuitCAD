import { PartManifestSchema, type PartManifest } from './manifest';

export function parsePartManifest(raw: unknown): PartManifest {
  return PartManifestSchema.parse(raw);
}

export class PartRegistry {
  private readonly manifests = new Map<string, PartManifest>();

  constructor(manifests: readonly PartManifest[] = []) {
    for (const manifest of manifests) this.register(manifest);
  }

  register(manifest: PartManifest): void {
    if (this.manifests.has(manifest.id)) {
      throw new Error(`part "${manifest.id}" is already registered`);
    }
    this.manifests.set(manifest.id, manifest);
  }

  has(id: string): boolean {
    return this.manifests.has(id);
  }

  get(id: string): PartManifest | undefined {
    return this.manifests.get(id);
  }

  require(id: string): PartManifest {
    const manifest = this.manifests.get(id);
    if (!manifest) throw new Error(`unknown part "${id}"`);
    return manifest;
  }

  list(): PartManifest[] {
    return [...this.manifests.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
