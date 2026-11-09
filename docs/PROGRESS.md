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
S06 IN PROGRESS, branch `stage/s06-mcu-emulation`. Done: T01 (Intel HEX parser → program memory),
T02 (`McuCpu`: avr8js CPU + timers 0/1/2 + ports B/C/D + USART, deterministic `runCycles`/`runMicros`;
blink toggles D13 at 500 ms ±0.1 %).
Next: T03 MCU worker host (zod protocol, pin-change events with cycle stamps, serial in/out, ≤ 60 Hz
snapshots), T04 Arduino Uno part (manifest + SVG + pin map D0–D13/A0–A5/5V/3V3/GND/VIN/RESET + D13 LED
+ supply model), T05 mixed-signal bridge (OUTPUT ≈ 25 Ω Thevenin, INPUT Hi-Z, INPUT_PULLUP 20–50 kΩ,
digital thresholds + hysteresis, analogRead → 10-bit, re-solve on pin edges only), T06 PWM quasi-static
vs transient, T07 co-sim scheduler (MCU clock master, wall-clock pacing/drift/hiccup tolerance, backlog
limit, speed control), T08 fixture traces, T09 examples + E2E (prebuilt hex). Then `/stage-finish S06`
— **HUMAN REVIEW GATE**.
MCU API: `parseIntelHex(text,size=0x8000) → {bytes,highestAddress}`; `new McuCpu(hex)` with `.cpu`,
`.usart`, `.cycles`, `.micros`, `runCycles/runMicros`, `reset`, `onPortChange(port, listener)` (listener
gets the port byte; D13 = PB5), `setPin(port,bit,high)`, `onSerial(cb)`. avr8js needs BOTH
`avrInstruction(cpu)` (executes, advances cycles) and `cpu.tick()` (timers/interrupts).
Gotchas: avr8js `cpu.reset()` does NOT zero `cycles`; wall-clock pacing not done yet (T07); sim-* eslint
permits Node built-ins in `*.test.ts` only; `vc-check` uses `pnpm -s`.
Blocked: none.

## Human actions pending
- (none)
