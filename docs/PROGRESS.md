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
Stage S00, branch `stage/s00-foundations`. Done: T01–T06 (pnpm workspace +
strict tsconfig/lint/format; package & app skeletons with vitest; sim-* boundary
lint + negative fixture; vc-check verified; CI verify + package-windows;
PlatformAdapter + in-memory fake + reusable contract suite).
Next: S00-T07 `apps/dev-server` (adapter bound to 127.0.0.1, path-traversal
guard, browser client, `dev:web`) — run it against `@vircuitcad/core/contract`.
Then T08 desktop (Electron CSP/security), T09 packaging, T10 offline guard +
THIRD_PARTY/license script, T11 README/CONTRIBUTING/ADR 0002.
Decisions: pnpm 10.34.9; Node 22.20.0 (.nvmrc); TypeScript 6.0.3 (typescript-eslint
peer requires <6.1.0); sim-* boundaries live in `eslint.config.mjs`.
Gotchas: `vc-check.sh` runs `pnpm -s`, so failure output can be empty (tsc errors
suppressed); CI `package-windows` build/package are no-ops until T08/T09. Bundle
was flattened to repo root and bootstrapped on `main`.
Blocked: none.

## Human actions pending
- (none)
