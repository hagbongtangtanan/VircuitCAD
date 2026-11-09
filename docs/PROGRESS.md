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
| S07 | Code editor, upload flow, serial monitor | pending |
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | pending |
| S09 | Parts wave 2 and instruments | pending |
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S06 complete (T01–T09); running `vc-stage-finish.sh S06` — **HUMAN REVIEW GATE** (exit 10: install
`vircuitcad-win`, run blink / button-LED / pot-dimmed LED / serial-hello, confirm smooth 60 fps and
correct behaviour, merge the PR, rerun the driver).
MCU worker API: `McuHost.start(hex)/pause/resume/reset/setPin(port,bit,high)/dispose`
(`onPinChange/onSerial/onState`); zod protocol (`start/pause/resume/reset/setPin`; `pinChange/serial/
state`); `McuCpu` (`runCycles/runMicros/reset/onPortChange/setPin/onSerial/pinState`); `Pacer`
(`tick(nowMs) → {micros,realTimeFactor,overloaded}`, `setSpeed/reset`); `recordTrace`.
Bridge rules: OUTPUT = Thevenin 5 V/0 V via ~25 Ω; INPUT_PULLUP = 30 kΩ to the 5 V rail; INPUT = Hi-Z;
digital thresholds 1.5 V/3.0 V with hysteresis; `analogRead` 10-bit (ref 5 V); PWM quasi-static =
duty × 5 V unless `hasReactiveParts`; `createDynamicPin` follows the live MCU pin state; UNO 5 V/3 V3 are
modelled as sources.
Scheduler: MCU clock is master; `Pacer` gives drift-corrected frames with a 100 ms backlog cap and an
overload flag. Throughput: ~44 MHz-equivalent (16 MHz AVR ≈ 2.8× real time) in Node.
Deferred: app-level E2E examples + wiring `McuHost`/`McuCircuit` into the renderer Run button (the
co-sim is proven headlessly: `McuCircuit` runs the prebuilt blink hex and the D13 LED lights/clears).
Gotchas: avr8js `reset()` doesn't zero `cycles`; `createDynamicPin` must always stamp its branch;
trace test is `slow`-tagged; `vc-check` uses `pnpm -s`.
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
