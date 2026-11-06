# PROGRESS — authoritative state (keep ≤ 60 lines)

Do not add columns: scripts parse this table. `done` is set only by `scripts/vc-stage-finish.sh`.

| ID | Stage | Status |
|---|---|---|
| S00 | Foundations, CI and platform adapter | done |
| S01 | Core model, breadboard connectivity, netlist | pending |
| S02 | Editor canvas | pending |
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
S01 complete (T01–T07 + netlist coverage gate); running `vc-stage-finish.sh S01`. Next: S02 editor
canvas (pan/zoom, place/move/rotate/delete, wire tool, parts bin, inspector, save/load, E2E).
core public API: model (`Circuit`/`PartInstance`/`Wire`/`Board`, `createEmptyCircuit`,
`createPartInstance`, `createWire`, `schemaVersion=1`); parts (`PartManifest`, `PartRegistry`,
`createDefaultPartRegistry` = resistor/led/battery); board (`generateBoardGeometry`,
`extractNetlist` → `{ nets: {name,isGround,pins,holes}[], floatingPins }`); serialize
(`serializeCircuit`/`deserializeCircuit`, `runMigrations`); store (`DocumentStore`: addParts,
move/rotate/deletePart, addWire/deleteWire, setParam, transaction, undo/redo, onChange).
Decisions: rotation is CCW (90 → (-y,x)); a part's `position` is the pin origin for rotated pin
offsets; nets named N1.. with the ground net as GND, ordered by a canonical pin+hole key; `.vcad`
migrations run through a v→v+1 chain.
Gotchas: `vc-check.sh` uses `pnpm -s` (failure output can be empty); core `tsconfig` sets
`types:[node]` for fixture reads; netlist coverage is enforced on demand via vitest `--coverage`.
Blocked: none.

## Human actions pending
- (none)
