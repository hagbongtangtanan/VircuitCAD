# PROGRESS — authoritative state (keep ≤ 60 lines)

Do not add columns: scripts parse this table. `done` is set only by `scripts/vc-stage-finish.sh`.

| ID | Stage | Status |
|---|---|---|
| S00 | Foundations, CI and platform adapter | done |
| S01 | Core model, breadboard connectivity, netlist | done |
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
S02 IN PROGRESS, branch `stage/s02-editor-canvas`. Done: T01 (Pixi mount/unmount/resize/DPR,
cursor-anchored zoom + middle/space pan, grid, `window.__editor`), T02 (`Scene` renders board
holes as one batched Graphics + parts via `TextureCache`, subscribes to `DocumentStore` — no React
re-render per frame), T03 (`HitTester` with rbush; priority pin > hole > part body > wire, world
tolerance, kind filter; `buildHitTestScene`).
Next: T04 tools (select/place/move/rotate/delete/duplicate via `DocumentStore` commands only,
snap, ghost, invalid feedback), T05 wire tool, T06 React panels in `packages/ui`, T07 save/load via
adapter + autosave journal, T08 Playwright E2E.
Editor API: `new Editor({ store, registry, cellSize?, gridSize? })` → `mount/unmount`,
`getViewport/zoomBy/panByScreen`, `getScene`; `Scene(renderer, store, registry)`;
`HitTester(scene).hitTest(point, tolerance, kinds?)`; `buildHitTestScene(circuit, registry,
geometry, cellSize)`.
Decisions: world units = grid units × `cellSize` (20); board is constant draw calls; parts use
cached placeholder textures (real SVG art pending under `packages/parts`); rotation shared via
core `rotateGridVector`.
Gotchas: `vc-check.sh` uses `pnpm -s` (failure output can be empty); editor typecheck needs
`@types/rbush` (root); the 100-part / 5000-hole fps benchmark note is still to be recorded at T08.
Blocked: none.

## Human actions pending
- (none)
