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
S03 IN PROGRESS, branch `stage/s03-analog-engine`. Done: T01 (LU), T02 (`MnaSystem` + `buildNodeMap`
+ `Device`/`MnaContext` + gmin + `addNode()`), T03 (linear R/V/I/switch), T04 (`solveOperatingPoint`),
T05 (nonlinear diode/LED/Zener + `pnjlim`), T06 (transient C/L companions + `runTransient`), T07
(typed `SimError` + `solveDcOrThrow` + one test circuit per code).
Next: T08 ngspice golden harness — `tools/` runner that shells out to native ngspice (skip if
absent), 20+ circuit specs, tolerance compare, and a **committed result JSON** so `golden`-tagged
tests run without ngspice; T09 `bench/` steps-per-sec report + `docs/MODELS.md`; then
`/stage-finish S03`.
sim-analog API (complete): solver, devices, `runTransient`, `SimError`/`solveDcOrThrow`; devices
carry `kind`; nonlinear devices register internal nodes in `setup()` so `findFloatingNodes` is
exact. `buildNodeMap(netlist)` maps core netlist nets → nodes (ground = 0).
Decisions: node/branch allocation only in `setup()`; nonlinear `limit()` clamps forward + reverse
breakdown; branch convergence uses a relative tolerance; devices `kind` drives diagnostics
(`countVoltageSources`). Exit gate still needs: ≥20 golden circuits within documented tolerance and
a benchmark note (≥20 000 transient steps/s on a 20-node circuit).
Gotchas: `vc-check` uses `pnpm -s` (empty failure output); `Float64Array` is generic over its buffer
in TS6 — annotate `let current: Float64Array`; ngspice must stay out of runtime code (only `tools/`
and tests); build the golden JSON from an independent oracle (ngspice if present, else closed-form
reference) since WSL has no ngspice here.
Blocked: none.

## Human actions pending
- (none)
