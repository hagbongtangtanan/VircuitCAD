# HuCAD Circuits

HuCAD Circuits is an **offline, local-first, Tinkercad Circuits-style Arduino simulator**
desktop app. Drag parts onto a canvas, wire them up, write Arduino C++ side by side, and run
the sketch against an emulated AVR — with no account and no network access at any point.

Built by BIT-CT students from CTU-San Francisco.

## Status

Under active development.

| Milestone | Scope                                                | State |
| --------- | ---------------------------------------------------- | ----- |
| 1         | Scaffolding, secure shell, typed IPC ping, packaging | Done  |
| 2         | Canvas, parts drawer, wiring, netlist, undo/redo     | Done  |
| 3         | Editor, compiler, serial monitor                     | Done  |
| 4         | avr8js simulation (LED, buzzer, input)               | Done  |
| 5         | `.circuit` / `.ino` / `.hex` file flows              | Done  |
| 6         | Packaging, docs, samples                             | Done  |

## Requirements

- Node.js 22+ and npm 10+
- Linux only, for the `chromium` sandbox: the Electron binary needs `libnss3`, `libnspr4`
  and `libasound2` from the system. They are present on a normal desktop install.
- One-time setup of the offline Arduino toolchain (about 420 MB on disk):

  ```bash
  npm run fetch:toolchain
  ```

  It downloads pinned, checksum-verified `avr-gcc`, `avr-libc`, `binutils-avr` and the
  Arduino AVR core, then precompiles the core for the Uno. This is the only step that uses
  the network; the app itself never does. The directory is gitignored and is shipped inside
  packaged builds by electron-builder.

## Scripts

```bash
npm install         # install dependencies
npm run fetch:toolchain # vendor avr-gcc + the Arduino core (once, needs network)
npm run dev         # launch the app with HMR
npm run build       # typecheck + bundle main, preload and renderer into out/
npm start           # preview the production bundle
npm run typecheck   # tsc for the node (main/preload) and web (renderer) sides
npm run lint        # ESLint
npm run test        # Vitest (run once)
npm run format      # Prettier write
npm run format:check

npm run build:linux # AppImage (electron-builder)
npm run build:win   # NSIS installer (run on Windows or with wine)
```

## Projects and files

A project is one `.hucad` file (JSON) holding both the circuit document and the sketch, so
opening it always restores a runnable state.

| Action        | Where               | Notes                                                   |
| ------------- | ------------------- | ------------------------------------------------------- |
| New           | toolbar             | starts a clean circuit with the default Blink sketch    |
| Open          | toolbar, `Ctrl+O`   | `.hucad` projects, plus `.ino` sketches into the editor |
| Save          | toolbar, `Ctrl+S`   | asks for a location the first time                      |
| Export `.ino` | toolbar (Code view) | writes the sketch alone                                 |
| Export `.hex` | toolbar (Code view) | writes the last compiled program                        |

The window title gains a bullet while there are unsaved changes, and the status bar shows the
project name plus an unsaved marker.

### Samples

The toolbar's sample picker ships two read-only examples from `resources/samples/`
(`process.resourcesPath/samples` in packaged builds):

| Sample        | Circuit                                       |
| ------------- | --------------------------------------------- |
| Blink led     | Uno, 220 Ω resistor and an LED on D13         |
| Traffic light | Three LEDs with resistors on D11, D12 and D13 |

Choosing one replaces the whole project, circuit and sketch. The sample file is read-only, so
the first **Save** asks for a `.hucad` location instead of offering to overwrite the example. Files are read and written in the main process; the
renderer only ever sees paths that came out of a native dialog, and a save can only reuse such
a path, never invent one.

## Packaging

```bash
npm run build:linux
```

produces `release/HuCAD Circuits-0.1.0.AppImage` (about 235 MB). The vendored toolchain and the
samples are copied outside the asar into `resources/`, so the installed app compiles sketches
and opens samples with no network and no system packages. `release/` is gitignored; the icon
(`resources/icon.png`, 512×512) is committed. The NSIS target builds on Windows (or with wine):

```bash
npm run build:win
```

## Verifying the running window

`scripts/verify-electron.mjs` drives a running build over the Chrome DevTools Protocol and
asserts that the renderer mounted, the `window.api.ping` IPC round trip works, and the window
logged no console errors or CSP violations. Start a build with remote debugging, then probe it:

```bash
electron out/main/index.js --remote-debugging-port=9222 &
CDP_HOST=http://127.0.0.1:9222 npm run verify:electron
```

Set `EXPECT_CANVAS=1` to also drive the circuit editor end to end: the script places a part from
the drawer, clicks two pins through the real Konva event path, and checks that a wire appeared
and the two nets merged. It then loads the bundled Blink sample and checks that the scene was
replaced with three parts, three wires and the sample's project label. Add `EXPECT_EDITOR=1` to switch to the Code view and compile the
default sketch through the vendored toolchain, asserting on the reported flash/RAM usage. Add
`EXPECT_SIM=1` to run that sketch on the emulated AVR and wait for its `Serial` output in the
monitor, then stop it again.

```bash
EXPECT_CANVAS=1 EXPECT_EDITOR=1 EXPECT_SIM=1 CDP_HOST=http://127.0.0.1:9222 npm run verify:electron
```

Native open/save dialogs cannot be driven over CDP, so the probe covers the file UI (buttons,
project label, dirty marker) while `src/main/services/projectFiles.test.ts` exercises the
read/write/validate paths against a temporary directory.

The packaged AppImage can be probed the same way: `--appimage-extract`, launch
`squashfs-root/AppRun --no-sandbox --remote-debugging-port=9222`, and point `CDP_HOST` at it.
That run is what proves the compiler and samples resolve from `process.resourcesPath` rather
than the repository.

On a headless or containerised Linux box where the setuid `chrome-sandbox` helper is not
installed, add `--no-sandbox` to the Electron flags. That disables the _process_ sandbox for
that run only; the renderer still runs with `sandbox: true` in its `webPreferences` in normal
use.

## Architecture

```
src/main/        Electron main process: window + security posture, ipc/, services/
                 services/compiler.ts   Electron paths + build queue
                 services/toolchain.ts  avr-gcc invocation, no Electron dependency
src/preload/     contextBridge surface (`window.api`), the only renderer↔main bridge
src/shared/      IPC contract, zod schemas, circuit model, compiler helpers
src/renderer/    React app: canvas/ parts/ wiring/ sim/ editor/ serial/ store/ ui/
                 sim/simulation.ts  avr8js CPU + peripherals, pin polling
                 sim/solver.ts      modified nodal analysis for the wired circuit
src/shared/      intelhex.ts        Intel HEX to AVR program memory
resources/       bundled offline assets: toolchain/ (gitignored), samples/
```

The renderer never touches Node or the file system directly. Anything that needs the OS goes
through a single typed `window.api` method, and the main process validates every payload with
zod before acting on it.

## Offline guarantee

There are no remote origins anywhere in the app: no CDNs, remote fonts, telemetry, or update
checks. The renderer runs under a strict `default-src 'self'` Content Security Policy applied
by the main process, and only the dev server origin is permitted while `npm run dev` is
running.

Compilation is equally local: the main process spawns the vendored `avr-gcc` with an argument
array (never a shell), writes the sketch to a temporary directory, and returns Intel HEX plus
diagnostics. The only network access in the project is `npm run fetch:toolchain`, which runs
once during setup.

## Simulation

The **Run** button compiles the sketch if needed and executes it on [avr8js] in the renderer.
Every animation frame advances the emulated ATmega328P by the elapsed wall time, reads the
PORT/PIN/DDR registers, and re-solves the wired circuit: wires and breadboard strips define
connectivity, resistors and potentiometers are conductances, LEDs are a forward voltage plus a
small series resistance, and the Uno's 5V/GND/IO pins are Thevenin sources. LED brightness comes
from the solved current, and the emulated UART feeds the serial monitor.

[avr8js]: https://github.com/wokwi/avr8js

Modelling notes and current gaps (buttons and the potentiometer are selectable but not yet
interactive, PWM is sampled rather than averaged, the buzzer has no audio) live in
`DECISIONS.md`.

## License

MIT.
