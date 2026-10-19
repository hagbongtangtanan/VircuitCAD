# HuCAD Circuits

HuCAD Circuits is an **offline, local-first, Tinkercad Circuits-style Arduino simulator**
desktop app. Drag parts onto a canvas, wire them up, write Arduino C++ side by side, and run
the sketch against an emulated AVR — with no account and no network access at any point.

Built by BIT-CT students from CTU-San Francisco.

## Status

Under active development.

| Milestone | Scope                                                | State   |
| --------- | ---------------------------------------------------- | ------- |
| 1         | Scaffolding, secure shell, typed IPC ping, packaging | Done    |
| 2         | Canvas, parts drawer, wiring, netlist, undo/redo     | Planned |
| 3         | Editor, compiler, serial monitor                     | Planned |
| 4         | avr8js simulation (LED, buzzer, input)               | Planned |
| 5         | `.circuit` / `.ino` / `.hex` file flows              | Planned |
| 6         | Packaging, docs, samples                             | Planned |

## Requirements

- Node.js 22+ and npm 10+
- Linux only, for the `chromium` sandbox: the Electron binary needs `libnss3`, `libnspr4`
  and `libasound2` from the system. They are present on a normal desktop install.

## Scripts

```bash
npm install         # install dependencies
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

## Verifying the running window

`scripts/verify-electron.mjs` drives a running build over the Chrome DevTools Protocol and
asserts that the renderer mounted, the `window.api.ping` IPC round trip works, and the window
logged no console errors or CSP violations. Start a build with remote debugging, then probe it:

```bash
electron out/main/index.js --remote-debugging-port=9222 &
CDP_HOST=http://127.0.0.1:9222 npm run verify:electron
```

On a headless or containerised Linux box where the setuid `chrome-sandbox` helper is not
installed, add `--no-sandbox` to the Electron flags. That disables the _process_ sandbox for
that run only; the renderer still runs with `sandbox: true` in its `webPreferences` in normal
use.

## Architecture

```
src/main/        Electron main process: window + security posture, ipc/, services/
src/preload/     contextBridge surface (`window.api`), the only renderer↔main bridge
src/shared/      IPC contract types + zod schemas (imported by all three sides)
src/renderer/    React app: canvas/ parts/ wiring/ netlist/ sim/ editor/ serial/ store/ ui/
resources/       bundled offline assets: samples/, toolchain/{win,linux}/
```

The renderer never touches Node or the file system directly. Anything that needs the OS goes
through a single typed `window.api` method, and the main process validates every payload with
zod before acting on it.

## Offline guarantee

There are no remote origins anywhere in the app: no CDNs, remote fonts, telemetry, or update
checks. The renderer runs under a strict `default-src 'self'` Content Security Policy applied
by the main process, and only the dev server origin is permitted while `npm run dev` is
running.

## License

MIT.
