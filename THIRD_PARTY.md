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
