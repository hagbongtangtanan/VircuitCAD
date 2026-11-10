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
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S10 branch `stage/s10-blocks-examples-schematic`. Done: T03 (schema v2: `mode`/`blocks`, `modeOf()`,
v1→v2 migration, fixture `fixtures/vcad/v2/blocks-blink.vcad`), T02 (new `@vircuitcad/blocks`: IR +
`generateArduino`, auto-includes Servo/LiquidCrystal/Serial; unit-tested, no deps).
Next: T01 Blockly bundled offline (pinned, offline locales) + toolbox, wire UI to `@vircuitcad/blocks`
IR; T04 ≥25 examples + browser dialog; T05 schematic view; T06 blocks↔text parity; T07 docs.
Decisions: T02 shipped Blockly-agnostic; T01 must map workspaces → `@vircuitcad/blocks` IR (keeps core
pure). `blocks` in .vcad is opaque `Record<string,unknown>`.
Gotchas: `SCHEMA_VERSION` now 2 (tests using `schemaVersion:2` as "unknown" must use 3); new pkgs go in
`packages/*` (pnpm-workspace auto-includes); `pnpm add blockly` needs network (registry reachable).
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
