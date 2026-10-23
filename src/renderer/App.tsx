import { useEffect, useState, type JSX } from 'react'
import { APP_NAME } from '../shared/app'
import { CircuitCanvas } from './canvas/CircuitCanvas'
import { DEFAULT_NOTE_TEXT, NOTE_WIDTH, noteHeight } from './canvas/notes'
import { CanvasToolbar } from './ui/CanvasToolbar'
import { CodePanel } from './ui/CodePanel'
import { InspectorPanel } from './ui/InspectorPanel'
import { NotificationCenter } from './ui/NotificationCenter'
import { PartsPanel } from './ui/PartsPanel'
import { SchematicView } from './schematic/SchematicView'
import { SerialDrawer } from './ui/SerialDrawer'
import { StatusBar } from './ui/StatusBar'
import { TopBar, type WorkspaceView } from './ui/TopBar'
import { useCircuitStore } from './store/circuitStore'
import { updateWindowTitle, useProjectStore } from './store/projectStore'
import { useSketchStore } from './store/sketchStore'
import { useViewportStore } from './store/viewportStore'

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function App(): JSX.Element {
  const [view, setView] = useState<WorkspaceView>('circuit')
  const [codeOpen, setCodeOpen] = useState(false)

  const undo = useCircuitStore((state) => state.undo)
  const redo = useCircuitStore((state) => state.redo)
  const removeSelected = useCircuitStore((state) => state.removeSelected)
  const duplicateSelected = useCircuitStore((state) => state.duplicateSelected)
  const rotateSelected = useCircuitStore((state) => state.rotateSelected)
  const flipSelected = useCircuitStore((state) => state.flipSelected)
  const addNote = useCircuitStore((state) => state.addNote)

  const build = useSketchStore((state) => state.build)
  const refreshToolchain = useSketchStore((state) => state.refreshToolchain)
  const projectName = useProjectStore((state) => state.name)
  const projectDirty = useProjectStore((state) => state.dirty)
  const saveProject = useProjectStore((state) => state.save)
  const openProject = useProjectStore((state) => state.open)
  const openLaunch = useProjectStore((state) => state.openLaunch)
  const receiveOpened = useProjectStore((state) => state.receiveOpened)
  const reportError = useProjectStore((state) => state.reportError)
  const loadSamples = useProjectStore((state) => state.loadSamples)
  const fitToContent = useViewportStore((state) => state.fitToContent)

  useEffect(() => {
    void refreshToolchain()
    void loadSamples()
    void openLaunch()

    const stopOpened = window.api.onFileOpened((opened) => receiveOpened(opened))
    const stopError = window.api.onFileOpenError((message) => reportError(message))
    return () => {
      stopOpened()
      stopError()
    }
  }, [loadSamples, openLaunch, receiveOpened, refreshToolchain, reportError])

  useEffect(() => {
    updateWindowTitle(projectName, projectDirty)
  }, [projectName, projectDirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (modifier && key === 'b') {
        event.preventDefault()
        setCodeOpen(true)
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
      if (event.shiftKey && key === 'f') {
        event.preventDefault()
        flipSelected('horizontal')
        return
      }
      if (event.shiftKey && key === 'v') {
        event.preventDefault()
        flipSelected('vertical')
        return
      }
      if (key === 'n') {
        event.preventDefault()
        const { size, viewport } = useViewportStore.getState()
        const center = {
          x: (size.width / 2 - viewport.offsetX) / viewport.scale,
          y: (size.height / 2 - viewport.offsetY) / viewport.scale,
        }
        addNote(DEFAULT_NOTE_TEXT, {
          x: center.x - NOTE_WIDTH / 2,
          y: center.y - noteHeight(DEFAULT_NOTE_TEXT) / 2,
        })
        return
      }
      if (key === 'f') {
        fitToContent()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelected()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    addNote,
    build,
    duplicateSelected,
    fitToContent,
    flipSelected,
    openProject,
    redo,
    removeSelected,
    rotateSelected,
    saveProject,
    undo,
  ])

  return (
    <div className="cb-shell" data-app={APP_NAME}>
      <TopBar
        view={view}
        onChangeView={setView}
        codeOpen={codeOpen}
        onToggleCode={() => setCodeOpen((current) => !current)}
      />

      <div className="cb-workspace">
        <div className="cb-stage">
          {view === 'circuit' ? (
            <>
              <CircuitCanvas />
              <CanvasToolbar />
              <InspectorPanel />
            </>
          ) : (
            <SchematicView />
          )}
          <SerialDrawer />
        </div>

        {codeOpen && <CodePanel onClose={() => setCodeOpen(false)} />}
        <PartsPanel />
      </div>

      <StatusBar />
      <NotificationCenter />
    </div>
  )
}
