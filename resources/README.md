# resources/

Assets that ship with the app but are not source code.

## toolchain/ (not in git)

The offline Arduino toolchain, vendored by:

```bash
node scripts/fetch-toolchain.mjs
```

It downloads pinned, checksum-verified packages and produces
`resources/toolchain/linux/`:

```
bin/            avr-gcc, avr-g++, avr-ar, avr-objcopy, avr-size
lib/            avr-libc headers + libs, gcc internals (relocatable)
lib/x86_64-linux-gnu/   host libmpc, used via LD_LIBRARY_PATH
arduino/        Arduino AVR core 1.8.7 sources (cores/, variants/, libraries/)
core/uno/core.a precompiled core for the atmega328p
manifest.json   exact versions and package checksums
```

The directory is gitignored (about 420 MB unpacked) and is copied into the
installer by electron-builder's `extraResources`, so packaged builds work with
no network access. The download cache lives in `resources/toolchain/.cache/`
and is never shipped.

## samples/

Example sketches referenced from the UI. Added in a later milestone.
