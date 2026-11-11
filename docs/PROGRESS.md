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
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | done |
| S09 | Parts wave 2 and instruments | done |
| S10 | Blockly, example library, schematic view | done |
| S11 | Polish, packaging, release | pending |

## Handoff
S10 DONE (merged, tag stage-s10-done). S11 branch `stage/s11-polish-release`. Done: T03 (core exports
`toSpiceNetlist`/`toBomCsv`/`toIno` + golden tests; SVG export exists via S10 `schematicToSvg`).
Next: T01 crash recovery/autosave/recent files, T02 settings+shortcuts+i18n, T04 a11y/UX, T05 soak+perf
budgets, T06 offline/security audit, T07 installer polish, T08 release workflow `v*`, T09 QA.md + tag
proposal. (PNG canvas export in T03 still needs the UI/wiring.)
Decisions: exports are pure core functions; SPICE emits scientific for |x|<1e-3 or ≥1e6, comments for
unsupported parts. UI wiring for S10 features (Blockly panel, code view, examples browser, schematic
panel) is still outstanding.
Gotchas: `SCHEMA_VERSION`=2; blockly only via `@vircuitcad/blocks/blockly`; packages needing Node built-ins
in tests set `"types":["node"]` in tsconfig (done for core/sim-analog/blocks/toolchain); CI finish race →
poll `gh run list` then re-run `vc-stage-finish.sh`.
Blocked: none.
APIs: `createMosfet`, `createSchottky`, `stampTransconductance`; `ldrResistance`/`ntcResistance`/
`potentiometerResistances`; `sim-digital` `Level`/`and`/`or`/`not`/`nand`/`xor`/`drive` + `DigitalEngine`
(addGate/set/get/settle → {levels,iterations,settled}); seven-segment → 8 LEDs (`<id>:<seg>`).
Gotchas: BJT Ebers-Moll unstable here; commit scopes can't contain commas; heavy tests need timeouts;
`vc-check` uses `pnpm -s`.
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
