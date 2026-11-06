import type { BoardGeometry, DocumentStore, PartRegistry, Rotation, Vec2 } from '@vircuitcad/core';

import type { HitTester } from '../hit/scene-index';
import type { Scene } from '../render/scene';
import {
  type HoleLookup,
  boardGridBounds,
  isPlacementValid,
  partGridBounds,
  snapPartPosition,
} from './placement';

export type ToolName = 'select' | 'place';

export type ToolControllerDeps = {
  store: DocumentStore;
  registry: PartRegistry;
  geometry: BoardGeometry;
  cellSize: number;
  scene: Scene;
  hitTest: () => HitTester;
};

export class ToolController {
  private tool: ToolName = 'select';
  private placingPartId: string | undefined = undefined;
  private selectedPartId: string | undefined = undefined;
  private drag: { partId: string; grabOffset: Vec2 } | undefined = undefined;
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

  setTool(tool: ToolName, partId?: string): void {
    this.tool = tool;
    this.placingPartId = tool === 'place' ? partId : undefined;
    this.drag = undefined;
    this.deps.scene.setPreview(null);
  }

  pointerDown(gridPoint: Vec2): void {
    if (this.tool === 'place') {
      this.commitPlacement(gridPoint);
      return;
    }

    const hit = this.deps
      .hitTest()
      .hitTest(this.toWorld(gridPoint), this.deps.cellSize * 0.6, ['part']);
    if (hit && hit.kind === 'part') {
      this.selectedPartId = hit.partId;
      this.deps.scene.setSelection(hit.partId);
      const part = this.deps.store.asPart(hit.partId);
      if (part) {
        this.drag = {
          partId: hit.partId,
          grabOffset: { x: gridPoint.x - part.position.x, y: gridPoint.y - part.position.y },
        };
      }
    } else {
      this.selectedPartId = undefined;
      this.deps.scene.setSelection(undefined);
    }
  }

  pointerMove(gridPoint: Vec2): void {
    if (this.tool === 'place' && this.placingPartId) {
      this.updatePreview(gridPoint);
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
    const selected = this.selectedPartId;
    if (!selected) return false;
    const part = this.deps.store.asPart(selected);
    if (!part) return false;

    if (key === 'r' || key === 'R') {
      const rotation = ((part.rotation + 90) % 360) as Rotation;
      return this.deps.store.rotatePart(selected, rotation);
    }
    if (key === 'Delete' || key === 'Backspace') {
      this.selectedPartId = undefined;
      this.deps.scene.setSelection(undefined);
      return this.deps.store.deletePart(selected);
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
