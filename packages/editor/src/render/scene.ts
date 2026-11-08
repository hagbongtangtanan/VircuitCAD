import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

import {
  extractNetlist,
  generateBoardGeometry,
  type BoardGeometry,
  type DocumentStore,
  type PartManifest,
  type PartRegistry,
  type Rotation,
  type Vec2,
} from '@vircuitcad/core';

import { buildHitTestScene } from '../hit/scene-index';
import { layoutPart } from './part-layout';
import { createPartTexture, createPlaceholderPartTexture } from './part-textures';
import { ledGlow, ledTint, voltageToColor } from './visuals';
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

export class Scene {
  readonly root = new Container();
  private readonly boardLayer = new Container();
  private readonly wiresLayer = new Container();
  private readonly partsLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly selectionGraphics = new Graphics();
  private readonly highlightGraphics = new Graphics();
  private readonly wirePreview = new Graphics();
  private ledById = new Map<string, { current: number; burnedOut: boolean }>();
  private nodeVoltages: Record<string, number> = {};
  private netColoring = false;
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
    this.root.addChild(this.boardLayer, this.wiresLayer, this.partsLayer, this.overlayLayer);
    this.overlayLayer.addChild(this.selectionGraphics, this.highlightGraphics, this.wirePreview);
    this.geometry = generateBoardGeometry(store.getCircuit().board.kind);
    this.drawBoard(options);
    this.renderCircuit();
    this.unsubscribe = store.onChange(() => {
      this.renderCircuit();
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

  setWirePreview(points: Vec2[] | null): void {
    this.wirePreview.clear();
    const [first, ...rest] = points ?? [];
    if (!first) return;
    this.wirePreview.moveTo(first.x, first.y);
    for (const point of rest) this.wirePreview.lineTo(point.x, point.y);
    this.wirePreview.stroke({ width: 2, color: 0xf59e0b, alpha: 0.85 });
  }

  private renderCircuit(): void {
    const circuit = this.store.getCircuit();
    const hitScene = buildHitTestScene(circuit, this.registry, this.geometry, this.cellSize);

    for (const child of this.wiresLayer.removeChildren()) child.destroy();
    const wires = new Graphics();

    let wireColors: number[] | undefined;
    if (this.netColoring) {
      const values = Object.values(this.nodeVoltages);
      if (values.length > 0) {
        const netOf = new Map<string, string>();
        for (const net of extractNetlist(circuit, this.registry).nets) {
          for (const pin of net.pins) netOf.set(`pin:${pin.partId}:${pin.pinId}`, net.name);
          for (const hole of net.holes) netOf.set(`hole:${hole}`, net.name);
        }
        const min = Math.min(...values);
        const max = Math.max(...values);
        wireColors = circuit.wires.map((wire) => {
          const key =
            wire.from.kind === 'pin'
              ? `pin:${wire.from.partId}:${wire.from.pinId}`
              : `hole:${wire.from.holeId}`;
          const name = netOf.get(key);
          const voltage = name !== undefined ? this.nodeVoltages[name] : undefined;
          return voltage === undefined ? 0x22c55e : voltageToColor(voltage, min, max);
        });
      }
    }

    hitScene.wires.forEach((wire, index) => {
      const [first, ...rest] = wire.points;
      if (!first) return;
      const color =
        wireColors?.[index] ??
        Number.parseInt((circuit.wires[index]?.color ?? '#22c55e').slice(1), 16);
      wires.moveTo(first.x, first.y);
      for (const point of rest) wires.lineTo(point.x, point.y);
      wires.stroke({ width: 2, color, alpha: 0.9 });
    });
    this.wiresLayer.addChild(wires);

    for (const child of this.partsLayer.removeChildren()) child.destroy();
    for (const part of circuit.parts) {
      const manifest = this.registry.get(part.partId);
      if (!manifest) continue;
      this.partsLayer.addChild(this.createSprite(part.id, manifest, part.position, part.rotation));
    }
  }

  setSimulation(
    snapshot: {
      nodeVoltages?: Record<string, number>;
      leds: { partId: string; current: number; burnedOut: boolean }[];
    } | null,
  ): void {
    this.ledById = new Map((snapshot?.leds ?? []).map((led) => [led.partId, led]));
    this.nodeVoltages = snapshot?.nodeVoltages ?? {};
    this.renderCircuit();
  }

  setNetColoring(enabled: boolean): void {
    this.netColoring = enabled;
    this.renderCircuit();
  }

  setHighlight(partIds: readonly string[]): void {
    this.highlightGraphics.clear();
    for (const partId of partIds) {
      const part = this.store.getCircuit().parts.find((candidate) => candidate.id === partId);
      const manifest = part ? this.registry.get(part.partId) : undefined;
      if (!part || !manifest) continue;
      const layout = layoutPart(manifest, part.position, part.rotation);
      const pad = this.cellSize * 0.4;
      this.highlightGraphics
        .rect(
          layout.bounds.minX * this.cellSize - pad,
          layout.bounds.minY * this.cellSize - pad,
          Math.max(layout.bounds.width * this.cellSize, 1) + pad * 2,
          Math.max(layout.bounds.height * this.cellSize, 1) + pad * 2,
        )
        .stroke({ width: 3, color: 0xef4444, alpha: 1 });
    }
  }

  private createSprite(partId: string, manifest: PartManifest, position: Vec2, rotation: Rotation): Sprite {
    const layout = layoutPart(manifest, position, rotation);
    const width = Math.max(1, layout.bounds.width) * this.cellSize;
    const height = Math.max(1, layout.bounds.height) * this.cellSize;

    const texture = this.cache.get(`part:${manifest.id}:${rotation}`, () =>
      createPartTexture(
        this.renderer,
        manifest,
        Math.round(width),
        Math.round(height),
        this.renderer.resolution,
      ),
    );

    const sprite = new Sprite(texture);
    sprite.position.set(layout.bounds.minX * this.cellSize, layout.bounds.minY * this.cellSize);

    const led = this.ledById.get(partId);
    if (led) {
      const glow = ledGlow(led.current);
      sprite.tint = ledTint(glow, led.burnedOut);
      sprite.alpha = led.burnedOut ? 0.5 : 0.5 + 0.5 * glow;
    }
    return sprite;
  }
}
