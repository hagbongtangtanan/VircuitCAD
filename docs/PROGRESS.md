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
S07 IN PROGRESS, branch `stage/s07-code-editor`. Done: T02 (sketch in `.vcad`), T03 (`RunController`
Build/Run/Stop state machine with request-id stale-drop + dirty flag), T05 (`SerialBuffer`/
`SerialMonitor`), T06 (`findUnknownIncludes`/`libraryMessage`).
Next: T01 Monaco bundled locally (Vite `?worker`, lazy, no CDN; C++ + own Arduino keywords; offline
Playwright test), T04 diagnostics → Monaco markers + Problems list, T07 lifecycle (edit-while-running
prompt; recompile resets MCU but keeps circuit; `docs/BEHAVIOUR.md`), T08 E2E (blink compile→LED; serial;
syntax-error marker) in the `toolchain` CI job. Then `/stage-finish S07`.
API: `RunController(deps).build()/stop()/cancel()/markEdited()/getState()/onChange`; `Circuit.sketch`,
`defaultSketch()`, `sketchOf()`; `SerialMonitor`; `findUnknownIncludes`, `libraryMessage`.
Gotchas: heavy tests need explicit timeouts (toolchain compile 60 s; trace `slow`); jsdom lacks
`scrollIntoView` (guarded); `vc-check` uses `pnpm -s`.
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
