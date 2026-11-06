import { useMemo, useState } from 'react';

import type { PartManifest, PartRegistry } from '@vircuitcad/core';

export type PartsBinProps = {
  registry: PartRegistry;
  onPick: (partId: string) => void;
};

export function PartsBin({ registry, onPick }: PartsBinProps) {
  const [query, setQuery] = useState('');

  const categories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const byCategory = new Map<string, PartManifest[]>();
    for (const manifest of registry.list()) {
      if (
        needle &&
        !manifest.name.toLowerCase().includes(needle) &&
        !manifest.id.toLowerCase().includes(needle)
      ) {
        continue;
      }
      const bucket = byCategory.get(manifest.category) ?? [];
      bucket.push(manifest);
      byCategory.set(manifest.category, bucket);
    }
    return [...byCategory.entries()];
  }, [registry, query]);

  return (
    <div className="parts-bin">
      <input
        type="search"
        placeholder="Search parts"
        aria-label="Search parts"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {categories.map(([category, manifests]) => (
        <section key={category} aria-label={category}>
          <h3>{category}</h3>
          <ul>
            {manifests.map((manifest) => (
              <li key={manifest.id}>
                <button type="button" onClick={() => onPick(manifest.id)}>
                  {manifest.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
