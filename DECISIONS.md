# Decisions

Record of non-obvious engineering choices. Newest entries at the bottom.

## 2026-10-19 — Package layout and TypeScript projects

- **CommonJS output for main and preload (no `"type": "module"`).** A sandboxed preload
  (`sandbox: true`) cannot be an ES module, so the preload must be CJS. Keeping the package
  CJS is the only arrangement where electron-vite emits CJS for both main and preload without
  per-file overrides.
- **Two TypeScript projects, `tsconfig.node.json` and `tsconfig.web.json`.** The node project
  covers main/preload/shared with Node types and no DOM lib; the web project covers the
  renderer and shared with `DOM` + `vite/client`. `tsconfig.json` is a solution file that only
  references the two. TypeScript 6 allows `noEmit` on `composite` projects, so `tsc -p`
  works without generating declaration files.
- **Config files use the `.mts` extension.** Vite's config loader is moving to native ESM
  loading and warns when a `.ts` config is loaded as CommonJS. `.mts` states the intent
  explicitly and silences the warning; electron-vite resolves `electron.vite.config.mts` too.
- **`@typescript-eslint` runs un-type-checked.** Linting stays fast and needs no project
  service wiring, while `strict` in both tsconfigs already gives full type safety. The
  explicit `no-explicit-any` rule keeps the "no `any`" requirement enforced.
- **Shared code is imported with relative paths, not an alias.** `src/shared` is inside both
  tsconfig `include` lists, so `../shared/ipc` typechecks everywhere with no alias duplication
  between the Vite config and the tsconfigs.

## 2026-10-19 — Renderer↔main boundary

- **One contract module.** `src/shared/ipc.ts` owns channel names and the request/response map;
  `src/shared/schemas.ts` owns the zod schemas. Types are inferred from the zod schemas
  (`z.infer`) so the validators and the TypeScript types cannot drift apart.
- **Main validates, renderer asks.** Handlers receive `unknown` and run `schema.parse`, so a
  compromised renderer cannot smuggle unexpected shapes into the main process. The `ping`
  response echoes the request timestamp, which makes the round trip provable in tests and in
  the running app.
- **The preload exposes named methods, not a generic `invoke`.** `window.api.ping(...)` keeps
  the renderer unable to reach a channel that was not deliberately exported.

## 2026-10-19 — Security posture

- **Renderer hardened by default.** `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`; `setWindowOpenHandler` denies every `window.open`, and
  `will-navigate` is cancelled for all web contents.
- **CSP is injected by the main process**, not a `<meta>` tag, so it also covers anything the
  dev server serves. `default-src 'self'` with `object-src`, `base-uri`, `form-action` and
  `frame-ancestors` all locked down.
- **Dev-only CSP relaxation.** `@vitejs/plugin-react` injects the Fast Refresh preamble as an
  inline script and the dev client needs a websocket to `localhost:5173`, so `script-src`
  gains `'unsafe-inline'` and `connect-src` gains the dev origin **only** while the dev server
  is driving the renderer. The switch is `process.env.ELECTRON_RENDERER_URL`, which only
  electron-vite's dev server sets — running the built `out/` bundle therefore uses the strict
  production policy even though `app.isPackaged` is still false.
- **All permission requests are denied.** Nothing in this app needs camera, geolocation,
  notifications or clipboard access, so the handler returns `false` unconditionally.

## 2026-10-19 — Packaging

- **electron-builder targets NSIS (Windows) and AppImage (Linux)**, configured in
  `electron-builder.yml`. The bundle ships only `out/**` plus `package.json`; the Rust-free
  toolchain assets will be added to `resources/` in a later milestone.
- **The app is not built here.** This machine has no display server beyond the shared X socket
  and no setuid `chrome-sandbox`, so `electron-builder` (which signs/reflinks the Electron
  binary) is not exercised. Verification instead runs the real Electron binary against the
  built `out/` bundle over the Chrome DevTools Protocol.

## 2026-10-19 — Circuit model, canvas and netlist

- **The document is the single source of truth.** `CircuitDocument` (parts, wires) lives in the
  zustand store and everything else is derived: Konva nodes read the store, the netlist is
  rebuilt with `useMemo` whenever the document changes. No view state is ever the authority.
- **Every part is a `PartDefinition`.** Pins, size, default props, editable prop fields,
  internal nets and the Konva body live in one registry entry, so the drawer, inspector,
  canvas and netlist all read the same description. Part geometry helpers
  (`pinWorldPosition`) apply rotation about the part centre, which keeps wires attached while
  a part is rotated.
- **Snapshots instead of invertible commands.** `createHistory` stores the previous document on
  every edit; undo/redo therefore cannot drift out of sync with the operation it reverses. A
  drag is one entry: `beginTransientEdit` banks the pre-drag document and the intermediate
  `movePart` calls bypass the stack until `commitTransientEdit`.
- **Netlist is union-find over pins.** Every pin starts as its own node; `internalNets` (both
  breadboard column halves plus the four power rails) and then each wire union nodes together.
  Union-find handles the cycles that jumper wires between breadboard columns create, which a
  naive DFS would have to special-case.
- **Breadboard connectivity is modelled, not drawn ad hoc.** The 30-column board exposes 420
  pins (two five-hole column halves plus four 30-hole rails) and 64 internal nets; the drawn
  board body is generated from the same row/column constants, so holes and pins cannot drift
  apart.
- **Pins and wire strokes keep a constant on-screen size.** They are drawn inside the
  zoom-transformed layer, so their radii/widths are divided by the current scale. Grid lines
  thicken the same way; the grid step doubles when a 10-unit cell would render below 8 px.
- **The verification probe drives the real UI.** `EXPECT_CANVAS=1` makes
  `scripts/verify-electron.mjs` click a drawer button and then dispatch CDP mouse events onto
  two pin coordinates, asserting that a wire appears and the two nets merge. This exercises the
  Konva hit-testing and store paths that unit tests cannot reach, with zero console errors and
  zero CSP violations required.

## 2026-10-19 — Offline compiler toolchain

- **The toolchain is vendored, not committed.** `scripts/fetch-toolchain.mjs` downloads
  checksum-pinned Ubuntu `gcc-avr`/`avr-libc`/`binutils-avr` packages plus the Arduino AVR
  core 1.8.7 tarball into `resources/toolchain/linux/` (gitignored, ~420 MB unpacked) and
  precompiles `core/uno/core.a` for the atmega328p. Committing 60+ MB of binaries would bloat
  every clone; this keeps the repository small while still producing a fully offline app
  after one setup step. electron-builder copies the directory outside the asar as an
  `extraResources` entry, so packaged builds compile with no network and no system packages.
- **The tree stays relocatable.** avr-gcc locates its headers and libraries relative to
  `argv[0]`, so the extracted packages keep `<root>/bin` next to `<root>/lib`. `libmpc.so.3`
  is the one host library the AVR compiler needs that Ubuntu does not install by default; it
  is extracted into `<root>/lib/x86_64-linux-gnu` and supplied via `LD_LIBRARY_PATH` on the
  spawned process, not by touching the system.
- **Compilation lives in the main process, behind IPC.** `services/toolchain.ts` is
  Electron-free so Vitest can exercise the real avr-gcc; `services/compiler.ts` only adds the
  platform search paths and a build queue (one compile at a time). Arguments are passed as an
  array to `spawn` (never a shell), each build gets a fresh `mkdtemp` directory, and a runaway
  compile is killed after 60 seconds.
- **Arduino prototypes are generated, not required from the user.** The IDE lets `loop()`
  call a helper defined below it, so `shared/compile.ts` scans the sketch for top-level
  function definitions and emits forward declarations into the translation unit. Comments and
  string literals are blanked first (preserving length and line breaks), default arguments are
  dropped (repeating them in a declaration is a C++ error), and preprocessor lines are skipped
  — without that last rule an `#include <EEPROM.h>` line got glued onto the next prototype and
  the compiler warned about "extra tokens at end of #include directive".
- **Diagnostics point at sketch lines.** The generated unit ends with `#line 1 "sketch.ino"`,
  so GCC reports the lines the user actually typed. File names are dropped from the payload
  for now; line and column are enough for the build output.
- **Serial monitor infrastructure lands before the simulator.** Milestone 3 owns the line
  buffer (CR/LF handling, bounded history) and the terminal UI; milestone 4 will feed it from
  the emulated UART. Until then the panel explains that the simulation is not running yet
  instead of pretending to be live.

## 2026-10-19 — Simulation behind the Run button

- **avr8js runs in the renderer, not a worker.** The CPU, the circuit solver and the UI share
  the circuit document, so keeping them in one process avoids copying a document plus pin
  state across a `postMessage` boundary 60 times per second. Each frame advances the CPU by
  the elapsed wall time (capped at 50 ms of simulated time), which keeps the UI responsive
  when a frame stalls instead of spiralling into a catch-up loop. If CPU load ever becomes a
  problem, the simulation class is framework-free and can move behind a worker unchanged.
- **Electrical behaviour is a small MNA solve, not SPICE.** Nets come from the existing
  union-find netlist; resistors, potentiometers, the buzzer and closed switches are
  conductances; the Uno pins are Thevenin sources (25 Ω output, 30 kΩ pull-up, 0.5 Ω 5 V
  rail); ground nets collapse into the reference node so two wired ground pins cannot form a
  singular loop of ideal sources. LEDs are solved as a forward voltage with a 0.5 Ω series
  resistance, iterating on/off state (max eight passes) until the conduction state stops
  changing. A 1 nS leak from every net to ground defines floating nets as 0 V.
- **Only the Uno is simulated.** The part registry has a single board, so the sim state is
  built from the first Arduino Uno in the document. `sim/unoPins.ts` is the one place that
  maps circuit pin ids ("D13", "A0", "GND2") onto ATmega328P port bits and supply rails.
- **The emulator stops when the circuit changes.** Rewiring while the CPU is running would
  leave the solver holding a stale netlist. Instead the store subscribes to the circuit
  document and stops the run; pressing Run again picks up the new wiring.
- **Simulation tests use a committed HEX fixture.** Linking the compiler into every unit test
  would make the suite depend on the vendored toolchain. `sim/fixtures.ts` holds the HEX for
  a blink-plus-serial sketch generated once with the real avr-gcc; the toolchain integration
  tests cover the compiler, and the CDP probe covers the compile → run → serial path end to
  end.
