# Phase 0 — File feature inventory (VircuitCAD)

Workspace: `/home/kheil_gwapo/projects/OldVircuitCAD` (git toplevel verified identical to `pwd`).
Sources inspected (read-only):

- main process: `work/app/out/main/index.js` (1805 lines)
- preload: `work/app/out/preload/index.js` (75 lines)
- renderer: `work/readable/out/renderer/assets/index-BU2QbNS1.js` (109 629 lines)
- bundled samples: `resources/samples/*.vcc` (4 files)
- pristine archive: `pristine/app.asar` (sha256 `3cbc4837276d8a321899da4736805463f2c5bdc39f3f6eacd824f10344165d0a`)

No component visuals, pin ids, nets or the electrical model were touched.

## 1. Project commands

| Command | Exists | Where |
| --- | --- | --- |
| New | yes | renderer store `newProject()` `work/readable/.../index-BU2QbNS1.js:100220`; File menu item `file-new` `:108969`; shortcut Ctrl+N `:109483` |
| Open | yes | renderer `open()` `:100139`; File menu `file-open` `:108976`; shortcut Ctrl+O `:109451`; main IPC `file:open` `work/app/out/main/index.js:1536` |
| Save | yes | renderer `save()` `:100233`; File menu `file-save` `:108991`; shortcut Ctrl+S `:109446`; main IPC `file:save-project` `main:1556` |
| Save As | yes | renderer `saveAs()` `:100268`; File menu `file-save-as` `:108999`; **no keyboard shortcut** |
| Revert | **not present** | no entry in `FileMenu` `:108914-109060`, no store action |
| Close (document) | **not present** | no store action; only the window close button exists |
| Quit | **not present** | no `Menu.setApplicationMenu`, no `before-quit` handler; `window-all-closed` → `app.quit()` `main:1801` |
| Window X | yes, unguarded | `BrowserWindow` created `main:1722`; only a `closed` listener `main:1754`; no `close` listener |

## 2. Menus and shortcuts

- In-app File dropdown: `FileMenu` `:108914-109060` — New circuit, Open…, Open starter…, Save, Save As…, separator, Export sketch (.ino), Export program (.hex), separator, Export view as PNG…, Save schematic as PDF…, separator, Keyboard shortcuts…, Guided tour.
- Samples: not a menu — the Parts panel has a “starters” section listing bundled samples `:105528-105580` (`data-testid="samples"`, `data-sample="<name>.vcc"`), plus a separate starter-library modal `loadStarter()` `:100200`.
- Native menu bar: the main process never calls `Menu.setApplicationMenu` (grep: no `Menu` usage in `main:1-1805`) → Electron’s default menu applies on Windows/Linux; it carries no project actions. The macOS app menu is Electron’s default.
- Shortcuts (renderer keydown handler `:109435-109560`): Ctrl+B build, Ctrl+S save, Ctrl+O open, Ctrl+Z/Y undo/redo, Ctrl+C/V/A/D, Ctrl+N new, `?` help, R rotate, Shift+F/V flip, N note, F fit. Help sheet lists the same (`:108363-108460`). **Ctrl+Shift+S is not bound.**

## 3. Unsaved-changes indicator and title

- Dot next to the project name in the header: `.cb-dirty-dot` rendered when `dirty` `:109255-109260`, input `project-title` `:109236`.
- Dirty computation: `computeDirty()` `:10051` compares the live circuit-document object identity, the sketch source and the project name against the last saved snapshot (`savedCircuit`/`savedSource`/`savedName` `:10035-100037`). `syncDirty()` `:10058` runs from `useCircuitStore.subscribe` `:100376` and `useSketchStore.subscribe` `:100379`.
- Window title: `updateWindowTitle()` `:10047` sets `document.title = "• <name> — VircuitCAD"` (the bullet mirrors the dirty flag). The main process never calls `setTitle`/`setRepresentedFilename`/`setDocumentEdited`, so the OS title bar shows the renderer title only.

## 4. Opening files by other means

| Path | Exists | Evidence |
| --- | --- | --- |
| Command-line argument | yes | `filePathFromArgs()` `main:1666`, `LAUNCH_EXTENSIONS` `.vcc/.vcircuit/.ino/.json` `main:1655`; queued at `main:1681`; renderer picks it up with `takeLaunchFile` `main:1528`, renderer `:100156` |
| Second instance (OS re-open) | yes | `requestSingleInstanceLock` `main:1781`, `second-instance` → `acceptOpenedFile` `main:1783` |
| macOS `open-file` | yes | `main:1788` |
| OS file association | configured in the installer, not in code | comment `main:1652` (“keep in step with electron-builder.yml”); no code path of its own |
| Drag-and-drop of a file | **not present** | the only `drop` handlers are part dragging (`:68902`, `:69015`) and CodeMirror (`:13588`); the preload exposes no `webUtils.getPathForFile`, and `File.path` is not used |
| Recent files list | **not present** | no `recent` in main or renderer |
| Last-session restore | **not present** | no session store; `pendingLaunchPath` only carries an OS-supplied file |

## 5. Autosave / recovery / backups

- Autosave: **not present** (no `autosave` in main or renderer).
- Crash recovery: **not present**.
- Backup files: **not present** (`writeProjectFile` writes straight to the target, `main:1330`).

## 6. Import / export

| Feature | Exists | Where |
| --- | --- | --- |
| Export project | yes | `file:save-project` `main:1556` → `writeProjectFile` `main:1330` |
| Export sketch `.ino` | yes | `file:export-sketch` `main:1573` → `writeSketchFile` `main:1357`; renderer `:100303` |
| Import sketch `.ino` | yes | `openKindForPath` `main:544` → `kind:"sketch"`; renderer `applyOpened` `:100095` (opens as an untitled sketch) |
| Export PNG (circuit view) | yes | `file:export-png` `main:1590` → `writePngFile` `main:1361`; renderer `:100315` |
| Export PDF (schematic, vector) | yes | `file:export-pdf` `main:1607` → `writePdfFile` `main:1376`; renderer `:100333` |
| Export SVG | **not present** | `prepareSvgForExport` `:105691` only feeds the PDF path |
| Export netlist | **not present** | `buildNetlist` `:65228` is internal only |
| Export BOM | **not present** | no BOM code path |
| Export HEX | yes | `file:export-hex` `main:1631` → `writeHexFile` `main:1389`; renderer `:100354` |
| Serial-monitor log save | **not present** | serial drawer `:108282` has no save/copy action |
| Sketch storage | inside the project file | `project.sketch`; the `.ino` export is a copy |

## 7. Samples

- Listed from `resources/samples` next to the app: `samplesDirectory()` `main:1429`, `listSamples()` `main:1404`.
- Opened through `openSample` `main:1627` → `readSample()` `main:1419` → `openFile()` (read-only).
- The renderer then clears the path: `openSample()` sets `path: null` after `applyOpened` `:100185-100198` → a sample is an **untitled copy**; Save asks for a location and can never overwrite the bundled file. The same holds for starters (`:100200-100219`).

## 8. IPC surface, window preferences, dialogs

Channels (`work/app/out/preload/index.js:7-22`, identical in `main:1-36`):

| Channel | Direction | Payload | Validation |
| --- | --- | --- | --- |
| `app:ping` | renderer→main | `{sentAt:int}` | zod strict |
| `build:compile` | renderer→main | `{sketch:string≤2e5}` | zod strict |
| `build:toolchain-status` | renderer→main | – | – |
| `file:open` | renderer→main | – | native open dialog, extension filter `vcc/vcircuit/json/ino` `main:1536` |
| `file:take-launch` | renderer→main | – | – |
| `file:opened` | main→renderer | `{kind,path,project|sketch}` | – |
| `file:open-error` | main→renderer | string | – |
| `file:save-project` | renderer→main | `{project:<project schema>, path:string\|null}` | `saveProjectRequestSchema` `main:562` |
| `file:export-sketch` | renderer→main | `{sketch, path}` | `main:567` |
| `file:export-hex` | renderer→main | `{hex≤4e5, path}` | `main:571` |
| `file:export-png` | renderer→main | `{dataUrl(png regex, ≤32 MB), name≤120, path}` | `main:578` |
| `file:export-pdf` | renderer→main | `{base64 pdf regex, ≤48 MB, name, path}` | `main:584` |
| `file:list-samples` | renderer→main | – | – |
| `file:open-sample` | renderer→main | `{name: /^[a-z0-9-]+\.(vcc|vcircuit)$/}` | `main:591` |

- Path approval: `approvedPaths` set `main:1445`; a renderer-supplied save path is honoured only when it is in that set, otherwise a save dialog is shown (`resolveSavePath` `main:1492`). Dialog-picked paths are added to the set.
- Window preferences `main:1731-1738`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, `spellcheck: false`, preload `out/preload/index.js`. `setWindowOpenHandler` denies popups (`main:1743`, `1776`), `will-navigate` is prevented (`main:1744`, `1777`), CSP is strict offline (`main:1687-1721`), permission requests are denied (`main:1717`).
- Dialog APIs used: `electron.dialog.showOpenDialog` (`main:1479`), `electron.dialog.showSaveDialog` (`main:1487`). No `messageBox`, no native error dialogs — errors travel to the renderer as rejected IPC promises and become toasts (`fail()` `:100122`).

## Saved file format

- Extension: `.vcc` (legacy `.vcircuit`; `.json` is also accepted on open). Encoding: UTF-8, pretty-printed with 2-space indent and a trailing newline (`serializeProject` `main:510`).
- Top level (`currentProjectFileSchema` `main:489`):

```jsonc
{
  "format": "vircuit-project",
  "version": 2,                       // 1 = legacy (no metadata/viewport)
  "metadata": { "created_at": "ISO-8601", "app_version": "0.5.0-beta.3" },
  "viewport": { "scale": 1, "offsetX": 60, "offsetY": 60 },
  "name": "optional project title",   // optional
  "circuit": {
    "version": 1,
    "parts": [ { "id", "type", "position": {"x","y"}, "rotation": 0|90|180|270,
                 "flipX": true?, "flipY": true?, "props": { …per type… } } ],
    "wires": [ { "id", "from": {"partId","pinId"}, "to": {"partId","pinId"},
                 "color": "#rrggbb", "waypoints": [ {"x","y"} ] } ],
    "notes": [ { "id", "text", "position" } ]   // optional
  },
  "sketch": "Arduino C++ source"
}
```

- Saved: parts (id, type, position, rotation, flips, per-type props), wires (endpoints, colour, waypoints), optional canvas notes, the sketch source, the project name, the viewport and metadata (`created_at`, `app_version`).
- Not saved: selection, undo/redo history, simulation state, burnt/damaged parts, serial log, window layout, damage-engine settings, per-part runtime brightness.

## Where the app writes files

- Project save: the path chosen in the save dialog, or the previously opened/approved path. Default filename `safeBaseName(project.name) + ".vcc"` (`main:1560`, `safeBaseName` `main:1466` strips everything but `[a-z0-9._-]`, 80 chars max).
- Exports: sketch `.ino`, program `.hex`, view `.png`, schematic `.pdf` — all through a save dialog, extension forced by `withExtension()` `main:559`.
- Build artifacts: a temp build directory under `os.tmpdir()` `main:1036` (compiled objects are removed after the build).
- The app writes **nothing** inside the install directory, and never writes to the bundled samples.
- Windows handling: paths are plain strings from the OS; `fileExtension`/`fileBaseName`/`fileStem` split on `"/"` only (`main:538`, renderer `:99919-99932`), so on Windows the *displayed* base name keeps the drive and folders. `safeBaseName` removes characters Windows forbids in file names from the default export name.
