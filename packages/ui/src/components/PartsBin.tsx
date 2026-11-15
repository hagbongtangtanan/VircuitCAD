import { isPlaceable, type PartManifest, type PartRegistry } from '@vircuitcad/core';
import { resolvePartArt, toSvg } from '@vircuitcad/parts/art';
import { useEffect, useMemo, useState } from 'react';

export type PartsBinProps = {
  registry: PartRegistry;
  onPick: (partId: string) => void;
};

const STORAGE_KEY = 'vircuitcad.partsBin.open';

function loadOpen(): Record<string, boolean> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function PartsBin({ registry, onPick }: PartsBinProps) {
  const [query, setQuery] = useState('');
  const [showPlanned, setShowPlanned] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(loadOpen);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
      }
    } catch {
      /* storage unavailable — session-only */
    }
  }, [open]);

  const categories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const byCategory = new Map<string, PartManifest[]>();
    for (const manifest of registry.list()) {
      if (!showPlanned && !isPlaceable(manifest)) continue;
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
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [registry, query, showPlanned]);

  const toggleCategory = (category: string): void => {
    setOpen((previous) => ({ ...previous, [category]: previous[category] === false }));
  };

  const thumbnails = useMemo(
    () =>
      new Map(
        registry.list().map((manifest) => [
          manifest.id,
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSvg(resolvePartArt(manifest)))}`,
        ]),
      ),
    [registry],
  );

  return (
    <div className="parts-bin">
      <div className="parts-bin-search">
        <input
          type="search"
          placeholder="Search parts"
          aria-label="Search parts"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <label className="parts-bin-toggle">
        <input
          type="checkbox"
          checked={showPlanned}
          onChange={(event) => setShowPlanned(event.target.checked)}
        />
        <span>Show planned</span>
      </label>
      {categories.map(([category, manifests]) => {
        const expanded = open[category] !== false;
        const bodyId = `parts-${category}`;
        return (
          <section key={category} aria-label={category} className="parts-category">
            <h3>
              <button
                type="button"
                className="parts-category-toggle"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={() => toggleCategory(category)}
              >
                <span className="parts-category-chevron" aria-hidden="true" />
                <span>{category} ({manifests.length})</span>
              </button>
            </h3>
            <ul id={bodyId} hidden={!expanded}>
              {manifests.map((manifest) => {
                const placeable = isPlaceable(manifest);
                return (
                  <li key={manifest.id} className="part-row-item">
                    <button
                      type="button"
                      className="part-row"
                      disabled={!placeable}
                      title={placeable ? manifest.name : 'Planned — not available yet'}
                      onClick={() => onPick(manifest.id)}
                    >
                      <img
                        className="part-thumbnail"
                        data-testid="part-thumbnail"
                        src={thumbnails.get(manifest.id)}
                        alt=""
                        width="24"
                        height="24"
                      />
                      <span className="part-name">{manifest.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
