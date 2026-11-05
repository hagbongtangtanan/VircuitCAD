# S00 — Foundations, CI and platform adapter

## Goal
A green, strict monorepo with CI on ubuntu + windows, a `PlatformAdapter` with two implementations, and an Electron app showing a blank Pixi canvas. **No simulation yet.**

## Read first
`docs/ARCHITECTURE.md` (Packages, Hard boundaries), `docs/RISKS.md` rows: WSL quirks, Electron security, Offline gaps.

## Tasks
- [x] **S00-T01** Root workspace: `package.json` (private, `packageManager` pinned, scripts `typecheck lint test test:fast build dev:web dev:desktop`), `pnpm-workspace.yaml`, `.nvmrc` (current Node LTS, exact), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint flat config + typescript-eslint, Prettier, `.editorconfig`. → `pnpm install && pnpm -r typecheck && pnpm -r lint` pass.
- [x] **S00-T02** Skeletons for `packages/{core,sim-analog,sim-digital,sim-mcu,parts,editor,ui,toolchain}`, `apps/{desktop,dev-server}`: `src/index.ts`, Vitest config, scripts `typecheck lint test test:fast` (`test:fast` = unit tests excluding tags `slow|golden|e2e|toolchain`). → one trivial passing test per package.
- [x] **S00-T03** Boundary enforcement: lint rule (`no-restricted-imports`/`import/no-restricted-paths` or dependency-cruiser) so `sim-*` cannot import DOM/Electron/Node-only APIs or `editor|ui|apps`. → a committed negative-fixture test proves a violation fails lint.
- [x] **S00-T04** Make the automation bundle work with the real project: run `scripts/vc-check.sh fast` and `full`; output must be quiet on success and ≤ 60 lines on failure. Fix root scripts only (do not edit `scripts/vc-*.sh`). → both pass.
- [x] **S00-T05** `.github/workflows/ci.yml`: job `verify` (ubuntu-latest: pnpm cache, `--frozen-lockfile`, typecheck, lint, test, non-blocking `pnpm audit --prod`, `ELECTRON_SKIP_BINARY_DOWNLOAD=1`), job `package-windows` (windows-latest, `needs: verify`, `shell: bash`, builds desktop, uploads artifact `vircuitcad-win`). → both jobs defined; `verify` is the required-check name.
- [x] **S00-T06** `PlatformAdapter` in `packages/core`: zod-typed interfaces `fs` (app-data + user-picked paths only), `dialogs` (open/save), `compile` (stub), `toolchain` (stub), `app` (version, paths). Plus an in-memory fake for tests. → contract test suite runs against the fake.
- [x] **S00-T07** `apps/dev-server`: Node server exposing the adapter on `127.0.0.1` only, path-traversal protected; browser client implementation; `pnpm dev:web` runs Vite + server. → contract suite passes against dev-web impl.
- [x] **S00-T08** `apps/desktop`: Electron main/preload/renderer (Vite), `contextIsolation` on, `nodeIntegration` off, `sandbox` on, strict CSP, typed IPC validated by zod, Electron adapter impl; renderer mounts a blank Pixi canvas and shows the app version. → app builds; unit tests for IPC validation.
- [ ] **S00-T09** Packaging: electron-builder with NSIS (per-user) + portable targets, `extraResources` placeholder for the toolchain, own placeholder icon, version from package.json. → `package-windows` job produces installer + portable exe artifacts.
- [ ] **S00-T10** Offline guard: Playwright (dev-web, headless) test that fails on any non-localhost request and asserts CSP; `THIRD_PARTY.md` seed + license-check script (allow MIT/Apache-2.0/BSD/ISC). → both run in `verify`.
- [ ] **S00-T11** Docs: `README.md` (WSL dev loop, how to fetch/test the Windows artifact), `CONTRIBUTING.md` pointing to AGENTS.md, ADR 0002 (adapter design). → links valid.

## Pitfalls (known in advance)
- electron-builder + pnpm often needs hoisted modules for the desktop app (`.npmrc node-linker=hoisted` scoped to it, or `public-hoist-pattern`).
- Sandboxed preload must be **CJS**; bundle it separately from the ESM renderer.
- Headless/CI has no GPU: unit tests mock Pixi; E2E uses software GL (`--use-gl=swiftshader`/`--use-angle=swiftshader`).
- Windows runner: use `shell: bash`, avoid path-length issues, never rely on case-insensitivity.
- Pin exact versions; verify each license before adding a dependency.
- Do not run Electron GUI in WSL; dev-web is the dev loop.

## Exit gate
- `verify` and `package-windows` green; installer + portable artifacts present.
- `pnpm dev:web` serves the app; Playwright asserts a canvas exists and no external requests.
- Boundary lint negative test passes; `scripts/vc-check.sh full` passes quietly.

## Handoff to next stage
Write in Handoff: package names + exports, test tags, adapter API summary, any dependency-version decisions.
