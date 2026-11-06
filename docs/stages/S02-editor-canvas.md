# S02 — Editor canvas

## Goal
A usable breadboard editor: pan/zoom, place/move/rotate/delete parts, wire tool, parts bin, inspector, save/load, undo/redo, covered by E2E.

## Read first
`docs/stages/S01-core-model.md` Handoff, `packages/core` store API. `docs/RISKS.md` row "Breadboard UX complexity".

## Tasks
- [x] **S02-T01** `packages/editor`: Pixi app mount/unmount, resize, device-pixel-ratio, pan (middle-drag/space-drag) + wheel zoom around cursor, grid. → Playwright asserts canvas present and zoom changes transform.
- [x] **S02-T02** Render breadboard + parts from SVG textures with a texture cache; imperative Pixi layer subscribing to the store (no React re-render per frame). → 5 000 holes render ≥ 60 fps in a benchmark note.
- [x] **S02-T03** Spatial index (rbush) and hit-testing, **pin-first**, then part body, then wire. → unit tests for priority and tolerance.
- [x] **S02-T04** Tools: select, place (drag from bin), move, rotate (R), delete (Del), duplicate; snap pins to breadboard holes; ghost preview; invalid-placement feedback. → store commands only (no direct mutation).
- [x] **S02-T05** Wire tool: click pin/hole → waypoints → click end; snapping, colour choice, delete, move endpoint, wire-over-wire without implicit junction. → netlist updates correctly in tests.
- [x] **S02-T06** React panels in `packages/ui`: parts bin (search, categories), inspector (typed param editors with units/validation), toolbar, status bar. → component tests.
- [ ] **S02-T07** Save/load via adapter dialogs, recent files, dirty indicator, autosave journal to app-data (restore prompt stubbed). → E2E: save → reload → identical.
- [ ] **S02-T08** Playwright E2E (dev-web): place resistor, wire it, undo/redo, rotate, delete, save/load. → in `verify`, with software GL flags.

## Pitfalls
- React re-render storms: keep Pixi imperative, pass store selectors, throttle UI-only state.
- HiDPI blur: scale textures by DPR; keep stroke widths in screen px.
- Hit-test cost on large boards: query the index, never iterate all holes.
- CI has no GPU: SwiftShader flags; tests must not depend on pixel-perfect output (assert state, plus one coarse screenshot at most).
- Keyboard shortcuts must not fire while typing in inspector fields.

## Exit gate
- E2E suite green in CI; editing a 100-part circuit stays responsive (note measured fps in handoff).
- Undo/redo works for every tool.

## Handoff to next stage
Record: editor package API, tool architecture, how to add a part visual.
