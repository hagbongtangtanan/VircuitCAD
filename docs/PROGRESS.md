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
| S07 | Code editor, upload flow, serial monitor | done |
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | pending |
| S09 | Parts wave 2 and instruments | pending |
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S07 complete (T01–T08); running `vc-stage-finish.sh S07` → tag `stage-s07-done`. Next: S08 parts wave 1.
Code panel API: `CodeEditor({value,onChange,theme,readOnly})` lazy-loads `monaco-editor` (bundled, no
CDN); own Arduino keywords via `arduinoCompletions()`; a default-closed "Code" toggle in the header shows
Build/Stop/run-state + `ProblemsPanel` + `SerialMonitor`, and Build runs `RunController` → adapter
`compile` → `McuCircuit` stepping (LEDs tinted via `Scene.setSimulation`, serial → `SerialBuffer`).
Lifecycle (`docs/BEHAVIOUR.md`): `RunController` Build→compile→`onStart(hex)`→running; request-id drops
stale results; edit-while-running ⇒ `markEdited` prompt; recompile resets the MCU, keeps the circuit.
Serial: `SerialBuffer` 10 000 lines; `withLineEnding` none/LF/CRLF.
Gotchas: Vite 8/rolldown could not resolve Monaco's `?worker` import — Monaco runs on the main thread
(worker wiring dropped); the lazy Monaco import can trigger a dev re-optimize, so the Code panel is
default-closed to keep the E2E layout stable; heavy tests need explicit timeouts; `vc-check` uses `pnpm -s`.
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
