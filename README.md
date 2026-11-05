# VircuitCAD

Offline Windows desktop app to build, code and simulate 2D circuits (Arduino/AVR + analog +
digital). Educational-grade, TinkerCAD-like, **zero network at runtime**.

> Status: early scaffolding (stage S00). See `docs/ROADMAP.md` for the plan.

## Requirements

- Node 22.20.0 (see `.nvmrc`) and pnpm 10.34.9 (`corepack enable`).
- A GitHub CLI login (`gh auth login`) for the automated git flow.
- Development happens in **WSL**; the Windows build is produced by CI.

## Setup (WSL)

1. Clone onto the Linux filesystem (e.g. `~/dev/VircuitCAD`), never under `/mnt/c`.
2. `bash scripts/vc-setup-wsl.sh` and fix anything marked ✖.
3. `pnpm install`.

## Dev loop

- `pnpm dev:web` — Vite renderer + loopback adapter server on `127.0.0.1:5173/5174`.
- **Do not** run the Electron GUI inside WSL/WSLg; use dev-web.

## Checks

- `scripts/vc-check.sh fast` — typecheck + lint + unit tests.
- `scripts/vc-check.sh full` — adds the full test suite and build.
- `pnpm test:e2e` — offline/CSP guard (Playwright, chromium).
- `pnpm check:licenses` — dependency license allowlist.

## Windows artifact

The CI job `package-windows` uploads the `vircuitcad-win` artifact (NSIS installer + portable
`.exe`). Download it from the Actions run of a stage/PR; installers are never built locally.

## Documentation

- `AGENTS.md` — rules for OpenCode sessions (read first).
- `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/RUNBOOK.md`, `THIRD_PARTY.md`.
