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
S04 IN PROGRESS, branch `stage/s04-vertical-slice`. Done: T01–T04 (worker host + bridge; run
controls/status/toast/highlight; parts + own art; LED glow + net colouring), T05 (power-supply and
multimeter manifests; bridge maps supply → voltage source and ammeter-mode meter → 0 V source;
`readMeters` reports V and A, Ω null (power-off); snapshot `meters` + `InstrumentPanel`).
Next: T06 `examples/*.vcad` (LED+resistor, divider, RC charge, switch-LED) + E2E loading them;
T07 perf baseline on a 50-part circuit + ADR 0003 (worker protocol) + MODELS update; then
`/stage-finish S04` — **HUMAN REVIEW GATE** (finish exits 10, PR left open for Windows testing).
Gotchas: `readMeters`/`MeterReading` must be exported from sim-analog; fps under 4 parallel dev-web
workers is ~6 (single worker ~30–50); worker relies on CSP fallback (no worker-src).
APIs: `SimulationHost.start(circuit)/stop/pause/resume/setParam/dispose` (`onSnapshot/onStatus/
onError`); `SimSnapshot { time, nodeVoltages, leds[], meters[] }`; error event carries `nets`;
Scene `setSimulation/setHighlight/setNetColoring`.
Decisions: worker gets the full zod-validated `Circuit`; shorts flagged at >100 A source current
(sources have 1e-6 internal R); LED burnout non-latching; pin-to-pin parts sit off the rail (`y≈20`).
Blocked: none.

## Human actions pending
- (none)
