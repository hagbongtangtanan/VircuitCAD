import { useCallback, useEffect, useState, type JSX } from 'react'
import type { PingResponse } from '../../shared/schemas'

type IpcStatus =
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready'; readonly response: PingResponse }
  | { readonly kind: 'failed'; readonly message: string }

/**
 * Smoke test for the preload bridge: proves the renderer can reach the main
 * process and get a validated response back.
 */
export function IpcStatus(): JSX.Element {
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

  if (status.kind === 'checking') return <span>IPC: checking…</span>
  if (status.kind === 'failed') {
    return <span className="app-status-error">IPC failed: {status.message}</span>
  }
  return <span>IPC ok · Electron {status.response.versions.electron}</span>
}
