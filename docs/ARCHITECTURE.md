# ARCHITECTURE (condensed)

## Stack
Electron (Windows target) · React + TS + Vite · PixiJS (WebGL 2D, SVG part art) · Zustand + Immer patches (undo/redo, autosave) · avr8js in a Web Worker · custom MNA analog solver in TS (Rust→WASM only if profiling demands) · ngspice as CI-only golden oracle · Monaco (local workers) · Blockly · bundled arduino-cli + avr-gcc as child process · pnpm workspaces · Vitest, fast-check, Playwright · electron-builder (NSIS + portable) on GitHub Actions `windows-latest`.
Runner-up: Tauri 2 (rejected: Rust toolchain + painful WSL→Windows builds). Switchable thanks to `PlatformAdapter`.

## Data flow
```
Editor (Pixi) → Circuit Model (JSON, versioned, zod) → Netlist Extractor (union-find over pins, wires, hole strips)
   → Analog engine (MNA + Newton) | Digital engine (event-driven) | MCU engine (avr8js Worker, paced to wall clock)
   MCU pin out = Thevenin source; analogRead/digitalRead = node voltage
   → results throttled 30–60 Hz → UI (LEDs, meters, scope, serial)
```

## Packages
```
apps/desktop          Electron main/preload + renderer shell
apps/dev-server       WSL dev-web adapter server (127.0.0.1 only)
packages/core         model, zod schema, migrations, netlist, PlatformAdapter interface
packages/sim-analog   MNA solver, device models
packages/sim-digital  gates, flip-flops, counters, behavioural ICs
packages/sim-mcu      avr8js wrapper, pin bridge, serial
packages/parts        manifests + SVG + models
packages/editor       Pixi canvas, tools, hit-testing
packages/ui           React panels
packages/toolchain    arduino-cli wrapper, hex cache
tools/                toolchain fetcher, fixture generator
```

## Hard boundaries
- `sim-*` → imports only `core` (types) and std JS. No DOM/Electron/Node-only.
- `editor`/`ui` never talk to Electron directly; only `PlatformAdapter`.
- Parts are data (manifest: pins, SVG, params, `simModel` id, optional `schematicSymbol`) + a small model in TS.

## Dev-web mode
`pnpm dev:web` = Vite + `apps/dev-server` on localhost using Linux arduino-cli. Open from Windows browser; Playwright runs headless in WSL/CI. Real Windows behaviour is verified by the `package-windows` CI job and human gates.

## Simulation notes
- Newton-Raphson with junction limiting; gmin on every node; gmin stepping, then source stepping as fallbacks; adaptive step with breakpoints at digital edges.
- Singular matrix → typed `SimError` with node refs → UI shows "short circuit near X".
- If no reactive parts: solve DC only on pin events. PWM: quasi-static averaging when no reactive parts.
- Educational-grade, documented in `docs/MODELS.md` (created in S03, grown per part).
