import { create } from 'zustand'
import {
  circuitDocumentSchema,
  emptyCircuitDocument,
  noteSchema,
  partSchema,
  pinHasWire,
  type CircuitDocument,
  type PartInstance,
  type PartType,
  type PinRef,
  type Point,
  type Rotation,
  type Wire,
} from '../../shared/circuit'
import { DEFAULT_WIRE_COLOR, wireColorFor, wireKindFor } from '../../shared/wireColors'
import { GRID_SIZE, snapPoint } from '../canvas/geometry'
import { definitionOf } from '../parts/definitions'
import { createHistory } from './history'

export { DEFAULT_WIRE_COLOR } from '../../shared/wireColors'

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

export type FlipAxis = 'horizontal' | 'vertical'

export interface CircuitStore {
  document: CircuitDocument
  selectedPartIds: readonly string[]
  selectedWireId: string | null
  selectedNoteId: string | null
  wireColor: string
  canUndo: boolean
  canRedo: boolean

  addPart(type: PartType, position: Point): string
  movePart(id: string, position: Point): void
  beginTransientEdit(): void
  commitTransientEdit(): void
  removeSelected(): void
  duplicateSelected(): void
  copySelected(): void
  pasteClipboard(): void
  selectAll(): void
  rotateSelected(): void
  flipSelected(axis: FlipAxis): void
  setPartProp(id: string, key: string, value: string | number): void

  addNote(text: string, position: Point): string
  updateNote(id: string, text: string): void
  moveNote(id: string, position: Point): void
  selectNote(id: string | null): void

  selectParts(ids: readonly string[], additive?: boolean): void
  selectWire(id: string | null): void
  setWireColor(color: string): void

  addWire(from: PinRef, to: PinRef, waypoints?: readonly Point[]): string | null
  setWireEndpoint(id: string, end: 'from' | 'to', ref: PinRef): boolean
  setWireWaypoints(id: string, waypoints: readonly Point[]): void
  /** Live update during a handle drag; recorded by the transient edit. */
  dragWireWaypoints(id: string, waypoints: readonly Point[]): void

  undo(): void
  redo(): void
  replaceDocument(document: CircuitDocument): void
}

function refsEqual(a: PinRef, b: PinRef): boolean {
  return a.partId === b.partId && a.pinId === b.pinId
}

function hasWireBetween(
  document: CircuitDocument,
  from: PinRef,
  to: PinRef,
  ignoreId?: string
): boolean {
  return document.wires.some(
    (wire) =>
      wire.id !== ignoreId &&
      ((refsEqual(wire.from, from) && refsEqual(wire.to, to)) ||
        (refsEqual(wire.from, to) && refsEqual(wire.to, from)))
  )
}

/** VCC and GND get conventional colours; everything else honours the palette. */
function colorForWire(
  document: CircuitDocument,
  from: PinRef,
  to: PinRef,
  fallback: string
): string {
  const kindOf = (ref: PinRef): string | undefined => {
    const part = document.parts.find((candidate) => candidate.id === ref.partId)
    if (part === undefined) return undefined
    return definitionOf(part.type).pins.find((pin) => pin.id === ref.pinId)?.kind
  }

  const kinds = [kindOf(from), kindOf(to)].filter((kind): kind is string => kind !== undefined)
  const kind = wireKindFor(kinds)
  return kind === 'signal' ? fallback : wireColorFor(kind)
}

export const useCircuitStore = create<CircuitStore>()((set, get) => {
  const history = createHistory<CircuitDocument>()

  let transientBase: CircuitDocument | null = null
  let clipboardParts: PartInstance[] = []
  let clipboardWires: Wire[] = []
  let pasteGeneration = 0

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
    selectedNoteId: null,
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
      set({ selectedPartIds: [part.id], selectedWireId: null, selectedNoteId: null })
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
      const { document, selectedPartIds, selectedWireId, selectedNoteId } = get()
      const doomedParts = new Set(selectedPartIds)
      if (doomedParts.size === 0 && selectedWireId === null && selectedNoteId === null) return

      if (selectedNoteId !== null) {
        const notes = (document.notes ?? []).filter((note) => note.id !== selectedNoteId)
        commit({ ...document, notes })
        set({ selectedPartIds: [], selectedWireId: null, selectedNoteId: null })
        return
      }

      const parts = document.parts.filter((part) => !doomedParts.has(part.id))
      const wires = document.wires.filter(
        (wire) =>
          wire.id !== selectedWireId &&
          !doomedParts.has(wire.from.partId) &&
          !doomedParts.has(wire.to.partId)
      )

      commit({ ...document, parts, wires })
      set({ selectedPartIds: [], selectedWireId: null, selectedNoteId: null })
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
      set({
        selectedPartIds: clones.map((clone) => clone.id),
        selectedWireId: null,
        selectedNoteId: null,
      })
    },

    copySelected(): void {
      const { document, selectedPartIds } = get()
      if (selectedPartIds.length === 0) return
      const selected = new Set(selectedPartIds)
      clipboardParts = document.parts
        .filter((part) => selected.has(part.id))
        .map((part) => structuredClone(part))
      clipboardWires = document.wires
        .filter((wire) => selected.has(wire.from.partId) && selected.has(wire.to.partId))
        .map((wire) => structuredClone(wire))
      pasteGeneration = 0
    },

    pasteClipboard(): void {
      if (clipboardParts.length === 0) return
      const { document } = get()
      pasteGeneration += 1
      const offset = { x: GRID_SIZE * 2 * pasteGeneration, y: GRID_SIZE * 2 * pasteGeneration }
      const idMap = new Map<string, string>()
      const clones = clipboardParts.map((part) => {
        const clone = partSchema.parse({
          ...structuredClone(part),
          id: createId(part.type),
          position: { x: part.position.x + offset.x, y: part.position.y + offset.y },
        })
        idMap.set(part.id, clone.id)
        return clone
      })
      const wires: Wire[] = []
      for (const wire of clipboardWires) {
        const from = idMap.get(wire.from.partId)
        const to = idMap.get(wire.to.partId)
        if (from === undefined || to === undefined) continue
        wires.push({
          ...structuredClone(wire),
          id: createId('wire'),
          from: { partId: from, pinId: wire.from.pinId },
          to: { partId: to, pinId: wire.to.pinId },
        })
      }
      commit({
        ...document,
        parts: [...document.parts, ...clones],
        wires: [...document.wires, ...wires],
      })
      set({
        selectedPartIds: clones.map((clone) => clone.id),
        selectedWireId: null,
        selectedNoteId: null,
      })
    },

    selectAll(): void {
      set({
        selectedPartIds: get().document.parts.map((part) => part.id),
        selectedWireId: null,
        selectedNoteId: null,
      })
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
      set({ selectedNoteId: null })
    },

    flipSelected(axis: FlipAxis): void {
      const { document, selectedPartIds } = get()
      if (selectedPartIds.length === 0) return

      const selected = new Set(selectedPartIds)
      const parts = document.parts.map((part) => {
        if (!selected.has(part.id)) return part
        const flag = axis === 'horizontal' ? 'flipX' : 'flipY'
        return partSchema.parse({ ...part, [flag]: part[flag] !== true })
      })

      commit({ ...document, parts })
      set({ selectedNoteId: null })
    },

    addNote(text: string, position: Point): string {
      const { document } = get()
      const note = noteSchema.parse({
        id: createId('note'),
        text: text.slice(0, 4000),
        position: snapPoint(position),
      })
      commit({ ...document, notes: [...(document.notes ?? []), note] })
      set({ selectedPartIds: [], selectedWireId: null, selectedNoteId: note.id })
      return note.id
    },

    updateNote(id: string, text: string): void {
      const { document } = get()
      const notes = (document.notes ?? []).map((note) =>
        note.id === id ? noteSchema.parse({ ...note, text: text.slice(0, 4000) }) : note
      )
      commit({ ...document, notes })
    },

    moveNote(id: string, position: Point): void {
      const { document } = get()
      const notes = (document.notes ?? []).map((note) =>
        note.id === id ? noteSchema.parse({ ...note, position }) : note
      )
      set({ document: { ...document, notes } })
    },

    selectNote(id: string | null): void {
      set({ selectedNoteId: id, selectedPartIds: [], selectedWireId: null })
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
      set({ selectedPartIds: next, selectedWireId: null, selectedNoteId: null })
    },

    selectWire(id: string | null): void {
      set({ selectedWireId: id, selectedPartIds: [], selectedNoteId: null })
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

    addWire(from: PinRef, to: PinRef, waypoints: readonly Point[] = []): string | null {
      const { document, wireColor } = get()
      if (from.partId === to.partId && from.pinId === to.pinId) return null
      if (hasWireBetween(document, from, to)) return null
      if (pinHasWire(document.wires, from) || pinHasWire(document.wires, to)) return null

      const wire: Wire = {
        id: createId('wire'),
        from,
        to,
        color: colorForWire(document, from, to, wireColor),
        waypoints: [...waypoints],
      }
      commit({ ...document, wires: [...document.wires, wire] })
      return wire.id
    },

    setWireEndpoint(id: string, end: 'from' | 'to', ref: PinRef): boolean {
      const { document } = get()
      const wire = document.wires.find((candidate) => candidate.id === id)
      if (wire === undefined) return false

      if (refsEqual(ref, end === 'from' ? wire.from : wire.to)) return true
      const other = end === 'from' ? wire.to : wire.from
      if (refsEqual(ref, other)) return false
      if (hasWireBetween(document, ref, other, id)) return false
      if (pinHasWire(document.wires, ref, id)) return false

      const wires = document.wires.map((candidate) =>
        candidate.id === id ? { ...candidate, [end]: ref } : candidate
      )
      commit({ ...document, wires })
      return true
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
      set({ document: previous, selectedPartIds: [], selectedWireId: null, selectedNoteId: null })
      syncHistoryFlags()
    },

    redo(): void {
      const next = history.redo(get().document)
      if (next === null) return
      transientBase = null
      set({ document: next, selectedPartIds: [], selectedWireId: null, selectedNoteId: null })
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
        selectedNoteId: null,
        canUndo: false,
        canRedo: false,
      })
    },
  }
})
