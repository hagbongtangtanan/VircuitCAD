import { useEffect, useRef, useState, type JSX } from 'react'
import { APP_NAME } from '../../shared/app'
import { Icon } from './Icon'
import { useProjectStore } from '../store/projectStore'
import { useSimStore } from '../store/simStore'
import { useSketchStore } from '../store/sketchStore'

export type WorkspaceView = 'circuit' | 'schematic'

export interface TopBarProps {
  readonly view: WorkspaceView
  readonly onChangeView: (view: WorkspaceView) => void
  readonly codeOpen: boolean
  readonly onToggleCode: () => void
}

/** Thin wrapper around `main`'s file operations, with a click-away menu. */
function FileMenu(): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const busy = useProjectStore((state) => state.busy)
  const newProject = useProjectStore((state) => state.newProject)
  const openProject = useProjectStore((state) => state.open)
  const saveProject = useProjectStore((state) => state.save)
  const exportSketch = useProjectStore((state) => state.exportSketch)
  const exportHex = useProjectStore((state) => state.exportHex)
  const exportPng = useProjectStore((state) => state.exportPng)
  const exportPdf = useProjectStore((state) => state.exportPdf)
  const hasHex = useSketchStore((state) => state.hex !== null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node))
        setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const run = (action: () => void | Promise<void>): void => {
    setOpen(false)
    void action()
  }

  return (
    <div className="cb-menu-root" ref={rootRef}>
      <button
        type="button"
        className="cb-button"
        data-testid="file-menu-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        File <Icon name="chevron" />
      </button>
      {open && (
        <div className="cb-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            data-testid="file-new"
            onClick={() => run(newProject)}
          >
            New circuit
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="file-open"
            disabled={busy}
            onClick={() => run(openProject)}
          >
            Open…
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="file-save"
            disabled={busy}
            onClick={() => run(saveProject)}
          >
            Save
          </button>
          <span className="cb-menu-separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            data-testid="export-sketch"
            onClick={() => run(exportSketch)}
          >
            Export sketch (.ino)
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="export-hex"
            disabled={!hasHex}
            onClick={() => run(exportHex)}
          >
            Export program (.hex)
          </button>
          <span className="cb-menu-separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            data-testid="export-png"
            onClick={() => run(exportPng)}
          >
            Export view as PNG…
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="export-pdf"
            onClick={() => run(exportPdf)}
          >
            Save schematic as PDF…
          </button>
        </div>
      )}
    </div>
  )
}

function SimulationControls(): JSX.Element {
  const status = useSimStore((state) => state.status)
  const elapsedMs = useSimStore((state) => state.elapsedMs)
  const toggle = useSimStore((state) => state.toggle)
  const simulating = status === 'running' || status === 'preparing'

  const label =
    status === 'running'
      ? `simulating · ${(elapsedMs / 1000).toFixed(1)} s`
      : status === 'preparing'
        ? 'building sketch…'
        : status === 'error'
          ? 'simulation error'
          : status === 'stopped'
            ? 'stopped'
            : 'not simulating'

  return (
    <div className="cb-sim-cluster">
      <button
        type="button"
        className={simulating ? 'cb-run-button is-running' : 'cb-run-button'}
        data-testid="sim-button"
        disabled={status === 'preparing'}
        title={simulating ? 'Stop the simulation' : 'Compile (if needed) and run the circuit'}
        onClick={() => void toggle()}
      >
        <span aria-hidden="true" className="cb-run-icon" />
        {simulating ? 'Stop' : 'Start simulation'}
      </button>
      <span className="cb-sim-status" data-testid="sim-status">
        {label}
      </span>
    </div>
  )
}

/** Application chrome: brand, project name, view tabs, file/build/run actions. */
export function TopBar({ view, onChangeView, codeOpen, onToggleCode }: TopBarProps): JSX.Element {
  const name = useProjectStore((state) => state.name)
  const dirty = useProjectStore((state) => state.dirty)
  const rename = useProjectStore((state) => state.rename)

  const phase = useSketchStore((state) => state.phase)
  const build = useSketchStore((state) => state.build)

  return (
    <header className="cb-topbar">
      <div className="cb-topbar-section cb-topbar-brand">
        <span className="cb-brand-mark" aria-hidden="true">
          <span className="cb-brand-pin" />
        </span>
        <span className="cb-brand-name">{APP_NAME}</span>
      </div>

      <label className="cb-title">
        <span className="cb-visually-hidden">Circuit name</span>
        <input
          className="cb-title-input"
          data-testid="project-title"
          value={name}
          spellCheck={false}
          style={{ width: `${Math.max(name.length, 8) + 2}ch` }}
          onChange={(event) => rename(event.target.value)}
        />
        {dirty && <span className="cb-dirty-dot" title="Unsaved changes" aria-hidden="true" />}
      </label>

      <div className="cb-view-tabs" role="tablist" aria-label="Workspace view">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'circuit'}
          className={view === 'circuit' ? 'cb-tab is-active' : 'cb-tab'}
          onClick={() => onChangeView('circuit')}
        >
          Circuit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'schematic'}
          className={view === 'schematic' ? 'cb-tab is-active' : 'cb-tab'}
          onClick={() => onChangeView('schematic')}
        >
          Schematic
        </button>
      </div>

      <span className="cb-topbar-spacer" />

      <div className="cb-topbar-actions">
        <FileMenu />
        <button
          type="button"
          className="cb-button"
          data-testid="build-button"
          disabled={phase === 'building'}
          title="Compile the sketch (Ctrl+B)"
          onClick={() => void build()}
        >
          {phase === 'building' ? 'Building…' : 'Build'}
        </button>
        <button
          type="button"
          className={codeOpen ? 'cb-button is-pressed' : 'cb-button'}
          data-testid="code-toggle"
          aria-pressed={codeOpen}
          title="Show or hide the code panel"
          onClick={onToggleCode}
        >
          Code
        </button>
        <SimulationControls />
      </div>
    </header>
  )
}
