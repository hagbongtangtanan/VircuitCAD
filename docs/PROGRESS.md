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
S02 complete (T01–T08); running `vc-stage-finish.sh S02` → tag `stage-s02-done`. Next: S03 analog
solver (MNA/Newton; consumes the netlist contract).
Editor API: `new Editor({store,registry,cellSize?,gridSize?})` → `mount/unmount`,
`getViewport/zoomBy/panByScreen`, `onViewportChange`, `getScene`, `getToolController`;
`Scene(renderer,store,registry)` renders the board (one batched Graphics), wires and parts (cached
textures) plus selection/preview; `HitTester(scene).hitTest/nearest`; `buildHitTestScene`;
`ToolController.setTool('select'|'place'|'wire',partId?)`, `pointerDown/Move/Up(gridPoint)`,
`keyDown(key)`; placement helpers `snapPartPosition`/`isPlacementValid`.
Add a part visual: swap `createPlaceholderPartTexture` for the manifest's `svg` asset (loaded via
`TextureCache`, keyed by `manifest.id`+rotation); real SVG art will live in `packages/parts`.
App/UI: desktop `App` composes `@vircuitcad/ui` (PartsBin/Inspector/Toolbar/StatusBar) with the
editor, save/load via adapter dialogs (app-data fallback for dev-web) + autosave journal + dirty
flag; `window.__app`/`window.__editor` for E2E.
Perf note: ≈50 fps at 100 parts under SwiftShader (no GPU, 1 worker); ~30 fps with 4 parallel
workers; board stays constant draw calls (one sprite per part).
Decisions: world = grid × `cellSize` (20); wires join only at shared endpoints/strips;
`DocumentStore.replace` added for load; dev-web dialogs return null → app-data fallback path.
Gotchas: `vc-check` uses `pnpm -s` (empty failure output); editor typecheck needs `@types/rbush`;
ui tests need jsdom + testing-library at the workspace root.
Blocked: none.

## Human actions pending
- (none)
