# PROGRESS — authoritative state (keep ≤ 60 lines)

Do not add columns: scripts parse this table. `done` is set only by `scripts/vc-stage-finish.sh`.

| ID | Stage | Status |
|---|---|---|
| S00 | Foundations, CI and platform adapter | done |
| S01 | Core model, breadboard connectivity, netlist | done |
| S02 | Editor canvas | done |
| S03 | Analog solver engine | done |
| S04 | Vertical slice: battery + resistor + LED lights up | done |
| S05 | Offline Arduino toolchain and compile service | pending |
| S06 | AVR emulation and mixed-signal bridge | pending |
| S07 | Code editor, upload flow, serial monitor | pending |
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | pending |
| S09 | Parts wave 2 and instruments | pending |
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S05 IN PROGRESS, branch `stage/s05-toolchain`. Done: T02 (`locateToolchain` + `isolatedEnv`), T03
(`CompileService`: short temp dir, injectable runner w/ timeout+cancel, gcc diagnostic + size parser,
hex read), T04 (LRU `CompileCache` keyed by sources/libs/board/toolchain version), T05 (both adapters
locate the toolchain and run `CompileService`; absent CLI ⇒ clear diagnostic + `toolchain.info`).
Next: T01 `tools/fetch-toolchain.mjs` + `tools/toolchain.lock.json` (the ONLY networked code; pinned
arduino-cli + `arduino:avr` core + curated libs into gitignored `resources/toolchain/`; win32-x64 +
linux-x64; sha256 verify; idempotent), T06 `tools/make-fixtures.mjs` (compiles `fixtures/sketches/*.ino`
→ committed `.hex` ≤2 MB + `.json` trace placeholders), T07 `toolchain`-tagged integration tests +
CI job (fetch then `unshare -rn` network-blocked; Windows odd-path smoke), T08 electron-builder
`extraResources` (already in `electron-builder.yml`) + installer-size report + `docs/TOOLCHAIN.md`.
Then `/stage-finish S05`.
APIs: `locateToolchain({devRoots,packagedRoot,platform}) → ToolchainLayout`; `isolatedEnv(layout)`;
`new CompileService({layout,tempRoot?,timeoutMs?,runner?}).compile(request,{signal?,onProgress?}) →
CompileResult`; `parseDiagnostics`/`parseSizeReport`; `CompileCache`/`cacheKey`.
Gotchas: arduino-cli must stay offline (`ARDUINO_*` env); keep the toolchain out of asar; no committed
binaries (pre-commit refuses); dev-web `resources/toolchain` is resolved from cwd — a fetch-T01 run
from the repo root is required for a real compile.
Blocked: none.

## Human actions pending
- (none)
