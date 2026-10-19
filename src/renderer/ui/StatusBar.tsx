import { useMemo, type JSX } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import { useProjectStore } from '../store/projectStore'
import { useSimStore } from '../store/simStore'
import { useSketchStore } from '../store/sketchStore'
import { buildNetlist } from '../wiring/netlist'
import { IpcStatus } from './IpcStatus'

/**
 * One-line diagnostics strip. It is intentionally the only always-on chrome
 * below the canvas: counts, toolchain state and the serial callback live here
 * so the canvas and panels above stay clean.
 */
export function StatusBar(): JSX.Element {
  const document = useCircuitStore((state) => state.document)
  const projectName = useProjectStore((state) => state.name)
  const projectDirty = useProjectStore((state) => state.dirty)
  const projectError = useProjectStore((state) => state.error)
  const simStatus = useSimStore((state) => state.status)
  const simError = useSimStore((state) => state.error)
  const simElapsedMs = useSimStore((state) => state.elapsedMs)
  const litLeds = useSimStore(
    (state) => Object.values(state.ledBrightness).filter((value) => value > 0.02).length
  )
  const toolchain = useSketchStore((state) => state.toolchain)

  const netlist = useMemo(() => buildNetlist(document), [document])

  return (
    <footer className="cb-statusbar">
      <span
        className="cb-status-item"
        data-testid="project-status"
        title={projectError ?? undefined}
      >
        {projectName}
        {projectDirty ? ' · unsaved changes' : ''}
        {projectError === null ? '' : ` · ${projectError}`}
      </span>
      <span className="cb-status-item" data-testid="scene-counts">
        {document.parts.length} part{document.parts.length === 1 ? '' : 's'} ·{' '}
        {document.wires.length} wire{document.wires.length === 1 ? '' : 's'} · {netlist.netCount}{' '}
        net{netlist.netCount === 1 ? '' : 's'}
      </span>
      <span className="cb-status-item" data-testid="sim-readout">
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
      <span className="cb-status-spacer" />
      <span className="cb-status-item" data-testid="toolchain-status">
        {toolchain === null
          ? 'Toolchain: checking…'
          : toolchain.available
            ? `Toolchain: ${toolchain.avrGcc ?? 'avr-gcc'} · Arduino core ${toolchain.arduinoCore ?? '?'}`
            : `Toolchain: unavailable — ${toolchain.detail}`}
      </span>
      <span className="cb-status-item">
        <IpcStatus />
      </span>
    </footer>
  )
}
