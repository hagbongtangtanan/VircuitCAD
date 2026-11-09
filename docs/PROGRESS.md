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
S08 IN PROGRESS, branch `stage/s08-parts-wave1`. Done: T04 (LDR/NTC/potentiometer manifests + sim
models; `ldrResistance`/`ntcResistance`/`potentiometerResistances` in `sim-analog/src/sensors.ts`; the
bridge splits the pot into two legs).
Next: T01 part-authoring kit (`docs/PARTS.md`, `pnpm new-part`, manifest validator + lint that every part
has a demo+test), T02 BJT/MOSFET/Schottky/Zener, T03 op-amp/comparator, T05 relay, T06 `sim-digital`
event-driven engine (`0/1/Z/X`, delays, Thevenin boundary), T07 74xx/74HC161/595/4017, T08 555, T09
7-segment/LED bar/RGB, T10 demo+test for every part + MODELS/THIRD_PARTY updates. Then `/stage-finish S08`.
Sensors API: `ldrResistance(lux,{r10,gamma})`, `ntcResistance(celsius,{r25,beta})`,
`potentiometerResistances(total, position) → {low,high}`.
Gotchas: 3-terminal nonlinear devices (BJT/MOSFET) need VCCS stamping on `MnaSystem` (not yet exposed via
`MnaContext`) — plan to add a `stampTransconductance` before T02; heavy tests need timeouts; `vc-check`
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
