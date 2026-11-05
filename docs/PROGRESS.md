# PROGRESS — authoritative state (keep ≤ 60 lines)

Do not add columns: scripts parse this table. `done` is set only by `scripts/vc-stage-finish.sh`.

| ID | Stage | Status |
|---|---|---|
| S00 | Foundations, CI and platform adapter | pending |
| S01 | Core model, breadboard connectivity, netlist | pending |
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
S00 complete (T01–T11); running `vc-stage-finish.sh S00` (PR → CI → squash-merge → tag
`stage-s00-done`). Next stage: S01 core model (zod Circuit schema, part manifests, breadboard
strips, netlist extractor, undo/redo store, `.vcad` + migrations).
Decisions: pnpm 10.34.9; Node 22.20.0; TypeScript 6.0.3; renderer runtime deps are
devDependencies (bundled, packaged app ships no node_modules); one zod-validated RPC surface in
core (`handleRpc`, base64 JSON envelope); `dev:web` serves the desktop renderer with transport
auto-detected; sim-* purity enforced in `eslint.config.mjs`.
Gotchas: `vc-check.sh` uses `pnpm -s` so failure output can be empty; `pixi.js/unsafe-eval`
import is required under the strict CSP; MPL-2.0 (lightningcss, build-only) is on the license
allowlist; CI `package-windows` builds the installer only on windows-latest.
Blocked: none.

## Human actions pending
- (none)
