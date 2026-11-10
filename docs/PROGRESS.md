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
S08 complete (T01–T10); running `vc-stage-finish.sh S08` → tag `stage-s08-done`. Next: S09.
Digital API (`@vircuitcad/sim-digital`): `Level '0'|'1'|'Z'|'X'`, `and/or/not/nand/xor/drive/isDriven`,
`DigitalEngine` (`addGate/set/get/settle → {levels,iterations,settled}`), `DFlipFlop`, `Counter`,
`ShiftRegister`, `decode`, `JohnsonCounter`.
Analog devices added: `createSchottky`, `createMosfet`, `createBjt`, `createOpAmp`, `createRelay`,
`ldrResistance`/`ntcResistance`/`potentiometerResistances`, `astable555`/`monostable555`;
`MnaSystem`/`MnaContext` gained `stampTransconductance`.
Part `simModel` ids: resistor, led, diode, battery, battery-pack, switch, pushbutton, slide-switch,
inductor, capacitor, power-supply, multimeter, arduino-uno, ldr, ntc, potentiometer, seven-segment,
rgb-led, led-bar.
Known partials: relay flyback-diode transient not tested; op-amp uses soft output-current saturation;
some devices lack a `.vcad` demo (displays added; mosfet/bjt/opamp/relay/sensor demos pending).
Gotchas: BJT needs `pnjlim` limiting to converge; heavy tests need explicit timeouts; `vc-check` uses `pnpm -s`.
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
