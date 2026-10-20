# HuCAD

HuCAD is an **offline, local-first, Tinkercad Circuits-style Arduino simulator** desktop
app. Drag parts onto a canvas, wire them up, write Arduino C++ side by side, and run the sketch
against an emulated AVR — with no account and no network access at any point.

The product name is a single constant, `APP_NAME` in `src/shared/app.ts`. The npm package,
windows, user-data directory, desktop entry, installer artifact names and the git repository are
all `HuCAD`.

Built by BIT-CT students from CTU-San Francisco.

[![Latest release](https://img.shields.io/github/v/release/hagbongtangtanan/HuCAD)](https://github.com/hagbongtangtanan/HuCAD/releases/latest)

## Status

Under active development.

| Milestone | Scope                                                  | State       | Remaining                                                                 |
| --------- | ------------------------------------------------------ | ----------- | ------------------------------------------------------------------------- |
| 1         | Scaffolding, secure IPC, design system, full UI shell  | Done        | Schematic, blocks, notes and flip are labelled placeholders               |
| 2         | Canvas, breadboard, wiring, undo/redo, notes           | In progress | Curved wire routing and the notes tool; breadboard and undo/redo are done |
| 3         | Core parts, inspector, property editing                | Done        | Extended library is tracked under milestone 8                             |
| 4         | MNA solver, LED/resistor models, sim engine            | Done        | —                                                                         |
| 5         | Compiler, text editor, serial monitor                  | Done        | Block modes moved to milestone 6                                          |
| 6         | Block editor (Blocks / Text / Blocks + Text)           | Not started | Whole milestone                                                           |
| 7         | LED glow, burn-out, buzzer audio, multimeter, warnings | In progress | Burn-out, audio, multimeter and warnings; LED glow is done                |
| 8         | Extended parts and starter gallery                     | In progress | Protocol parts and displays, servo/relay/stepper, more starter circuits   |
| 9         | Persistence, schematic view, PNG export, shortcuts     | In progress | Schematic view and PNG export; persistence and shortcuts are done         |
| 10        | Windows-first installers, bundled toolchain, docs      | In progress | Windows/macOS toolchains and verified builds on those platforms           |

This table reflects the code rather than the original six-step plan. "Done" means implemented,
tested and exercised by the CDP probe; "In progress" names exactly what is still missing. The
milestone boundaries were tightened during the rebuild: block modes moved to milestone 6 and the
extended part library is tracked under milestone 8.

## Download

Latest installers: **<https://github.com/hagbongtangtanan/HuCAD/releases/latest>**

| Platform | Artifact                   | Install                                                     |
| -------- | -------------------------- | ----------------------------------------------------------- |
| Linux    | `HuCAD-*-linux-*.AppImage` | `chmod +x` it, then run it                                  |
| Windows  | `HuCAD-*-win-*.exe`        | run the installer (SmartScreen: **More info → Run anyway**) |
| macOS    | `HuCAD-*-mac-*.dmg`        | drag to Applications (first open: right-click → **Open**)   |

The Linux AppImage needs FUSE 2 (`sudo apt install libfuse2` on Ubuntu 22.04+); where FUSE is
unavailable, run it as `./HuCAD-*.AppImage --appimage-extract-and-run`. Compiling a
sketch needs the vendored AVR toolchain, which currently ships for Linux only — the canvas,
wiring and simulation work on every platform.

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
  packaged builds by electron-builder. The script is idempotent: once the toolchain is present
  it exits immediately, so `npm run build:linux` runs it automatically through `prebuild:linux`.
  `npm run toolchain:verify` checks for a usable toolchain without touching the network.

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

npm run release     # publish release/ to a GitHub Release (manual path)
npm run release:dry # print the release plan without writing anything
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

## Supported parts

All parts below are modelled by the MNA solver and animate while the simulation runs. The
**Basic** section of the library is a curated subset; **All parts** groups everything.

| Group    | Parts                                                         |
| -------- | ------------------------------------------------------------- |
| Boards   | Arduino Uno R3, breadboard, AA battery, 9V battery, 5V supply |
| Passives | resistor, capacitor, inductor, diode                          |
| Inputs   | push button, slide switch, potentiometer, photoresistor (LDR) |
| Outputs  | LED, RGB LED, 7-segment display, buzzer, DC motor             |

Interaction: hold a push button on the canvas to press it, click a slide switch (or the
inspector checkbox) to latch it, and use the inspector sliders for the potentiometer wiper and
the LDR's ambient light. The seven-segment display lights each segment independently from its
own pin, and RGB channels are solved separately, so mixed colours are real currents rather than
a painted effect.

Known modelling limits, chosen to keep the solver fast and predictable:

- Capacitors are open circuits and inductors are 50 mΩ shorts; there is no transient/AC analysis.
- The LDR is driven by the inspector's light slider, not by an LED shining on it.
- The DC motor is a 20 Ω load: it spins up whenever it has voltage, there is no back-EMF or
  mechanical load.
- Sensors with digital protocols (ultrasonic, PIR, temperature, gas, soil) and displays with
  controllers (LCD, OLED) are not in this tranche; they need device-level models and are tracked
  as Milestone 8 work.

## Packaging

HuCAD targets Windows; the NSIS installer is the shipped artifact:

```bash
npm run build:win
```

produces `release/HuCAD-0.2.1-win-x64.exe`. The installer is unsigned for now. The Linux build
(`npm run build:linux`, about 234 MB AppImage) still exists for development and smoke tests on
the machine the app is developed on: `prebuild:linux` vendors the toolchain, and electron-builder
copies it and the samples outside the asar into `resources/`. The packaged directory is checked
with the same CDP probe as the dev build (`CDP_HOST=... EXPECT_EDITOR=1 EXPECT_SIM=1`).
`release/` is gitignored; the icon (`resources/icon.png`, 512×512) is committed.

Windows packages currently ship without a compiler: the vendored avr-gcc is Linux-only and the
Windows toolchain is still Milestone 10 work, so the simulator runs but sketch uploads are
disabled there. Artifact names are deliberately space-free
(`HuCAD-<version>-<os>-<arch>.<ext>`): GitHub rewrites spaces in uploaded asset names, which
would break both the download links and the updater metadata in `latest.yml`.

## Releasing

CI is the primary path. Bump `version` in `package.json`, commit, and push a matching
`v<version>` tag: `.github/workflows/release.yml` builds the Windows installer, verifies that
the tag matches `package.json`, and uploads the `.exe` (plus `latest.yml` and its blockmap) to
the GitHub Release for that tag. Tags with a suffix, such as `v0.2.0-beta.1`, are published as
pre-releases. Releases intentionally contain Windows assets only.

```bash
npm version 0.2.1 --no-git-tag-version   # or edit package.json by hand
git commit -am "chore: release v0.2.1"
git tag v0.2.1
git push origin main v0.2.1
```

`scripts/release.mjs` is the manual/hotfix path: it publishes an already-built `release/`
directory using the same naming and notes rules. It prefers an authenticated `gh` session and
otherwise needs a token with `repo` scope in `GH_TOKEN` (or `GITHUB_TOKEN`); the token is never
read from a file or committed.

```bash
export GH_TOKEN=ghp_...   # or: gh auth login
npm run build:win         # produce release/*.exe
npm run release:dry       # print tag, assets, notes — writes nothing
npm run release           # create or update the release, overwriting assets
npm run release -- --draft --prerelease
```

The script is idempotent: an existing release for the tag is updated and its assets are
clobbered, so a failed upload is re-run by invoking it again. It creates and pushes the
annotated tag only when it is missing, and it refuses to run against a dirty working tree (or a
remote that is not `hagbongtangtanan/HuCAD`) unless told otherwise.

## Verifying the running window

`scripts/verify-electron.mjs` drives a running build over the Chrome DevTools Protocol and
asserts that the renderer mounted, the `window.api.ping` IPC round trip works, and the window
logged no console errors or CSP violations. Start a build with remote debugging, then probe it:

```bash
electron out/main/index.js --remote-debugging-port=9222 &
CDP_HOST=http://127.0.0.1:9222 npm run verify:electron
```

Set `EXPECT_CANVAS=1` to also drive the circuit editor end to end: the script places a part from
the parts panel, clicks two pins through the real Konva event path, and checks that a wire
appeared and the two nets merged. It then loads the bundled Blink sample from the panel's
Starters view and checks that the scene was replaced with three parts, three wires and the
sample's project label. Add `EXPECT_EDITOR=1` to open the code panel and compile the default
sketch through the vendored toolchain, asserting on the reported flash/RAM usage. Add
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
                 ui/                shell: top bar, canvas toolbar, parts panel, code panel,
                                    serial drawer, floating inspector, status bar, tokens.css
                 store/viewportStore.ts  pan/zoom/fit state shared by canvas and toolbar
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
