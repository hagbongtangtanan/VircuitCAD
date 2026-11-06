import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

import {
  generateBoardGeometry,
  type BoardGeometry,
  type DocumentStore,
  type PartCategory,
  type PartManifest,
  type PartRegistry,
  type Rotation,
  type Vec2,
} from '@vircuitcad/core';

import { layoutPart } from './part-layout';
import { createPlaceholderPartTexture } from './part-textures';
import { TextureCache } from './texture-cache';

export type SceneOptions = {
  cellSize?: number;
  holeRadius?: number;
  holeColor?: number;
};

export type PreviewState = {
  manifest: PartManifest;
  position: Vec2;
  rotation: Rotation;
  valid: boolean;
};

const CATEGORY_COLORS: Record<PartCategory, number> = {
  passive: 0xd6b98a,
  opto: 0xef4444,
  power: 0x64748b,
  digital: 0x38bdf8,
  mcu: 0x22c55e,
  instrument: 0xa78bfa,
};

export class Scene {
  readonly root = new Container();
  private readonly boardLayer = new Container();
  private readonly partsLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly selectionGraphics = new Graphics();
  private readonly cache = new TextureCache<Texture>();
  private readonly geometry: BoardGeometry;
  private readonly cellSize: number;
  private readonly unsubscribe: () => void;
  private preview: Sprite | undefined = undefined;
  private selectedId: string | undefined = undefined;
  private destroyed = false;

  constructor(
    private readonly renderer: Renderer,
    private readonly store: DocumentStore,
    private readonly registry: PartRegistry,
    options: SceneOptions = {},
  ) {
    this.cellSize = options.cellSize ?? 20;
    this.root.addChild(this.boardLayer, this.partsLayer, this.overlayLayer);
    this.overlayLayer.addChild(this.selectionGraphics);
    this.geometry = generateBoardGeometry(store.getCircuit().board.kind);
    this.drawBoard(options);
    this.renderParts();
    this.unsubscribe = store.onChange(() => {
      this.renderParts();
      this.refreshSelection();
    });
  }

  getGeometry(): BoardGeometry {
    return this.geometry;
  }

  getCellSize(): number {
    return this.cellSize;
  }

  getPartCount(): number {
    return this.partsLayer.children.length;
  }

  setSelection(partId: string | undefined): void {
    this.selectedId = partId;
    this.refreshSelection();
  }

  setPreview(preview: PreviewState | null): void {
    this.preview?.destroy();
    this.preview = undefined;
    if (!preview) return;

    const layout = layoutPart(preview.manifest, preview.position, preview.rotation);
    const width = Math.max(1, layout.bounds.width) * this.cellSize;
    const height = Math.max(1, layout.bounds.height) * this.cellSize;
    const color = preview.valid ? 0x22c55e : 0xef4444;
    const texture = this.cache.get(`preview:${preview.manifest.id}:${preview.rotation}:${preview.valid}`, () =>
      createPlaceholderPartTexture(
        this.renderer,
        color,
        Math.round(width),
        Math.round(height),
        this.renderer.resolution,
      ),
    );

    const sprite = new Sprite(texture);
    sprite.alpha = 0.5;
    sprite.position.set(layout.bounds.minX * this.cellSize, layout.bounds.minY * this.cellSize);
    this.preview = sprite;
    this.overlayLayer.addChild(sprite);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    this.preview?.destroy();
    this.preview = undefined;
    this.cache.clear((texture) => texture.destroy(true));
    this.root.destroy({ children: true });
  }

  private refreshSelection(): void {
    this.selectionGraphics.clear();
    if (!this.selectedId) return;

    const part = this.store.getCircuit().parts.find((candidate) => candidate.id === this.selectedId);
    if (!part) return;
    const manifest = this.registry.get(part.partId);
    if (!manifest) return;

    const layout = layoutPart(manifest, part.position, part.rotation);
    const pad = this.cellSize * 0.3;
    const width = Math.max(layout.bounds.width * this.cellSize, 1) + pad * 2;
    const height = Math.max(layout.bounds.height * this.cellSize, 1) + pad * 2;
    this.selectionGraphics
      .rect(
        layout.bounds.minX * this.cellSize - pad,
        layout.bounds.minY * this.cellSize - pad,
        width,
        height,
      )
      .stroke({ width: 2, color: 0x38bdf8, alpha: 0.9 });
  }

  private drawBoard(options: SceneOptions): void {
    const radius = options.holeRadius ?? 3;
    const color = options.holeColor ?? 0x334155;
    const graphics = new Graphics();
    for (const hole of this.geometry.holes) {
      graphics.circle(hole.position.x * this.cellSize, hole.position.y * this.cellSize, radius);
    }
    graphics.fill({ color });
    this.boardLayer.addChild(graphics);
  }

  private renderParts(): void {
    for (const child of this.partsLayer.removeChildren()) child.destroy();
    for (const part of this.store.getCircuit().parts) {
      const manifest = this.registry.get(part.partId);
      if (!manifest) continue;
      this.partsLayer.addChild(this.createSprite(manifest, part.position, part.rotation));
    }
  }

  private createSprite(manifest: PartManifest, position: Vec2, rotation: Rotation): Sprite {
    const layout = layoutPart(manifest, position, rotation);
    const width = Math.max(1, layout.bounds.width) * this.cellSize;
    const height = Math.max(1, layout.bounds.height) * this.cellSize;
    const color = CATEGORY_COLORS[manifest.category];

    const texture = this.cache.get(`part:${manifest.id}:${rotation}`, () =>
      createPlaceholderPartTexture(
        this.renderer,
        color,
        Math.round(width),
        Math.round(height),
        this.renderer.resolution,
      ),
    );

    const sprite = new Sprite(texture);
    sprite.position.set(layout.bounds.minX * this.cellSize, layout.bounds.minY * this.cellSize);
    return sprite;
  }
}
