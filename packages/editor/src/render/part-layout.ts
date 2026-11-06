import { rotateGridVector, type PartManifest, type Rotation, type Vec2 } from '@vircuitcad/core';

export type PartPinLayout = { id: string; position: Vec2 };
export type PartBounds = { minX: number; minY: number; width: number; height: number };
export type PartLayout = { bounds: PartBounds; pins: PartPinLayout[] };

export function layoutPart(manifest: PartManifest, origin: Vec2, rotation: Rotation): PartLayout {
  const pins = manifest.pins.map((pin) => {
    const offset = rotateGridVector(pin.position, rotation);
    return { id: pin.id, position: { x: origin.x + offset.x, y: origin.y + offset.y } };
  });

  const xs = pins.map((pin) => pin.position.x);
  const ys = pins.map((pin) => pin.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return { bounds: { minX, minY, width: maxX - minX, height: maxY - minY }, pins };
}
