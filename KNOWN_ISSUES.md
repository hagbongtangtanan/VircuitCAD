# KNOWN ISSUES

Known limitations and issues at `v0.1.0-beta`:

## Packaging

- The Windows build is **unsigned**, so SmartScreen shows a warning. Choose *More info →
  Run anyway*, or use the portable zip. A code-signing certificate is planned.
- Windows installers are built only by CI (`package-windows` / `Release` workflows); they are
  never produced locally.

## Parts and simulation

- The palette currently ships the S08/S09 part set; some wave-2 parts (motor/H-bridge, LCD,
  NeoPixel, keypad, extra sensors) exist as models but are not yet wired into the palette/UI.
- The SPICE netlist export covers linear sources and passives only; other parts are emitted as
  comments.
- Simulation is **educational-grade** — see `docs/MODELS.md` for model notes.

## Editor / UI

- The read-only **Schematic** view is auto-laid-out and uses net labels; there is no manual
  placement or routing, and selection cross-highlight with the breadboard is not yet wired.
- **Blocks**: no `while`, no arrays; `repeat` uses a fixed `i`; text → blocks is not supported.
- PNG canvas export is not yet wired into the UI; schematic SVG export is available.
- Crash-recovery journal and recent-files logic exist in core; the restore prompt and file
  association live in the Electron shell and are not fully wired.

## Testing

- Some tasks are covered by model-level unit/golden tests rather than end-to-end UI tests;
  run `docs/QA.md` on a clean VM before tagging a release.
