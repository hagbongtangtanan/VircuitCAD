import { create } from 'zustand'
import type { Point } from '../../shared/circuit'
import { MAX_SCALE, MIN_SCALE, clamp, type Size, type Viewport } from '../canvas/geometry'
import { NOTE_WIDTH, noteHeight } from '../canvas/notes'
import { definitionOf, pinWorldPosition } from '../parts/definitions'
import { useCircuitStore } from './circuitStore'

export const INITIAL_VIEWPORT: Viewport = { scale: 1, offsetX: 60, offsetY: 60 }

/** Screen-space breathing room kept around the circuit when fitting it. */
const FIT_PADDING = 64

export interface ViewportStore {
  readonly viewport: Viewport
  /** Live pixel size of the canvas, reported by the canvas on every resize. */
  readonly size: Size
  setViewport(viewport: Viewport): void
  setSize(size: Size): void
  /** Multiplies the zoom, keeping `anchor` (screen space) pinned. Defaults to the centre. */
  zoomBy(factor: number, anchor?: Point): void
  zoomTo(scale: number): void
  panBy(dx: number, dy: number): void
  fitToContent(): void
  reset(): void
}

/** Axis-aligned world bounds of every part and wire anchor, or null when empty. */
export function circuitContentBounds(): { min: Point; max: Point } | null {
  const { parts, notes = [] } = useCircuitStore.getState().document
  if (parts.length === 0 && notes.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const include = (point: Point): void => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  for (const part of parts) {
    const { width, height } = definitionOf(part.type).size
    include(part.position)
    include({ x: part.position.x + width, y: part.position.y + height })
    for (const pin of definitionOf(part.type).pins) {
      include(pinWorldPosition(part, pin.id))
    }
  }

  for (const note of notes) {
    include(note.position)
    include({ x: note.position.x + NOTE_WIDTH, y: note.position.y + noteHeight(note.text) })
  }

  if (!Number.isFinite(minX)) return null
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } }
}

/** Centre-fit a world bounds rectangle inside a viewport of the given size. */
export function fitViewport(
  size: Size,
  bounds: { readonly min: Point; readonly max: Point }
): Viewport {
  const width = Math.max(1, bounds.max.x - bounds.min.x)
  const height = Math.max(1, bounds.max.y - bounds.min.y)
  const usableWidth = Math.max(1, size.width - FIT_PADDING * 2)
  const usableHeight = Math.max(1, size.height - FIT_PADDING * 2)
  const scale = clamp(Math.min(usableWidth / width, usableHeight / height), MIN_SCALE, MAX_SCALE)

  return {
    scale,
    offsetX: (size.width - width * scale) / 2 - bounds.min.x * scale,
    offsetY: (size.height - height * scale) / 2 - bounds.min.y * scale,
  }
}

export const useViewportStore = create<ViewportStore>()((set, get) => {
  function anchoredZoom(nextScale: number, anchor?: Point): void {
    const { viewport, size } = get()
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    const point = anchor ?? { x: size.width / 2, y: size.height / 2 }
    const worldX = (point.x - viewport.offsetX) / viewport.scale
    const worldY = (point.y - viewport.offsetY) / viewport.scale
    set({
      viewport: {
        scale,
        offsetX: point.x - worldX * scale,
        offsetY: point.y - worldY * scale,
      },
    })
  }

  return {
    viewport: INITIAL_VIEWPORT,
    size: { width: 800, height: 600 },

    setViewport(viewport: Viewport): void {
      set({ viewport })
    },

    setSize(size: Size): void {
      const previous = get().size
      if (previous.width === size.width && previous.height === size.height) return
      set({ size })
    },

    zoomBy(factor: number, anchor?: Point): void {
      anchoredZoom(get().viewport.scale * factor, anchor)
    },

    zoomTo(scale: number): void {
      anchoredZoom(scale)
    },

    panBy(dx: number, dy: number): void {
      const { viewport } = get()
      set({
        viewport: { ...viewport, offsetX: viewport.offsetX + dx, offsetY: viewport.offsetY + dy },
      })
    },

    fitToContent(): void {
      const { size } = get()
      const bounds = circuitContentBounds()
      if (bounds === null) {
        set({ viewport: INITIAL_VIEWPORT })
        return
      }
      set({ viewport: fitViewport(size, bounds) })
    },

    reset(): void {
      set({ viewport: INITIAL_VIEWPORT })
    },
  }
})
