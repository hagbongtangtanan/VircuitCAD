# PROGRESS — authoritative state (keep ≤ 60 lines)

Do not add columns: scripts parse this table. `done` is set only by `scripts/vc-stage-finish.sh`.

| ID | Stage | Status |
|---|---|---|
| S00 | Foundations, CI and platform adapter | done |
| S01 | Core model, breadboard connectivity, netlist | done |
| S02 | Editor canvas | done |
| S03 | Analog solver engine | done |
| S04 | Vertical slice: battery + resistor + LED lights up | pending |
| S05 | Offline Arduino toolchain and compile service | pending |
| S06 | AVR emulation and mixed-signal bridge | pending |
| S07 | Code editor, upload flow, serial monitor | pending |
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | pending |
| S09 | Parts wave 2 and instruments | pending |
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S04 IN PROGRESS, branch `stage/s04-vertical-slice`. Done: T01 (`buildSimulation(circuit, registry)` +
`solveSimulation` source stepping; zod worker protocol; `@vircuitcad/editor` `solver.worker` +
`SimulationHost`).
Next: T02 run controls + status bar + error toast + `SimError` canvas highlight, T03 part art/models
(own SVG), T04 LED glow/burnout visual + net colouring toggle, T05 multimeter + bench supply, T06
`examples/*.vcad` + E2E, T07 perf baseline + ADR 0003 + MODELS update; then `/stage-finish S04` —
**S04 is a HUMAN REVIEW GATE** (finish exits 10, PR left open).
APIs: `buildSimulation(circuit, registry) → Simulation { system, devices, nodeMap, netlist, nodeOf,
deviceByName }`; `solveSimulation(sim) → OperatingPointResult` (source stepping via `setScale` on
voltage sources); `WorkerCommandSchema`/`WorkerEventSchema`/`SimSnapshot`; editor `SimulationHost`
(`start(circuit)`, `stop/pause/resume`, `setParam`, `onSnapshot/onStatus/onError`, `dispose`).
Decisions: the worker gets the full `Circuit` in `start` (zod-validated); LED burnout is
non-latching (converged current only); parts wired pin-to-pin must be placed off the rail (`y≈20`)
or they short through board strips; sim-analog now depends on `zod`.
Gotchas: `vc-check` uses `pnpm -s` (empty failure output); the worker script imports only
`sim-analog` (no DOM); the internal LED node is allocated in `setup()` (called by `buildSimulation`).
Blocked: none.

## Human actions pending
- (none)
