import type { JSX } from 'react'
import { DEFAULT_NOTE_TEXT, NOTE_WIDTH, noteHeight } from '../canvas/notes'
import { useCircuitStore } from '../store/circuitStore'
import { useViewportStore } from '../store/viewportStore'
import { Icon } from './Icon'

/**
 * Floating toolbar over the canvas. Everything here acts on the current
 * selection or the viewport, so it stays out of the way of the parts panel.
 */
export function CanvasToolbar(): JSX.Element {
  const viewport = useViewportStore((state) => state.viewport)
  const zoomBy = useViewportStore((state) => state.zoomBy)
  const zoomTo = useViewportStore((state) => state.zoomTo)
  const fitToContent = useViewportStore((state) => state.fitToContent)

  const canUndo = useCircuitStore((state) => state.canUndo)
  const canRedo = useCircuitStore((state) => state.canRedo)
  const undo = useCircuitStore((state) => state.undo)
  const redo = useCircuitStore((state) => state.redo)
  const rotateSelected = useCircuitStore((state) => state.rotateSelected)
  const flipSelected = useCircuitStore((state) => state.flipSelected)
  const addNote = useCircuitStore((state) => state.addNote)
  const duplicateSelected = useCircuitStore((state) => state.duplicateSelected)
  const removeSelected = useCircuitStore((state) => state.removeSelected)

  const hasParts = useCircuitStore((state) => state.selectedPartIds.length > 0)
  const hasWire = useCircuitStore((state) => state.selectedWireId !== null)
  const hasNote = useCircuitStore((state) => state.selectedNoteId !== null)
  const hasSelection = hasParts || hasWire || hasNote

  const addNoteHere = (): void => {
    const { size, viewport: current } = useViewportStore.getState()
    const center = {
      x: (size.width / 2 - current.offsetX) / current.scale,
      y: (size.height / 2 - current.offsetY) / current.scale,
    }
    addNote(DEFAULT_NOTE_TEXT, {
      x: center.x - NOTE_WIDTH / 2,
      y: center.y - noteHeight(DEFAULT_NOTE_TEXT) / 2,
    })
  }

  return (
    <div className="cb-canvas-toolbar" data-testid="canvas-toolbar" role="toolbar">
      <button
        type="button"
        className="cb-tool"
        title="Zoom out"
        aria-label="Zoom out"
        data-testid="zoom-out"
        onClick={() => zoomBy(1 / 1.2)}
      >
        <Icon name="zoom-out" />
      </button>
      <button
        type="button"
        className="cb-tool cb-tool-wide"
        title="Reset zoom to 100%"
        data-testid="zoom-level"
        onClick={() => zoomTo(1)}
      >
        {Math.round(viewport.scale * 100)}%
      </button>
      <button
        type="button"
        className="cb-tool"
        title="Zoom in"
        aria-label="Zoom in"
        data-testid="zoom-in"
        onClick={() => zoomBy(1.2)}
      >
        <Icon name="zoom-in" />
      </button>
      <button
        type="button"
        className="cb-tool"
        title="Fit the circuit to the window"
        aria-label="Fit the circuit to the window"
        data-testid="zoom-fit"
        onClick={fitToContent}
      >
        <Icon name="fit" />
      </button>

      <span className="cb-toolbar-divider" />

      <button
        type="button"
        className="cb-tool"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        data-testid="undo"
        disabled={!canUndo}
        onClick={undo}
      >
        <Icon name="undo" />
      </button>
      <button
        type="button"
        className="cb-tool"
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
        data-testid="redo"
        disabled={!canRedo}
        onClick={redo}
      >
        <Icon name="redo" />
      </button>

      <span className="cb-toolbar-divider" />

      <button
        type="button"
        className="cb-tool"
        title="Rotate 90° (R)"
        aria-label="Rotate 90 degrees"
        data-testid="rotate"
        disabled={!hasParts}
        onClick={rotateSelected}
      >
        <Icon name="rotate" />
      </button>
      <button
        type="button"
        className="cb-tool"
        title="Flip horizontally (Shift+click for vertical)"
        aria-label="Flip horizontally"
        data-testid="flip"
        disabled={!hasParts}
        onClick={(event) => flipSelected(event.shiftKey ? 'vertical' : 'horizontal')}
      >
        <Icon name="flip" />
      </button>
      <button
        type="button"
        className="cb-tool"
        title="Add note (N)"
        aria-label="Add note"
        data-testid="notes"
        onClick={addNoteHere}
      >
        <Icon name="note" />
      </button>
      <button
        type="button"
        className="cb-tool"
        title="Duplicate (Ctrl+D)"
        aria-label="Duplicate"
        data-testid="duplicate"
        disabled={!hasParts}
        onClick={duplicateSelected}
      >
        <Icon name="duplicate" />
      </button>
      <button
        type="button"
        className="cb-tool cb-tool-danger"
        title="Delete (Del)"
        aria-label="Delete"
        data-testid="delete"
        disabled={!hasSelection}
        onClick={removeSelected}
      >
        <Icon name="trash" />
      </button>
    </div>
  )
}
