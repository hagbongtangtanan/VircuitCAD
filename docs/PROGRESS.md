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
S07 IN PROGRESS, branch `stage/s07-code-editor`. Done: T01 (Monaco bundled locally via lazy dynamic
import; `CodeEditor` + own Arduino keyword/completion data; Vite `?worker` wiring in the app at
`apps/desktop/src/renderer/monaco-env.ts`), T02 (sketch in `.vcad`), T03 (`RunController`), T04
(diagnostics markers + `ProblemsPanel`), T05 (`SerialMonitor`), T06 (library policy), T07
(`docs/BEHAVIOUR.md`).
Next: T08 — wire the renderer: mount `CodeEditor` (call `ensureMonacoEnvironment()` first) + sketch
tabs + `ProblemsPanel` + `SerialMonitor`; Build = `RunController` → adapter `compile` (dev-web returns a
toolchain-missing diagnostic unless `resources/toolchain` exists) → on success build `McuCircuit(circuit,
registry, hex)` and step it on an interval (pacing via `Pacer`) → feed LED state + serial to the canvas
UI; syntax error → markers. E2E (blink compile→LED toggles; serial hello; error marker) in the
`toolchain` CI job. Also add the offline-Playwright assertion (editor loads, no external requests).
Then `/stage-finish S07`.
API: `CodeEditor({value,onChange,theme,readOnly})`; `ensureMonacoEnvironment()` (app); `RunController`;
`toMarkers`/`markersByFile`; `ProblemsPanel`; `SerialMonitor`; `McuCircuit`; `findUnknownIncludes`.
Gotchas: the `?worker` import must stay in the app (Vitest can't resolve it in the ui lib); heavy tests
need explicit timeouts; jsdom lacks `scrollIntoView`; commit scopes can't contain commas; `vc-check`
uses `pnpm -s`.
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
