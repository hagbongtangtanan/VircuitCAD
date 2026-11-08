# S05 — Offline Arduino toolchain and compile service

## Goal
Compile Arduino sketches to `.hex` fully offline on Windows and Linux, with cache, structured diagnostics, bundled libraries and committed hex fixtures.

## Read first
`docs/RISKS.md` row "Offline Arduino compile"; `PlatformAdapter.compile/toolchain` from S00.

## Tasks
- [x] **S05-T01** `tools/fetch-toolchain.mjs` + `tools/toolchain.lock.json`: pinned arduino-cli version + sha256, installs `arduino:avr` core and the curated libs (Servo, LiquidCrystal, Wire, SPI, EEPROM, SoftwareSerial, NeoPixel library with a compatible licence) into `resources/toolchain/` (gitignored); supports `win32-x64` and `linux-x64`; verifies checksums; idempotent. → this script is the only code allowed to use the network.
- [x] **S05-T02** Toolchain locator in `packages/toolchain`: dev vs packaged resource paths, isolated env (`ARDUINO_DIRECTORIES_*` inside the toolchain dir, no user config), version probe. → tests with a fake layout.
- [x] **S05-T03** Compile service: sketch → short temp dir (`%TEMP%\vcad\<hash8>` / `/tmp/vcad`), spawn arduino-cli with `--build-path`, timeout, cancel, stdout/stderr capture; parse gcc diagnostics into `{file,line,col,severity,message}` + size report. → parser tests with real captured error samples.
- [x] **S05-T04** Hash cache keyed by (sources + libs + board + toolchain version) with LRU eviction. → second compile of identical source is a cache hit.
- [x] **S05-T05** Wire `compile`/`toolchain` into both adapters with progress events and cancel. → contract tests.
- [ ] **S05-T06** `tools/make-fixtures.mjs` compiles `fixtures/sketches/*.ino` (blink, millis-blink, button-led, serial-hello, pwm-fade, adc-read, timer-isr, servo-sweep, lcd-hello) → committed `.hex` (total ≤ 2 MB) + sidecar `.json` placeholders for expected traces (filled in S06).
- [ ] **S05-T07** Integration tests tagged `toolchain` (skipped when the toolchain is absent) + CI job `toolchain` (ubuntu) that fetches and runs them **with the network blocked** after fetch (`unshare -rn`); Windows job smoke-compiles with `TEMP` containing spaces and non-ASCII characters.
- [ ] **S05-T08** electron-builder `extraResources` for the toolchain; installer-size report; `docs/TOOLCHAIN.md` (licences — GPL tools run as separate processes —, antivirus note, update procedure).

## Pitfalls
- Long paths, spaces, non-ASCII usernames break avr-gcc → short ASCII temp dir, always.
- arduino-cli may try to reach the network (index update, notifications) → disable and prove with the network-blocked test.
- Antivirus may quarantine the toolchain → document; keep it unpacked outside asar.
- Never commit binaries (hook will refuse); fixtures are small `.hex` only.
- Core/library versions must be locked in the lock file; compile output must be reproducible.

## Exit gate
- `toolchain` CI job green; hex fixtures committed; Windows smoke compile passes on the odd-path run.
- Compile of blink succeeds with the network blocked.

## Handoff to next stage
Record: compile API, diagnostic shape, fixture list + what each demonstrates, installer-size delta.
