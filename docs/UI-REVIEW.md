# UI-REVIEW — human review checklist (S13)

The agent cannot see pixels, so it proves layout with measurable assertions. This checklist is
for the human review gate: open the CI artifact `vircuitcad-screens` (or run `pnpm e2e:screens`)
and confirm the app looks right at 1366×768 and 1920×1080.

Screenshots land in `artifacts/screens/`: five app states × three viewport sizes, plus the parts
gallery. The gallery shows every part at 1× and 2× with its name and pin labels, and the breadboard.

## Checklist

- [ ] Toolbar: grouped icon buttons, active tool highlighted, Run/Pause/Stop disabled with a reason.
- [ ] Left panel: search box, category accordions with counts, part cards readable; "Show planned"
      reveals disabled planned parts.
- [ ] Right panel: inspector header shows a category icon and the part name; numeric fields show a
      formatted unit hint; enums (e.g. RGB LED common) use a styled select; no selection shows a
      document summary.
- [ ] Canvas: real breadboard (body, trench, power-rail stripes with ±, column numbers and row
      letters at 100% zoom); parts are recognisable, not grey rectangles; selected part has an
      outline with corner handles; wires use the colour palette.
- [ ] Status bar: parts / wires / zoom / simulation state / time segments with separators, a
      saved/unsaved dot, and the version.
- [ ] Light theme renders with the same contrast (theme toggle in the View menu).
- [ ] Nothing is clipped, no control is smaller than 28 px, and panels never overlap the canvas
      (the `screens.spec.ts` checks fail the build otherwise).

## How to review locally

```bash
pnpm dev:web            # 127.0.0.1:5173 (app) and /gallery.html (parts gallery)
pnpm e2e:screens        # writes artifacts/screens/*.png
```

Regenerate the gallery after adding a part or changing art (see `docs/DESIGN.md` 3.5).
