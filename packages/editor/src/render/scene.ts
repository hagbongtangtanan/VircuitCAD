import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

import {
  extractNetlist,
  generateBoardGeometry,
  rotateGridVector,
  type BoardGeometry,
  type DocumentStore,
  type Hole,
  type PartManifest,
  type PartRegistry,
  type Rotation,
  type Vec2,
} from '@vircuitcad/core';
import {
  ART_PADDING,
  BOARD_HOLE,
  buildBreadboardArt,
  boardHoleCircles,
  partFootprint,
} from '@vircuitcad/parts/art';

import { buildHitTestScene } from '../hit/scene-index';
import { createStaticText, drawPrimitives } from './art-graphics';
import { layoutPart } from './part-layout';
import { createPartTexture, createPlaceholderPartTexture } from './part-textures';
import { partTextureKey } from './texture-key';
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
  private readonly boardLabelLayer = new Container();
  private readonly hoverLayer = new Container();
  private readonly wiresLayer = new Container();
  private readonly partsLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly hoverGraphics = new Graphics();
  private readonly selectionGraphics = new Graphics();
  private readonly highlightGraphics = new Graphics();
  private readonly hoverPinGraphics = new Graphics();
  private readonly snapGraphics = new Graphics();
  private readonly wirePreview = new Graphics();
  private labelsVisible = false;
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
    this.root.addChild(
      this.boardLayer,
      this.hoverLayer,
      this.wiresLayer,
      this.partsLayer,
      this.overlayLayer,
    );
    this.boardLayer.addChild(this.boardLabelLayer);
    this.boardLabelLayer.visible = false;
    this.hoverLayer.addChild(this.hoverGraphics);
    this.overlayLayer.addChild(
      this.snapGraphics,
      this.selectionGraphics,
      this.highlightGraphics,
      this.hoverPinGraphics,
      this.wirePreview,
    );
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
    this.snapGraphics.clear();
    if (!preview) return;

    this.snapGraphics
      .circle(
        preview.position.x * this.cellSize,
        preview.position.y * this.cellSize,
        this.cellSize * 0.4,
      )
      .stroke({ width: 2, color: preview.valid ? 0x22c55e : 0xef4444, alpha: 0.9 });

    const layout = layoutPart(preview.manifest, preview.position, preview.rotation);
    const width = Math.max(1, layout.bounds.width) * this.cellSize;
    const height = Math.max(1, layout.bounds.height) * this.cellSize;
    const color = preview.valid ? 0x22c55e : 0xef4444;
    const variant = preview.valid ? 'preview-valid' : 'preview-invalid';
    const texture = this.cache.get(
      `${partTextureKey(preview.manifest.id, variant, this.renderer.resolution)}:${preview.rotation}`,
      () =>
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
    const x = layout.bounds.minX * this.cellSize - pad;
    const y = layout.bounds.minY * this.cellSize - pad;
    const width = Math.max(layout.bounds.width * this.cellSize, 1) + pad * 2;
    const height = Math.max(layout.bounds.height * this.cellSize, 1) + pad * 2;
    this.selectionGraphics.rect(x, y, width, height).stroke({ width: 2, color: 0x38bdf8, alpha: 0.9 });

    const handle = 6;
    const corners: [number, number][] = [
      [x, y],
      [x + width, y],
      [x, y + height],
      [x + width, y + height],
    ];
    for (const [hx, hy] of corners) {
      this.selectionGraphics
        .rect(hx - handle / 2, hy - handle / 2, handle, handle)
        .fill({ color: 0x38bdf8 });
    }
  }

  private refreshHoverPin(partId: string | undefined, pinId: string | undefined): void {
    this.hoverPinGraphics.clear();
    if (!partId || !pinId) return;
    const part = this.store.getCircuit().parts.find((candidate) => candidate.id === partId);
    const manifest = part ? this.registry.get(part.partId) : undefined;
    if (!part || !manifest) return;
    const layout = layoutPart(manifest, part.position, part.rotation);
    const pin = layout.pins.find((candidate) => candidate.id === pinId);
    if (!pin) return;
    const x = pin.position.x * this.cellSize;
    const y = pin.position.y * this.cellSize;
    this.hoverPinGraphics
      .circle(x, y, this.cellSize * 0.35)
      .stroke({ width: 2, color: 0x3da5ff, alpha: 1 });
    this.hoverPinGraphics.circle(x, y, 3).fill({ color: 0x3da5ff, alpha: 0.9 });
  }

  setHoverPin(partId: string | undefined, pinId?: string): void {
    this.refreshHoverPin(partId, pinId);
  }

  private drawBoard(options: SceneOptions): void {
    const radius = options.holeRadius ?? 3;
    const holeColor =
      options.holeColor !== undefined
        ? `#${options.holeColor.toString(16).padStart(6, '0')}`
        : BOARD_HOLE;
    const art = buildBreadboardArt(this.geometry.kind);
    const graphics = new Graphics();
    drawPrimitives(graphics, art.primitives);
    drawPrimitives(graphics, boardHoleCircles(art, radius, holeColor));
    this.boardLayer.addChild(graphics);
    for (const label of art.labels) {
      if (label.kind === 'text') this.boardLabelLayer.addChild(createStaticText(label));
    }
  }

  /** Column numbers and row letters appear at zoom 100% and above. */
  setZoom(scale: number): void {
    const visible = scale >= 1;
    if (visible === this.labelsVisible) return;
    this.labelsVisible = visible;
    this.boardLabelLayer.visible = visible;
  }

  /** Highlight the 5-hole strip (or rail) under the cursor. */
  setHoverHole(holeId: string | undefined): void {
    this.hoverGraphics.clear();
    if (!holeId) return;
    const stripId = this.geometry.stripOf(holeId);
    const strip = stripId
      ? this.geometry.strips.find((candidate) => candidate.id === stripId)
      : undefined;
    if (!strip) return;
    const holes = strip.holes
      .map((id) => this.geometry.hole(id))
      .filter((hole): hole is Hole => hole !== undefined);
    if (holes.length === 0) return;
    const xs = holes.map((hole) => hole.position.x);
    const ys = holes.map((hole) => hole.position.y);
    const pad = this.cellSize * 0.45;
    const minX = Math.min(...xs) * this.cellSize;
    const minY = Math.min(...ys) * this.cellSize;
    this.hoverGraphics
      .roundRect(
        minX - pad,
        minY - pad,
        (Math.max(...xs) - Math.min(...xs)) * this.cellSize + pad * 2,
        (Math.max(...ys) - Math.min(...ys)) * this.cellSize + pad * 2,
        4,
      )
      .fill({ color: 0x3da5ff, alpha: 0.16 })
      .stroke({ width: 1, color: 0x3da5ff, alpha: 0.6 });
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
      wires.stroke({ width: 2, color, alpha: 0.9, cap: 'round', join: 'round' });
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
    const texture = this.cache.get(
      partTextureKey(manifest.id, 'default', this.renderer.resolution),
      () => createPartTexture(this.renderer, manifest, this.renderer.resolution),
    );

    const footprint = partFootprint(manifest);
    const rotatedMin = rotateGridVector({ x: footprint.minX, y: footprint.minY }, rotation);
    const rotatedPad = rotateGridVector({ x: ART_PADDING, y: ART_PADDING }, rotation);
    const sprite = new Sprite(texture);
    sprite.position.set(
      (position.x + rotatedMin.x) * this.cellSize - rotatedPad.x,
      (position.y + rotatedMin.y) * this.cellSize - rotatedPad.y,
    );
    sprite.rotation = (rotation * Math.PI) / 180;

    const led = this.ledById.get(partId);
    if (led) {
      const glow = ledGlow(led.current);
      sprite.tint = ledTint(glow, led.burnedOut);
      sprite.alpha = led.burnedOut ? 0.5 : 0.5 + 0.5 * glow;
    }
    return sprite;
  }
}
