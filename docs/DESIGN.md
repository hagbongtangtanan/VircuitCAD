# DESIGN — UI foundation and part art

Authoritative spec for the editor's visual design. Implement it literally; it is original
(no Tinkercad colours, icons, shapes or layout). All values are starting points.

## 3.1 Layout (default 1920x1080, minimum 1024x640)

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

## 3.2 Tokens (dark theme default; light theme derived and must pass the same contrast tests)

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

States every control must have: default, hover, active, focus-visible (2 px accent ring),
disabled (with a tooltip that says why).

## 3.3 Canvas visuals

- Breadboard body warm light grey (`#d8d3c6`), holes dark, centre trench, power rails with red and
  blue stripes and +/- marks, column letters and row numbers visible at zoom 100% and above.
- Wires: rounded corners, 8-colour palette (red, black, blue, green, yellow, orange, white,
  purple), round end caps, a brighter outline on hover, accent outline when selected.
- Part card (fallback art): rounded body in a category colour, part name and value in the UI font,
  pin dots with pin names shown on hover or at zoom 150% and above.
- Pin hover: accent ring plus a tooltip with pin name and net name; snap target highlighted before
  the click.

## 3.4 Icons

Original SVG set, 20 px grid, 1.5 px stroke, `currentColor`, no filled blobs, one consistent corner
style. Never trace icons from other products.

## 3.5 Rules for agent-drawn art (parts, breadboard, Arduino Uno, icons)

Because the agent cannot see what it draws, art is written in a small **art DSL** (TypeScript
objects: `rect`, `roundRect`, `circle`, `line`, `polyline`, `text`, each with token-colour fills)
and never as free-hand SVG paths.

- **Geometry comes from data, not guesses.** Body size and pin positions are read from the part
  manifest (0.1-inch pitch grid); pin pads are generated from the manifest pins, so anchors cannot
  drift.
- **Keep it simple and recognisable:** one body shape, one or two signature details (resistor colour
  bands from the value, LED dome, battery label plates, chip notch), pin pads, a name label. No
  gradients or fine detail.
- **Palette:** token colours only, plus a small fixed set for resistor bands and LED colours defined
  in the token file.
- **Readability:** body versus canvas background contrast of at least 3:1; labels at least 10 px at
  100% zoom; pin pads at least 6 px.
- **One renderer, two outputs:** the same DSL renders to Pixi Graphics and to an SVG string, so tests
  and the gallery can inspect it.
- **Gallery:** a generated page showing every part at 1x and 2x on the canvas colour, with name and
  pin labels, for human review.

## 3.6 Components (states every control already needs: 3.2)

- **Toolbar** (`packages/ui/src/components/Toolbar.tsx`): grouped icon buttons (tools / edit /
  history / net colours), active tool uses `aria-pressed`, disabled buttons carry a reason tooltip.
- **PartsBin** (`PartsBin.tsx`): search box, per-category accordion with counts, one button per part.
  Planned parts are hidden until "Show planned" is on and are disabled with a reason.
- **Inspector** (`Inspector.tsx`): category-icon header + part name, a `Properties` fieldset, one row
  per param. Numeric params show a formatted unit hint (`formatQuantity`) and validation alerts; params
  with `options` render as a select; with no selection a document summary is shown.
- **StatusBar** (`StatusBar.tsx`): `parts | wires | zoom | simulation | time` segments with `.status-sep`
  dividers, a saved/unsaved dot, and the version. Zoom updates imperatively from the viewport.
- **CanvasControls** (`CanvasControls.tsx`): on-canvas zoom out / percent (reset) / zoom in / fit and a
  grid toggle. **WireColorPicker** (`WireColorPicker.tsx`): the 8-colour palette, shown for the wire tool.
- **RunControls** (`RunControls.tsx`): Run/Pause/Stop, disabled with a reason until the capability exists.

Panels never re-render while panning or zooming: the zoom readouts subscribe to the viewport and write
their text node directly (`e2e/canvas.spec.ts` asserts zero React commits).

## 3.7 Adding a part's art

1. Add the manifest to `packages/core/src/parts/catalog.ts` (pins on the 0.1-inch grid, `simModel`,
   `status`). Pin pads and the footprint are generated from these pins, so anchors cannot drift.
2. Draw the body in `packages/parts/art/builders.ts`: add an `ArtBuilder` keyed by `simModel` using the
   DSL helpers (`rect`, `circle`, `line`, `polyline`, `text`), token colours only, geometry inside the
   footprint, and a `body` colour with at least 3:1 contrast on `--canvas-bg`. No builder → the part
   gets a labelled fallback card (name + category colour), never a grey rectangle.
3. Optional hand-made override: place `<part-id>.svg` next to `packages/parts/art/overrides.ts` and
   register its markup in `SVG_OVERRIDES`. It replaces the serialised DSL for export and the gallery.
4. Regenerate the gallery (`pnpm e2e:screens`) and eyeball it via `docs/UI-REVIEW.md`.

Pixi renders the DSL through `packages/editor/src/render/art-graphics.ts`; textures are cached by
`partTextureKey(partId, variant, resolution)` and the sprite is rotated by transform, never re-rendered.
