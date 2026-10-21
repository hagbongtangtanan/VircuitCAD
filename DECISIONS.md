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

## 2026-10-19 — One project file, dialogs in the main process

- **A project is a single `.hucad` JSON file containing both the circuit and the sketch.**
  Splitting them would let a user open a circuit without its code (or the reverse) and end up
  with a runnable-looking project that is not. The format has an explicit discriminator and
  version, is validated with the same zod schemas the canvas uses, and parses in the renderer's
  tests without touching the file system.
- **The renderer never picks a path on its own.** The main process shows the dialog, reads or
  writes the file, and remembers every path the user approved this session. A later save may
  reuse an approved path; anything else goes back through a dialog. That keeps a compromised
  renderer from overwriting arbitrary files while still allowing plain "save" to work after
  the first save.
- **Opening an `.ino` loads only the sketch.** The project path stays empty so the first save
  asks for a `.hucad` location; the window title still shows the imported file name. Unknown
  extensions are rejected instead of guessed at.
- **Dirty state is a comparison, not a change counter.** The store keeps snapshots of the last
  saved circuit document (reference equality) and sketch string. Any store update recomputes
  the flag, so undoing back to the saved state correctly clears the unsaved marker.

## 2026-10-19 — Bundled samples and the AppImage

- **Samples are ordinary project files shipped as read-only resources.** The renderer asks the
  main process for a list and opens one by file name; the name is matched against
  `SAMPLE_NAME_PATTERN` and resolved inside a fixed directory, so a compromised renderer cannot
  escape it. Opening a sample replaces the circuit and the sketch and shows the sample's human
  label ("Blink led") in the status bar, but leaves the project path empty so the first save
  goes through the normal dialog instead of overwriting the example.
- **Packaged builds mirror the repository layout.** electron-builder's `extraResources` copies
  `resources/toolchain` to `toolchain` and `resources/samples` to `samples`, next to
  `app.asar`; `samplesDirectory()` checks `process.resourcesPath` first and falls back to the
  checkout so `npm run dev` and the un-packaged probe work unchanged.
- **The AppImage is verified, not assumed.** `--appimage-extract` followed by `AppRun` and the
  same CDP probe is the only check that proves `process.resourcesPath` resolution and that the
  vendored `avr-gcc` still runs after packaging, since both are invisible to `npm run build`.
- **The icon and desktop entry are part of the build.** `resources/icon.png` (512×512,
  generated) is picked up from the build-resources directory, and `desktopName` in
  `package.json` plus `linux.syncDesktopName` make the `.desktop` file, `StartupWMClass` and
  Electron's `app_id` agree so the launcher groups the running window correctly.
- **A failing simulation tick reports an error instead of freezing.** The animation loop wraps
  the CPU step and the publish in a guard; an exception cancels the loop and puts the store in
  `error` with the message, so the status bar explains what happened instead of showing a
  frozen "running" clock.
- **Regexes inside the injected CDP expression need doubled backslashes.** The probe's
  expression is written as a JavaScript template literal, so `/\d+/` in the repository source
  reaches the page as `/d+/` and silently never matches. The LED check uses a character class
  (`[0-9]+`) to stay readable and immune to that trap.

## 2026-10-19 — Releasing through GitHub Releases

- **Artifact names are space-free on purpose.** GitHub rewrites spaces in uploaded asset names,
  so `HuCAD Circuits-0.1.0.AppImage` would land as `HuCAD.Circuits-0.1.0.AppImage` while
  `latest-linux.yml` kept pointing at the original name — silently breaking both the download
  links and the updater. `artifactName` is now
  `HuCAD-Circuits-<version>-<os>-<arch>.<ext>` on every platform.
- **CI is the primary path; the script is the fallback.** `.github/workflows/release.yml`
  builds on Linux, Windows and macOS for every `v*` tag and publishes with
  `electron-builder --publish always`, while `scripts/release.mjs` publishes an already-built
  `release/` directory for hotfixes. Both produce the same tag, notes and asset set.
- **A tag publishes, it does not draft.** The GitHub provider creates drafts by default, which
  would make a tag push look like nothing happened, so `publish.releaseType` is `release` and
  the workflow sets `EP_PRE_RELEASE` from a `-suffix` in the tag to keep beta tags out of the
  stable channel. `EP_GH_IGNORE_TIME` lets a re-run overwrite assets on a release older than
  the publisher's two hour upload window.
- **The release script prefers `gh` and falls back to the REST API.** `gh` supplies an
  authenticated session for free; the fallback needs only `GH_TOKEN`/`GITHUB_TOKEN` and Node's
  `fetch`, so the script stays dependency-free. The release is read from the API _before_ the
  tag is created, so a token that cannot see the repository never leaves a tag behind.
- **Windows and macOS packages currently ship without a compiler.** The vendored avr-gcc is
  Linux-only and `fetch-toolchain.mjs` refuses to run elsewhere, so CI skips that step on those
  runners and electron-builder only warns about the missing resource directory. The canvas,
  wiring and simulator work there; compiling a sketch needs a matching toolchain first.

## 2026-10-20 — CircuitBench UI shell

- **The product name is a constant, not a rename.** `APP_NAME` in `src/shared/app.ts` feeds the
  window title, the top bar, the HTML title and the document title. The npm package, repository
  and installer artifact names stay `HuCAD Circuits` for now: renaming them changes download
  URLs, the updater's `latest*.yml` and the GitHub release identity, which belongs to the
  packaging milestone rather than the shell.
- **Light theme with a token layer.** `ui/tokens.css` owns every colour, radius, shadow and
  spacing value, and `styles.css` only consumes them. Konva cannot read CSS custom properties,
  so canvas chrome (grid, pins, handles) mirrors the same palette in `parts/partColors.ts` and
  `canvas/CircuitCanvas.tsx`; those two spots must change together.
- **System fonts only.** The shell uses `system-ui`/`Segoe UI` stacks and a monospace stack
  instead of bundling a webfont: the app must work offline, and shipping a font adds megabytes
  and a licence obligation for no visible gain.
- **Viewport state lives in a store.** Pan/zoom used to be local to `CircuitCanvas`;
  `store/viewportStore.ts` now owns it so the floating canvas toolbar can zoom, reset and
  fit-to-content without imperative refs, and `fitToContent` can measure the document (parts,
  their rotated footprints and pin anchors) in one place.
- **The floating inspector only exists while something is selected.** Tinkercad's inspector
  appears next to the selection and disappears otherwise; keeping an empty panel permanently
  docked would waste canvas space. Selection is already the store's source of truth, so the
  panel is a pure derivation of it.
- **Placeholders are labelled, not faked.** The Flip tool, Notes tool, block modes and Schematic
  tab are visible but inert, each with a tooltip or note naming the milestone that implements
  it. A disabled control with an honest label is better than a button that silently does
  nothing, and it keeps the shell's information architecture testable early.
- **Clicked parts avoid existing footprints.** A click in the parts panel places the part at the
  centre of the current viewport, then walks right/down on the grid until the new bounding box
  no longer overlaps an existing part. Dropping on top of the Uno (which is what a naive centre
  placement does once the sample is loaded) hides pins the user needs next.
- **The serial drawer opens on first output but stays in the DOM.** Collapsing it uses `hidden`
  on the body rather than unmounting, so the monitor keeps its buffer and scroll position and
  the CDP probe can assert its presence without racing the auto-open behaviour.

## 2026-10-20 — CircuitBench identity, interactive inputs, wider part library

- **This supersedes the "names stay HuCAD" note above.** The npm package is now `circuitbench`,
  the desktop entry is `circuitbench.desktop`, the app id is `com.circuitbench.app` and artifacts
  are `CircuitBench-<version>-<os>-<arch>.<ext>`. The GitHub repository stays `HuCAD` because
  existing releases, badges and clone URLs point at it; `publish.repo` therefore still says
  `HuCAD`. The Electron user-data directory follows the package name, so the packaged app writes
  to `~/.config/circuitbench`. The `.hucad` project extension and `hucad-project` format id are
  kept as the on-disk format because changing them would invalidate every saved project and
  sample for no user-visible gain.
- **Runtime input is separate from the document.** `store/interactionStore.ts` holds held
  buttons, latched switches, potentiometer wipers and sensor levels. The simulation pulls a
  snapshot through `ArduinoSimulation.readInputs` and folds it into the solve signature, so
  pressing a button re-solves instantly without dirtying the project, entering the undo stack or
  stopping the emulator (`useCircuitStore` only stops the sim when the document itself changes).
  Before this, `SolveOptions` existed but was never passed at runtime, so buttons and pots were
  inert while the simulator ran.
- **Momentary vs latched controls.** Push buttons are pressed on `mousedown` and released on
  `mouseup`/`mouseleave`/window blur; slide switches latch on click. Both are also reachable from
  the inspector so a control can be driven without fighting the drag gesture.
- **Capacitors and inductors are DC models.** A capacitor is an open circuit and an inductor a
  50 mΩ short. Adding transient analysis would change the solver from a few-millisecond linear
  solve to a time-stepped integrator; the simulator's job here is "does this circuit work", not
  SPICE accuracy. The limitation is documented in the README rather than hidden.
- **Diodes reuse the LED branch machinery.** LED, diode, RGB channel and seven-segment segment
  are all "forward voltage plus series resistance" branches solved iteratively until the on/off
  set is stable. Branch keys are `partId` for single-die parts and `partId:channel` for multi-die
  parts, which lets one brightness map feed the canvas without special cases in the store.
- **RGB mixing uses saturated primaries plus a separate strength.** Summing the pastel lens
  colours washed red + blue toward white, so the additive mix uses saturated channel colours
  while opacity and glow radius follow the summed intensity. The lens is tinted with the result,
  making a mixed colour visible even when the individual dice are small.
- **The seven-segment display has ten leads, five per edge.** The definition exposes a–e on the
  top and f, g, dp, common, common2 on the bottom, with the two commons tied as an internal net.
  The renderer insets the body between the two pin rows so the leads stay outside the display
  instead of drawing stubs across the segments.
- **PWM pins are averaged by duty, not sampled by pin state.** `avr8js` exposes the timer
  compare and control registers, so the simulation reads COM/WGM/OCR directly. The solve runs
  at the high level and scales LED, buzzer and motor current by the duty cycle; this keeps a
  blue LED lit at 50% instead of letting an averaged 2.5 V fall below its 3 V forward voltage.
  Duty is flooded through series resistors, inductors and closed switches so the common
  resistor-plus-LED wiring dims correctly, and a PWM cathode is treated as `1 - duty` for
  common-anode parts. It is an average model: there is no per-cycle waveform or inductor ripple.
- **Breadboards are a mounting surface, not a peer of the parts.** Their bodies and hole
  markers render in their own layers below the components, so a resistor dropped on the board
  is drawn on top of the holes. Wires and component pins stay above everything for
  clickability. The first implementation drew every part in document order and every pin in one
  top layer, which made a breadboard placed later cover earlier components and all holes cover
  the parts' bodies.
- **Batteries and supplies are Thevenin sources inside the solver.** They need no Uno driver, so
  a battery + motor + LED circuit solves on its own; an ideal source would make parallel grounds
  singular, hence the small series resistance (0.5 Ω AA, 1 Ω 9V, 0.1 Ω supply).
- **Placement walks outward in footprint-sized rings.** The previous fixed 30 px right/down scan
  could never escape the 300×200 Uno, so clicked parts landed on top of the board. The step now
  scales with the part's own size, and rings are visited nearest-first.
- **The toolchain fetch is idempotent and verifiable.** `fetch-toolchain.mjs` exits early when
  `bin/avr-g++`, `core/uno/core.a` and the Arduino core are present, `--force` rebuilds, and
  `--verify` checks without the network for CI. `prebuild:linux` runs the fetch so a fresh clone
  cannot produce a compiler-less AppImage, and the release workflow runs `toolchain:verify` as an
  explicit gate. Windows and macOS still ship without a compiler (unchanged).

## 2026-10-20 — Product name reverted to HuCAD

- **`APP_NAME` is `HuCAD` again, and every derived identity follows it.** The npm package is
  `hucad`, the desktop entry is `hucad.desktop`, the app id is `com.hucad.app`, artifacts are
  `HuCAD-<version>-<os>-<arch>.<ext>`, and the packaged app writes to `~/.config/hucad`. This
  supersedes both earlier naming entries; the repository was already `HuCAD`, so releases and
  clone URLs stay valid.
- **Only user-facing identity changed.** The `.hucad` project extension, `hucad-project` format
  id and drag MIME are unchanged because they are internal/file-format contracts; the two
  CircuitBench paragraphs above are left as history rather than rewritten.

## 2026-10-20 — Releases are Windows-only

- **CI builds and publishes only the Windows NSIS installer.** HuCAD is a Windows product, so
  the release matrix was collapsed to `windows-latest`; the Linux AppImage remains a local
  development/smoke-test build and is not published. Beating the concurrent-publish race is
  still handled by packaging on the runner and uploading from a separate job.
- **The Windows package currently has no compiler.** The vendored avr-gcc is Linux-only, so the
  Windows artifact ships without `resources/toolchain/win`; electron-builder warns and the
  simulator runs, but uploads are unavailable. A Windows toolchain remains Milestone 10 work.

## 2026-10-20 — The Windows installer vendors its own toolchain

- **`fetch-toolchain.mjs` gained a Windows path.** It downloads Arduino's pinned
  `avr-gcc-7.3.0-atmel3.6.1-arduino7-i686-w64-mingw32.zip`, extracts the prefix to
  `resources/toolchain/win`, precompiles the Uno core with the Windows compiler, and records the
  versions in `manifest.json`. `prebuild:win` runs it, so a Windows build no longer ships an app
  that cannot compile. The Linux path is unchanged and still serves local smoke tests.
- **Platform directory names follow electron-builder, not Node.** `compiler.ts` now maps
  `win32` to `win` and `darwin` to `mac` (previously it looked for `win32`, so even a packaged
  Windows toolchain would have been ignored). `toolchainFromDir` takes the platform so tests can
  assert the `.exe` names without running on Windows.

## 2026-10-20 — Schematic view derived from the netlist

- **The schematic is connectivity, not a copy of the canvas.** It runs the same `buildNetlist`
  the simulator uses, lays the parts out on its own grid and routes each net through a shared
  vertical channel. Moving a part or bending a wire on the circuit canvas therefore cannot break
  the schematic, and the two views never disagree about what is connected.
- **Breadboards are left out on purpose.** A breadboard is prototyping hardware, not a schematic
  symbol; drawing 830 holes would bury the circuit. A net that only exists on breadboard strips
  disappears, and a net that also reaches a real component is drawn between those components.
- **One colour per net, not per wire.** Wires can be recoloured individually on the canvas, but a
  schematic is about nets. Colouring by net (and cycling a fixed six-colour palette) keeps
  parallel routes through the channel distinguishable without a legend.
- **Unconnected components still appear.** A part with no connections shows up to six of its pins
  under its label, so it is visible that the part exists and is simply not wired yet.

## 2026-10-20 — PNG export captures whichever view is mounted

- **Each view rasterises itself.** The circuit captures the Konva stage with
  `toCanvas({ pixelRatio: 2 })`; the schematic serialises its SVG and draws it onto a canvas. A
  small registry lets the File menu ask "the active view" for a data URL without either view
  owning menu state.
- **The circuit export fits the whole document, then restores the user's view.** Exporting only
  the current framing would ship a cropped picture; the capture temporarily fits the content,
  clears the selection so handles and highlights stay out of the file, waits for two frames, and
  restores the viewport and selection afterwards. The schematic's SVG already has a stable
  viewBox, so it needs no viewport changes.
- **Computed styles are inlined into the serialised SVG.** An SVG loaded through an `<img>` cannot
  see the app's stylesheet or CSS variables, so every element's fill, stroke, font and spacing is
  copied from `getComputedStyle` before rasterising. This keeps the PNG identical to the screen
  without duplicating the palette.
- **The main process validates the PNG and owns the path.** The renderer sends a
  `data:image/png;base64,…` payload; `writePngFile` checks the data-URL shape and the PNG
  signature, and the save path still comes from a native dialog, like every other export.

## 2026-10-20 — Solved voltages feed the emulated inputs

- **The ADC had no peripheral at all.** `ArduinoSimulation` created the GPIO ports, timers and
  UART but never an `AVRADC`, so `analogRead()` waited for a conversion that could never finish
  and the potentiometer and LDR were dead ends. The simulation now owns an `AVRADC`; after each
  solve it copies the A0-A5 net voltages into the ADC channels. The values used during a run are
  therefore one animation frame old, which is well below what a person can notice on a slider.
- **External circuits can pull digital pins.** In output modes the CPU drives the net; in input
  modes the solved net voltage is written back with `AVRIOPort.setPin()`, so a pressed button or
  closed switch reaches `digitalRead()`. The threshold is 2.5 V, and floating inputs read low
  unless the sketch enabled the internal pull-up, which the solver already models as a 30 kΩ
  source.
- **The solve signature now covers every runtime input.** It included pressed buttons and
  potentiometers but not slide switches or photoresistor levels, so those controls changed the
  options passed to `solveCircuit` without ever invalidating the cached result. All four maps are
  folded into the signature.
- **`prime()` solves once before the first instruction.** Setup code often calls `analogRead()`
  immediately; without a solve the channels would still read 0 V. The store calls `prime()` after
  installing `readInputs`, and the normal frame loop keeps the values fresh.

## 2026-10-20 — Wires are drawn by pressing and clicking

- **A draft starts on pointer-down, not on release.** `PinMarker` reports `onMouseDown`, so a
  press on a pin begins a `WireDraft { start, waypoints }` immediately; a second press on another
  pin finishes it. Clicks are not used because Konva fires a click only after mouse-up, which
  would make the preview appear one gesture late and would let a drag start a pan first.
- **Bends are stored as world-space waypoints on the wire.** The draft's clicks append
  `snapPoint(world)` points, and `orthogonalRoute(start, end, waypoints)` recomputes the rounded
  path every frame, so the preview and the committed wire use exactly the same geometry. Undo
  simply restores the previous wire list; no routing state lives outside the document.
- **Finishing is a pin press, not a click.** The target pin reuses the same press handler, so a
  wire can end only on a terminal. Finishing over the start pin or an empty area cancels the
  draft, which also makes `Esc` and right-click predictable escape hatches.
- **Snapping is judged in screen pixels with a world cap.** The hit radius is `14 / scale` but
  never more than 16 world units, so zooming out does not make a pin across the breadboard grab
  the cursor; the endpoint drag uses `18 / scale` capped at 22.
- **A branch is a wire from the nearest endpoint of the selected wire.** The document has no
  junction objects; wires only connect pins, and the netlist already merges pins that share a
  net. A second press on a selected wire therefore starts a new wire at whichever of that wire's
  two pins is closer to the pointer rather than inventing a T-junction.
- **Endpoint handles retarget in place.** Dragging the green handle runs the same
  `setWireEndpoint` validation as creation (no self-loop, no duplicate pair), keeping the manual
  bends while the route is recomputed. Dropping on empty space leaves the wire untouched.
- **Power and ground colours are automatic.** `colorForWire` overrides the palette for `5V`,
  `3V3`, `VIN` and `GND` pins so power rails stay visually consistent; only signal wires use the
  selected palette colour.

## 2026-10-20 — Two schematic styles

- **The original style is a presentation of the same layout, not a second layout engine.**
  Both modes consume `layoutSchematic`; `{ roomyTwoPin: true }` gives two-terminal nodes 136
  units of height so the rotated symbols can span both pin anchors without changing channel
  routing or the simplified cards.
- **Symbol artwork is shared.** `GlyphBody` draws each path once; simplified cards show the
  artwork horizontally and the original sheet rotates it 90° inside the leads. Three-or-more-pin
  parts, including the Uno, stay module/IC boxes with named pins.
- **Reference designators are document-order annotations.** `annotations.ts` prefixes each type
  (R, C, D, SW, U…) and numbers per prefix; values use engineering units (10 kΩ). They are
  derived, so the document schema and undo history are untouched.
- **The style is view state, not project state.** It lives in `localStorage` under
  `hucad.schematicMode`; switching styles must not mark a project dirty or enter undo.
- **The original sheet is drawn inside the SVG.** A white paper rect, grid and title block
  travel through `rasterizeSvgToPng`, so the PNG matches the screen instead of the app's dark
  canvas backdrop.
