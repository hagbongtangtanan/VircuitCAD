# TOOLCHAIN — offline Arduino compile

VircuitCAD compiles Arduino sketches fully offline with a bundled `arduino-cli` + `arduino:avr`
toolchain. Nothing is downloaded at runtime.

## Fetch (dev and CI)

```
node tools/fetch-toolchain.mjs
```

Downloads the pinned `arduino-cli` (sha256-verified from `tools/toolchain.lock.json`), then installs
`arduino:avr` and the curated libraries (Servo, LiquidCrystal, Adafruit NeoPixel) into
`resources/toolchain/`. This is the **only** currently-networked code. `resources/toolchain/` is
gitignored and never committed.

- Supported: `linux-x64`, `win32-x64`.
- Idempotent: re-running verifies the CLI version and installs anything missing.
- Isolated env: `ARDUINO_DIRECTORIES_DATA/USER/DOWNLOADS` stay inside the toolchain dir; user config
  and the update notifier are disabled, so arduino-cli makes no network calls once installed.

## Packaging

`apps/desktop/electron-builder.yml` copies `resources/toolchain` via `extraResources` to
`<install>/resources/toolchain`, kept **outside** the asar so avr-gcc/avrdude can execute. Expect
roughly a 150 MB installer-size delta for the bundled AVR toolchain.

## Licences

The bundled tools are external programs launched as separate processes (arduino-cli is GPL-3.0,
avr-gcc/avrdude have their own licences); VircuitCAD does not link against them. See
`THIRD_PARTY.md`.

## Antivirus

Some antivirus products quarantine freshly-unpacked `arduino-cli`/`avr-gcc`. Installer guidance
should recommend allowing the install directory; the toolchain is never packed inside the asar.

## Updating

Bump the versions and, when the archive changes, the `sha256` values in `tools/toolchain.lock.json`,
rerun `node tools/fetch-toolchain.mjs`, regenerate fixtures (`node tools/make-fixtures.mjs`) and
commit the new `.hex` files.
