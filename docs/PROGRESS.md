# PROGRESS — authoritative state (keep ≤ 60 lines)

Do not add columns: scripts parse this table. `done` is set only by `scripts/vc-stage-finish.sh`.

| ID | Stage | Status |
|---|---|---|
| S00 | Foundations, CI and platform adapter | done |
| S01 | Core model, breadboard connectivity, netlist | done |
| S02 | Editor canvas | done |
| S03 | Analog solver engine | done |
| S04 | Vertical slice: battery + resistor + LED lights up | done |
| S05 | Offline Arduino toolchain and compile service | done |
| S06 | AVR emulation and mixed-signal bridge | done |
| S07 | Code editor, upload flow, serial monitor | pending |
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | pending |
| S09 | Parts wave 2 and instruments | pending |
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S07 IN PROGRESS, branch `stage/s07-code-editor`. Done: T02 (sketch in `.vcad`), T03 (`RunController`),
T04 (diagnostics markers + `ProblemsPanel`), T05 (`SerialBuffer`/`SerialMonitor`), T06 (library policy),
T07 (`docs/BEHAVIOUR.md` lifecycle rules; edit-while-running prompt via `RunController.markEdited`).
Next: T01 Monaco bundled locally (add `monaco-editor`; Vite `?worker` for editor.+language workers via
`self.MonacoEnvironment.getWorker`; lazy-load; C++ tokenizer + own Arduino keyword/completion data;
dark/light; Playwright offline test with no external requests). T08 E2E: wire the renderer — sketch
editor → Build (adapter compile) → `McuCircuit` with hex → D13 LED toggles; serial hello appears;
syntax error shows a marker — run in the `toolchain` CI job. Then `/stage-finish S07`.
API: `RunController`; `toMarkers`/`markersByFile` (editor) + `ProblemsPanel` (ui); `Circuit.sketch`/
`defaultSketch`/`sketchOf`; `SerialMonitor`; `findUnknownIncludes`/`libraryMessage`.
Gotchas: heavy tests need explicit timeouts; jsdom lacks `scrollIntoView`; commit scopes can't contain
commas; `vc-check` uses `pnpm -s`.
Blocked: none.
MCU API: `parseIntelHex`; `McuCpu` (`.cpu/.usart/.cycles/.micros`, `runCycles/runMicros`, `reset`,
`onPortChange(port, (value,old)=>…)` port byte, D13 = PB5, `setPin`, `onSerial`); `McuHost`
(`start(hex)/pause/resume/reset/setPin(port,bit,high)/dispose`, `onPinChange/onSerial/onState`).
avr8js: call BOTH `avrInstruction(cpu)` then `cpu.tick()`.
Gotchas: avr8js `reset()` doesn't zero `cycles`; sim-* eslint permits Node built-ins only in `*.test.ts`;
`vc-check` uses `pnpm -s`.
Blocked: none.

## Human actions pending
- (none)
