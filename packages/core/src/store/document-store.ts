import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer';
import { createStore } from 'zustand/vanilla';

import {
  type Circuit,
  type Endpoint,
  type ParamValue,
  type PartInstance,
  type Rotation,
  type Vec2,
  createPartInstance,
  createWire,
} from '../model/circuit';

enablePatches();

export type DocumentState = { circuit: Circuit };

export type HistoryEntry = { label: string; patches: Patch[]; inverse: Patch[] };

export type ChangeEvent = { label: string; circuit: Circuit };

export type AddPartOptions = {
  id?: string;
  position?: Vec2;
  rotation?: Rotation;
  params?: Record<string, ParamValue>;
};

export type AddWireOptions = { id?: string; waypoints?: Vec2[]; color?: string };

function endpointKey(endpoint: Endpoint): string {
  return endpoint.kind === 'pin'
    ? `pin:${endpoint.partId}:${endpoint.pinId}`
    : `hole:${endpoint.holeId}`;
}

function wireMatches(wire: { from: Endpoint; to: Endpoint }, from: Endpoint, to: Endpoint): boolean {
  const fromKey = endpointKey(from);
  const toKey = endpointKey(to);
  const wireFrom = endpointKey(wire.from);
  const wireTo = endpointKey(wire.to);
  return (wireFrom === fromKey && wireTo === toKey) || (wireFrom === toKey && wireTo === fromKey);
}

function partOf(endpoint: Endpoint): string | undefined {
  return endpoint.kind === 'pin' ? endpoint.partId : undefined;
}

export class DocumentStore {
  private readonly store;
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];
  private readonly listeners = new Set<(event: ChangeEvent) => void>();

  constructor(circuit: Circuit) {
    this.store = createStore<DocumentState>(() => ({ circuit }));
  }

  getCircuit(): Circuit {
    return this.store.getState().circuit;
  }

  historySize(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length };
  }

  onChange(listener: (event: ChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replace(circuit: Circuit): void {
    this.store.setState({ circuit });
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit('load');
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private emit(label: string): void {
    const event: ChangeEvent = { label, circuit: this.getCircuit() };
    for (const listener of this.listeners) listener(event);
  }

  private mutate(label: string, recipe: (draft: Draft<Circuit>) => void): boolean {
    const [next, patches, inverse] = produceWithPatches(this.getCircuit(), recipe);
    if (patches.length === 0) return false;

    this.store.setState({ circuit: next });
    this.undoStack.push({ label, patches, inverse });
    this.redoStack.length = 0;
    this.emit(label);
    return true;
  }

  transaction(label: string, recipe: (draft: Draft<Circuit>) => void): boolean {
    return this.mutate(label, recipe);
  }

  addPart(partId: string, options: AddPartOptions = {}): string {
    const instance = createPartInstance(partId, options);
    this.mutate('addPart', (draft) => {
      if (draft.parts.some((part) => part.id === instance.id)) return;
      draft.parts.push(instance);
    });
    return instance.id;
  }

  movePart(partId: string, position: Vec2): boolean {
    return this.mutate('movePart', (draft) => {
      const part = draft.parts.find((candidate) => candidate.id === partId);
      if (part) part.position = position;
    });
  }

  rotatePart(partId: string, rotation: Rotation): boolean {
    return this.mutate('rotatePart', (draft) => {
      const part = draft.parts.find((candidate) => candidate.id === partId);
      if (part) part.rotation = rotation;
    });
  }

  setParam(partId: string, key: string, value: ParamValue): boolean {
    return this.mutate('setParam', (draft) => {
      const part = draft.parts.find((candidate) => candidate.id === partId);
      if (part) part.params[key] = value;
    });
  }

  deletePart(partId: string): boolean {
    return this.mutate('deletePart', (draft) => {
      const index = draft.parts.findIndex((candidate) => candidate.id === partId);
      if (index === -1) return;
      draft.parts.splice(index, 1);
      draft.wires = draft.wires.filter(
        (wire) => partOf(wire.from) !== partId && partOf(wire.to) !== partId,
      );
    });
  }

  addWire(from: Endpoint, to: Endpoint, options: AddWireOptions = {}): string | undefined {
    if (endpointKey(from) === endpointKey(to)) return undefined;

    const wire = createWire(from, to, options);
    const added = this.mutate('addWire', (draft) => {
      if (draft.wires.some((existing) => wireMatches(existing, from, to))) return;
      draft.wires.push(wire);
    });
    return added ? wire.id : undefined;
  }

  deleteWire(wireId: string): boolean {
    return this.mutate('deleteWire', (draft) => {
      const index = draft.wires.findIndex((candidate) => candidate.id === wireId);
      if (index !== -1) draft.wires.splice(index, 1);
    });
  }

  moveWireEndpoint(wireId: string, end: 'from' | 'to', endpoint: Endpoint): boolean {
    return this.mutate('moveWireEndpoint', (draft) => {
      const wire = draft.wires.find((candidate) => candidate.id === wireId);
      if (wire) wire[end] = endpoint;
    });
  }

  setWireColor(wireId: string, color: string): boolean {
    return this.mutate('setWireColor', (draft) => {
      const wire = draft.wires.find((candidate) => candidate.id === wireId);
      if (wire) wire.color = color;
    });
  }

  asPart(id: string): PartInstance | undefined {
    return this.getCircuit().parts.find((part) => part.id === id);
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.store.setState({ circuit: applyPatches(this.getCircuit(), entry.inverse) });
    this.redoStack.push(entry);
    this.emit('undo');
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this.store.setState({ circuit: applyPatches(this.getCircuit(), entry.patches) });
    this.undoStack.push(entry);
    this.emit('redo');
    return true;
  }
}
