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
(`HitTester` rbush; pin > hole > part > wire), T04 (`ToolController` select/place/move/rotate/
delete/duplicate via `DocumentStore`; selection + ghost), T05 (wire tool + `moveWireEndpoint`/
`setWireColor` in core), T06 (`@vircuitcad/ui` PartsBin/Inspector/Toolbar/StatusBar with
testing-library+jsdom component tests).
Next: T07 wire the desktop renderer (compose `ui` panels + `Editor` + `DocumentStore`) and add
save/load via adapter dialogs + recent files + dirty indicator + autosave journal to app-data;
T08 Playwright editing E2E (place/wire/undo/redo/rotate/delete/save-load) + record the 100-part fps
note; then `/stage-finish S02`.
APIs: `Editor({store,registry})` → `mount/unmount`, viewport helpers, `getScene`, `getToolController`;
`ToolController.setTool('select'|'place'|'wire', partId?)`, `pointerDown/Move/Up(gridPoint)`,
`keyDown(key)`, `setWireColor`, `getSelectedPartId/WireId`; `Scene.setSelection/setPreview/
setWirePreview`. ui exports `PartsBin/Inspector/Toolbar(ToolbarTool)/StatusBar`.
Decisions: world = grid × `cellSize` (20); wires join only at shared endpoints/strips; placeholder
part textures until real SVG art lands.
Gotchas for T07/T08: the dev-web adapter's `dialogs.openFile/saveFile` return `null`, so save/load
must fall back to an app-data path (or add a path param) for the E2E "save → reload → identical";
`DocumentStore` has no "replace circuit" command yet (add one for load). `vc-check` uses `pnpm -s`
(empty failure output); editor typecheck needs `@types/rbush` (root).
Blocked: none.

## Human actions pending
- (none)
