import type { JSX } from 'react'
import { useSketchStore } from '../store/sketchStore'

function percent(used: number, total: number): string {
  return `${((used / total) * 100).toFixed(1)}%`
}

/**
 * Build result: one summary line plus every compiler diagnostic, so a failed
 * build always explains itself.
 */
export function BuildOutput(): JSX.Element {
  const phase = useSketchStore((state) => state.phase)
  const diagnostics = useSketchStore((state) => state.diagnostics)
  const memory = useSketchStore((state) => state.memory)
  const durationMs = useSketchStore((state) => state.durationMs)
  const buildError = useSketchStore((state) => state.buildError)

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error')

  let summary: string
  if (buildError !== null) {
    summary = buildError
  } else if (phase === 'building') {
    summary = 'Compiling…'
  } else if (phase === 'succeeded' && memory !== null) {
    summary = `Compiled in ${durationMs ?? 0} ms · flash ${memory.flashBytes}/${memory.flashCapacity} B (${percent(
      memory.flashBytes,
      memory.flashCapacity
    )}) · RAM ${memory.ramBytes}/${memory.ramCapacity} B (${percent(memory.ramBytes, memory.ramCapacity)})`
  } else if (phase === 'failed') {
    summary = `Build failed with ${errors.length} error${errors.length === 1 ? '' : 's'}.`
  } else {
    summary = 'Not built yet. Press Ctrl+B or hit Build.'
  }

  return (
    <section className="build-output" aria-label="Build output">
      <h2 className="app-panel-title">Build output</h2>
      <p
        className={`build-summary build-summary-${buildError === null ? phase : 'failed'}`}
        data-testid="build-status"
      >
        {summary}
      </p>
      {diagnostics.length > 0 && (
        <ul className="diagnostic-list" data-testid="diagnostic-list">
          {diagnostics.map((diagnostic, index) => (
            <li
              key={`${diagnostic.severity}-${diagnostic.line}-${diagnostic.column}-${index}`}
              className={`diagnostic diagnostic-${diagnostic.severity}`}
            >
              <span className="diagnostic-location">
                {diagnostic.line === null
                  ? 'sketch'
                  : `line ${diagnostic.line}${diagnostic.column === null ? '' : `:${diagnostic.column}`}`}
              </span>
              <span className="diagnostic-message">{diagnostic.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
