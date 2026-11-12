# VircuitCAD: Stage S13 "UI foundation and part art" (continuation pack)

**For:** the current repo (pnpm monorepo, opencode `/stage` workflow). Install it after S12 and before S04.
**Why:** the screenshot shows a working skeleton with no visual design, and the roadmap has no stage that fixes that before the first user-facing vertical slice (S04).

---

## 1. What the screenshot shows, and why

| What you see | Cause in the code (from my review of `main`) |
|---|---|
| Default grey buttons, serif text, bullet lists, classic scrollbar with arrows | There is **no stylesheet**. `index.html` only resets margins and sets a background; the panels use a few inline styles, and class names such as `.param` and `.inspector-empty` have no CSS behind them |
| Grey and red plain rectangles instead of parts | These are **placeholder textures** by design: `createPlaceholderPartTexture` draws a coloured rounded rectangle with no name, value or pins. Real art is planned only for 8 parts in S04-T03 |
| Breadboard is only dots | No board body, rails, labels or colours exist yet |
| Status bar reads "5 parts0 wires88%stopped 0 msUnsaved changes" | Segments are concatenated text with no separators or styling |
| `undo:yes redo:no` next to the toolbar, `v0.0.0` in the header | Debug leftovers |
| Run is clickable but does nothing; a Code button exists | The simulation worker arrives in S04 and the editor in S07, but the buttons were added early |
| The palette lists RGB LED, 7-Segment, Arduino Uno, Multimeter and more | They can be placed but have no simulation model or art yet |
| Default Electron menu (File, Edit, View, Window) | No custom menu |

So the app is not broken so much as **unfinished in a way the plan never scheduled**: visual design is deferred to S11 (settings and themes only), after the simulator. That order is risky, because S04's human review would judge an unstyled app. This stage fixes the order.

### One thing to know about the agent
opencode with a text-only model **cannot see screenshots**, so it cannot judge whether something "looks good". This stage therefore (a) gives it a concrete design spec to implement, (b) makes all artwork **agent-drawn from a small, constrained drawing format** whose geometry is derived from the part manifests and checked by tests, (c) tests layout and style with measurable assertions, and (d) ends with a **human visual review** of CI screenshots and a generated parts gallery. Art is agent-drawn for now by decision; the art system still has an override folder so hand-made SVGs can replace any part later without code changes.

---

## 2. How to install it (in WSL, in the repo)

1. Finish S03 and S12 first.
2. Create `docs/stages/S13-ui-foundation.md` from section 4 and `docs/DESIGN.md` from section 3 (the agent will extend it in T12).
3. Insert this row in `docs/PROGRESS.md` and `docs/ROADMAP.md` **after S12 and before S04**:
   ```
   | S13 | UI foundation and part art (run before S04) | pending |
   ```
4. Set `VC_PAUSE_AFTER="S04 S06 S11 S12 S13"` so the run stops for your visual review after S13.
5. Commit with `scripts/vc-save.sh --no-check "docs: add S13 UI foundation stage"`, start a fresh session and run `/stage S13`.

S04-T03 (part art for 8 parts) stays, but it must build on the art system from T05, not draw its own.

---

## 3. Design spec: `docs/DESIGN.md` (initial version)

All values are starting points. The look is **original**: no Tinkercad colours, icons, shapes or layout.

### 3.1 Layout (default 1920x1080, minimum 1024x640)

```
+--------------------------------------------------------------------------------+
| Menu: File  Edit  View  Help                                    (native menu)   |
+--------------------------------------------------------------------------------+
| [Select][Wire] | [Rotate][Duplicate][Delete] | [Undo][Redo] | [Run][Pause][Stop]  |  Toolbar, 40 px
+-----------+--------------------------------------------------+-----------------+
| Parts     |                                                  | Inspector       |
| [search]  |                 CANVAS                           |  header: icon   |
| v Power   |   breadboard, parts, wires                       |  name           |
| v Passive |                                  [ - ][100%][ + ]|  fields         |
| v Opto    |                                  [Fit]  [Grid]   |                 |
| ...       |                                                  |                 |
| 260 px    |                                                  | 300 px          |
+-----------+--------------------------------------------------+-----------------+
| 5 parts | 0 wires | 88% | Stopped | 0 ms                        Unsaved changes  |  Status, 28 px
+--------------------------------------------------------------------------------+
```

Left and right panels are resizable (min 200, max 420) and collapsible; sizes persist.

### 3.2 Tokens (dark theme default; light theme derived and must pass the same contrast tests)

| Token | Value | Use |
|---|---|---|
| `--bg-app` | `#0e1420` | window background |
| `--surface-1` | `#141c2b` | panels |
| `--surface-2` | `#1b2538` | inputs, cards |
| `--surface-3` | `#25314a` | hover |
| `--border` | `#2d3b58` | dividers |
| `--text` | `#e6ecf5` | primary text |
| `--text-muted` | `#9aa8c0` | secondary text |
| `--accent` | `#3da5ff` | active tool, focus, selection |
| `--success` / `--warning` / `--danger` | `#3ecf8e` / `#f5b84b` / `#ff6b6b` | states |
| `--canvas-bg` | `#0a101a` | canvas |
| `--grid-dot` | `#1f2c44` | canvas grid |
| Spacing scale | 4, 8, 12, 16, 24 px | all gaps and padding |
| Radius | 4, 6, 10 px | controls, cards, panels |
| Font (UI) | `"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif` | no remote fonts |
| Font (values) | `"Cascadia Mono", Consolas, monospace` | numbers, pin names |
| Sizes | 12 / 13 / 14 / 16 px | caption / body / label / heading |

States every control must have: default, hover, active, focus-visible (2 px accent ring), disabled (with a tooltip that says why).

### 3.3 Canvas visuals
- Breadboard body warm light grey (`#d8d3c6`), holes dark, centre trench, power rails with red and blue stripes and +/- marks, column letters and row numbers visible at zoom 100% and above.
- Wires: rounded corners, 8-colour palette (red, black, blue, green, yellow, orange, white, purple), round end caps, a brighter outline on hover, accent outline when selected.
- Part card (fallback art): rounded body in a category colour, part name and value in the UI font, pin dots with pin names shown on hover or at zoom 150% and above.
- Pin hover: accent ring plus a tooltip with pin name and net name; snap target highlighted before the click.

### 3.4 Icons
Original SVG set, 20 px grid, 1.5 px stroke, `currentColor`, no filled blobs, one consistent corner style. Never trace icons from other products.

### 3.5 Rules for agent-drawn art (parts, breadboard, Arduino Uno, icons)
Because the agent cannot see what it draws, art is written in a small **art DSL** (TypeScript objects: `rect`, `roundRect`, `circle`, `line`, `polyline`, `text`, each with token-colour fills) and never as free-hand SVG paths.
- **Geometry comes from data, not guesses.** Body size and pin positions are read from the part manifest (0.1-inch pitch grid); pin pads are generated from the manifest pins, so anchors cannot drift.
- **Keep it simple and recognisable:** one body shape, one or two signature details (resistor colour bands from the value, LED dome, battery label plates, chip notch), pin pads, a name label. No gradients or fine detail.
- **Palette:** token colours only, plus a small fixed set for resistor bands and LED colours defined in the token file.
- **Readability:** body versus canvas background contrast of at least 3:1; labels at least 10 px at 100% zoom; pin pads at least 6 px.
- **One renderer, two outputs:** the same DSL renders to Pixi Graphics and to an SVG string, so tests and the gallery can inspect it.
- **Gallery:** a generated page showing every part at 1x and 2x on the canvas colour, with name and pin labels, for human review.

---

## 4. Stage file: `docs/stages/S13-ui-foundation.md`

````markdown
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
- [ ] **S13-T01** Design tokens and global stylesheet in `packages/ui/src/theme/` (`tokens.css`, `base.css`): CSS variables from DESIGN.md, reset, typography, styled buttons, inputs, selects, lists, scrollbars, focus rings; dark default plus light theme via `data-theme`. Remove inline styles from `App.tsx` and index.html. → Playwright on the real page asserts computed styles (button font and background from tokens, no default serif, focus ring present); unit test: every text and background token pair meets 4.5:1 contrast in both themes.
- [ ] **S13-T02** App shell layout with CSS grid per DESIGN.md 3.1: toolbar, left parts panel, canvas, right inspector, status bar; resizable and collapsible side panels with persisted sizes. → Playwright at 1280x720, 1366x768 and 1920x1080 (and DPR 1.25): no horizontal overflow, regions do not overlap, canvas fills the remaining space, collapse and resize work.
- [ ] **S13-T03** Original SVG icon set (at least 24 icons) in `packages/ui/src/icons`, and a toolbar with grouped icon buttons, tooltips showing name and shortcut, active-tool state, and accessible names. Remove the `undo:yes redo:no` text and the header version. → component tests: every button has an accessible name, an icon and a tooltip; focus order is logical.
- [ ] **S13-T04** Parts panel: search box, collapsible category accordion with counts, part cards with a small preview and the name, click or drag to place, keyboard navigation. Add `status: 'ready' | 'planned'` to part manifests; planned parts are hidden unless "Show planned" is on, and cannot be placed. → tests: search filters, planned parts cannot be placed, accordion state persists.
- [ ] **S13-T05** Part art system with the art DSL from DESIGN.md 3.5: a `PartArt` spec (primitives, pin pads generated from the manifest, label) rendered by Pixi **and** serialisable to SVG, with a texture cache keyed by part, variant and resolution. Art is agent-drawn and lives in `packages/parts/art/` as DSL source; an optional hand-made `<part-id>.svg` in the same folder overrides it. Parts without art get a **fallback card** (name, value, pin dots), replacing the grey rectangles. → unit tests: every manifest resolves to art or fallback; pin anchors equal manifest pin positions within 0.5 px; no primitive lies outside the footprint; body-to-background contrast at least 3:1; SVG output structure test; texture cache hits on repeat.
- [ ] **S13-T06** Breadboard and Arduino Uno artwork (agent-drawn with the art DSL, original): breadboard body, centre trench, power rails with stripes and +/- marks, column letters and row numbers at zoom thresholds, strip highlight on hover; Uno board with all header labels (D0 to D13, A0 to A5, 5V, 3V3, GND, VIN, RESET), USB, power jack and MCU chip. → tests: hole and pin positions match manifest geometry; label counts correct; benchmark note: 60 fps with breadboard plus 20 parts.
- [ ] **S13-T07** Canvas interaction polish: pin hover highlight and tooltip (pin and net names), snap indicator, wire styling and colour choice, selection outline and handles, rubber-band selection, cursor per tool, on-canvas zoom controls (minus, percent, plus, fit) and grid toggle, empty-state hint. → tests on state and DOM (not pixels); zoom controls change the viewport; pan and zoom still cause 0 React commits.
- [ ] **S13-T08** Status bar and inspector formatting: status bar segments with separators (parts, wires, zoom, simulation state, time, saved or unsaved dot); inspector header with icon and part name, labelled field groups with units and validation messages, styled selects for enums (for example RGB LED common: cathode or anode), a document summary when nothing is selected. → component tests with real components; formatting tests for units.
- [ ] **S13-T09** Custom application menu and window: File (New, Open, Save, Save As, Export), Edit (Undo, Redo, Delete, Select all, Duplicate), View (Zoom in, out, reset, fit, toggle grid, toggle panels, theme), Help (About with the version, Shortcuts, Licenses); title shows project name and a dirty marker; minimum size 1024x640; window bounds persist; no dev menus in production. → unit tests of the menu template; E2E that accelerators trigger the same commands as the toolbar.
- [ ] **S13-T10** No dead controls: Run, Pause, Stop and Code are disabled with a tooltip until the capability exists (capability flags from core), parts without models are marked planned. → tests: disabled controls cannot trigger commands and state the reason.
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
````

---

## 5. Kickoff prompt (fresh opencode session)

```text
Run /stage S13.

Context: the current build works but has no visual design: no stylesheet, grey placeholder rectangles for parts, a bare dotted breadboard, a concatenated status bar, debug text in the toolbar, and buttons that do nothing yet. This stage adds the UI foundation before the first simulation slice (S04).

Read docs/PROGRESS.md, docs/stages/S13-ui-foundation.md and docs/DESIGN.md first.

Rules on top of AGENTS.md:
1. You cannot see screenshots. Follow docs/DESIGN.md literally and verify with measurable assertions: computed styles, bounding boxes, scroll sizes, element counts, contrast ratios.
2. All colours, spacing, radii and fonts come from the CSS variables in the token file. No inline styles for theming. No remote assets.
3. All icons and artwork are original and agent-drawn with the art DSL in docs/DESIGN.md section 3.5: geometry comes from the part manifests, colours from tokens. Do not imitate Tinkercad or other products.
4. Never mock the module under test, do not skip or weaken tests, and show that each new test can fail.
5. Do not touch packages/sim-*.
6. Stop after 6 tasks, write the handoff and tell me what is next.
```

---

## 6. How to review the result (your part)

- Open the CI screenshots and the **parts gallery**, and write the feedback as concrete tweaks, for example "resistor body too small", "LED dome too dark", "pin labels overlap on the Uno". The agent can act on specific numbers and names, not on "make it nicer".
- Agent-drawn art is the decision for now. Later you can drop a hand-made `<part-id>.svg` into `packages/parts/art/` to replace any single part without changing code.
