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
S03 complete (T01–T09); running `vc-stage-finish.sh S03` → tag `stage-s03-done`. Next: S04 vertical
slice (battery + resistor + LED lights up) — consume this engine.
Engine API: `solveOperatingPoint(system, devices, initial?, options) → { solution, converged,
iterations, method }`; `solveDcOrThrow(system, devices, options)` (throws `SimError`);
`runTransient(system, devices, { tstop, dt?, method?: 'be'|'trapezoidal', adaptive?, breakpoints? })
→ { time, solution }[]`; `MnaSystem`, `buildNodeMap(netlist)`, `setupDevices`, `stampDevices`.
Devices (each carries `kind`): `createResistor`, `createVoltageSource(name,p,n,v,internalR?)`,
`createCurrentSource`, `createSwitch`, `createDiode`, `createLed(name,color,a,b)`,
`createZener(name,a,b,vz)`, `createCapacitor`, `createInductor`; branches/nodes are allocated in
`setup()`. Map a core netlist to devices via `buildNodeMap` (pin → net) + `manifest.simModel`.
Errors: `SimError { code: SHORT_CIRCUIT | NO_GROUND | FLOATING | NO_CONVERGENCE | SOURCE_LOOP, refs }`.
Benchmark: 21-node RC ladder ≈ 42 000 transient steps/sec. Golden: 20 circuits + closed-form oracle
+ committed `results.json`; `tools/ngspice/` runs native ngspice (skips when absent).
Gotchas: keep ngspice out of runtime code (only `tools/` and tests); TS6 `Float64Array` is generic
over its buffer (annotate); the sim-* lint forbids Node built-ins even in `bench/`.
Blocked: none.

## Human actions pending
- (none)
