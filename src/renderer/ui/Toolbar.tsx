import type { JSX } from 'react'
import { useCircuitStore } from '../store/circuitStore'

export function Toolbar(): JSX.Element {
  const canUndo = useCircuitStore((state) => state.canUndo)
  const canRedo = useCircuitStore((state) => state.canRedo)
  const undo = useCircuitStore((state) => state.undo)
  const redo = useCircuitStore((state) => state.redo)
  const rotateSelected = useCircuitStore((state) => state.rotateSelected)
  const duplicateSelected = useCircuitStore((state) => state.duplicateSelected)
  const removeSelected = useCircuitStore((state) => state.removeSelected)
  const wireColor = useCircuitStore((state) => state.wireColor)
  const setWireColor = useCircuitStore((state) => state.setWireColor)
  const hasParts = useCircuitStore((state) => state.selectedPartIds.length > 0)
  const hasWire = useCircuitStore((state) => state.selectedWireId !== null)

  return (
    <header className="app-toolbar">
      <span className="app-brand">
        Hu<span className="app-brand-accent">CAD</span> Circuits
      </span>

      <div className="toolbar-group">
        <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          Redo
        </button>
      </div>

      <div className="toolbar-group">
        <button type="button" onClick={rotateSelected} disabled={!hasParts} title="Rotate 90° (R)">
          Rotate
        </button>
        <button
          type="button"
          onClick={duplicateSelected}
          disabled={!hasParts}
          title="Duplicate (Ctrl+D)"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={removeSelected}
          disabled={!hasParts && !hasWire}
          title="Delete (Del)"
        >
          Delete
        </button>
      </div>

      <label className="toolbar-color">
        Wire
        <input
          type="color"
          value={wireColor}
          aria-label="Wire color"
          onChange={(event) => setWireColor(event.target.value)}
        />
      </label>

      <span className="toolbar-spacer" />
      <span className="toolbar-hint">drag parts from the right · click two pins to wire them</span>
    </header>
  )
}
