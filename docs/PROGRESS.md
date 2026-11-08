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
S05 IN PROGRESS, branch `stage/s05-toolchain`. Done: T02 (`locateToolchain` dev/packaged roots +
`isolatedEnv`, fake-layout tests), T03 (`CompileService`: short temp dir, injectable runner with
timeout/cancel, gcc diagnostic + size parser, hex read; tests), T04 (LRU `CompileCache` keyed by
sources/libs/board/toolchain version).
Next: T01 `tools/fetch-toolchain.mjs` + `tools/toolchain.lock.json` (the only networked code; pinned
arduino-cli + `arduino:avr` core + curated libs into gitignored `resources/toolchain/`), T05 wire
`compile`/`toolchain` into both adapters (progress + cancel), T06 `tools/make-fixtures.mjs` + committed
`.hex` fixtures, T07 `toolchain`-tagged integration tests + CI job (fetch then run network-blocked via
`unshare -rn`; Windows odd-path smoke), T08 electron-builder `extraResources` + `docs/TOOLCHAIN.md`.
APIs: `locateToolchain({devRoots,packagedRoot,platform}) → ToolchainLayout`; `isolatedEnv(layout)`;
`new CompileService({layout,tempRoot?,timeoutMs?,runner?}).compile(request,{signal?,onProgress?}) →
CompileResult`; `parseDiagnostics`/`parseSizeReport`; `CompileCache`/`cacheKey`.
Gotchas: keep arduino-cli offline (`ARDUINO_*` env), toolchain out of asar, no committed binaries
(hook refuses); toolchain/`CompileService` is the only Node/network-touching code besides `tools/`.
Blocked: none.

## Human actions pending
- (none)
