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
S10 branch `stage/s10-blocks-examples-schematic`. Done: T01 (blockly 13.4.0 pinned + en locale,
toolbox, custom block defs, structural workspace→IR mapper; Blockly only via `@vircuitcad/blocks/blockly`
subpath), T02 (`generateArduino` generator, unit-tested), T03 (schema v2 `mode`/`blocks` + v1→v2
migration + v2 fixture).
Next: T04 ≥25 example circuits + metadata + browser dialog + CI smoke tests; T05 schematic view; T06
blocks↔text parity (5 programs); T07 docs. UI wiring of Blockly/code view into apps/desktop still TODO.
Decisions: `@vircuitcad/blocks` holds pure IR/generator/toolbox/mapper; Blockly isolated in `blockly.ts`
subpath. core `blocks` field is opaque.
Gotchas: `SCHEMA_VERSION` now 2 (tests using 2 as "unknown" must use 3); blockly needs `import
'blockly/blocks'` for builtin defs and `blockly/msg/en` (default export is undefined — filter strings from
namespace); jsdom env via `// @vitest-environment jsdom`; license check passes.
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
