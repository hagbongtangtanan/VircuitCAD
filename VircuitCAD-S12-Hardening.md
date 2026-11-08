# VircuitCAD: Stage S12 "Hardening and alignment" (continuation pack)

**For:** the current repo (pnpm monorepo, stages S00 to S11, opencode workflow with `/stage`, `scripts/vc-*.sh`).
**What this is:** one new stage that fixes the problems found in the S00 to S02 review and aligns the project with your decisions, written in the repo's own stage-file format so `/stage S12` runs it with no changes to the scripts.
**Decisions it encodes:** file extension is **`.vcc`**; boards are **Arduino AVR only** (no Raspberry Pi Pico, no NodeMCU/ESP).
**Limits of the review behind it:** I read the code of the `main` branch (S00 to S02 done) but could not install packages or run anything, so each finding is from reading the code. The agent must reproduce a problem with a failing test before fixing it, and drop the task if it turns out not to be a problem.

---

## 1. Findings this stage fixes

| # | Finding | Task |
|---|---|---|
| 1 | Extension is `.vcad` everywhere (code, fixtures, docs); you chose `.vcc` | T01 |
| 2 | Scope and renderer decisions not recorded (ADR 0001 is a stub; Pico and ESP only appear as roadmap non-goals) | T02 |
| 3 | The RPC layer drops dialog options, so filters and default paths never reach the native dialog | T03 |
| 4 | Cancelling Save As or Open still reads or writes the app-data fallback file and reports success | T04 |
| 5 | The renderer can ask the main process for a recursive delete, and the allowed roots are the whole OS temp folder plus the parent folder of any file ever picked | T05 |
| 6 | Saves and autosave use a plain `writeFile` (a crash mid-write corrupts the file) | T06 |
| 7 | Autosave is write-only: nothing restores it at startup | T07 |
| 8 | Every pan or zoom re-renders the whole React app (six state updates per viewport change) | T08 |
| 9 | No navigation or new-window guard, no single-instance lock, no AppUserModelId, no fuses, no request allow-list | T09 |
| 10 | Packaging never launches the built exe; `publish` not disabled; no `.vcc` association; Windows-specific tests only run on Linux | T10 |
| 11 | The Electron compile adapter is a stub that returns success with a fake hex | T11 |
| 12 | Test-honesty and Windows rules are not written into `AGENTS.md` | T12 |

---

## 2. How to install it (one time, in WSL, in the repo)

1. Make sure S03 is finished and merged first. This stage does not touch `packages/sim-analog`, so it can wait until S03 is done.
2. Create `docs/stages/S12-hardening.md` with the content in section 3.
3. In `docs/PROGRESS.md`, insert this row **between the S03 and S04 rows** (the scripts pick the next stage by table order, and the stage id only has to match `S` plus two digits):
   ```
   | S12 | Hardening and alignment (run before S04) | pending |
   ```
4. In `docs/ROADMAP.md`, add the same row between S03 and S04 and a note that boards are Arduino AVR only and the project file extension is `.vcc`.
5. Optional: set `VC_PAUSE_AFTER="S04 S06 S11 S12"` so the run stops after S12 and you can launch the first packaged exe yourself.
6. Commit these doc changes the way the repo allows (`scripts/vc-save.sh --no-check "docs: add S12 hardening stage"`), then start a fresh opencode session and run `/stage S12`.

I did not test the scripts with a stage inserted out of ID order. If `vc-status.sh next` does not return `S12` after S03 is done, move the row by hand and tell opencode to read `scripts/vc-status.sh`.

---

## 3. Stage file: `docs/stages/S12-hardening.md`

````markdown
# S12 — Hardening and alignment

## Goal
Fix the defects found in the S00–S02 review, rename the project file to `.vcc`, record the Arduino-AVR-only scope, and prove the packaged Windows exe actually starts. No simulation changes.

## Read first
`docs/ARCHITECTURE.md` (stack), `apps/desktop/src/main/adapter.ts`, `packages/core/src/platform/rpc.ts`, `apps/desktop/src/renderer/App.tsx`, `apps/desktop/electron-builder.yml`, `.github/workflows/ci.yml`.

## Working rules for this stage
- **Reproduce first:** for every task write a test that fails on the current code, then fix it. If you cannot reproduce a problem, say so in the commit body and drop the task.
- **Never mock the module under test**, never copy logic into a test file, and prove each new test can fail (break the code, see it fail, restore).
- Windows path behaviour is tested with `path.win32` in unit tests, because `verify` runs on Linux.
- Nothing in `packages/sim-*` changes in this stage.

## Tasks
- [ ] **S12-T01** Rename the project file extension `.vcad` → `.vcc` everywhere: code, dialog filters, `fixtures/vcad` → `fixtures/vcc`, stage docs, ROADMAP, README. Nothing has shipped, so no legacy reader. Check whether the file contents carry a format id string and rename it too. → `grep -ri vcad` finds nothing except an ADR note; all tests green.
- [ ] **S12-T02** Write `docs/adr/0003-scope-and-file-format.md` (Arduino AVR boards only; no RP2040/Pico, no ESP/NodeMCU in v1; `.vcc`) and expand ADR 0001 with why PixiJS (not Konva) and which render rules apply (batched Graphics, texture cache, cached static layers, no per-frame React state). Update ROADMAP non-goals to match. → docs only; ADRs link each other.
- [ ] **S12-T03** Forward dialog options through RPC: add zod `OpenDialogParams`/`SaveDialogParams` (title, defaultPath, filters with extensions) in `rpc.ts`, pass them to `adapter.dialogs.*`, and make the client send them. → test that filters and defaultPath arrive at the adapter; malformed options are rejected.
- [ ] **S12-T04** Fix cancel semantics: `null` from a native dialog means the user cancelled, so do nothing (no write, no read, no "Saved" hint). The app-data fallback is only for dev-web, signalled by an explicit capability on the adapter (for example `dialogs.native: boolean`), never inferred from `null`. Replace `path.split('/')` with a platform-neutral basename helper that handles `\`. → test: cancel does not write or load; dev-web fallback still works in E2E.
- [ ] **S12-T05** Least-privilege filesystem in the Electron adapter: grant only the exact path the user picked (not its parent folder); remove the whole OS temp folder from the allowed roots (use `userData/tmp`); replace recursive `fs.remove` with `removeFile` (non-recursive, files only, only inside app data); resolve real paths so symlinks and junctions cannot escape; compare case-insensitively on Windows. → tests with `path.win32` for `..`, drive-relative, `\\server\share`, `\\?\` prefixes, trailing dots or spaces, `file:stream`, plus a real symlink escape test.
- [ ] **S12-T06** Atomic writes in the main process: write a temp file in the **same folder as the target**, flush it to disk, then rename over the target; for user saves keep the previous version as `<name>.bak`; remove the temp file on any failure; on Windows retry `EBUSY`/`EPERM` renames a few times with backoff (antivirus locks). Autosave uses the same helper. → fault-injection tests (inject a failure at every step via an injectable fs layer): the original file is never lost or truncated; target in another folder works; read-only target gives a clear error.
- [ ] **S12-T07** Crash recovery: autosave journal in `userData/recovery/`, written atomically, with a clean-exit marker; at startup, if a journal is newer than the last save and parses against the schema, show a Restore / Discard dialog (replace the current stub); delete the journal after a successful save or Discard. → unit tests plus an E2E: kill the page after an edit, reload, restore gives an identical circuit.
- [ ] **S12-T08** Stop viewport changes from re-rendering React: split `App.tsx` into small components that subscribe to the store with `useSyncExternalStore` and narrow selectors (counts, selection, history flags); expose zoom to the status bar through a throttled external store; never call a global `refresh()` from `onViewportChange`. → render-count tests that mount the **real** `StatusBar`, `Inspector`, `PartsBin` and `Toolbar` with a React `Profiler`: 0 commits during 100 simulated pan/zoom events; moving one part re-renders neither the inspector nor the parts bin; note measured fps with 100 parts in the handoff.
- [ ] **S12-T09** Electron hardening: `setWindowOpenHandler` → deny, block `will-navigate` and `will-attach-webview`, deny every permission request and check, `requestSingleInstanceLock` plus `second-instance` handling (focus the window, open a `.vcc` passed as an argument), `app.setAppUserModelId('com.vircuitcad.app')`, a `webRequest.onBeforeRequest` allow-list that cancels everything except `file:`, `devtools:` and the dev-server URL in dev, and Electron fuses (disable `RunAsNode`, `NODE_OPTIONS` and CLI inspect; ASAR integrity; only load from ASAR) via electron-builder's `electronFuses` option or an `afterPack` script. The packaged renderer must carry its CSP in the `index.html` meta tag (a `file://` page has no response headers), so add a build-output test that `dist/renderer/index.html` contains the policy. → unit tests with a fake window and session; build test for the meta CSP.
- [ ] **S12-T10** Packaging and a real exe check: set `publish` to never (config and `--publish never`); add `.vcc` file association with a `build/vcc.ico` generated by a small script that wraps the existing 256 px PNG in an ICO container (no new dependency); no `.ino` association; add a `--smoke-test --out <file>` flag, active only when `app.isPackaged`, that loads the renderer, checks the CSP meta, `nodeIntegration` off and zero blocked requests attempted, writes a small JSON and exits 0 or 1. In `ci.yml` `package-windows`: also run the desktop and core unit tests on Windows, launch `release/win-unpacked/VircuitCAD.exe --smoke-test` with a 60 s timeout and fail the job on a non-zero exit, silent-install the NSIS exe to a temp folder (`/S /D=...`), assert the exe and the `.vcc` association exist, uninstall with the `_?=<dir>` argument so the script waits, and upload the smoke JSON. → the CI job fails if the exe does not start.
- [ ] **S12-T11** Make the Electron `compile` adapter honest: return `ok: false` with a diagnostic "Toolchain not installed (arrives in S05)" instead of a fake successful hex, and keep `toolchain.info` accurate. → contract tests updated; no test relies on the fake hex.
- [ ] **S12-T12** Update `AGENTS.md` and `docs/RUNBOOK.md`: add the test-honesty rules from this stage, the atomic-write rule, "never expose recursive delete over IPC", "renderer/core/editor/ui import no Node modules" (add a lint rule for it like the sim-* one), the Windows path-testing rule, and that every stage that changes packaging must keep the CI exe smoke test green. → lint rule has a test like `tools/lint-boundaries`.

## Pitfalls
- Do not break the dev-web adapter: it keeps the app-data fallback behaviour behind the explicit capability.
- Rename churn is large: do T01 first, in one commit, before other tasks touch the same files.
- Windows CI runners have a desktop session, but if Electron cannot start a GPU process in smoke mode, disable hardware acceleration only when `--smoke-test` is present.
- Keep `style-src 'unsafe-inline'` only if Pixi/React need it, and note why in ADR 0001.

## Exit gate
- `vc-check full` green and every new test proven able to fail.
- Cancelling a dialog changes nothing; a crash during save never loses the previous file; killing the page and reloading offers a restore.
- 0 React commits during pan and zoom with 100 parts.
- The CI Windows job starts the unpacked exe, passes the smoke test, installs and uninstalls cleanly, and the `.vcc` association is registered.
- `grep -ri "vcad"` returns no matches outside ADR notes.

## Handoff to next stage
Record: adapter capability flags, the atomic-write helper's name and location, the recovery file layout, the smoke-test JSON fields, and the measured fps with 100 parts.
````

---

## 4. Kickoff prompt (paste into a fresh opencode session after installing)

```text
Run /stage S12.

Context: this stage fixes defects found in a review of the S00–S02 code and applies two decisions: the project file extension is .vcc (not .vcad), and the boards in v1 are Arduino AVR only (no Raspberry Pi Pico, no NodeMCU/ESP).

Read docs/PROGRESS.md and docs/stages/S12-hardening.md only, plus the files its "Read first" lists.

Rules for this stage on top of AGENTS.md:
1. Reproduce each problem with a failing test before fixing it. If you cannot reproduce it, say so in the commit body and drop the task.
2. Never mock the module under test, never copy logic into a test file, and show that each new test can fail.
3. Do not skip, delete or weaken tests.
4. Do not touch packages/sim-*.
5. Do T01 (rename) first, in one commit.
6. The CI Windows job must launch the packaged exe; do not mark T10 done until that job passes on the pull request.

Stop after 6 tasks, write the handoff, and tell me what is next.
```

---

## 5. After S12

- Run `/stage S04` (vertical slice). Its human review gate is the first time anyone opens the installed app, so use the Windows CI artifact and walk through: install, place battery, resistor and LED, run, the LED lights, save as `.vcc`, double-click the file, uninstall.
- Keep the rules in `AGENTS.md` (T12) for every later stage, especially S05 (toolchain) and S06 (AVR emulation), where the earlier project failed: real Worker tests, no mocks of the module under test, compile tests that run instead of skipping, and serial output and input verified end to end.
