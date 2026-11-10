# S09 — Parts wave 2 and instruments

## Goal
Oscilloscope, function generator, displays, actuators, sensors, NeoPixel, plus a performance pass on large circuits.

## Read first
`docs/PARTS.md`, S06 and S08 Handoffs.

## Tasks
- [x] **S09-T01** Oscilloscope: 2 channels, time/div, volts/div, edge trigger (auto/normal), cursors, panel rendered on canvas, decimating ring buffer fed by solver probes. → deterministic render-data tests.
- [x] **S09-T02** Function generator (sine/square/triangle, freq, amplitude, offset) and bench supply upgrades (CC mode). → frequency/amplitude tests.
- [x] **S09-T03** LCD 16×2 (HD44780, 4/8-bit, custom chars, busy-flag timing tolerance) + `LiquidCrystal` example. → command-sequence tests.
- [x] **S09-T04** Servo (pulse width → angle), DC motor (R + L + back-EMF, visual speed), L293D H-bridge, piezo buzzer (WebAudio from pin square wave, mute button). → tests per model.
- [x] **S09-T05** Sensors: HC-SR04 (distance slider, echo timing from the cycle clock), PIR, TMP36, 4×4 keypad, joystick. → example sketch per sensor.
- [x] **S09-T06** WS2812/NeoPixel strip: decode ~800 kHz bit stream from pin edge timestamps (cycle-accurate), render colours. → decoded-frame tests from fixture traces.
- [ ] **S09-T07** Library bundle additions (check licences, pin versions), fixtures + examples for Servo, LiquidCrystal, NeoPixel. → `toolchain` CI job covers them.
- [ ] **S09-T08** Performance pass: benchmark circuit with 100 parts / 300 wires; set budgets (≥ 30 fps editor, solver ≥ 1× real time); fix top 3 hotspots; budgets enforced in CI bench job. → numbers in Handoff.

## Pitfalls
- Audio is blocked until a user gesture: start the AudioContext on first click, and always provide mute.
- Scope sampling vs adaptive solver steps: resample to a uniform grid before display.
- `Servo` takes Timer1 (kills PWM on D9/D10) — model it faithfully and document.
- NeoPixel timing needs cycle-accurate pin timestamps, never wall-clock time.
- LCD sketches poll or delay unpredictably → tolerate busy-flag timing.

## Exit gate
- Demo circuits for all parts pass; performance budgets met and enforced in CI.

## Handoff to next stage
Record: instrument APIs, perf numbers, library additions.
