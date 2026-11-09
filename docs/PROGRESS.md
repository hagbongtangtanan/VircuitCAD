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
S06 IN PROGRESS, branch `stage/s06-mcu-emulation`. Done: T01–T07 (hex, `McuCpu` avr8js, protocol +
`mcu.worker`/`McuHost`, `arduino-uno` part, bridge primitives, PWM quasi-static, `Pacer`), T08
(`recordTrace` + `tools/make-traces.ts` filled the S05 sidecar `.json` traces; slow-tagged replay test
for every fixture).
Next: T09 examples (blink/button-LED/pot-dimmed LED/serial-hello) + E2E with prebuilt hex (no toolchain
in CI). Remaining glue: wire MCU `pinChange` → `createMcuOutput`/`createPwmOutput` devices → re-solve on
pin edges only, and hook the UNO + `McuHost` into the desktop app (Run) so D13 drives an on-board LED.
Then `/stage-finish S06` — **HUMAN REVIEW GATE**.
MCU API: `McuCpu`; `Pacer` (`tick(nowMs) → {micros,realTimeFactor,overloaded}`, `setSpeed/reset`);
`recordTrace(hex,micros,ports)`; protocol schemas; `McuHost.start(hex)/pause/resume/reset/setPin(port,bit,
high)` with `onPinChange/onSerial/onState`. Bridge: `createMcuOutput`, `createPwmOutput`, `createPullup`,
`digitalRead`, `analogRead`, `pwmAverageVoltage`, `hasReactiveParts`.
Gotchas: avr8js `reset()` doesn't zero `cycles`; trace test is `slow`-tagged (excluded from `test:fast`);
pin-edge→solver coupling + app wiring not done; `vc-check` uses `pnpm -s`.
MCU API: `parseIntelHex`; `McuCpu` (`.cpu/.usart/.cycles/.micros`, `runCycles/runMicros`, `reset`,
`onPortChange(port, (value,old)=>…)` port byte, D13 = PB5, `setPin`, `onSerial`); `McuHost`
(`start(hex)/pause/resume/reset/setPin(port,bit,high)/dispose`, `onPinChange/onSerial/onState`).
avr8js: call BOTH `avrInstruction(cpu)` then `cpu.tick()`.
Gotchas: avr8js `reset()` doesn't zero `cycles`; sim-* eslint permits Node built-ins only in `*.test.ts`;
`vc-check` uses `pnpm -s`.
Blocked: none.

## Human actions pending
- (none)
