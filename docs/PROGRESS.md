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
| S13 | UI foundation and part art (run before S04) | done |

## Handoff
S13 `stage/s13-ui-foundation` (before S04); spec docs/DESIGN.md; verify with measurable assertions.
ALL TASKS DONE (T01–T12). Key files: T01 tokens/base.css (CSS-var source of truth, 4.5:1 contrast
test); T02 `AppShell` grid shell (resizable/collapsible `app-col` panels, persisted `vircuitcad.shell`);
T03 icons+Toolbar; T04 manifest `status`+`isPlaceable`; T05 art DSL `packages/parts/art`
(`dsl`/`builders`/`toSvg`/`resolvePartArt` fallback, `ART_PADDING=5`; editor `art-graphics.ts`→Pixi,
`partTextureKey(part,variant,resolution)`); T06 breadboard `art/board.ts` + Uno labels; T07
`CanvasControls` (zoom/fit/grid, imperative %, 0 React commits via `window.__renderCount`), pin tooltip,
wire palette, snap ring, selection handles, cursor, empty hint; T08 `StatusBar` segments + `Inspector`
enum selects (`ParamSpec.options`) + `formatQuantity`; T09 menu; T10 capabilities; T11 `pnpm e2e:screens`
→ `artifacts/screens/` (+ gallery, layout checks) uploaded by CI; T12 docs.
Next: `vc-stage-finish.sh S13` → human review gate (exit 10: check the `vircuitcad-screens` artifact at
1366×768 and 1920×1080).
Notes: tokens in CSS; parallel e2e CPU-bound (`--workers=1`); perf ~13–31 fps/100 parts under SwiftShader.
Blocked: none.
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
