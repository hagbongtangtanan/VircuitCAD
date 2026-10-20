import { create } from 'zustand'
import {
  circuitDocumentSchema,
  emptyCircuitDocument,
  partSchema,
  type CircuitDocument,
  type PartInstance,
  type PartType,
  type PinRef,
  type Point,
  type Rotation,
  type Wire,
} from '../../shared/circuit'
import { GRID_SIZE, snapPoint } from '../canvas/geometry'
import { definitionOf } from '../parts/definitions'
import { createHistory } from './history'

export const DEFAULT_WIRE_COLOR = '#4f9cf9'

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function duplicatePart(part: PartInstance, offset: Point): PartInstance {
  return partSchema.parse({
    ...part,
    id: createId(part.type),
    position: { x: part.position.x + offset.x, y: part.position.y + offset.y },
  })
}

export interface CircuitStore {
  document: CircuitDocument
  selectedPartIds: readonly string[]
  selectedWireId: string | null
  wireColor: string
  canUndo: boolean
  canRedo: boolean

  addPart(type: PartType, position: Point): string
  movePart(id: string, position: Point): void
  beginTransientEdit(): void
  commitTransientEdit(): void
  removeSelected(): void
  duplicateSelected(): void
  rotateSelected(): void
  setPartProp(id: string, key: string, value: string | number): void

  selectParts(ids: readonly string[], additive?: boolean): void
  selectWire(id: string | null): void
  setWireColor(color: string): void

  addWire(from: PinRef, to: PinRef): string | null
  setWireWaypoints(id: string, waypoints: readonly Point[]): void
  /** Live update during a handle drag; recorded by the transient edit. */
  dragWireWaypoints(id: string, waypoints: readonly Point[]): void

  undo(): void
  redo(): void
  replaceDocument(document: CircuitDocument): void
}

export const useCircuitStore = create<CircuitStore>()((set, get) => {
  const history = createHistory<CircuitDocument>()

  let transientBase: CircuitDocument | null = null

  function syncHistoryFlags(): void {
    set({ canUndo: history.canUndo(), canRedo: history.canRedo() })
  }

  /** Records the current document and then applies `next`. */
  function commit(next: CircuitDocument): void {
    history.push(get().document)
    transientBase = null
    set({ document: next })
    syncHistoryFlags()
  }

  return {
    document: emptyCircuitDocument(),
    selectedPartIds: [],
    selectedWireId: null,
    wireColor: DEFAULT_WIRE_COLOR,
    canUndo: false,
    canRedo: false,

    addPart(type: PartType, position: Point): string {
      const definition = definitionOf(type)
      const part = partSchema.parse({
        id: createId(type),
        type,
        position: snapPoint(position),
        rotation: 0,
        props: structuredClone(definition.defaultProps),
      })
      const document = get().document
      commit({ ...document, parts: [...document.parts, part] })
      set({ selectedPartIds: [part.id], selectedWireId: null })
      return part.id
    },

    movePart(id: string, position: Point): void {
      const document = get().document
      const parts = document.parts.map((part) =>
        part.id === id ? partSchema.parse({ ...part, position }) : part
      )
      // Deliberately bypasses `commit`: a drag is one history entry, recorded by
      // `beginTransientEdit` when the drag starts.
      set({ document: { ...document, parts } })
    },

    beginTransientEdit(): void {
      if (transientBase === null) {
        transientBase = get().document
      }
    },

    commitTransientEdit(): void {
      const base = transientBase
      transientBase = null
      if (base === null || base === get().document) return
      history.push(base)
      syncHistoryFlags()
    },

    removeSelected(): void {
      const { document, selectedPartIds, selectedWireId } = get()
      const doomedParts = new Set(selectedPartIds)
      if (doomedParts.size === 0 && selectedWireId === null) return

      const parts = document.parts.filter((part) => !doomedParts.has(part.id))
      const wires = document.wires.filter(
        (wire) =>
          wire.id !== selectedWireId &&
          !doomedParts.has(wire.from.partId) &&
          !doomedParts.has(wire.to.partId)
      )

      commit({ ...document, parts, wires })
      set({ selectedPartIds: [], selectedWireId: null })
    },

    duplicateSelected(): void {
      const { document, selectedPartIds } = get()
      if (selectedPartIds.length === 0) return

      const selected = new Set(selectedPartIds)
      const offset = { x: GRID_SIZE * 2, y: GRID_SIZE * 2 }
      const idMap = new Map<string, string>()
      const clones: PartInstance[] = []

      for (const part of document.parts) {
        if (!selected.has(part.id)) continue
        const clone = duplicatePart(part, offset)
        idMap.set(part.id, clone.id)
        clones.push(clone)
      }

      const clonedWires: Wire[] = []
      for (const wire of document.wires) {
        const from = idMap.get(wire.from.partId)
        const to = idMap.get(wire.to.partId)
        if (from === undefined || to === undefined) continue
        clonedWires.push({
          ...wire,
          id: createId('wire'),
          from: { partId: from, pinId: wire.from.pinId },
          to: { partId: to, pinId: wire.to.pinId },
        })
      }

      commit({
        ...document,
        parts: [...document.parts, ...clones],
        wires: [...document.wires, ...clonedWires],
      })
      set({ selectedPartIds: clones.map((clone) => clone.id), selectedWireId: null })
    },

    rotateSelected(): void {
      const { document, selectedPartIds } = get()
      if (selectedPartIds.length === 0) return

      const selected = new Set(selectedPartIds)
      const parts = document.parts.map((part) => {
        if (!selected.has(part.id)) return part
        const rotation = ((part.rotation + 90) % 360) as Rotation
        return partSchema.parse({ ...part, rotation })
      })

      commit({ ...document, parts })
    },

    setPartProp(id: string, key: string, value: string | number): void {
      const { document } = get()
      const part = document.parts.find((candidate) => candidate.id === id)
      if (part === undefined) return

      const field = definitionOf(part.type).propFields.find((candidate) => candidate.key === key)
      if (field === undefined) return

      let parsedValue: string | number
      if (field.kind === 'number') {
        const numeric = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(numeric)) return
        parsedValue = Math.min(field.max, Math.max(field.min, numeric))
      } else {
        const text = String(value)
        if (!field.options.includes(text)) return
        parsedValue = text
      }

      const candidate = partSchema.safeParse({
        ...part,
        props: { ...part.props, [key]: parsedValue },
      })
      if (!candidate.success) return

      const parts = document.parts.map((existing) =>
        existing.id === id ? candidate.data : existing
      )
      commit({ ...document, parts })
    },

    selectParts(ids: readonly string[], additive = false): void {
      const next = additive ? Array.from(new Set([...get().selectedPartIds, ...ids])) : [...ids]
      set({ selectedPartIds: next, selectedWireId: null })
    },

    selectWire(id: string | null): void {
      set({ selectedWireId: id, selectedPartIds: [] })
    },

    setWireColor(color: string): void {
      const { document, selectedWireId } = get()
      set({ wireColor: color })

      if (selectedWireId === null) return
      const wires = document.wires.map((wire) =>
        wire.id === selectedWireId ? { ...wire, color } : wire
      )
      commit({ ...document, wires })
    },

    addWire(from: PinRef, to: PinRef): string | null {
      const { document, wireColor } = get()
      if (from.partId === to.partId && from.pinId === to.pinId) return null

      const alreadyExists = document.wires.some(
        (wire) =>
          (wire.from.partId === from.partId &&
            wire.from.pinId === from.pinId &&
            wire.to.partId === to.partId &&
            wire.to.pinId === to.pinId) ||
          (wire.from.partId === to.partId &&
            wire.from.pinId === to.pinId &&
            wire.to.partId === from.partId &&
            wire.to.pinId === from.pinId)
      )
      if (alreadyExists) return null

      const wire: Wire = { id: createId('wire'), from, to, color: wireColor, waypoints: [] }
      commit({ ...document, wires: [...document.wires, wire] })
      return wire.id
    },

    setWireWaypoints(id: string, waypoints: readonly Point[]): void {
      const { document } = get()
      const wires = document.wires.map((wire) =>
        wire.id === id ? { ...wire, waypoints: [...waypoints] } : wire
      )
      commit({ ...document, wires })
    },

    dragWireWaypoints(id: string, waypoints: readonly Point[]): void {
      const { document } = get()
      const wires = document.wires.map((wire) =>
        wire.id === id ? { ...wire, waypoints: [...waypoints] } : wire
      )
      set({ document: { ...document, wires } })
    },

    undo(): void {
      const previous = history.undo(get().document)
      if (previous === null) return
      transientBase = null
      set({ document: previous, selectedPartIds: [], selectedWireId: null })
      syncHistoryFlags()
    },

    redo(): void {
      const next = history.redo(get().document)
      if (next === null) return
      transientBase = null
      set({ document: next, selectedPartIds: [], selectedWireId: null })
      syncHistoryFlags()
    },

    replaceDocument(document: CircuitDocument): void {
      const parsed = circuitDocumentSchema.parse(document)
      history.clear()
      transientBase = null
      set({
        document: parsed,
        selectedPartIds: [],
        selectedWireId: null,
        canUndo: false,
        canRedo: false,
      })
    },
  }
})
