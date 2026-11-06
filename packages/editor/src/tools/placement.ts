import {
  rotateGridVector,
  type BoardGeometry,
  type PartManifest,
  type Rotation,
  type Vec2,
} from '@vircuitcad/core';

import { layoutPart } from '../render/part-layout';

export type GridRect = { minX: number; minY: number; maxX: number; maxY: number };
export type HoleLookup = { nearest(from: Vec2, tolerance: number): Vec2 | null };
export type SnapResult = { position: Vec2; snapped: boolean };

export function partGridBounds(
  manifest: PartManifest,
  rotation: Rotation,
  position: Vec2,
): GridRect {
  const { bounds } = layoutPart(manifest, position, rotation);
  return {
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.minX + bounds.width,
    maxY: bounds.minY + bounds.height,
  };
}

export function boardGridBounds(geometry: BoardGeometry): GridRect {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const hole of geometry.holes) {
    minX = Math.min(minX, hole.position.x);
    minY = Math.min(minY, hole.position.y);
    maxX = Math.max(maxX, hole.position.x);
    maxY = Math.max(maxY, hole.position.y);
  }
  return { minX, minY, maxX, maxY };
}

export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

export function snapPartPosition(
  manifest: PartManifest,
  rotation: Rotation,
  desired: Vec2,
  holes: HoleLookup,
  tolerance = 1.5,
): SnapResult {
  const anchorPin = manifest.pins[0];
  const anchor = anchorPin ? rotateGridVector(anchorPin.position, rotation) : { x: 0, y: 0 };
  const target = { x: desired.x + anchor.x, y: desired.y + anchor.y };

  const hole = holes.nearest(target, tolerance);
  if (hole) {
    return { position: { x: hole.x - anchor.x, y: hole.y - anchor.y }, snapped: true };
  }
  return { position: { x: Math.round(desired.x), y: Math.round(desired.y) }, snapped: false };
}

export function isPlacementValid(
  manifest: PartManifest,
  rotation: Rotation,
  position: Vec2,
  board: GridRect,
  occupied: readonly GridRect[],
): boolean {
  const rect = partGridBounds(manifest, rotation, position);
  if (rect.minX < board.minX || rect.minY < board.minY) return false;
  if (rect.maxX > board.maxX || rect.maxY > board.maxY) return false;
  return !occupied.some((other) => rectsOverlap(rect, other));
}
