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
S02 IN PROGRESS, branch `stage/s02-editor-canvas`. Done: T01 (Pixi mount/zoom/pan/grid), T02
(`Scene` batches board holes + cached part textures, imperative store subscription), T03
(`HitTester` rbush; pin > hole > part > wire, tolerance, kind filter; `buildHitTestScene`), T04
(`ToolController`: select/drag-move with hole snap, click-place with ghost + validity, R rotate,
Del delete, D duplicate — all via `DocumentStore`; `Scene` selection + preview), T05 (wire tool:
pin/hole → waypoints → pin/hole, ghost line, colour, endpoint editing; select+delete wires; core
gains `moveWireEndpoint`/`setWireColor`).
Next: T06 React panels in `packages/ui` (parts bin, inspector, toolbar, status bar), T07 save/load
via adapter dialogs + recent files + dirty/autosave journal, T08 Playwright editing E2E (place,
wire, undo/redo, rotate, delete, save/load) + record the 100-part fps note, then `/stage-finish S02`.
Editor API: `new Editor({ store, registry, cellSize?, gridSize? })` → `mount/unmount`, viewport
helpers, `getScene`, `getToolController`; `ToolController.setTool('select'|'place'|'wire', partId?)`,
`pointerDown/Move/Up(gridPoint)`, `keyDown(key)`, `setWireColor`; `Scene.setSelection/setPreview/
setWirePreview`.
Decisions: world units = grid units × `cellSize` (20); wires only connect at shared endpoints/strips
(no mid-segment junctions); parts use cached placeholder textures (real SVG art pending under
`packages/parts`).
Gotchas: `vc-check.sh` uses `pnpm -s` (failure output can be empty); editor typecheck needs
`@types/rbush` (root); fps benchmark note still pending for T08.
Blocked: none.

## Human actions pending
- (none)
