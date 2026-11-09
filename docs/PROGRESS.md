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
| S06 | AVR emulation and mixed-signal bridge | pending |
| S07 | Code editor, upload flow, serial monitor | pending |
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | pending |
| S09 | Parts wave 2 and instruments | pending |
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S06 IN PROGRESS, branch `stage/s06-mcu-emulation`. Done: T01 (HEX parser), T02 (`McuCpu` avr8js; blink
D13 500 ms ±0.1 %), T03 (MCU protocol + `mcu.worker`/`McuHost`), T04 (`arduino-uno` manifest + art),
T05 (bridge primitives: Thevenin output, pull-up, digital hysteresis, 10-bit ADC, UNO rails), T06
(`createPwmOutput` averaged Thevenin + `pwmAverageVoltage` + `hasReactiveParts`).
Next: T07 co-sim scheduler (MCU clock master; wall-clock pacing/drift/hiccup tolerance; backlog limit;
speed control; wire MCU pin-change events → `createMcuOutput`/`createPwmOutput` devices → re-solve on
pin edges only), T08 fill the S05 sidecar traces + deterministic trace tests for every fixture, T09
examples (blink, button-LED, pot-dimmed LED, serial-hello) + E2E with prebuilt hex. Then
`/stage-finish S06` — **HUMAN REVIEW GATE**.
Bridge API: `createMcuOutput(name,node,high,{onResistance,highLevel})` (setHigh), `createPwmOutput(name,
node,duty,{onResistance,level})` (setDuty), `createPullup(name,node,railNode,≈30k)`, `digitalRead(v,prev,
{low,high})`, `analogRead(v,ref)`, `pwmAverageVoltage(duty,level)`, `hasReactiveParts(circuit,registry)`.
Gotchas: avr8js `reset()` doesn't zero `cycles`; MCU↔solver coupling (pin edges → devices → re-solve) is
NOT wired yet (T07); `vc-check` uses `pnpm -s`.
MCU API: `parseIntelHex`; `McuCpu` (`.cpu/.usart/.cycles/.micros`, `runCycles/runMicros`, `reset`,
`onPortChange(port, (value,old)=>…)` port byte, D13 = PB5, `setPin`, `onSerial`); `McuHost`
(`start(hex)/pause/resume/reset/setPin(port,bit,high)/dispose`, `onPinChange/onSerial/onState`).
avr8js: call BOTH `avrInstruction(cpu)` then `cpu.tick()`.
Gotchas: avr8js `reset()` doesn't zero `cycles`; sim-* eslint permits Node built-ins only in `*.test.ts`;
`vc-check` uses `pnpm -s`.
Blocked: none.

## Human actions pending
- (none)
