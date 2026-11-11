# THIRD_PARTY — licenses

VircuitCAD bundles third-party software. This file is a seed; regenerate and review
before every release (`pnpm check:licenses` enforces the allowlist: MIT, Apache-2.0,
BSD, ISC and other permissive licenses).

## Runtime / shipped

| Component | License | Notes |
|---|---|---|
| Electron | MIT | desktop shell |
| React / React DOM | MIT | renderer UI |
| PixiJS | MIT | 2D canvas renderer |
| zod | MIT | schema validation |
| Monaco Editor | MIT | code editor (bundled, main-thread) |
| Blockly | Apache-2.0 | visual coding (pinned, offline locale) |
| avr8js | MIT | AVR core emulation |

## Bundled external tools (separate processes, never linked)

| Component | License | Notes |
|---|---|---|
| arduino-cli | GPL-3.0 | launched as a child process, never linked |
| avr-gcc / avrdude | GPL-3.0 / GPL-2.0 | shipped inside `resources/toolchain`, run as processes |

GPL tools are invoked as separate executables with process separation; VircuitCAD does not link
against them. Confirm the legal position with counsel before a public release (not legal advice).

## Build / tooling (not shipped)

| Component | License | Notes |
|---|---|---|
| TypeScript | Apache-2.0 | compiler |
| Vite / Rolldown | MIT | bundler |
| esbuild | MIT | main/preload bundling |
| Vitest, Playwright | MIT / Apache-2.0 | tests |
| electron-builder | MIT | packaging |
| lightningcss | MPL-2.0 | build-only (Vite optional dep) |

## Assets

All part art, icons and branding are original VircuitCAD placeholders — including the wave-1 parts
(diodes/LEDs, MOSFET/BJT, op-amp, relay, LDR/NTC/pot, 7-segment/LED bar/RGB). No Autodesk or Tinkercad
assets are used.
