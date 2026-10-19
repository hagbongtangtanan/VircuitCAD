import type { JSX } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import { useProjectStore } from '../store/projectStore'
import { useSimStore } from '../store/simStore'
import { useSketchStore } from '../store/sketchStore'

export type WorkspaceView = 'circuit' | 'code'

export interface ToolbarProps {
  readonly view: WorkspaceView
  readonly onChangeView: (view: WorkspaceView) => void
}

export function Toolbar({ view, onChangeView }: ToolbarProps): JSX.Element {
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

  const phase = useSketchStore((state) => state.phase)
  const build = useSketchStore((state) => state.build)

  const openProject = useProjectStore((state) => state.open)
  const saveProject = useProjectStore((state) => state.save)
  const newProject = useProjectStore((state) => state.newProject)
  const exportSketch = useProjectStore((state) => state.exportSketch)
  const exportHex = useProjectStore((state) => state.exportHex)
  const projectBusy = useProjectStore((state) => state.busy)
  const hasHex = useSketchStore((state) => state.hex !== null)

  const simStatus = useSimStore((state) => state.status)
  const elapsedMs = useSimStore((state) => state.elapsedMs)
  const toggleSimulation = useSimStore((state) => state.toggle)
  const simulating = simStatus === 'running' || simStatus === 'preparing'

  return (
    <header className="app-toolbar">
      <span className="app-brand">
        Hu<span className="app-brand-accent">CAD</span> Circuits
      </span>

      <div className="toolbar-group" role="tablist" aria-label="Workspace view">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'circuit'}
          className={view === 'circuit' ? 'is-active' : undefined}
          onClick={() => onChangeView('circuit')}
        >
          Circuit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'code'}
          className={view === 'code' ? 'is-active' : undefined}
          onClick={() => onChangeView('code')}
        >
          Code
        </button>
      </div>

      <div className="toolbar-group">
        <button type="button" data-testid="file-new" onClick={newProject}>
          New
        </button>
        <button
          type="button"
          data-testid="file-open"
          disabled={projectBusy}
          title="Open a .hucad project or .ino sketch (Ctrl+O)"
          onClick={() => void openProject()}
        >
          Open
        </button>
        <button
          type="button"
          data-testid="file-save"
          disabled={projectBusy}
          title="Save the project (Ctrl+S)"
          onClick={() => void saveProject()}
        >
          Save
        </button>
      </div>

      {view === 'circuit' && (
        <>
          <div className="toolbar-group">
            <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              Undo
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
              Redo
            </button>
          </div>

          <div className="toolbar-group">
            <button
              type="button"
              onClick={rotateSelected}
              disabled={!hasParts}
              title="Rotate 90° (R)"
            >
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
        </>
      )}

      <span className="toolbar-spacer" />

      {view === 'code' && (
        <div className="toolbar-group">
          <button
            type="button"
            data-testid="export-sketch"
            title="Write the sketch to an .ino file"
            onClick={() => void exportSketch()}
          >
            Export .ino
          </button>
          <button
            type="button"
            data-testid="export-hex"
            disabled={!hasHex}
            title="Write the compiled program to a .hex file"
            onClick={() => void exportHex()}
          >
            Export .hex
          </button>
        </div>
      )}

      <button
        type="button"
        className="toolbar-build"
        data-testid="build-button"
        disabled={phase === 'building'}
        title="Compile the sketch (Ctrl+B)"
        onClick={() => void build()}
      >
        {phase === 'building' ? 'Building…' : 'Build'}
      </button>
      <button
        type="button"
        className={simulating ? 'toolbar-run is-active' : 'toolbar-run'}
        data-testid="sim-button"
        disabled={simStatus === 'preparing'}
        title={simulating ? 'Stop the simulation' : 'Compile (if needed) and run the circuit'}
        onClick={() => void toggleSimulation()}
      >
        {simulating ? 'Stop' : 'Run'}
      </button>
      <span className="toolbar-hint" data-testid="sim-status">
        {simStatus === 'running'
          ? `simulating · ${(elapsedMs / 1000).toFixed(1)} s`
          : simStatus === 'preparing'
            ? 'building sketch…'
            : simStatus === 'error'
              ? 'simulation error'
              : simStatus === 'stopped'
                ? 'stopped'
                : 'not simulating'}
      </span>
    </header>
  )
}
