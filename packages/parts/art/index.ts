import type { PartManifest } from '@vircuitcad/core';

import { ART_BUILDERS, type ArtBody } from './builders';
import {
  ART_PADDING,
  partFootprint,
  rect,
  text,
  translatePrimitive,
  type ArtPrimitive,
  type Footprint,
  type PartArt,
} from './dsl';
import { SVG_OVERRIDES } from './overrides';
import { CATEGORY_COLORS, PALETTE } from './palette';

export * from './dsl';
export * from './palette';
export { ART_BUILDERS } from './builders';
export { SVG_OVERRIDES } from './overrides';

function assemble(
  manifest: PartManifest,
  footprint: Footprint,
  { body, primitives }: ArtBody,
  fallback: boolean,
): PartArt {
  const pad = ART_PADDING;
  return {
    partId: manifest.id,
    width: footprint.width + pad * 2,
    height: footprint.height + pad * 2,
    body,
    primitives: primitives.map((primitive) => translatePrimitive(primitive, pad, pad)),
    pins: footprint.pins.map((pin) => ({ ...pin, x: pin.x + pad, y: pin.y + pad })),
    label: {
      text: manifest.name,
      size: 10,
      x: footprint.width / 2 + pad,
      y: footprint.height / 2 + pad + 3,
    },
    fallback,
  };
}

/** A labelled card in the category colour — never a nameless grey rectangle. */
export function fallbackArt(manifest: PartManifest): PartArt {
  const footprint = partFootprint(manifest);
  const body = CATEGORY_COLORS[manifest.category];
  const card = rect(0, 0, footprint.width, footprint.height, body, {
    radius: 6,
    stroke: PALETTE.outline,
    strokeWidth: 1,
  });
  return assemble(manifest, footprint, { body, primitives: [card] }, true);
}

/** Resolve a manifest to agent-drawn art, or a readable fallback card. */
export function resolvePartArt(
  manifest: PartManifest,
  overrides: Record<string, string> = SVG_OVERRIDES,
): PartArt {
  const builder = ART_BUILDERS[manifest.simModel];
  let art: PartArt;
  if (builder) {
    const footprint = partFootprint(manifest);
    art = assemble(manifest, footprint, builder(manifest, footprint), false);
  } else {
    art = fallbackArt(manifest);
  }
  const override = overrides[manifest.id];
  return override ? { ...art, svgOverride: override } : art;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

function strokeAttrs(stroke: string | undefined, width: number | undefined): string {
  if (!stroke) return 'stroke="none"';
  return `stroke="${stroke}" stroke-width="${round(width ?? 1)}"`;
}

export function serializePrimitive(primitive: ArtPrimitive): string {
  switch (primitive.kind) {
    case 'rect': {
      const radius = primitive.radius ? ` rx="${round(primitive.radius)}"` : '';
      return `<rect x="${round(primitive.x)}" y="${round(primitive.y)}" width="${round(
        primitive.width,
      )}" height="${round(primitive.height)}"${radius} fill="${primitive.fill}" ${strokeAttrs(
        primitive.stroke,
        primitive.strokeWidth,
      )} />`;
    }
    case 'circle':
      return `<circle cx="${round(primitive.cx)}" cy="${round(primitive.cy)}" r="${round(
        primitive.r,
      )}" fill="${primitive.fill}" ${strokeAttrs(primitive.stroke, primitive.strokeWidth)} />`;
    case 'line':
      return `<line x1="${round(primitive.x1)}" y1="${round(primitive.y1)}" x2="${round(
        primitive.x2,
      )}" y2="${round(primitive.y2)}" stroke="${primitive.stroke}" stroke-width="${round(
        primitive.strokeWidth,
      )}" />`;
    case 'polyline': {
      const points = primitive.points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');
      return `<polyline points="${points}" fill="${primitive.fill ?? 'none'}" stroke="${
        primitive.stroke
      }" stroke-width="${round(primitive.strokeWidth)}" />`;
    }
    case 'text': {
      const anchor = ` text-anchor="${primitive.anchor ?? 'start'}"`;
      return `<text x="${round(primitive.x)}" y="${round(primitive.y)}" fill="${
        primitive.fill
      }" font-size="${round(primitive.size)}" font-family="monospace"${anchor}>${escapeXml(
        primitive.text,
      )}</text>`;
    }
  }
}

/** Serialise art to SVG. A hand-made override wins when present. */
export function toSvg(art: PartArt): string {
  if (art.svgOverride) return art.svgOverride;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(art.width)}" height="${round(
      art.height,
    )}" viewBox="0 0 ${round(art.width)} ${round(art.height)}" role="img">`,
    ...art.primitives.map(serializePrimitive),
    ...(art.label
      ? [serializePrimitive(text(art.label.x, art.label.y, art.label.text, PALETTE.text, art.label.size, 'middle'))]
      : []),
    ...art.pins.map(
      (pin) =>
        `<circle class="pin" data-pin="${escapeXml(pin.id)}" cx="${round(pin.x)}" cy="${round(
          pin.y,
        )}" r="${round(pin.r)}" fill="none" stroke="${PALETTE.pinRing}" stroke-width="1" />`,
    ),
    '</svg>',
  ];
  return parts.join('');
}

export function hasArt(manifest: PartManifest): boolean {
  return ART_BUILDERS[manifest.simModel] !== undefined;
}
