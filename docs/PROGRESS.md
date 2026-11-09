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
S06 IN PROGRESS, branch `stage/s06-mcu-emulation`. Done: T01 (HEX), T02 (`McuCpu` avr8js; blink 500 ms
±0.1 %), T03 (MCU protocol + `mcu.worker`/`McuHost`), T04 (`arduino-uno` manifest + art), T05 (bridge
primitives), T06 (PWM quasi-static), T07 (`Pacer`: drift-corrected frames, backlog cap, speed,
realTimeFactor/overloaded; worker uses it).
Next: T08 fill the S05 sidecar `.json` expected traces + deterministic trace tests for every fixture
(blink/millis/button/serial/pwm/adc/timer-isr), T09 examples (blink, button-LED, pot-dimmed LED,
serial-hello) + E2E with prebuilt hex (no toolchain in CI). Also still to wire: MCU pin-change events →
`createMcuOutput`/`createPwmOutput` devices → re-solve on pin edges only (the app-level co-sim glue).
Then `/stage-finish S06` — **HUMAN REVIEW GATE**.
MCU API: `McuCpu`, `Pacer`, protocol schemas; `McuHost.start(hex)/pause/resume/reset/setPin` with
`onPinChange/onSerial/onState` (state now carries `realTimeFactor`/`overloaded`).
Gotchas: avr8js `reset()` doesn't zero `cycles`; pin-edge→solver coupling not yet wired; `vc-check` uses
`pnpm -s`.
MCU API: `parseIntelHex`; `McuCpu` (`.cpu/.usart/.cycles/.micros`, `runCycles/runMicros`, `reset`,
`onPortChange(port, (value,old)=>…)` port byte, D13 = PB5, `setPin`, `onSerial`); `McuHost`
(`start(hex)/pause/resume/reset/setPin(port,bit,high)/dispose`, `onPinChange/onSerial/onState`).
avr8js: call BOTH `avrInstruction(cpu)` then `cpu.tick()`.
Gotchas: avr8js `reset()` doesn't zero `cycles`; sim-* eslint permits Node built-ins only in `*.test.ts`;
`vc-check` uses `pnpm -s`.
Blocked: none.

## Human actions pending
- (none)
