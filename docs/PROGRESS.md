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
| S06 | AVR emulation and mixed-signal bridge | pending |
| S07 | Code editor, upload flow, serial monitor | pending |
| S08 | Parts wave 1: semiconductors, digital ICs, 555 | pending |
| S09 | Parts wave 2 and instruments | pending |
| S10 | Blockly, example library, schematic view | pending |
| S11 | Polish, packaging, release | pending |

## Handoff
S05 complete (T01–T08); running `vc-stage-finish.sh S05` → tag `stage-s05-done`. Next: S06 AVR
emulation + mixed-signal bridge.
Compile API: `locateToolchain({devRoots,packagedRoot,platform}) → ToolchainLayout`; `isolatedEnv(layout)`;
`new CompileService({layout,tempRoot?,timeoutMs?,runner?}).compile(request,{signal?,onProgress?}) →
CompileResult { ok, hex?, diagnostics[] }`; `Diagnostic { file, line, column, severity, message }`;
`parseSizeReport → { sketchBytes?, dataBytes? }`; `CompileCache`/`cacheKey`. Adapters run the service
(absent CLI ⇒ diagnostic); electron-builder copies `resources/toolchain` via `extraResources` (outside asar).
Fixtures: `fixtures/sketches/{blink,millis-blink,button-led,serial-hello,pwm-fade,adc-read,timer-isr,
servo-sweep,lcd-hello}.ino` → `fixtures/hex/*.hex` + `.json` (34 KiB). `tools/fetch-toolchain.mjs` +
`tools/toolchain.lock.json` (arduino-cli 1.5.1, arduino:avr 1.8.8, Servo/LiquidCrystal/Adafruit NeoPixel);
`tools/make-fixtures.mjs`. Installer delta ≈ 150 MB (see `docs/TOOLCHAIN.md`).
Gotchas: `tools/fetch-toolchain.mjs` is the only networked code; `resources/toolchain/` is gitignored;
the CI `toolchain` job fetches then runs tests network-blocked via `sudo env PATH unshare -rn`; the
Windows smoke compile uses a spaces + non-ASCII TEMP.
Blocked: none.

## Human actions pending
- (none)
