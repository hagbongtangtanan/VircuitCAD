# S10 — Blockly, example library, schematic view

## Goal
Block-based coding that generates Arduino C++, a library of ≥ 25 example circuits, and a read-only schematic view derived from the netlist.

## Read first
S07 Handoff (code panel), `docs/PARTS.md` (schematic symbols), `docs/adr/` list.

## Tasks
- [x] **S10-T01** Blockly bundled offline (locales included, pinned version), toolbox: logic, loops, math, variables, text, Arduino I/O, time, serial, Servo and LCD blocks. → no external requests.
- [x] **S10-T02** Arduino C++ generator + read-only code view; per-project mode (blocks | text) — switching blocks→text is allowed with a warning, text→blocks is not offered. → generator unit tests.
- [x] **S10-T03** Workspace serialization inside `.vcad` (schema v2 + migration from v1 + fixtures). → old files still open.
- [ ] **S10-T04** Example library: ≥ 25 circuits with metadata (category, difficulty, description), loaded from bundled `.vcad`; browser dialog with search. → every example is smoke-tested in CI (loads, runs 2 s, no `SimError` unless intended).
- [ ] **S10-T05** Schematic view: auto-layout from the netlist using manifest `schematicSymbol`s; selection cross-highlights with the breadboard; labelled nets; export to SVG. → netlist-equivalence test (schematic nets == breadboard nets).
- [x] **S10-T06** Blocks↔text parity: 5 programs produce identical pin traces from blocks and from handwritten code. → deterministic trace comparison.
- [ ] **S10-T07** Docs: blocks reference, schematic limitations (read-only, auto-layout).

## Pitfalls
- Blockly API shifts between versions → pin and read types from `node_modules`.
- Auto-layout crossings are acceptable; **netlist correctness is not negotiable** (use net labels when routing is messy).
- Block-generated code must compile with the bundled core/libraries only.
- Keep the bundle lazy-loaded; startup time budget must not regress.

## Exit gate
- Parity tests, example smoke tests and schematic equivalence tests green.

## Handoff to next stage
Record: example list, schema version, known layout limitations.
