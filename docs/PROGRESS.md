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
S13 branch `stage/s13-ui-foundation` (UI foundation; runs before S04). Spec is docs/DESIGN.md —
implement literally, verify with measurable assertions (you cannot see screenshots). Done: T01
(`packages/ui/src/theme/tokens.css` dark+`[data-theme=light]`, `base.css` reset/controls/app-shell,
exported as `@vircuitcad/ui/tokens.css|base.css`, imported in renderer `main.tsx`; index.html +
App.tsx inline styles removed; node-env `contrast.test.ts` asserts 4.5:1 for text/background pairs in
both themes). Done also: T09 (pure `buildMenuTemplate` File/Edit/View/Help + dev items, applied in the
main process, commands sent over `vircuitcad:menu`; preload `onMenu`; App wires undo/redo/delete/
duplicate; window min 1024x640). Done also: T03 (27 original icons in `packages/ui/src/icons`,
Toolbar rebuilt with grouped icon buttons + accessible names/tooltips/active+disabled states; header
version moved to the status bar; `undo:yes` debug text removed). Done also: T10 (`defaultCapabilities`/
`unavailableReason`; RunControls + header Code disable with a reason tooltip; all-on defaults). Next:
T02 shell grid, T04 parts panel + ready/planned, T05 art DSL + Pixi/SVG + fallback card, T06
breadboard/Uno art, T07 canvas polish, T08 status/inspector, T11 screenshot harness, T12 docs.
Notes: theme tokens live in CSS (source of truth, parsed by the contrast test); heavy tests
(netlist property, sim-mcu blink) now have 30s timeouts.
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
