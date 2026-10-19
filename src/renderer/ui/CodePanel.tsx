import { useState, type JSX } from 'react'
import { BuildOutput } from '../editor/BuildOutput'
import { SketchEditor } from '../editor/SketchEditor'
import { useProjectStore } from '../store/projectStore'
import { useSimStore } from '../store/simStore'
import { useSketchStore } from '../store/sketchStore'
import { Icon } from './Icon'

type CodeMode = 'blocks' | 'text' | 'both'

const MODES: readonly { readonly id: CodeMode; readonly label: string }[] = [
  { id: 'blocks', label: 'Blocks' },
  { id: 'text', label: 'Text' },
  { id: 'both', label: 'Blocks + Text' },
]

export interface CodePanelProps {
  readonly onClose: () => void
}

/**
 * Collapsible code workspace. Only the text modes are wired up today; the
 * block editor lands in Milestone 6, so those modes explain themselves.
 */
export function CodePanel({ onClose }: CodePanelProps): JSX.Element {
  const [mode, setMode] = useState<CodeMode>('text')

  const phase = useSketchStore((state) => state.phase)
  const toggleSimulation = useSimStore((state) => state.toggle)
  const simStatus = useSimStore((state) => state.status)
  const exportHex = useProjectStore((state) => state.exportHex)
  const hasHex = useSketchStore((state) => state.hex !== null)

  const running = simStatus === 'running' || simStatus === 'preparing'

  return (
    <aside className="cb-code-panel" aria-label="Code" data-testid="code-panel">
      <header className="cb-code-header">
        <h2 className="cb-panel-title">Code</h2>
        <div className="cb-segmented" role="group" aria-label="Code view">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={mode === entry.id ? 'cb-segment is-active' : 'cb-segment'}
              aria-pressed={mode === entry.id}
              data-testid={`code-mode-${entry.id}`}
              onClick={() => setMode(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="cb-icon-button"
          data-testid="code-close"
          title="Hide the code panel"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="cb-code-actions">
        <button
          type="button"
          className="cb-button cb-button-primary"
          data-testid="code-upload"
          disabled={phase === 'building' || running}
          title="Compile the sketch and run it on the simulated board"
          onClick={() => void toggleSimulation()}
        >
          Upload &amp; Run
        </button>
        <button
          type="button"
          className="cb-button"
          data-testid="code-download"
          disabled={!hasHex}
          title="Export the compiled program as a .hex file"
          onClick={() => void exportHex()}
        >
          Download .hex
        </button>
      </div>

      <div className="cb-code-body">
        {mode === 'blocks' ? (
          <p className="cb-placeholder" data-testid="blocks-placeholder">
            The drag-and-drop block editor arrives in Milestone 6. Switch to Text to write Arduino
            C++ today.
          </p>
        ) : (
          <>
            {mode === 'both' && (
              <p className="cb-inline-note" data-testid="blocks-placeholder">
                Blocks arrive in Milestone 6 — showing the text sketch.
              </p>
            )}
            <SketchEditor />
            <BuildOutput />
          </>
        )}
      </div>
    </aside>
  )
}
