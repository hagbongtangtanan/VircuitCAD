# PROGRESS — authoritative state (keep ≤ 60 lines)

Do not add columns: scripts parse this table. `done` is set only by `scripts/vc-stage-finish.sh`.

| ID | Stage | Status |
|---|---|---|
| S00 | Foundations, CI and platform adapter | done |
| S01 | Core model, breadboard connectivity, netlist | done |
| S02 | Editor canvas | done |
| S03 | Analog solver engine | done |
| S04 | Vertical slice: battery + resistor + LED lights up | done |
| S05 | Offline Arduino toolchain and compile service | done |
| S06 | AVR emulation and mixed-signal bridge | done |
| S07 | Code editor, upload flow, serial monitor | done |
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | done |
| S09 | Parts wave 2 and instruments | done |
| S10 | Blockly, example library, schematic view | done |
| S11 | Polish, packaging, release | done |
| S13 | UI foundation and part art (run before S04) | pending |

## Handoff
S13 `stage/s13-ui-foundation` (before S04). Spec docs/DESIGN.md; verify with measurable assertions (no
screenshots). Done: T01 tokens/base.css (CSS-var source of truth; 4.5:1 contrast test), T03 27 icons +
grouped Toolbar, T04 manifest `status` ready/planned + `isPlaceable`, T09 `buildMenuTemplate` + menu IPC,
T10 `defaultCapabilities`/`unavailableReason`. T02 `AppShell` grid shell (toolbar/body/status, `app-col`
sides, separators 200–420 px + keyboard, collapse, persisted `vircuitcad.shell`; Code+Run in toolbar).
T05 art DSL `packages/parts/art` (`dsl`/`builders`/`toSvg`, `resolvePartArt` fallback card, pin pads from
manifest, `ART_PADDING=5`; editor `art-graphics.ts`→Pixi, `partTextureKey(part,variant,resolution)`,
sprite rotated by transform; `SVG_OVERRIDES`). T06 breadboard `packages/parts/art/board.ts` (body/trench/
rails/±/labels at zoom≥1, strip hover) + Uno header labels from pins. T07 `CanvasControls` (zoom/fit/grid,
imperative %, 0 React commits on pan/zoom via `window.__renderCount`), pin tooltip on hover, wire colour
palette, snap ring, selection handles, cursor per tool, empty-state hint.
Next: T08 status/inspector, T11 screenshot harness, T12 docs.
Notes: tokens in CSS; heavy tests 30s; parallel e2e CPU-bound (`--workers=1`). Perf ~13–31 fps/100 parts
under SwiftShader. Blocked: none.
--- (previous stages) ---
S10 DONE (merged, tag stage-s10-done). S11 branch `stage/s11-polish-release`. Done: T03 (core exports
+ golden tests), T09 (`docs/QA.md`), T06 (`docs/SECURITY.md`, THIRD_PARTY.md, dompurify override, audit
clean), T05 (`tools/bench.ts` + baseline + `pnpm bench` + CI `bench` job; long soak deferred), T02 (core
`Settings` model + adapter persistence + en i18n scaffold), T01 (core checksummed autosave journal +
recent files; file association/single-instance/window-state deferred), T07 (electron-builder: per-user
NSIS no-elevation, delete-appdata-on-uninstall, zip target, optional signing), T08 (release.yml on `v*`
tags: version stamp, NSIS/portable/zip, SHA256SUMS, draft Release; docs/USER_GUIDE.md, KNOWN_ISSUES.md;
dry-run needs a tag push). Only T04 (a11y/UX) left before finish. (PNG canvas export + S10/S11 UI wiring
still outstanding.)
Decisions: exports are pure core functions; SPICE emits scientific for |x|<1e-3 or ≥1e6, comments for
unsupported parts. UI wiring for S10 features (Blockly panel, code view, examples browser, schematic
panel) is still outstanding.
Gotchas: `SCHEMA_VERSION`=2; blockly only via `@vircuitcad/blocks/blockly`; packages needing Node built-ins
in tests set `"types":["node"]` in tsconfig (done for core/sim-analog/blocks/toolchain); CI finish race →
poll `gh run list` then re-run `vc-stage-finish.sh`.
Blocked: none.
APIs: `createMosfet`, `createSchottky`, `stampTransconductance`; `ldrResistance`/`ntcResistance`/
`potentiometerResistances`; `sim-digital` `Level`/`and`/`or`/`not`/`nand`/`xor`/`drive` + `DigitalEngine`
(addGate/set/get/settle → {levels,iterations,settled}); seven-segment → 8 LEDs (`<id>:<seg>`).
Gotchas: BJT Ebers-Moll unstable here; commit scopes can't contain commas; heavy tests need timeouts;
`vc-check` uses `pnpm -s`.
Blocked: none.
MCU API: `parseIntelHex`; `McuCpu` (`.cpu/.usart/.cycles/.micros`, `runCycles/runMicros`, `reset`,
`onPortChange(port, (value,old)=>…)` port byte, D13 = PB5, `setPin`, `onSerial`); `McuHost`
(`start(hex)/pause/resume/reset/setPin(port,bit,high)/dispose`, `onPinChange/onSerial/onState`).
avr8js: call BOTH `avrInstruction(cpu)` then `cpu.tick()`.
Gotchas: avr8js `reset()` doesn't zero `cycles`; sim-* eslint permits Node built-ins only in `*.test.ts`;
`vc-check` uses `pnpm -s`.
Blocked: none.

## Human actions pending
- (none)
