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
`buildNodeMap` + `Device`/`MnaContext` + gmin), T03 (linear devices R/V/I/switch), T04
(`solveOperatingPoint`: Newton with reltol/vntol/abstol + iteration cap, then gmin stepping, then
optional source stepping via a `setSourceScale` hook).
Next: T05 nonlinear (diode/LED/Zener + `pnjlim`), T06 transient (C/L companions, BE + trap,
adaptive dt with breakpoints), T07 typed `SimError` + one test circuit each, T08 ngspice golden
harness + 20 circuits + committed JSON, T09 bench + `docs/MODELS.md`; then `/stage-finish S03`.
sim-analog API: `solveOperatingPoint(system, devices, initial?, options?) →
{ solution, converged, iterations, method: 'newton'|'gmin'|'source' }`; `SolverOptions`
`{ maxIterations, reltol, vntol, abstol, gmin, gminSteps, sourceSteps, setSourceScale }`. Nonlinear
devices linearize from `ctx.voltage(node)` (previous iterate) and add a companion current source
(`I(v0) - g(v0)*v0`); source stepping needs the caller's `setSourceScale` to rescale V/I sources.
Decisions: netlist nets → nodes via `buildNodeMap`; voltage-source branch indices reserved in
`setup()`; internal R uses the branch diagonal (`-R`); gmin 1e-12 per stamp; linear DC needs 2
Newton iterations (stamp + confirm).
Gotchas: `vc-check` uses `pnpm -s` (empty failure output); `Float64Array` is generic over its
buffer in TS6 — annotate `let current: Float64Array`; MnaSystem branch row is `nodeCount + branch + 1`.
Blocked: none.

## Human actions pending
- (none)
