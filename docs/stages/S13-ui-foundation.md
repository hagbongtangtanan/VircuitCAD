# S13 — UI foundation and part art

## Goal
Turn the working skeleton into a usable, legible editor: global styling and layout, icon toolbar, parts panel, readable parts, a real breadboard and Arduino Uno drawing, polished canvas interactions, a custom menu, and honest handling of features that do not exist yet. No simulation changes.

## Read first
`docs/DESIGN.md` (the spec is authoritative), `apps/desktop/src/renderer/App.tsx` and `index.html`, `packages/ui/src`, `packages/editor/src/render/*`, `packages/parts` manifests.

## Working rules for this stage
- You cannot see screenshots. Implement the spec in `docs/DESIGN.md` literally, and prove results with **measurable assertions** (computed styles, bounding boxes, scroll sizes, counts), never with "looks fine".
- No inline styles for theming. All colours, spacing, radii and fonts come from CSS variables in the token file.
- No remote fonts, images or icon CDNs. Everything is bundled and original.
- All art is agent-drawn with the art DSL (DESIGN.md 3.5). No hand-placed pin coordinates, no copied artwork, no remote assets.
- Never mock the module under test; prove new tests can fail.
- Do not touch `packages/sim-*`.

## Tasks
- [x] **S13-T01** Design tokens and global stylesheet in `packages/ui/src/theme/` (`tokens.css`, `base.css`): CSS variables from DESIGN.md, reset, typography, styled buttons, inputs, selects, lists, scrollbars, focus rings; dark default plus light theme via `data-theme`. Remove inline styles from `App.tsx` and index.html. → Playwright on the real page asserts computed styles (button font and background from tokens, no default serif, focus ring present); unit test: every text and background token pair meets 4.5:1 contrast in both themes.
- [x] **S13-T02** App shell layout with CSS grid per DESIGN.md 3.1: toolbar, left parts panel, canvas, right inspector, status bar; resizable and collapsible side panels with persisted sizes. → Playwright at 1280x720, 1366x768 and 1920x1080 (and DPR 1.25): no horizontal overflow, regions do not overlap, canvas fills the remaining space, collapse and resize work.
- [x] **S13-T03** Original SVG icon set (at least 24 icons) in `packages/ui/src/icons`, and a toolbar with grouped icon buttons, tooltips showing name and shortcut, active-tool state, and accessible names. Remove the `undo:yes redo:no` text and the header version. → component tests: every button has an accessible name, an icon and a tooltip; focus order is logical.
- [x] **S13-T04** Parts panel: search box, collapsible category accordion with counts, part cards with a small preview and the name, click or drag to place, keyboard navigation. Add `status: 'ready' | 'planned'` to part manifests; planned parts are hidden unless "Show planned" is on, and cannot be placed. → tests: search filters, planned parts cannot be placed, accordion state persists.
- [x] **S13-T05** Part art system with the art DSL from DESIGN.md 3.5: a `PartArt` spec (primitives, pin pads generated from the manifest, label) rendered by Pixi **and** serialisable to SVG, with a texture cache keyed by part, variant and resolution. Art is agent-drawn and lives in `packages/parts/art/` as DSL source; an optional hand-made `<part-id>.svg` in the same folder overrides it. Parts without art get a **fallback card** (name, value, pin dots), replacing the grey rectangles. → unit tests: every manifest resolves to art or fallback; pin anchors equal manifest pin positions within 0.5 px; no primitive lies outside the footprint; body-to-background contrast at least 3:1; SVG output structure test; texture cache hits on repeat.
- [x] **S13-T06** Breadboard and Arduino Uno artwork (agent-drawn with the art DSL, original): breadboard body, centre trench, power rails with stripes and +/- marks, column letters and row numbers at zoom thresholds, strip highlight on hover; Uno board with all header labels (D0 to D13, A0 to A5, 5V, 3V3, GND, VIN, RESET), USB, power jack and MCU chip. → tests: hole and pin positions match manifest geometry; label counts correct; benchmark note: 60 fps with breadboard plus 20 parts.
- [x] **S13-T07** Canvas interaction polish: pin hover highlight and tooltip (pin and net names), snap indicator, wire styling and colour choice, selection outline and handles, rubber-band selection, cursor per tool, on-canvas zoom controls (minus, percent, plus, fit) and grid toggle, empty-state hint. → tests on state and DOM (not pixels); zoom controls change the viewport; pan and zoom still cause 0 React commits.
- [x] **S13-T08** Status bar and inspector formatting: status bar segments with separators (parts, wires, zoom, simulation state, time, saved or unsaved dot); inspector header with icon and part name, labelled field groups with units and validation messages, styled selects for enums (for example RGB LED common: cathode or anode), a document summary when nothing is selected. → component tests with real components; formatting tests for units.
- [x] **S13-T09** Custom application menu and window: File (New, Open, Save, Save As, Export), Edit (Undo, Redo, Delete, Select all, Duplicate), View (Zoom in, out, reset, fit, toggle grid, toggle panels, theme), Help (About with the version, Shortcuts, Licenses); title shows project name and a dirty marker; minimum size 1024x640; window bounds persist; no dev menus in production. → unit tests of the menu template; E2E that accelerators trigger the same commands as the toolbar.
- [x] **S13-T10** No dead controls: Run, Pause, Stop and Code are disabled with a tooltip until the capability exists (capability flags from core), parts without models are marked planned. → tests: disabled controls cannot trigger commands and state the reason.
- [ ] **S13-T11** Visual QA harness: `pnpm e2e:screens` saves PNGs at 3 viewport sizes for 5 states (empty, parts placed, part selected, wire being drawn, light theme) plus a **parts gallery** page (every part and the breadboard and Uno at 1x and 2x) to `artifacts/screens/`; CI uploads them; automatic checks for clipped text (`scrollWidth > clientWidth`), controls below 28 px, and overlapping regions; add `docs/UI-REVIEW.md` checklist. → CI artifact present and checks pass.
- [ ] **S13-T12** Write `docs/DESIGN.md` fully (tokens, components, icon rules, part-art rules, how to add a part's art) and update `AGENTS.md`: use tokens only, every new part needs art or the fallback, planned parts stay hidden, tests measure layout instead of judging looks. → docs only.

## Pitfalls
- Pixi text is expensive: cache label textures, show pin names only above the zoom threshold, and never create Text objects per frame.
- `style-src 'unsafe-inline'` is currently allowed; prefer classes and CSS files so it can be tightened later.
- Panels must not re-render on pan and zoom: reuse the S12 selector pattern.
- HiDPI: scale textures by device pixel ratio and keep stroke widths in screen pixels.
- Keep the custom menu in the main process; send actions to the renderer through the existing validated IPC.

## Exit gate
- `vc-check full` green; computed-style, layout and contrast tests pass; every test proven able to fail.
- CI uploads screenshots; **human review (S13 is a review gate):** open the Windows artifact or screenshots and confirm panels, toolbar, parts, breadboard and status bar are readable and clean at 1366x768 and 1920x1080.
- No part appears as a nameless grey rectangle; no control exists that does nothing.

## Handoff to next stage
Record: token file location, how to add a part's art (SVG path and anchors), the planned/ready flag, capability flags for disabled controls.
