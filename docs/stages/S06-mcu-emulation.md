# S06 — AVR emulation and mixed-signal bridge

## Goal
Run compiled sketches on an emulated ATmega328P inside the circuit: GPIO, PWM, ADC, serial, with the MCU pins coupled to the analog solver. Human review gate.

## Read first
Handoffs of S04 (worker protocol) and S05 (fixtures); `docs/RISKS.md` rows "Co-sim performance", "PWM and analog stiffness", "SharedArrayBuffer".

## Tasks
- [x] **S06-T01** `sim-mcu`: Intel HEX parser → program memory; checks against the S05 fixtures. → malformed-hex tests.
- [x] **S06-T02** avr8js integration (pinned; verify supported peripherals in its types first): CPU, timers 0/1/2, ports B/C/D, USART, ADC, SPI, TWI. Cycle-driven run loop with wall-clock pacing (16 MHz), drift correction, pause/resume/reset, and a **deterministic cycle-driven mode** for tests. → blink fixture toggles at 1 Hz ±0.1 % in deterministic mode.
- [x] **S06-T03** MCU worker host: zod protocol, pin-change events stamped with cycle counts, serial in/out, ≤ 60 Hz snapshots. → protocol tests.
- [x] **S06-T04** Arduino Uno part: manifest, own SVG, pin map (D0–D13, A0–A5, 5V, 3V3, GND, VIN, RESET), on-board LED on D13, power-supply model. → placeable in editor.
- [ ] **S06-T05** Mixed-signal bridge: OUTPUT pin = Thevenin source (≈ 25 Ω, 0/5 V); INPUT = Hi-Z; INPUT_PULLUP = 20–50 kΩ to 5 V; digitalRead uses thresholds with hysteresis; analogRead samples node voltage → 10-bit with reference handling; solver re-solves **on pin edges only**. → circuit tests: button+pullup, divider into A0.
- [ ] **S06-T06** PWM: detect timer-driven PWM; quasi-static average (duty × V) when the circuit has no reactive parts, full transient otherwise; LED brightness from average current. → pot-dimmed LED example.
- [ ] **S06-T07** Co-sim scheduler: the MCU clock is master; solver advances to event timestamps; backlog limit and a visible "running at 0.4× real time" indicator; speed control (0.1×–max). → synthetic overload test.
- [ ] **S06-T08** Fill the S05 sidecar expected traces; deterministic trace tests for every fixture (blink, millis, button, serial, pwm, adc, timer-isr). → all pass.
- [ ] **S06-T09** Examples: blink (D13 LED + resistor), button-LED, pot-dimmed LED, serial-hello. → E2E with prebuilt hex (no toolchain needed in CI).

## Pitfalls
- Electron throttles timers in background windows → `backgroundThrottling: false`; pacing must tolerate hiccups (catch up, don't spiral).
- `delay()`/`millis()` accuracy depends on timer0 prescaler/overflow handling — test them.
- ADC needs the sampling delay and reference setting (AVCC vs internal) to be honoured.
- PWM at 490/980 Hz with 20 µs steps can be stiff → use the quasi-static path by default.
- Start with `postMessage`; only consider SharedArrayBuffer after profiling (needs COOP/COEP).
- Floating-point drift: use integer cycle counters for time.

## Exit gate
- Fixture trace tests, co-sim tests and E2E examples green in CI.
- **Human (S06 is a review gate):** on the Windows installer, run blink, button-LED, pot-dimmed LED and serial-hello (using prebuilt hex); confirm smooth 60 fps and correct behaviour.

## Handoff to next stage
Record: MCU worker API, bridge rules (thresholds, resistances), scheduler behaviour, measured MHz-equivalent throughput.
