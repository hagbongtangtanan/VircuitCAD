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
S06 IN PROGRESS, branch `stage/s06-mcu-emulation`. Done: T01 (`@vircuitcad/sim-mcu` Intel HEX parser
→ program memory with checksum/range validation; parses all S05 fixtures; malformed-hex tests).
Next: T02 avr8js integration (pin the version; check its supported peripherals first: CPU, timers 0/1/2,
ports B/C/D, USART, ADC, SPI, TWI; cycle-driven run loop with wall-clock pacing + a deterministic
cycle mode; blink toggles at 1 Hz ±0.1 %), T03 MCU worker host (zod protocol, pin-change events with
cycle stamps, ≤ 60 Hz snapshots), T04 Arduino Uno part (manifest + SVG + pin map + D13 LED + supply
model), T05 mixed-signal bridge (OUTPUT = ~25 Ω Thevenin, INPUT Hi-Z, INPUT_PULLUP 20–50 kΩ, digital
thresholds with hysteresis, analogRead → 10-bit, re-solve on pin edges only), T06 PWM quasi-static vs
transient, T07 co-sim scheduler (MCU clock master, backlog limit, speed control), T08 fixture traces,
T09 examples + E2E (prebuilt hex). Then `/stage-finish S06` — **HUMAN REVIEW GATE**.
MCU API so far: `parseIntelHex(text, size=0x8000) → { bytes: Uint8Array, highestAddress }`; `HexParseError`.
Decisions: sim-mcu stays pure TS (no DOM/Node) in runtime; the sim-* eslint boundary now permits Node
built-ins in `*.test.ts` (fixtures read from disk).
Gotchas: `resources/toolchain/` gitignored; `tools/fetch-toolchain.mjs` is the only networked code;
`vc-check` uses `pnpm -s` (empty failure output).
Blocked: none.

## Human actions pending
- (none)
