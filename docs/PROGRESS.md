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
S08 IN PROGRESS, branch `stage/s08-parts-wave1`. Done: T01 (part kit), T02 PARTIAL (Schottky + level-1
N/P MOSFET; `stampTransconductance`; **BJT deferred**), T04 (LDR/NTC/pot), T06 (`sim-digital` levels +
`DigitalEngine` event engine), T09 PARTIAL (7-segment; **LED bar/RGB deferred**).
Next: BJT (Ebers-Moll + limiting), T03 op-amp/comparator, T05 relay, T07 74xx/74HC161/595/4017 (build on
`sim-digital`), T08 555, LED bar + RGB, T10 demos+tests + MODELS/THIRD_PARTY. Then `/stage-finish S08`.
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
