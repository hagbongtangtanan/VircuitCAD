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
S03 IN PROGRESS, branch `stage/s03-analog-engine`. Done: T01 (dense LU solver on Float64Array
buffers, partial pivoting, singularity flag), T02 (`MnaSystem` stamps + deterministic `buildNodeMap`
+ `Device`/`MnaContext` interfaces + gmin), T03 (linear devices: resistor, DC voltage source with
series internal R, current source, open/closed switch; `setup`/`stamp` phases).
Next: T04 DC operating point (Newton, abstol/reltol/vntol, gmin then source stepping), T05
nonlinear (diode/LED/Zener + `pnjlim`), T06 transient (C/L companions, BE+trap, adaptive dt), T07
typed `SimError` + one test circuit each, T08 ngspice golden harness + 20 circuits + committed JSON,
T09 bench + `docs/MODELS.md`; then `/stage-finish S03`.
sim-analog API: `LuDecomposition`; `MnaSystem(nodeCount)` with `addConductance/addCurrent/
reserveVoltageSource/stampVoltageSource/addBranchResistance/setVoltageSource/addGmin/solve/
nodeVoltage/branchCurrent/isSingular`; `buildNodeMap(netlist)` (ground net = 0, others sorted);
`Device { name, nodes, setup?, stamp, update?, limit?, breakpoints? }`; `createMnaContext`,
`setupDevices`, `stampDevices(system, devices, previous?, gmin)`; devices `createResistor`,
`createVoltageSource(name, p, n, v, internalR=1e-6)`, `createCurrentSource`, `createSwitch`.
Decisions: netlist nets → nodes via `buildNodeMap`; voltage-source branch indices are reserved in
`setup()` so re-stamping after `reset()` stays stable; internal R uses the branch diagonal
(`-R`), no hidden node; gmin (1e-12) every stamp.
Gotchas: `vc-check` uses `pnpm -s` (failure output can be empty); MnaSystem branch row is
`nodeCount + branch + 1` in 1-based stamps (off-by-one bug already fixed).
Blocked: none.

## Human actions pending
- (none)
