import 'pixi.js/unsafe-eval';

import { Application, Container, Graphics } from 'pixi.js';

import type { DocumentStore, PartRegistry } from '@vircuitcad/core';

import { Scene } from './render/scene';
import { type Viewport, panBy, screenToWorld, zoomAt } from './viewport';

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
  private viewport: Viewport = { scale: 1, x: 0, y: 0 };
  private cleanup: Array<() => void> = [];
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

    const world = new Container();
    app.stage.addChild(world);
    this.world = world;
    this.grid = new Graphics();
    world.addChild(this.grid);

    if (this.store && this.registry) {
      this.scene = new Scene(app.renderer, this.store, this.registry, { cellSize: this.cellSize });
      world.addChild(this.scene.root);
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

  private applyViewport(): void {
    if (!this.world) return;
    this.world.scale.set(this.viewport.scale);
    this.world.position.set(this.viewport.x, this.viewport.y);
    this.drawGrid();
  }

  private drawGrid(): void {
    const grid = this.grid;
    const app = this.app;
    if (!grid || !app) return;
    grid.clear();

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
    let lastX = 0;
    let lastY = 0;
    let spaceDown = false;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 1 && !spaceDown) return;
      panning = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (!panning) return;
      this.panByScreen(event.clientX - lastX, event.clientY - lastY);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (!panning) return;
      panning = false;
      canvas.style.cursor = spaceDown ? 'grab' : 'default';
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      this.zoomBy(factor, event.clientX - rect.left, event.clientY - rect.top);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== 'Space') return;
      spaceDown = true;
      canvas.style.cursor = 'grab';
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code !== 'Space') return;
      spaceDown = false;
      if (!panning) canvas.style.cursor = 'default';
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this.cleanup.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    });
  }
}
