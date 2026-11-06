# PROGRESS — authoritative state (keep ≤ 60 lines)

Do not add columns: scripts parse this table. `done` is set only by `scripts/vc-stage-finish.sh`.

| ID | Stage | Status |
|---|---|---|
| S00 | Foundations, CI and platform adapter | done |
| S01 | Core model, breadboard connectivity, netlist | done |
| S02 | Editor canvas | done |
| S03 | Analog solver engine | pending |
| S04 | Vertical slice: battery + resistor + LED lights up | pending |
| S05 | Offline Arduino toolchain and compile service | pending |
| S06 | AVR emulation and mixed-signal bridge | pending |
| S07 | Code editor, upload flow, serial monitor | pending |
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | pending |
| S09 | Parts wave 2 and instruments | pending |
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S03 IN PROGRESS, branch `stage/s03-analog-engine`. Done: T01 (dense LU solver), T02 (`MnaSystem` +
`buildNodeMap` + `Device`/`MnaContext` + gmin + `addNode()` for internal nodes), T03 (linear devices
R/V/I/switch), T04 (`solveOperatingPoint`: Newton + gmin/source stepping), T05 (nonlinear diode/LED/
Zener with `pnjlim` and reverse-breakdown limiting; LED colour Vf + burnout flag; solver branch
convergence uses relative tolerance).
Next: T06 transient (C/L companions, BE + trapezoidal, adaptive dt with breakpoints), T07 typed
`SimError` (`SHORT_CIRCUIT`/`NO_GROUND`/`FLOATING`/`NO_CONVERGENCE`/`SOURCE_LOOP`) + a test circuit
each, T08 ngspice golden harness + 20 circuits + committed result JSON, T09 `bench/` steps/sec +
`docs/MODELS.md`; then `/stage-finish S03`.
sim-analog API: `createDiode(name,a,b,{is,vt,n,seriesResistance,maxCurrent})`,
`createLed(name,color,a,b,opts)` (Vf map, rs 20, burnout >60 mA), `createZener(name,a,b,vz,opts)`
(isBreakdown default 1e-3), `pnjlim`. Devices may `system.addNode()` in `setup()` for internal
nodes; nonlinear devices linearize from `ctx.voltage(node)` and add a companion current source.
Decisions: node/branch allocation only in `setup()` (before stamping); nonlinear `limit()` clamps
forward (pnjlim) and reverse breakdown (-vz-30·vt); branch rows are `nodeCount + branch + 1`.
Gotchas: `vc-check` uses `pnpm -s` (empty failure output); `Float64Array` is generic over its buffer
in TS6 — annotate `let current: Float64Array`; tiny node rounding on huge conductances needs the
relative branch tolerance; `overflow clamp` on exponentials at ±80·vt.
Blocked: none.

## Human actions pending
- (none)
