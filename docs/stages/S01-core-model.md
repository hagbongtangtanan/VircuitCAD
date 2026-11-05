# S01 — Core model, breadboard connectivity, netlist

## Goal
A pure, fully tested circuit model: schema, part manifests, breadboard hole connectivity, deterministic netlist extraction, undo/redo store, versioned save format. No rendering.

## Read first
`docs/ARCHITECTURE.md` (Data flow), `packages/core` public API from S00.

## Tasks
- [x] **S01-T01** Zod schema + types: `Circuit`, `PartInstance` (id, partId, position, rotation, params), `Wire` (endpoints = pin/hole refs, waypoints, colour), `Board`; `schemaVersion = 1`; stable ids (nanoid). → round-trip tests.
- [x] **S01-T02** Part manifest schema + registry: pins (id, name, position, electrical role), params with units/ranges, `simModel` id, svg ref; register 3 placeholder parts (resistor, LED, battery). → invalid manifests rejected with clear errors.
- [ ] **S01-T03** Breadboard geometry generator (full + half): holes, 5-hole strips, power rails (with the **mid-board rail split** on full boards), column/row labels. → unit tests on counts and groups.
- [ ] **S01-T04** Netlist extractor: union-find over pins, wires and hole groups; nets named deterministically (sorted); ground detection; floating-pin report; parts straddling strips. → golden netlist fixtures.
- [ ] **S01-T05** Property tests (fast-check): netlist invariant to wire order, which hole of a strip is used, part rotation, id regeneration. → ≥ 5 properties, 1000 runs.
- [ ] **S01-T06** Serialization `.vcad` (JSON) + migration framework (`migrate(v → v+1)` chain) + `fixtures/vcad/v1/*.vcad`. → loading a v1 fixture works; a fake v2 migration test proves the chain.
- [ ] **S01-T07** Document store (Zustand + Immer patches): commands (add/move/rotate/delete part, add/delete wire, set param), undo/redo via inverse patches, change events for autosave. → headless tests incl. 100-step undo/redo round-trip.

## Pitfalls
- Two pins in the same hole, wire from a hole to itself, duplicate wires → must be no-ops or clear errors, never crashes.
- Net naming must not depend on insertion order (determinism → stable tests, stable solver node order).
- Keep geometry in logical grid units, not pixels. Do not import Pixi/React here.
- Immer patches and undo: group multi-step gestures (drag) into one undo entry.

## Exit gate
- All tests green incl. property tests; `core` coverage of netlist ≥ 90 %.
- Fixture of a "battery → resistor → LED" breadboard circuit extracts the expected 3-net netlist.

## Handoff to next stage
Record: public API of `core`, command list, netlist output shape (the solver contract for S03/S04).
