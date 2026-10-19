import { useEffect, useMemo, useState, type JSX } from 'react'
import { CircuitCanvas } from './canvas/CircuitCanvas'
import { BuildOutput } from './editor/BuildOutput'
import { SketchEditor } from './editor/SketchEditor'
import { SerialMonitor } from './serial/SerialMonitor'
import { useCircuitStore } from './store/circuitStore'
import { updateWindowTitle, useProjectStore } from './store/projectStore'
import { useSimStore } from './store/simStore'
import { useSketchStore } from './store/sketchStore'
import { buildNetlist } from './wiring/netlist'
import { IpcStatus } from './ui/IpcStatus'
import { PartDrawer } from './ui/PartDrawer'
import { PartInspector } from './ui/PartInspector'
import { Toolbar, type WorkspaceView } from './ui/Toolbar'

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function App(): JSX.Element {
  const [view, setView] = useState<WorkspaceView>('circuit')

  const document = useCircuitStore((state) => state.document)
  const undo = useCircuitStore((state) => state.undo)
  const redo = useCircuitStore((state) => state.redo)
  const removeSelected = useCircuitStore((state) => state.removeSelected)
  const duplicateSelected = useCircuitStore((state) => state.duplicateSelected)
  const rotateSelected = useCircuitStore((state) => state.rotateSelected)
  const selectParts = useCircuitStore((state) => state.selectParts)
  const selectWire = useCircuitStore((state) => state.selectWire)

  const build = useSketchStore((state) => state.build)
  const refreshToolchain = useSketchStore((state) => state.refreshToolchain)
  const toolchain = useSketchStore((state) => state.toolchain)
  const simStatus = useSimStore((state) => state.status)
  const simError = useSimStore((state) => state.error)
  const simElapsedMs = useSimStore((state) => state.elapsedMs)
  const projectName = useProjectStore((state) => state.name)
  const projectDirty = useProjectStore((state) => state.dirty)
  const projectError = useProjectStore((state) => state.error)
  const saveProject = useProjectStore((state) => state.save)
  const openProject = useProjectStore((state) => state.open)
  const loadSamples = useProjectStore((state) => state.loadSamples)
  const litLeds = useSimStore(
    (state) => Object.values(state.ledBrightness).filter((value) => value > 0.02).length
  )

  // Derived state: the netlist is rebuilt whenever the topology changes.
  const netlist = useMemo(() => buildNetlist(document), [document])

  useEffect(() => {
    void refreshToolchain()
    void loadSamples()
  }, [refreshToolchain, loadSamples])

  useEffect(() => {
    updateWindowTitle(projectName, projectDirty)
  }, [projectName, projectDirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (modifier && key === 'b') {
        event.preventDefault()
        setView('code')
        void build()
        return
      }
      if (modifier && key === 's') {
        event.preventDefault()
        void saveProject()
        return
      }
      if (modifier && key === 'o') {
        event.preventDefault()
        void openProject()
        return
      }
      if (modifier && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (modifier && key === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (isTextEntry(event.target)) return

      if (modifier && key === 'd') {
        event.preventDefault()
        duplicateSelected()
        return
      }
      if (key === 'r') {
        rotateSelected()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelected()
        return
      }
      if (event.key === 'Escape') {
        selectParts([])
        selectWire(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    build,
    duplicateSelected,
    openProject,
    redo,
    removeSelected,
    rotateSelected,
    saveProject,
    selectParts,
    selectWire,
    undo,
  ])

  return (
    <div className="app-shell">
      <Toolbar view={view} onChangeView={setView} />

      <main className="app-main" data-view={view}>
        {view === 'circuit' ? (
          <>
            <CircuitCanvas />
            <div className="app-sidebar">
              <PartDrawer />
              <PartInspector />
            </div>
          </>
        ) : (
          <div className="code-workspace">
            <SketchEditor />
            <div className="code-panels">
              <SerialMonitor />
              <BuildOutput />
            </div>
          </div>
        )}
      </main>

      <footer className="app-status">
        <span data-testid="project-status" title={projectError ?? undefined}>
          {projectName}
          {projectDirty ? ' · unsaved changes' : ''}
          {projectError === null ? '' : ` · ${projectError}`}
        </span>
        <span data-testid="scene-counts">
          {document.parts.length} parts · {document.wires.length} wires · {netlist.netCount} nets
        </span>
        <span data-testid="sim-readout">
          {simStatus === 'running'
            ? `Sim: running · ${(simElapsedMs / 1000).toFixed(1)} s · ${litLeds} LED${litLeds === 1 ? '' : 's'} lit`
            : simStatus === 'preparing'
              ? 'Sim: building sketch…'
              : simStatus === 'error'
                ? `Sim: error — ${simError ?? 'unknown'}`
                : simStatus === 'stopped'
                  ? 'Sim: stopped'
                  : 'Sim: idle'}
        </span>
        <span data-testid="toolchain-status">
          {toolchain === null
            ? 'Toolchain: checking…'
            : toolchain.available
              ? `Toolchain: ${toolchain.avrGcc ?? 'avr-gcc'} · Arduino core ${toolchain.arduinoCore ?? '?'}`
              : `Toolchain: unavailable — ${toolchain.detail}`}
        </span>
        <IpcStatus />
      </footer>
    </div>
  )
}
