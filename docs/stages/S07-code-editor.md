# S07 — Code editor, upload flow, serial monitor

## Goal
Write Arduino code in-app, compile offline, run on the emulated Uno, see diagnostics and serial output.

## Read first
Handoffs of S05 and S06; `docs/TOOLCHAIN.md`.

## Tasks
- [ ] **S07-T01** Monaco bundled locally (Vite `?worker`, no CDN), lazy-loaded; C++ language, Arduino keyword/completion list (own data), dark/light themes. → Playwright offline test loads the editor with no external requests.
- [x] **S07-T02** Sketch persisted inside `.vcad` (text); tabs for `.ino` + `.h`; autosave. → save/load round-trip.
- [x] **S07-T03** Code panel (dockable/resizable), toolbar: Build, Run (compile → load hex → start), Stop; progress + cancel via adapter. → state machine unit tests.
- [ ] **S07-T04** Diagnostics: compile errors → Monaco markers + Problems list; click-to-jump; stale-marker clearing. → tests with captured gcc output.
- [x] **S07-T05** Serial monitor: ring buffer (10 000 lines), auto-scroll toggle, send box with line-ending option, baud-mismatch hint, timestamps, clear. → performance test at 1 000 lines/s.
- [x] **S07-T06** Library policy: only the bundled set; unknown `#include` produces a clear "not bundled" message listing the available libraries. → unit tests.
- [ ] **S07-T07** Lifecycle semantics: edit while running → prompt to restart; recompiling resets MCU but keeps the circuit; documented in `docs/BEHAVIOUR.md`. → E2E.
- [ ] **S07-T08** E2E: write blink → compile → LED toggles; serial hello appears; a syntax error shows a marker. → in CI (`toolchain` job).

## Pitfalls
- Monaco is heavy: lazy-load, dispose models/editors, watch memory.
- CSP must allow `worker-src blob:` only as needed; keep `script-src` strict.
- Race: compile finishing after the user pressed Stop or edited again → use request ids, drop stale results.
- Input-method editors and AltGr shortcuts: don't capture global shortcuts while the editor is focused.

## Exit gate
- E2E green in CI; no external network requests while editing/compiling.
- Compile-error → marker → fix → run flow works in the Windows artifact smoke test.

## Handoff to next stage
Record: code-panel API, lifecycle rules, serial buffer limits.
