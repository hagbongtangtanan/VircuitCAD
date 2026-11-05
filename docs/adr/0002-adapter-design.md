# ADR 0002 — PlatformAdapter transport

Status: accepted.

## Context

Everything OS-related must be isolated behind `PlatformAdapter` so the same renderer runs both
in the Electron shell and in the WSL dev-web loop, without renderer code importing Electron or
Node.

## Decision

- `@vircuitcad/core` defines the `PlatformAdapter` interface (`fs`, `dialogs`, `compile`,
  `toolchain`, `app`) with zod schemas for every payload.
- One validated RPC surface: `handleRpc(adapter, request)` returns a JSON envelope
  `{ ok: true, result }` or `{ ok: false, error: { code, message } }`. Binary payloads travel as
  base64 strings.
- Two implementations: **electron** (`ipcRenderer.invoke`, structured clone) and **dev-web**
  (HTTP on `127.0.0.1`, loopback-only, path-traversal guarded by allowed roots). Both clients are
  built from `createAdapterClient`.
- `@vircuitcad/core/contract` provides a reusable contract suite; every adapter implementation
  runs it.

## Consequences

- Renderer code never imports Electron or Node.
- Adding a transport means providing a caller function plus a server-side adapter; the shared
  contract test keeps implementations honest.
- dev-web binds to `127.0.0.1` only and never exposes arbitrary filesystem access.
