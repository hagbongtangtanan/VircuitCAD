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
