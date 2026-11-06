import RBush from 'rbush';

import {
  type BoardGeometry,
  type Circuit,
  type Endpoint,
  type PartRegistry,
  type Vec2,
} from '@vircuitcad/core';

import { layoutPart } from '../render/part-layout';

export type Rect = { minX: number; minY: number; maxX: number; maxY: number };
export type HitKind = 'pin' | 'hole' | 'part' | 'wire';

export type Hit =
  | { kind: 'pin'; partId: string; pinId: string; position: Vec2 }
  | { kind: 'hole'; holeId: string; position: Vec2 }
  | { kind: 'part'; partId: string; rect: Rect }
  | { kind: 'wire'; wireId: string; points: Vec2[] };

export type HitTestScene = {
  pins: { partId: string; pinId: string; position: Vec2 }[];
  holes: { holeId: string; position: Vec2 }[];
  parts: { partId: string; rect: Rect }[];
  wires: { wireId: string; points: Vec2[] }[];
};

const RANK: Record<HitKind, number> = { pin: 0, hole: 1, part: 2, wire: 3 };

type IndexItem = Rect & { hit: Hit; rank: number };

function endpointKey(endpoint: Endpoint): string {
  return endpoint.kind === 'pin'
    ? `pin:${endpoint.partId}:${endpoint.pinId}`
    : `hole:${endpoint.holeId}`;
}

export function buildHitTestScene(
  circuit: Circuit,
  registry: PartRegistry,
  geometry: BoardGeometry,
  cellSize: number,
): HitTestScene {
  const pins: HitTestScene['pins'] = [];
  const parts: HitTestScene['parts'] = [];
  const worldByEndpoint = new Map<string, Vec2>();

  for (const hole of geometry.holes) {
    const position = { x: hole.position.x * cellSize, y: hole.position.y * cellSize };
    worldByEndpoint.set(`hole:${hole.id}`, position);
  }

  for (const part of circuit.parts) {
    const manifest = registry.get(part.partId);
    if (!manifest) continue;
    const layout = layoutPart(manifest, part.position, part.rotation);
    for (const pin of layout.pins) {
      const position = { x: pin.position.x * cellSize, y: pin.position.y * cellSize };
      pins.push({ partId: part.id, pinId: pin.id, position });
      worldByEndpoint.set(`pin:${part.id}:${pin.id}`, position);
    }
    parts.push({
      partId: part.id,
      rect: {
        minX: layout.bounds.minX * cellSize - cellSize / 2,
        minY: layout.bounds.minY * cellSize - cellSize / 2,
        maxX: (layout.bounds.minX + layout.bounds.width) * cellSize + cellSize / 2,
        maxY: (layout.bounds.minY + layout.bounds.height) * cellSize + cellSize / 2,
      },
    });
  }

  const wires = circuit.wires.map((wire) => {
    const start = worldByEndpoint.get(endpointKey(wire.from)) ?? { x: 0, y: 0 };
    const end = worldByEndpoint.get(endpointKey(wire.to)) ?? { x: 0, y: 0 };
    const points = [
      start,
      ...wire.waypoints.map((point) => ({ x: point.x * cellSize, y: point.y * cellSize })),
      end,
    ];
    return { wireId: wire.id, points };
  });

  const holes = geometry.holes.map((hole) => ({
    holeId: hole.id,
    position: worldByEndpoint.get(`hole:${hole.id}`) ?? { x: 0, y: 0 },
  }));

  return { pins, holes, parts, wires };
}

function distanceToRect(point: Vec2, rect: Rect): number {
  const dx = Math.max(rect.minX - point.x, 0, point.x - rect.maxX);
  const dy = Math.max(rect.minY - point.y, 0, point.y - rect.maxY);
  return Math.hypot(dx, dy);
}

function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function distanceToPolyline(point: Vec2, points: Vec2[]): number {
  const first = points[0];
  if (!first) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return Math.hypot(point.x - first.x, point.y - first.y);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    best = Math.min(best, distanceToSegment(point, previous, current));
  }
  return best;
}

function distanceToHit(hit: Hit, point: Vec2): number {
  switch (hit.kind) {
    case 'pin':
    case 'hole':
      return Math.hypot(hit.position.x - point.x, hit.position.y - point.y);
    case 'part':
      return distanceToRect(point, hit.rect);
    case 'wire':
      return distanceToPolyline(point, hit.points);
  }
}

function boundsOf(hit: Hit): Rect {
  switch (hit.kind) {
    case 'pin':
    case 'hole':
      return { minX: hit.position.x, minY: hit.position.y, maxX: hit.position.x, maxY: hit.position.y };
    case 'part':
      return hit.rect;
    case 'wire': {
      const xs = hit.points.map((point) => point.x);
      const ys = hit.points.map((point) => point.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }
  }
}

export class HitTester {
  private readonly index = new RBush<IndexItem>();

  constructor(scene: HitTestScene) {
    const items: IndexItem[] = [];
    const add = (hit: Hit): void => {
      items.push({ ...boundsOf(hit), hit, rank: RANK[hit.kind] });
    };
    for (const pin of scene.pins) add({ kind: 'pin', ...pin });
    for (const hole of scene.holes) add({ kind: 'hole', ...hole });
    for (const part of scene.parts) add({ kind: 'part', ...part });
    for (const wire of scene.wires) add({ kind: 'wire', ...wire });
    this.index.load(items);
  }

  hitTest(point: Vec2, tolerance: number, kinds?: readonly HitKind[]): Hit | null {
    const candidates = this.index.search({
      minX: point.x - tolerance,
      minY: point.y - tolerance,
      maxX: point.x + tolerance,
      maxY: point.y + tolerance,
    });

    let best: { hit: Hit; rank: number; distance: number } | null = null;
    for (const item of candidates) {
      if (kinds && !kinds.includes(item.hit.kind)) continue;
      const distance = distanceToHit(item.hit, point);
      if (distance > tolerance) continue;
      if (
        !best ||
        item.rank < best.rank ||
        (item.rank === best.rank && distance < best.distance)
      ) {
        best = { hit: item.hit, rank: item.rank, distance };
      }
    }
    return best?.hit ?? null;
  }

  nearest(point: Vec2, tolerance: number, kinds?: readonly HitKind[]): Hit | null {
    const candidates = this.index.search({
      minX: point.x - tolerance,
      minY: point.y - tolerance,
      maxX: point.x + tolerance,
      maxY: point.y + tolerance,
    });

    let best: { hit: Hit; distance: number } | null = null;
    for (const item of candidates) {
      if (kinds && !kinds.includes(item.hit.kind)) continue;
      const distance = distanceToHit(item.hit, point);
      if (distance > tolerance) continue;
      if (!best || distance < best.distance) best = { hit: item.hit, distance };
    }
    return best?.hit ?? null;
  }
}
