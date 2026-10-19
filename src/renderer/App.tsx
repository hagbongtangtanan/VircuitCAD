import { useEffect, useMemo, type JSX } from 'react'
import { CircuitCanvas } from './canvas/CircuitCanvas'
import { useCircuitStore } from './store/circuitStore'
import { buildNetlist } from './wiring/netlist'
import { IpcStatus } from './ui/IpcStatus'
import { PartDrawer } from './ui/PartDrawer'
import { PartInspector } from './ui/PartInspector'
import { Toolbar } from './ui/Toolbar'

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function App(): JSX.Element {
  const document = useCircuitStore((state) => state.document)
  const undo = useCircuitStore((state) => state.undo)
  const redo = useCircuitStore((state) => state.redo)
  const removeSelected = useCircuitStore((state) => state.removeSelected)
  const duplicateSelected = useCircuitStore((state) => state.duplicateSelected)
  const rotateSelected = useCircuitStore((state) => state.rotateSelected)
  const selectParts = useCircuitStore((state) => state.selectParts)
  const selectWire = useCircuitStore((state) => state.selectWire)

  // The netlist is derived state: it is rebuilt whenever the topology changes.
  const netlist = useMemo(() => buildNetlist(document), [document])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

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
  }, [duplicateSelected, redo, removeSelected, rotateSelected, selectParts, selectWire, undo])

  return (
    <div className="app-shell">
      <Toolbar />
      <main className="app-main">
        <CircuitCanvas />
        <div className="app-sidebar">
          <PartDrawer />
          <PartInspector />
        </div>
      </main>
      <footer className="app-status">
        <span data-testid="scene-counts">
          {document.parts.length} parts · {document.wires.length} wires · {netlist.netCount} nets
        </span>
        <IpcStatus />
      </footer>
    </div>
  )
}
