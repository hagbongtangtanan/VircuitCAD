import type { PartManifest } from '@vircuitcad/core';

import { ART_UNIT } from './palette';

/**
 * Art DSL (docs/DESIGN.md 3.5). Agent-drawn parts are written as small TypeScript
 * objects, never free-hand SVG paths. The same spec renders to Pixi and to SVG.
 */

export type ArtPoint = { x: number; y: number };
export type ArtColor = string;

export type ArtPrimitive =
  | {
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      radius?: number;
      fill: ArtColor;
      stroke?: ArtColor;
      strokeWidth?: number;
    }
  | {
      kind: 'circle';
      cx: number;
      cy: number;
      r: number;
      fill: ArtColor;
      stroke?: ArtColor;
      strokeWidth?: number;
    }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: ArtColor; strokeWidth: number }
  | {
      kind: 'polyline';
      points: ArtPoint[];
      stroke: ArtColor;
      strokeWidth: number;
      fill?: ArtColor;
      closed?: boolean;
    }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      fill: ArtColor;
      size: number;
      anchor?: 'start' | 'middle' | 'end';
    };

export type ArtPin = { id: string; x: number; y: number; r: number };

export type PartArt = {
  partId: string;
  width: number;
  height: number;
  /** Primary body colour, used for the body/background contrast check. */
  body: ArtColor;
  primitives: ArtPrimitive[];
  /** Pin pads generated from the manifest — anchors cannot drift. */
  pins: ArtPin[];
  label?: { text: string; size: number; x: number; y: number };
  fallback: boolean;
  /** Optional hand-made SVG that overrides the serialised DSL output. */
  svgOverride?: string;
};

export type Footprint = {
  minX: number;
  minY: number;
  widthUnits: number;
  heightUnits: number;
  width: number;
  height: number;
  pins: ArtPin[];
};

export const PIN_RADIUS = 3.5;
/** Padding around the pin footprint so pin pads are never clipped by the texture. */
export const ART_PADDING = 5;

/** Body and pin geometry come from the manifest, never from guesses. */
export function partFootprint(manifest: PartManifest): Footprint {
  const xs = manifest.pins.map((pin) => pin.position.x);
  const ys = manifest.pins.map((pin) => pin.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const widthUnits = Math.max(1, Math.max(...xs) - minX);
  const heightUnits = Math.max(1, Math.max(...ys) - minY);
  const pins: ArtPin[] = manifest.pins.map((pin) => ({
    id: pin.id,
    x: (pin.position.x - minX) * ART_UNIT,
    y: (pin.position.y - minY) * ART_UNIT,
    r: PIN_RADIUS,
  }));
  return {
    minX,
    minY,
    widthUnits,
    heightUnits,
    width: widthUnits * ART_UNIT,
    height: heightUnits * ART_UNIT,
    pins,
  };
}

export function translatePrimitive(
  primitive: ArtPrimitive,
  dx: number,
  dy: number,
): ArtPrimitive {
  switch (primitive.kind) {
    case 'rect':
      return { ...primitive, x: primitive.x + dx, y: primitive.y + dy };
    case 'circle':
      return { ...primitive, cx: primitive.cx + dx, cy: primitive.cy + dy };
    case 'line':
      return {
        ...primitive,
        x1: primitive.x1 + dx,
        y1: primitive.y1 + dy,
        x2: primitive.x2 + dx,
        y2: primitive.y2 + dy,
      };
    case 'polyline':
      return {
        ...primitive,
        points: primitive.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      };
    case 'text':
      return { ...primitive, x: primitive.x + dx, y: primitive.y + dy };
  }
}

export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: ArtColor,
  options: { radius?: number; stroke?: ArtColor; strokeWidth?: number } = {},
): ArtPrimitive {
  return { kind: 'rect', x, y, width, height, fill, ...options };
}

export function circle(
  cx: number,
  cy: number,
  r: number,
  fill: ArtColor,
  options: { stroke?: ArtColor; strokeWidth?: number } = {},
): ArtPrimitive {
  return { kind: 'circle', cx, cy, r, fill, ...options };
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: ArtColor,
  strokeWidth = 1.5,
): ArtPrimitive {
  return { kind: 'line', x1, y1, x2, y2, stroke, strokeWidth };
}

export function polyline(
  points: ArtPoint[],
  stroke: ArtColor,
  strokeWidth = 1.5,
  options: { fill?: ArtColor; closed?: boolean } = {},
): ArtPrimitive {
  return { kind: 'polyline', points, stroke, strokeWidth, ...options };
}

export function text(
  x: number,
  y: number,
  value: string,
  fill: ArtColor,
  size = 10,
  anchor: 'start' | 'middle' | 'end' = 'start',
): ArtPrimitive {
  return { kind: 'text', x, y, text: value, fill, size, anchor };
}

/** Bounding box of a primitive in art pixels (text is a label, its box is estimated). */
export function primitiveBounds(primitive: ArtPrimitive): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  switch (primitive.kind) {
    case 'rect':
      return {
        minX: primitive.x,
        minY: primitive.y,
        maxX: primitive.x + primitive.width,
        maxY: primitive.y + primitive.height,
      };
    case 'circle':
      return {
        minX: primitive.cx - primitive.r,
        minY: primitive.cy - primitive.r,
        maxX: primitive.cx + primitive.r,
        maxY: primitive.cy + primitive.r,
      };
    case 'line':
      return {
        minX: Math.min(primitive.x1, primitive.x2),
        minY: Math.min(primitive.y1, primitive.y2),
        maxX: Math.max(primitive.x1, primitive.x2),
        maxY: Math.max(primitive.y1, primitive.y2),
      };
    case 'polyline': {
      const xs = primitive.points.map((point) => point.x);
      const ys = primitive.points.map((point) => point.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }
    case 'text': {
      const width = primitive.text.length * primitive.size * 0.6;
      const originX =
        primitive.anchor === 'middle'
          ? primitive.x - width / 2
          : primitive.anchor === 'end'
            ? primitive.x - width
            : primitive.x;
      return {
        minX: originX,
        minY: primitive.y - primitive.size,
        maxX: originX + width,
        maxY: primitive.y,
      };
    }
  }
}

function channel(component: number): number {
  const c = component / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
