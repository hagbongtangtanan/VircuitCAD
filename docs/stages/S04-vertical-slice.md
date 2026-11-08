# S04 — Vertical slice: battery + resistor + LED lights up

## Goal
End-to-end proof: draw a circuit on the breadboard, press Run, see the LED glow, read a multimeter — in the **Windows installer**. Human review gate.

## Read first
Handoffs of S01–S03; `packages/editor` API; `sim-analog` API.

## Tasks
- [x] **S04-T01** Simulation worker host: netlist → solver in a Web Worker, zod-validated message protocol (`start/stop/pause/setParam/probe`), results throttled to ≤ 60 Hz. → protocol tests; worker never imports DOM.
- [x] **S04-T02** Run controls + status bar (running/paused/time/speed), error toasts; `SimError` highlights the offending part/net on canvas. → E2E for a shorted battery shows the message.
- [x] **S04-T03** Part models + art (own SVG): 9 V battery, 3×AA pack, resistor (colour bands from value), LED (colours), pushbutton, slide switch, capacitor, inductor. → each has manifest + sim-model test.
- [ ] **S04-T04** Visual feedback: LED glow by current, burnout visual, optional net-voltage/current colouring toggle. → unit tests on mapping functions.
- [ ] **S04-T05** Instruments: multimeter (V/A/Ω with probe pins), bench DC power supply (V + current limit). → Ω mode measured with power off.
- [ ] **S04-T06** Example circuits (`examples/*.vcad`): LED+resistor, voltage divider, RC charge, switch-LED. → E2E loads each and asserts expected LED/meter state.
- [ ] **S04-T07** Performance baseline on 50-part circuit; ADR 0003 (worker protocol); update `docs/MODELS.md`. → numbers in Handoff.

## Pitfalls
- Worker message flooding → coalesce latest-wins per probe.
- Transient solve while editing: pause/rebuild netlist on structural edits, hot-update params without rebuild.
- LED resistor missing → must burn visibly, not crash.
- Ensure E2E runs without GPU-specific assumptions.

## Exit gate
- E2E "LED lights up" green; installer artifact from CI contains it.
- **Human (S04 is a review gate):** install `vircuitcad-win` on Windows, build battery→resistor→LED, confirm glow, multimeter reading and a clear short-circuit message.

## Handoff to next stage
Record: worker protocol summary, how parts register sim models, performance numbers.
