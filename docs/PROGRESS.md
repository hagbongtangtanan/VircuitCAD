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
S03 IN PROGRESS, branch `stage/s03-analog-engine`. Done: T01 (LU solver), T02 (`MnaSystem` +
`buildNodeMap` + `Device`/`MnaContext` + gmin + `addNode()`), T03 (linear devices R/V/I/switch), T04
(`solveOperatingPoint` + gmin/source stepping), T05 (nonlinear diode/LED/Zener + `pnjlim`), T06
(transient: capacitor/inductor companion models, BE + trapezoidal, breakpoint clamping + adaptive dt,
`runTransient`).
Next: T07 typed `SimError` (`SHORT_CIRCUIT`/`NO_GROUND`/`FLOATING`/`NO_CONVERGENCE`/`SOURCE_LOOP`)
with a test circuit each, T08 ngspice golden harness + 20 circuits + committed result JSON, T09
`bench/` steps/sec + `docs/MODELS.md`; then `/stage-finish S03`.
sim-analog API: `runTransient(system, devices, { tstop, dt?, method?, adaptive?, breakpoints?,
maxIterations?, ... }) → { time, solution }[]`; reactive devices `createCapacitor(name,a,b,C)` /
`createInductor(name,a,b,L)` implement `ReactiveLike` (`setTimeStep(dt, method)`, `commit(solution)`).
Reactive state advances in `commit` (once per step, not per Newton iteration). Inductor uses an MNA
branch reserved in `setup()`.
Decisions: node/branch allocation only in `setup()`; nonlinear `limit()` clamps forward (`pnjlim`)
and reverse breakdown (−vz − 30·vt); solver branch convergence uses a relative tolerance; reactive
companions: BE g=C/dt, trap g=2C/dt; inductor R=L/dt (BE) or 2L/dt (trap) with RHS −R·i_prev (BE).
Gotchas: `vc-check` uses `pnpm -s` (empty failure output); `Float64Array` is generic over its buffer
in TS6 — annotate `let current: Float64Array`; exponentials clamped to ±80·vt.
Blocked: none.

## Human actions pending
- (none)
