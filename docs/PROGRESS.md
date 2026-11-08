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
S04 IN PROGRESS, branch `stage/s04-vertical-slice`. Done: T01 (bridge + `solveSimulation` source
stepping; zod worker protocol; editor `solver.worker` + `SimulationHost`), T02 (Run/Pause/Stop,
sim status, error toast + `SimError` net→part highlight; Scene `setSimulation`/`setHighlight`; >100 A
⇒ SHORT_CIRCUIT; E2E toast), T03 (catalog + bridge mappings for battery-pack/pushbutton/slide-switch/
capacitor/inductor + own per-model vector art), T04 (visual mappings `ledGlow`/`ledTint`/
`voltageToColor` + LED tint/alpha + net-colouring toggle `Editor.setNetColoring` + Toolbar 'Nets').
Next: T05 multimeter + bench supply, T06 `examples/*.vcad` + E2E, T07 perf baseline + ADR 0003 +
MODELS update; then `/stage-finish S04` — **HUMAN REVIEW GATE** (finish exits 10, PR left open).
APIs: `SimulationHost.start(circuit)/stop/pause/resume/setParam/dispose` with `onSnapshot/onStatus/
onError`; `SimSnapshot { time, nodeVoltages, leds[] }`; error event carries `nets` for highlighting;
Scene `setSimulation({leds})`, `setHighlight(partIds)`.
Decisions: worker gets the full zod-validated `Circuit`; shorts detected by source current >100 A
(sources have 1e-6 internal R, so parallel/short sources draw huge current rather than going
singular); LED burnout non-latching; pin-to-pin parts must sit off the rail (`y≈20`).
Gotchas: `vc-check` uses `pnpm -s` (empty failure output); fps under 4 parallel dev-web workers drops
to ~6 (single worker ~50); the sim worker needs the CSP fallback `default-src 'self'` (no worker-src).
Blocked: none.

## Human actions pending
- (none)
