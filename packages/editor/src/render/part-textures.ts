import { Graphics, type Renderer, type Texture } from 'pixi.js';

import type { PartManifest } from '@vircuitcad/core';

export function createPlaceholderPartTexture(
  renderer: Renderer,
  color: number,
  width: number,
  height: number,
  resolution: number,
): Texture {
  const graphics = new Graphics();
  graphics
    .roundRect(0, 0, Math.max(width, 8), Math.max(height, 8), 3)
    .fill({ color })
    .stroke({ width: 1, color: 0x0b1220, alpha: 0.6 });

  const texture = renderer.generateTexture({ target: graphics, resolution });
  graphics.destroy();
  return texture;
}

/** Own vector art per sim model (no Autodesk/Tinkercad assets). */
export function createPartTexture(
  renderer: Renderer,
  manifest: PartManifest,
  width: number,
  height: number,
  resolution: number,
): Texture {
  const w = Math.max(width, 10);
  const h = Math.max(height, 10);
  const outline = { width: 1, color: 0x0b1220, alpha: 0.7 };
  const graphics = new Graphics();

  switch (manifest.simModel) {
    case 'resistor': {
      graphics.roundRect(0, 0, w, h, 3).fill({ color: 0xd6b98a }).stroke(outline);
      const bands = [0x1f2937, 0xef4444, 0xf59e0b];
      const bandWidth = Math.max(2, w * 0.1);
      bands.forEach((color, index) => {
        graphics
          .rect(w * 0.25 + index * bandWidth * 1.8, 0, bandWidth, h)
          .fill({ color });
      });
      break;
    }
    case 'led': {
      graphics
        .circle(w / 2, h / 2, Math.min(w, h) / 2)
        .fill({ color: 0xef4444 })
        .stroke(outline);
      break;
    }
    case 'battery':
    case 'battery-pack': {
      graphics.roundRect(0, 0, w, h, 2).fill({ color: 0x64748b }).stroke(outline);
      graphics.rect(w * 0.82, h * 0.35, w * 0.18, h * 0.3).fill({ color: 0xf59e0b });
      break;
    }
    case 'switch':
    case 'pushbutton':
    case 'slide-switch': {
      graphics.roundRect(0, 0, w, h, 2).fill({ color: 0x94a3b8 }).stroke(outline);
      graphics
        .moveTo(w * 0.2, h * 0.7)
        .lineTo(w * 0.8, h * 0.3)
        .stroke({ width: 2, color: 0x1f2937 });
      break;
    }
    case 'capacitor': {
      graphics.roundRect(0, 0, w, h, 2).fill({ color: 0x38bdf8 }).stroke(outline);
      graphics.rect(w * 0.4, 0, 2, h).fill({ color: 0x0b1220 });
      graphics.rect(w * 0.6, 0, 2, h).fill({ color: 0x0b1220 });
      break;
    }
    case 'inductor': {
      graphics.roundRect(0, 0, w, h, 2).fill({ color: 0xa78bfa }).stroke(outline);
      break;
    }
    default: {
      graphics.roundRect(0, 0, w, h, 3).fill({ color: 0x64748b }).stroke(outline);
    }
  }

  const texture = renderer.generateTexture({ target: graphics, resolution });
  graphics.destroy();
  return texture;
}
