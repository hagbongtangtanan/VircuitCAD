import type { Circuit } from '../model/circuit';
import type { PartRegistry } from '../parts/registry';

/** Renders a bill of materials grouped by part, sorted by part id. */
export function toBomCsv(circuit: Circuit, registry: PartRegistry): string {
  const references = new Map<string, string[]>();
  for (const part of circuit.parts) {
    const list = references.get(part.partId) ?? [];
    list.push(part.id);
    references.set(part.partId, list);
  }

  const rows = [...references.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([partId, ids]) => {
      const name = registry.get(partId)?.name ?? partId;
      const refs = [...ids].sort().join(';');
      return `${partId},${name},${ids.length},${refs}`;
    });

  return `${['partId,name,quantity,references', ...rows].join('\n')}\n`;
}
