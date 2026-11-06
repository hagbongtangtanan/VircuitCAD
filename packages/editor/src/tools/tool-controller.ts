import {
  DEFAULT_WIRE_COLOR,
  type BoardGeometry,
  type DocumentStore,
  type Endpoint,
  type PartRegistry,
  type Rotation,
  type Vec2,
} from '@vircuitcad/core';

import type { Hit, HitTester } from '../hit/scene-index';
import type { Scene } from '../render/scene';
import {
  type HoleLookup,
  boardGridBounds,
  isPlacementValid,
  partGridBounds,
  snapPartPosition,
} from './placement';

export type ToolName = 'select' | 'place' | 'wire';

export type ToolControllerDeps = {
  store: DocumentStore;
  registry: PartRegistry;
  geometry: BoardGeometry;
  cellSize: number;
  scene: Scene;
  hitTest: () => HitTester;
};

type PendingWire = { from: Endpoint; fromWorld: Vec2; waypoints: Vec2[] };

function endpointKey(endpoint: Endpoint): string {
  return endpoint.kind === 'pin'
    ? `pin:${endpoint.partId}:${endpoint.pinId}`
    : `hole:${endpoint.holeId}`;
}

function endpointOf(hit: Hit): Endpoint | undefined {
  if (hit.kind === 'pin') return { kind: 'pin', partId: hit.partId, pinId: hit.pinId };
  if (hit.kind === 'hole') return { kind: 'hole', holeId: hit.holeId };
  return undefined;
}

export class ToolController {
  private tool: ToolName = 'select';
  private placingPartId: string | undefined = undefined;
  private selectedPartId: string | undefined = undefined;
  private selectedWireId: string | undefined = undefined;
  private drag: { partId: string; grabOffset: Vec2 } | undefined = undefined;
  private pending: PendingWire | undefined = undefined;
  private wireColor = DEFAULT_WIRE_COLOR;
  private readonly board;

  constructor(private readonly deps: ToolControllerDeps) {
    this.board = boardGridBounds(deps.geometry);
  }

  getTool(): ToolName {
    return this.tool;
  }

  getSelectedPartId(): string | undefined {
    return this.selectedPartId;
  }

  getSelectedWireId(): string | undefined {
    return this.selectedWireId;
  }

  getWireColor(): string {
    return this.wireColor;
  }

  setWireColor(color: string): void {
    this.wireColor = color;
  }

  setTool(tool: ToolName, partId?: string): void {
    this.tool = tool;
    this.placingPartId = tool === 'place' ? partId : undefined;
    this.drag = undefined;
    this.cancelWire();
    this.deps.scene.setPreview(null);
  }

  pointerDown(gridPoint: Vec2): void {
    if (this.tool === 'place') {
      this.commitPlacement(gridPoint);
      return;
    }
    if (this.tool === 'wire') {
      this.wirePointerDown(gridPoint);
      return;
    }
    this.selectPointerDown(gridPoint);
  }

  pointerMove(gridPoint: Vec2): void {
    if (this.tool === 'place' && this.placingPartId) {
      this.updatePreview(gridPoint);
      return;
    }
    if (this.tool === 'wire' && this.pending) {
      this.updateWirePreview(gridPoint);
      return;
    }
    if (!this.drag) return;

    const part = this.deps.store.asPart(this.drag.partId);
    const manifest = this.manifestOf(this.drag.partId);
    if (!part || !manifest) return;

    const desired = {
      x: gridPoint.x - this.drag.grabOffset.x,
      y: gridPoint.y - this.drag.grabOffset.y,
    };
    const snapped = snapPartPosition(manifest, part.rotation, desired, this.holeLookup());
    this.deps.store.movePart(this.drag.partId, snapped.position);
  }

  pointerUp(): void {
    this.drag = undefined;
  }

  keyDown(key: string): boolean {
    if (key === 'Delete' || key === 'Backspace') {
      if (this.selectedWireId) {
        const wireId = this.selectedWireId;
        this.selectedWireId = undefined;
        return this.deps.store.deleteWire(wireId);
      }
      if (this.selectedPartId) {
        const partId = this.selectedPartId;
        this.selectedPartId = undefined;
        this.deps.scene.setSelection(undefined);
        return this.deps.store.deletePart(partId);
      }
      return false;
    }

    const selected = this.selectedPartId;
    if (!selected) return false;
    const part = this.deps.store.asPart(selected);
    if (!part) return false;

    if (key === 'r' || key === 'R') {
      const rotation = ((part.rotation + 90) % 360) as Rotation;
      return this.deps.store.rotatePart(selected, rotation);
    }
    if (key === 'd' || key === 'D') {
      this.duplicate(selected);
      return true;
    }
    return false;
  }

  duplicate(partId: string): string | undefined {
    const part = this.deps.store.asPart(partId);
    if (!part) return undefined;
    const id = this.deps.store.addPart(part.partId, {
      position: { x: part.position.x + 1, y: part.position.y },
      rotation: part.rotation,
      params: { ...part.params },
    });
    this.selectedPartId = id;
    this.deps.scene.setSelection(id);
    return id;
  }

  private selectPointerDown(gridPoint: Vec2): void {
    const hit = this.deps
      .hitTest()
      .hitTest(this.toWorld(gridPoint), this.deps.cellSize * 0.6, ['part', 'wire']);

    if (hit?.kind === 'part') {
      this.selectedPartId = hit.partId;
      this.selectedWireId = undefined;
      this.deps.scene.setSelection(hit.partId);
      const part = this.deps.store.asPart(hit.partId);
      if (part) {
        this.drag = {
          partId: hit.partId,
          grabOffset: { x: gridPoint.x - part.position.x, y: gridPoint.y - part.position.y },
        };
      }
      return;
    }

    if (hit?.kind === 'wire') {
      this.selectedWireId = hit.wireId;
      this.selectedPartId = undefined;
      this.deps.scene.setSelection(undefined);
      return;
    }

    this.selectedPartId = undefined;
    this.selectedWireId = undefined;
    this.deps.scene.setSelection(undefined);
  }

  private wirePointerDown(gridPoint: Vec2): void {
    const hit = this.deps
      .hitTest()
      .hitTest(this.toWorld(gridPoint), this.deps.cellSize * 0.6, ['pin', 'hole']);
    const endpoint = hit ? endpointOf(hit) : undefined;

    if (this.pending) {
      if (endpoint && endpointKey(endpoint) !== endpointKey(this.pending.from)) {
        this.deps.store.addWire(this.pending.from, endpoint, {
          waypoints: this.pending.waypoints,
          color: this.wireColor,
        });
        this.cancelWire();
      } else if (!endpoint) {
        this.pending.waypoints.push({ x: Math.round(gridPoint.x), y: Math.round(gridPoint.y) });
        this.updateWirePreview(gridPoint);
      }
      return;
    }

    if (endpoint && hit && (hit.kind === 'pin' || hit.kind === 'hole')) {
      this.pending = { from: endpoint, fromWorld: hit.position, waypoints: [] };
      this.updateWirePreview(gridPoint);
    }
  }

  private updateWirePreview(gridPoint: Vec2): void {
    if (!this.pending) {
      this.deps.scene.setWirePreview(null);
      return;
    }
    const points: Vec2[] = [
      this.pending.fromWorld,
      ...this.pending.waypoints.map((point) => this.toWorld(point)),
      this.toWorld(gridPoint),
    ];
    this.deps.scene.setWirePreview(points);
  }

  private cancelWire(): void {
    this.pending = undefined;
    this.deps.scene.setWirePreview(null);
  }

  private commitPlacement(gridPoint: Vec2): void {
    const manifest = this.placingManifest();
    if (!manifest) return;

    const snapped = snapPartPosition(manifest, 0, gridPoint, this.holeLookup());
    if (!isPlacementValid(manifest, 0, snapped.position, this.board, this.occupied())) {
      this.deps.scene.setPreview({ manifest, position: snapped.position, rotation: 0, valid: false });
      return;
    }
    const id = this.deps.store.addPart(manifest.id, { position: snapped.position, rotation: 0 });
    this.selectedPartId = id;
    this.deps.scene.setSelection(id);
    this.deps.scene.setPreview(null);
  }

  private updatePreview(gridPoint: Vec2): void {
    const manifest = this.placingManifest();
    if (!manifest) return;
    const snapped = snapPartPosition(manifest, 0, gridPoint, this.holeLookup());
    const valid = isPlacementValid(manifest, 0, snapped.position, this.board, this.occupied());
    this.deps.scene.setPreview({ manifest, position: snapped.position, rotation: 0, valid });
  }

  private placingManifest() {
    return this.placingPartId ? this.deps.registry.get(this.placingPartId) : undefined;
  }

  private manifestOf(partId: string) {
    const part = this.deps.store.asPart(partId);
    return part ? this.deps.registry.get(part.partId) : undefined;
  }

  private occupied(): ReturnType<typeof partGridBounds>[] {
    const registry = this.deps.registry;
    return this.deps.store
      .getCircuit()
      .parts.flatMap((part) => {
        const manifest = registry.get(part.partId);
        return manifest ? [partGridBounds(manifest, part.rotation, part.position)] : [];
      });
  }

  private holeLookup(): HoleLookup {
    const tester = this.deps.hitTest();
    const cellSize = this.deps.cellSize;
    return {
      nearest: (from, tolerance) => {
        const hit = tester.nearest(
          { x: from.x * cellSize, y: from.y * cellSize },
          tolerance * cellSize,
          ['hole'],
        );
        return hit && hit.kind === 'hole'
          ? { x: hit.position.x / cellSize, y: hit.position.y / cellSize }
          : null;
      },
    };
  }

  private toWorld(gridPoint: Vec2): Vec2 {
    return { x: gridPoint.x * this.deps.cellSize, y: gridPoint.y * this.deps.cellSize };
  }
}
