# AGENTS.md — rules for opencode on VircuitCAD

VircuitCAD = offline Windows desktop app (Electron + React + TypeScript + PixiJS) to build, code and simulate 2D circuits (Arduino/AVR + analog + digital). Educational-grade, TinkerCAD-like, **zero network at runtime**. Never copy Autodesk/Tinkercad assets or branding.

## How work is organised
- Work is split into **stages** (`docs/stages/Sxx-*.md`). One stage = one branch = one PR = one *fresh* session (or a few, if long).
- State lives on disk, not in your memory: `docs/PROGRESS.md` (status table + Handoff), the `[ ]/[x]` checkboxes in the stage file, and git history. Trust those over recollection.
- `docs/PROGRESS.md` is state: `scripts/vc-*.sh` parse the status table (never add/rename columns; `done` is set only by `vc-stage-finish.sh`), and `## Handoff` (≤ 15 lines) is overwritten every session, never appended.
- Branch/tag names are generated: `stage/sNN-slug` (slug = stage filename) and tag `stage-sNN-done` (the merged checkpoint). Let the scripts create them — never hand-make a branch.
- `scripts/vc-status.sh next|get Sxx|show` is the progress authority; it reads `docs/PROGRESS.md` from `origin/main` (an existing stage branch means in-progress), so a local edit alone changes nothing.
- Entry point: `/stage [Sxx]`. Resuming is the same command (it is idempotent).

## Context discipline (mandatory — sessions are short on purpose)
1. At session start read only: this file, `docs/PROGRESS.md`, the active stage file. Read anything else only if the stage's "Read first" lists it.
2. Never dump big files or logs. Use view ranges / grep; pipe command output through `| tail -n 40`.
3. Delegate broad searches and library-API lookups to a subagent (`@explore` / `@general`); keep only the conclusion.
4. Do at most **6 tasks per session**. Then write the handoff, save, and stop. A fresh session continues.
5. Finished tasks live in git + the checkbox; do not re-read or re-verify them.
6. Handoff (`docs/PROGRESS.md` → `## Handoff`) is ≤ 15 lines: done / next / decisions / gotchas / blocked. **Overwrite, never append.**

## Checks and verification
- `scripts/vc-check.sh [fast|full]` is the only verify entry point. `fast` = typecheck + lint + `test:fast`; `full` adds `test` + `build`. Quiet on success, ≤ 60 lines on failure (`VC_TAIL` overrides). It runs `pnpm install` itself if `node_modules` is missing, and is a no-op until S00 adds a root `package.json`.
- `test:fast` = unit tests only, excluding tags `slow|golden|e2e|toolchain`. Reuse the root scripts (`pnpm -r --if-present <script>`), not ad-hoc runners.
- `vc-save.sh` runs `vc-check.sh fast`; `vc-stage-finish.sh` runs `full`. Never verify another way to dodge a failure.

## Git rules (fully automated — never run raw git write commands)
- Commit **and** push only via `scripts/vc-save.sh [--task Sxx-Tnn] [--no-check | --wip] "type(scope): message"`.
  Raw `git add/commit/push/reset --hard/clean`, force-push, and committing on `main` are denied.
- Save after **every task** (`--task`). Use `--wip` whenever you hold ≥ ~100 lines of meaningful uncommitted work.
- Conventional commits: `feat fix chore docs test refactor perf build ci style revert wip`. Scope = package name (`core`, `sim-analog`, `editor`, …).
- A stage ends with `scripts/vc-stage-finish.sh Sxx` (full checks → PR → CI → squash-merge → tag). If it fails: read the output, fix the cause, save, rerun. **Exit code 10 = human review gate: stop.**
- Never weaken `.githooks/`, `scripts/vc-*.sh`, `opencode.json`, or CI checks unless a stage task explicitly says so. Hooks enforce the commit format, block secret-like/binary files and files >5 MB, and guard `main` (only the one-time bootstrap sets `VC_ALLOW_MAIN=1`).
- `.vc/` is scratch (logs, `ci.txt`, `push.err`) and gitignored; never commit it.

## Architecture rules
- `packages/sim-*` are pure TS: no DOM, no Electron, no Node-only APIs, no imports from `editor`/`ui`/`apps` (lint-enforced from S00).
- Everything OS-related goes through `PlatformAdapter` (fs, dialogs, compile, toolchain). Two impls: `electron`, `dev-web`.
- One circuit model; breadboard view, schematic view and netlist are projections. Simulators never know pixels.
- Parts are data-driven (manifest + SVG + model id). Adding a part must not touch core code.
- Heavy simulation runs in Web Workers; the UI receives ≤ 60 Hz snapshots. Validate every message with zod.
- Offline: no CDN, no remote fonts, no telemetry. Electron: `contextIsolation` on, `nodeIntegration` off, `sandbox` on, strict CSP, zod on every IPC payload.
- UI: all colours, spacing, radii and fonts come from the CSS token file (`packages/ui/src/theme/tokens.css`) — no inline styles for theming, no remote fonts/icons. Every new part ships with art or the fallback card (`packages/parts/art`); planned parts stay hidden and unplaceable. Prove layout with measurable assertions (computed styles, boxes, counts) and the screenshot harness — never judge looks from imagination.

## Environment
- Dev loop is `pnpm dev:web` (Vite + `apps/dev-server` on `127.0.0.1`); do **not** launch the Electron GUI in WSL/WSLg.
- Windows installers are produced only by the `package-windows` GitHub Actions job — never build/package them locally.
- `ngspice` is optional and CI-only (golden oracle for S03); regenerate golden fixtures only where it is installed.

## Code rules
- TS strict, no `any`, no `!` without a comment. Exact-pinned dependencies; justify each new dependency in the commit body. Read library APIs from `node_modules` types, not memory.
- Deterministic simulation in tests (fixed steps, seeded RNG).
- Every behaviour change ships with tests. Never delete or skip a test to go green; if a test is wrong, fix it and say why in the commit body.
- LF endings, POSIX paths internally (`path.posix`), no case-colliding filenames.
- Update `docs/` when behaviour or architecture changes; write an ADR (`docs/adr/`) before big refactors.

## When stuck
- Same failure 3 times → stop retrying. Put `Blocked: …` in the Handoff, `scripts/vc-save.sh --wip`, end the session with a 3-line report.
- Ambiguity the docs can't resolve: pick the simplest option that keeps ADR options open and record it under Handoff "Decisions".
- Out-of-scope ideas → one line in `docs/BACKLOG.md`. Do not build them.
