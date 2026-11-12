import { Container, Graphics, Text, TextStyle } from 'pixi.js';

import { PALETTE, type ArtPrimitive, type PartArt } from '@vircuitcad/parts/art';

/** Render art-DSL primitives into a Pixi Graphics path (docs/DESIGN.md 3.5). */
function drawShape(graphics: Graphics, primitive: ArtPrimitive): void {
  switch (primitive.kind) {
    case 'rect': {
      if (primitive.radius && primitive.radius > 0) {
        graphics.roundRect(primitive.x, primitive.y, primitive.width, primitive.height, primitive.radius);
      } else {
        graphics.rect(primitive.x, primitive.y, primitive.width, primitive.height);
      }
      graphics.fill(primitive.fill);
      if (primitive.stroke) {
        graphics.stroke({ width: primitive.strokeWidth ?? 1, color: primitive.stroke });
      }
      break;
    }
    case 'circle': {
      graphics.circle(primitive.cx, primitive.cy, primitive.r).fill(primitive.fill);
      if (primitive.stroke) {
        graphics.stroke({ width: primitive.strokeWidth ?? 1, color: primitive.stroke });
      }
      break;
    }
    case 'line': {
      graphics
        .moveTo(primitive.x1, primitive.y1)
        .lineTo(primitive.x2, primitive.y2)
        .stroke({ width: primitive.strokeWidth, color: primitive.stroke });
      break;
    }
    case 'polyline': {
      const points = primitive.points.flatMap((point) => [point.x, point.y]);
      graphics.poly(points, primitive.closed ?? false);
      if (primitive.fill) graphics.fill(primitive.fill);
      graphics.stroke({ width: primitive.strokeWidth, color: primitive.stroke });
      break;
    }
    case 'text':
      break;
  }
}

function makeText(primitive: Extract<ArtPrimitive, { kind: 'text' }>): Text {
  const node = new Text({
    text: primitive.text,
    style: new TextStyle({
      fontFamily: 'Consolas, monospace',
      fontSize: primitive.size,
      fill: primitive.fill,
    }),
  });
  const anchorX = primitive.anchor === 'middle' ? 0.5 : primitive.anchor === 'end' ? 1 : 0;
  node.anchor.set(anchorX, 0.5);
  node.position.set(primitive.x, primitive.y);
  return node;
}

/** A container holding the drawn body, pin pads and labels for one part art. */
export function buildPartArtContainer(art: PartArt): Container {
  const container = new Container();
  const graphics = new Graphics();
  const texts: Extract<ArtPrimitive, { kind: 'text' }>[] = [];

  for (const primitive of art.primitives) {
    if (primitive.kind === 'text') texts.push(primitive);
    else drawShape(graphics, primitive);
  }
  for (const pin of art.pins) {
    graphics
      .circle(pin.x, pin.y, pin.r)
      .fill({ color: PALETTE.pin, alpha: 0.9 })
      .stroke({ width: 1, color: PALETTE.pinRing });
  }
  container.addChild(graphics);

  if (art.label) {
    texts.push({
      kind: 'text',
      x: art.label.x,
      y: art.label.y,
      text: art.label.text,
      fill: PALETTE.text,
      size: art.label.size,
      anchor: 'middle',
    });
  }
  for (const primitive of texts) container.addChild(makeText(primitive));
  return container;
}
