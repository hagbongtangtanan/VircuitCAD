import { Graphics, type Renderer, type Texture } from 'pixi.js';

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
