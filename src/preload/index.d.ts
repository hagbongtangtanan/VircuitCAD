import type { CircuitApi } from '../shared/ipc'

declare global {
  interface Window {
    readonly api: CircuitApi
  }
}
