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
| S09 | Parts wave 2 and instruments | pending |
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S09 IN PROGRESS, branch `stage/s09-parts-wave2`. Done: T01 (scope), T02 (`sampleWaveform`), T03
(`Hd44780`), T04 (`hBridgeOutput`/`stepMotor`/`buzzerLevel`), T05 (TMP36, HC-SR04, PIR, keypad,
joystick), T06 (`decodeWs2812`).
Next: supply CC mode, T07 library bundle + fixtures, T08 perf pass. Then `/stage-finish S09`.
APIs: `ScopeBuffer`/`decimate`/`findTrigger`; `sampleWaveform`; `Hd44780`/`Keypad4x4`/`pirLevel`/
`buzzerLevel`; `servoAngle`/`servoPulse`/`joystickAxis`/`hBridgeOutput`/`stepMotor`; `tmp36*`/`hcSr04*`;
`decodeWs2812`.
Gotchas: heavy tests need timeouts; `vc-check` uses `pnpm -s`.
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
