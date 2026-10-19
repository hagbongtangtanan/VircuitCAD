import { useCallback, useEffect, useState, type JSX } from 'react'
import type { PingResponse } from '../shared/schemas'

type IpcStatus =
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready'; readonly response: PingResponse }
  | { readonly kind: 'failed'; readonly message: string }

export function App(): JSX.Element {
  const [status, setStatus] = useState<IpcStatus>({ kind: 'checking' })

  const checkIpc = useCallback(async (): Promise<void> => {
    setStatus({ kind: 'checking' })
    try {
      const response = await window.api.ping({ sentAt: Date.now() })
      setStatus({ kind: 'ready', response })
    } catch (error) {
      setStatus({
        kind: 'failed',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  useEffect(() => {
    void checkIpc()
  }, [checkIpc])

  return (
    <div className="app-shell">
      <header className="app-toolbar">
        <span className="app-brand">
          Hu<span className="app-brand-accent">CAD</span> Circuits
        </span>
        <span className="app-tagline">offline Arduino simulator</span>
      </header>

      <main className="app-main">
        <section className="app-canvas" aria-label="Circuit canvas">
          <p className="app-placeholder">Canvas arrives in Milestone 2.</p>
        </section>
        <aside className="app-drawer" aria-label="Parts drawer">
          <h2 className="app-panel-title">Parts</h2>
          <p className="app-placeholder">
            Arduino Uno R3, breadboard, LED, resistor, push button, potentiometer, buzzer.
          </p>
        </aside>
      </main>

      <footer className="app-status" role="status">
        {status.kind === 'checking' && <span>IPC: checking…</span>}
        {status.kind === 'failed' && (
          <span className="app-status-error">IPC failed: {status.message}</span>
        )}
        {status.kind === 'ready' && (
          <span>
            IPC ok · echo {status.response.echo} · Electron {status.response.versions.electron} ·
            Chrome {status.response.versions.chrome} · Node {status.response.versions.node}
          </span>
        )}
      </footer>
    </div>
  )
}
