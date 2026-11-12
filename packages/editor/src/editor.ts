import 'pixi.js/unsafe-eval';

import { Application, Container, Graphics } from 'pixi.js';

import { extractNetlist, type DocumentStore, type PartRegistry, type Vec2 } from '@vircuitcad/core';

import { HitTester, buildHitTestScene } from './hit/scene-index';
import { Scene } from './render/scene';
import { ToolController, type ToolName } from './tools/tool-controller';
import { clampScale, type Viewport, panBy, screenToWorld, zoomAt } from './viewport';

export type PinHoverInfo = {
  partId: string;
  pinId: string;
  pinName: string;
  netName: string | undefined;
  screen: { x: number; y: number };
};

export type EditorOptions = {
  background?: number;
  gridSize?: number;
  minGridScreenPx?: number;
  cellSize?: number;
  store?: DocumentStore;
  registry?: PartRegistry;
};

export class Editor {
  private app: Application | undefined = undefined;
  private world: Container | undefined = undefined;
  private grid: Graphics | undefined = undefined;
  private scene: Scene | undefined = undefined;
  private hitTester: HitTester | undefined = undefined;
  private controller: ToolController | undefined = undefined;
  private viewport: Viewport = { scale: 1, x: 0, y: 0 };
  private cleanup: Array<() => void> = [];
  private canvas: HTMLCanvasElement | undefined = undefined;
  private gridVisible = true;
  private hoverPinKey: string | undefined = undefined;
  private readonly viewportListeners = new Set<() => void>();
  private readonly hoverListeners = new Set<(info: PinHoverInfo | null) => void>();
  private readonly background: number;
  private readonly gridSize: number;
  private readonly minGridScreenPx: number;
  private readonly cellSize: number;
  private readonly store: DocumentStore | undefined;
  private readonly registry: PartRegistry | undefined;

  constructor(options: EditorOptions = {}) {
    this.background = options.background ?? 0x0f172a;
    this.gridSize = options.gridSize ?? 20;
    this.minGridScreenPx = options.minGridScreenPx ?? 6;
    this.cellSize = options.cellSize ?? this.gridSize;
    this.store = options.store;
    this.registry = options.registry;
  }

  async mount(element: HTMLElement): Promise<void> {
    if (this.app) throw new Error('Editor is already mounted');

    const app = new Application();
    await app.init({
      background: this.background,
      resizeTo: element,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    element.appendChild(app.canvas);
    this.app = app;
    this.canvas = app.canvas;

    const world = new Container();
    app.stage.addChild(world);
    this.world = world;
    this.grid = new Graphics();
    world.addChild(this.grid);

    if (this.store && this.registry) {
      const scene = new Scene(app.renderer, this.store, this.registry, { cellSize: this.cellSize });
      this.scene = scene;
      world.addChild(scene.root);

      this.hitTester = this.buildIndex();
      this.controller = new ToolController({
        store: this.store,
        registry: this.registry,
        geometry: scene.getGeometry(),
        cellSize: this.cellSize,
        scene,
        hitTest: () => this.ensureIndex(),
      });
      this.cleanup.push(
        this.store.onChange(() => {
          this.hitTester = this.buildIndex();
        }),
      );
      this.cleanup.push(this.controller.onStateChange(() => this.applyCursor()));
      this.applyCursor();
    }

    this.applyViewport();
    this.attachInteractions(app.canvas, element);

    const observer = new ResizeObserver(() => this.applyViewport());
    observer.observe(element);
    this.cleanup.push(() => observer.disconnect());
  }

  unmount(): void {
    for (const dispose of this.cleanup.splice(0)) dispose();
    this.scene?.destroy();
    this.scene = undefined;
    this.controller = undefined;
    this.hitTester = undefined;
    this.app?.destroy(true, { children: true });
    this.app = undefined;
    this.world = undefined;
    this.grid = undefined;
  }

  isMounted(): boolean {
    return this.app !== undefined;
  }

  getScene(): Scene | undefined {
    return this.scene;
  }

  getToolController(): ToolController | undefined {
    return this.controller;
  }

  setNetColoring(enabled: boolean): void {
    this.scene?.setNetColoring(enabled);
  }

  onViewportChange(listener: () => void): () => void {
    this.viewportListeners.add(listener);
    return () => this.viewportListeners.delete(listener);
  }

  getViewport(): Viewport {
    return { ...this.viewport };
  }

  setViewport(viewport: Viewport): void {
    this.viewport = { ...viewport };
    this.applyViewport();
  }

  zoomBy(factor: number, screenX: number, screenY: number): void {
    this.viewport = zoomAt(this.viewport, factor, screenX, screenY);
    this.applyViewport();
  }

  panByScreen(dx: number, dy: number): void {
    this.viewport = panBy(this.viewport, dx, dy);
    this.applyViewport();
  }

  /** Zoom about the centre of the viewport (on-canvas +/- controls). */
  zoomByCentre(factor: number): void {
    if (!this.app) return;
    this.zoomBy(factor, this.app.screen.width / 2, this.app.screen.height / 2);
  }

  /** Reset to 100% about the centre. */
  resetZoom(): void {
    if (!this.app) return;
    this.zoomBy(1 / this.viewport.scale, this.app.screen.width / 2, this.app.screen.height / 2);
  }

  /** Fit the whole board in the viewport. */
  fitToContent(): void {
    if (!this.app || !this.scene) return;
    const geometry = this.scene.getGeometry();
    const xs = geometry.holes.map((hole) => hole.position.x);
    const ys = geometry.holes.map((hole) => hole.position.y);
    const margin = 2;
    const minX = (Math.min(...xs) - margin) * this.cellSize;
    const minY = (Math.min(...ys) - margin) * this.cellSize;
    const worldWidth = (Math.max(...xs) - Math.min(...xs) + margin * 2) * this.cellSize;
    const worldHeight = (Math.max(...ys) - Math.min(...ys) + margin * 2) * this.cellSize;
    const viewWidth = this.app.screen.width;
    const viewHeight = this.app.screen.height;
    const scale = clampScale(Math.min(viewWidth / worldWidth, viewHeight / worldHeight));
    this.viewport = {
      scale,
      x: (viewWidth - worldWidth * scale) / 2 - minX * scale,
      y: (viewHeight - worldHeight * scale) / 2 - minY * scale,
    };
    this.applyViewport();
  }

  setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
    this.drawGrid();
  }

  isGridVisible(): boolean {
    return this.gridVisible;
  }

  onHoverPin(listener: (info: PinHoverInfo | null) => void): () => void {
    this.hoverListeners.add(listener);
    return () => this.hoverListeners.delete(listener);
  }

  private applyCursor(): void {
    if (!this.canvas) return;
    const tool: ToolName = this.controller?.getTool() ?? 'select';
    this.canvas.style.cursor = tool === 'wire' ? 'crosshair' : tool === 'place' ? 'copy' : 'default';
  }

  private buildIndex(): HitTester {
    const store = this.store;
    const registry = this.registry;
    const scene = this.scene;
    if (!store || !registry || !scene) throw new Error('Editor is not ready');
    return new HitTester(
      buildHitTestScene(store.getCircuit(), registry, scene.getGeometry(), this.cellSize),
    );
  }

  private ensureIndex(): HitTester {
    if (!this.hitTester) this.hitTester = this.buildIndex();
    return this.hitTester;
  }

  private toGrid(clientX: number, clientY: number, element: HTMLElement): Vec2 {
    const rect = element.getBoundingClientRect();
    const world = screenToWorld(this.viewport, clientX - rect.left, clientY - rect.top);
    return { x: world.x / this.cellSize, y: world.y / this.cellSize };
  }

  private applyViewport(): void {
    if (!this.world) return;
    this.world.scale.set(this.viewport.scale);
    this.world.position.set(this.viewport.x, this.viewport.y);
    this.drawGrid();
    this.scene?.setZoom(this.viewport.scale);
    for (const listener of this.viewportListeners) listener();
  }

  private emitHoverPin(info: PinHoverInfo | null): void {
    for (const listener of this.hoverListeners) listener(info);
  }

  private updateHover(clientX: number, clientY: number, element: HTMLElement): void {
    const scene = this.scene;
    if (!scene) return;
    const grid = this.toGrid(clientX, clientY, element);
    const gx = Math.round(grid.x);
    const gy = Math.round(grid.y);
    const near = Math.abs(grid.x - gx) < 0.45 && Math.abs(grid.y - gy) < 0.45;
    scene.setHoverHole(near ? scene.getGeometry().holeByPosition(gx, gy)?.id : undefined);

    const world = { x: grid.x * this.cellSize, y: grid.y * this.cellSize };
    const pinHit = this.ensureIndex().nearest(world, this.cellSize * 0.5, ['pin']);
    const key = pinHit?.kind === 'pin' ? `${pinHit.partId}:${pinHit.pinId}` : undefined;
    if (key === this.hoverPinKey) return;
    this.hoverPinKey = key;

    if (pinHit?.kind === 'pin') {
      scene.setHoverPin(pinHit.partId, pinHit.pinId);
      this.emitHoverPin({
        partId: pinHit.partId,
        pinId: pinHit.pinId,
        pinName: pinHit.pinName,
        netName: this.netNameOfPin(pinHit.partId, pinHit.pinId),
        screen: { x: clientX, y: clientY },
      });
    } else {
      scene.setHoverPin(undefined);
      this.emitHoverPin(null);
    }
  }

  private netNameOfPin(partId: string, pinId: string): string | undefined {
    const store = this.store;
    const registry = this.registry;
    if (!store || !registry) return undefined;
    for (const net of extractNetlist(store.getCircuit(), registry).nets) {
      if (net.pins.some((pin) => pin.partId === partId && pin.pinId === pinId)) return net.name;
    }
    return undefined;
  }

  private drawGrid(): void {
    const grid = this.grid;
    const app = this.app;
    if (!grid || !app) return;
    grid.clear();

    if (!this.gridVisible) return;
    const spacing = this.gridSize * this.viewport.scale;
    if (spacing < this.minGridScreenPx) return;

    const width = app.screen.width;
    const height = app.screen.height;
    const topLeft = screenToWorld(this.viewport, 0, 0);
    const bottomRight = screenToWorld(this.viewport, width, height);

    const startX = Math.floor(topLeft.x / this.gridSize) * this.gridSize;
    const startY = Math.floor(topLeft.y / this.gridSize) * this.gridSize;

    for (let x = startX; x <= bottomRight.x; x += this.gridSize) {
      grid.moveTo(x, topLeft.y);
      grid.lineTo(x, bottomRight.y);
    }
    for (let y = startY; y <= bottomRight.y; y += this.gridSize) {
      grid.moveTo(topLeft.x, y);
      grid.lineTo(bottomRight.x, y);
    }
    grid.stroke({ width: 1, color: 0x1e293b, alpha: 1 });
  }

  private attachInteractions(canvas: HTMLCanvasElement, element: HTMLElement): void {
    let panning = false;
    let toolDragging = false;
    let lastX = 0;
    let lastY = 0;
    let spaceDown = false;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button === 1 || spaceDown) {
        panning = true;
        lastX = event.clientX;
        lastY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
        return;
      }
      if (event.button === 0 && this.controller) {
        toolDragging = true;
        canvas.setPointerCapture(event.pointerId);
        this.controller.pointerDown(this.toGrid(event.clientX, event.clientY, element));
      }
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (panning) {
        this.panByScreen(event.clientX - lastX, event.clientY - lastY);
        lastX = event.clientX;
        lastY = event.clientY;
        return;
      }
      this.updateHover(event.clientX, event.clientY, element);
      if (this.controller && (toolDragging || this.controller.getTool() === 'place')) {
        this.controller.pointerMove(this.toGrid(event.clientX, event.clientY, element));
      }
    };
    const onPointerLeave = (): void => {
      this.scene?.setHoverHole(undefined);
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (panning) {
        panning = false;
        canvas.style.cursor = spaceDown ? 'grab' : 'default';
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
      }
      if (toolDragging) {
        toolDragging = false;
        this.controller?.pointerUp();
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      }
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      this.zoomBy(factor, event.clientX - rect.left, event.clientY - rect.top);
    };
    const isTypingTarget = (target: EventTarget | null): boolean => {
      const node = target as HTMLElement | null;
      if (!node) return false;
      return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space') {
        spaceDown = true;
        canvas.style.cursor = 'grab';
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (this.controller?.keyDown(event.key)) event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code !== 'Space') return;
      spaceDown = false;
      if (!panning) canvas.style.cursor = 'default';
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this.cleanup.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    });
  }
}
