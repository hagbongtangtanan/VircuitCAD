# ADR 0003 — Simulation worker protocol

Status: accepted.

## Context

Simulation must not block the UI, runs in a Web Worker, and must be validated at every boundary
(all IPC/worker payloads are zod-checked). Results feed the canvas at a bounded rate.

## Decision

- One worker (`@vircuitcad/editor/sim/solver.worker`) owns a `@vircuitcad/sim-analog` simulation; the
  main thread talks to it through `SimulationHost`.
- Commands (main→worker, `WorkerCommandSchema`): `start { circuit }`, `stop`, `pause`, `resume`,
  `setParam { partId, key, value }`. `start` carries the whole zod-validated `Circuit`.
- Events (worker→main, `WorkerEventSchema`): `status { state, time }`, `snapshot { time,
  nodeVoltages, leds[], meters[] }`, `error { code, message, nets? }`.
- The worker never imports DOM/Electron; it only imports `sim-analog` (+ `core` types).
- Snapshots are coalesced latest-wins per probe; the UI throttles to ≤ 60 Hz.
- Errors carry the offending net names so the canvas can highlight the part(s).

## Consequences

- The renderer stays responsive; heavy solves are off the main thread.
- Structural edits rebuild the netlist; parameter edits are hot (re-run) — a later stage may split
  `setParam` from `start` for incremental rebuilds.
- The protocol is transport-agnostic; an in-process host could be swapped for tests.
