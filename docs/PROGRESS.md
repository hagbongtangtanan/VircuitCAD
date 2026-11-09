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
S06 IN PROGRESS, branch `stage/s06-mcu-emulation`. Done: T01 (Intel HEX parser), T02 (`McuCpu` avr8js;
blink D13 500 ms ±0.1 %), T03 (zod MCU protocol + editor `mcu.worker`/`McuHost`), T04 (`arduino-uno`
manifest with 25-pin map D0–D13/A0–A5/5V/3V3/GND/VIN/RESET + own board art).
Next: T05 mixed-signal bridge (OUTPUT ≈ 25 Ω Thevenin, INPUT Hi-Z, INPUT_PULLUP 20–50 kΩ, digital
thresholds + hysteresis, analogRead → 10-bit, re-solve on pin edges only; UNO 5V/3V3 → sources; D13 LED
coupling), T06 PWM quasi-static vs transient, T07 co-sim scheduler (wall-clock pacing/drift/hiccup
tolerance, backlog limit, speed control), T08 fixture traces, T09 examples + E2E (prebuilt hex). Then
`/stage-finish S06` — **HUMAN REVIEW GATE**.
MCU API: `parseIntelHex`; `McuCpu` (`.cpu/.usart/.cycles/.micros`, `runCycles/runMicros`, `reset`,
`onPortChange(port, (value,old)=>…)` port byte, D13 = PB5, `setPin`, `onSerial`); `McuHost`
(`start(hex)/pause/resume/reset/setPin(port,bit,high)/dispose`, `onPinChange/onSerial/onState`).
avr8js: call BOTH `avrInstruction(cpu)` then `cpu.tick()`.
Gotchas: avr8js `reset()` doesn't zero `cycles`; sim-* eslint permits Node built-ins only in `*.test.ts`;
`vc-check` uses `pnpm -s`.
Blocked: none.

## Human actions pending
- (none)
