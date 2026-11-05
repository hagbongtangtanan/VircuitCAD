# S08 — Parts wave 1: semiconductors, digital ICs, 555

## Goal
A scalable part-authoring kit plus the core analog semiconductors, sensors-as-resistors, relay, a digital engine and the classic ICs.

## Read first
`docs/MODELS.md`, `packages/parts` conventions, S04/S06 Handoffs (sim-model registration, bridge thresholds).

## Tasks
- [ ] **S08-T01** Part-authoring kit: `docs/PARTS.md`, `pnpm new-part <id>` scaffold, manifest validator, lint rule: every part needs a demo circuit + a test. → CI fails on a part without both.
- [ ] **S08-T02** BJT (NPN/PNP, Ebers-Moll + Early), MOSFET (level-1 N/P), Schottky and Zener variants. → golden tests vs ngspice.
- [ ] **S08-T03** Op-amp (finite gain, rail limits, optional slew) and comparator. → follower/inverting/comparator tests.
- [ ] **S08-T04** Potentiometer/trimmer, LDR, NTC thermistor with on-canvas sliders. → params animate live without netlist rebuild.
- [ ] **S08-T05** Relay (coil L+R, contact hysteresis) with flyback-diode demo. → transient test of back-EMF clamp.
- [ ] **S08-T06** `sim-digital`: event-driven engine, levels `0/1/Z/X`, optional propagation delay, thresholds + Thevenin outputs at the analog boundary (74HC levels). → mixed circuit converges without ping-pong.
- [ ] **S08-T07** 74xx gates, 7474 flip-flop, 74HC161 counter, 74HC595 shift register, decoder, 4017. → truth-table/state-sequence tests.
- [ ] **S08-T08** 555 timer (behavioural, comparator hysteresis) with astable/monostable demos. → frequency/duty within 5 % of formula.
- [ ] **S08-T09** 7-segment (common anode/cathode), LED bar, RGB LED. → per-segment current tests.
- [ ] **S08-T10** Demo circuit + test for every part above; update `docs/MODELS.md` and `THIRD_PARTY.md`.

## Pitfalls
- Analog↔digital feedback loops can oscillate in the solver → iterate with a cap, then settle on the last stable state with a warning.
- Wired-logic conflicts must resolve to `X`, not crash.
- MOSFET and BJT saturation are the usual non-convergence sources: reuse junction limiting and gmin stepping.
- IC pin 1 notch orientation and DIP straddling the breadboard centre gap must be correct in manifests.
- 555 internal comparators chatter without hysteresis.

## Exit gate
- Every part has a demo and a passing test; golden suite still within tolerance; no solver non-convergence in the demo suite.

## Handoff to next stage
Record: digital-engine API, boundary rules, list of parts with their sim-model ids.
