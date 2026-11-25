# Phase 1 — Assessment of file handling (unpatched build)

**How it was tested:** the real main-process bundle `work/app/out/main/index.js` (the same
code that ships in `pristine/app.asar`, sha256 `3cbc4837…`) was loaded headlessly in Node with a
**mocked `electron` module** (mocked preload boundary): `ipcMain.handle` registrations, the
`BrowserWindow` options, the app/window events and the dialog calls are captured, and every IPC
handler is invoked directly with real payloads. All file writes went to a temp directory created
with `os.tmpdir()`. Harness: `scripts/test-files.js`; raw output:
`reports/file-features-phase1-pristine.json`.

Renderer-only behaviour (dirty flag, guards, title) was checked by **code reading** against
`work/readable/out/renderer/assets/index-BU2QbNS1.js`; the two renderer checks are labelled
`code-read` in the evidence column. No visual check was performed — the human reviews that.

Summary: **27 PASS, 10 FAIL, 3 NOT PRESENT.** Critical: 4 checks (A1 atomic save, A5 unsaved
guard ×4). High: 2 checks (A2 backup, C16 second-instance open).

| id | check | status | severity | evidence |
| --- | --- | --- | --- | --- |
| A1 | save writes a valid project file | PASS | – | `saved=…/a1.vcc format=vircuit-project version=2` |
| A1 | save is atomic (target survives a crash during the write) | **FAIL** | **Critical** | simulated `ENOSPC` mid-write: `rejected=true target_intact=false bytes_before=1121 bytes_after=20` — the old file is destroyed (`writeProjectFile` → `fs.promises.writeFile`, `main:1330`) |
| A2 | a backup of the previous version is kept | **FAIL** | **High** | `backup_exists=false backup_matches_previous=false` — no `.bak` is written |
| A3 | a failed write reports the file name and keeps the document dirty | PASS | – | `message="ENOENT … /a3/a3.vcc" mentions_file=true`; the renderer only clears `dirty` in `markSaved()` after a successful save (`work/readable/…:10066`) |
| A3 | a failed write is never silent | PASS | – | `handler_rejected=true` |
| A4 | corrupt / empty / wrong-type / oversized files are rejected | PASS | – | `corrupt.vcc:rejected empty.vcc:rejected wrong.vcc:rejected huge.vcc:rejected`; the current document is only replaced on success (`applyOpened` is called after the await) |
| A4 | an oversized file is rejected before it is read into memory | **FAIL** | Medium | `bytes_read_before_rejection=5242880` — `readText()` reads the whole file and only then compares against `MAX_FILE_BYTES` (`main:1324`) |
| A5 | the window close event asks the renderer before closing | **FAIL** | **Critical** | `main window has a "close" listener: false` — only `closed` is registered (`main:1754`) |
| A5 | the app guards `before-quit` | **FAIL** | **Critical** | `app "before-quit" handler registered: false`; `window-all-closed` → `app.quit()` (`main:1801`) |
| A5 | a discard confirmation channel exists for in-app actions | **FAIL** | **Critical** | `ipc channel file:confirm-discard registered: false` |
| A5 | the renderer asks before New/Open/Sample discards the document | **FAIL** | **Critical** | `renderer has a discard guard: false; newProject() is guarded: false` (code-read, `work/readable/…:100220`) |
| A6 | the dirty flag is derived from the document, sketch and name only | PASS | – | `computeDirty() mentions viewport=false selection=false` (code-read, `work/readable/…:10051`) — selection, pan and zoom do not set it |
| A6 | the dirty flag is cleared only after a successful save | PASS | – | `dirty:false assignments=3 markSaved() calls=5`; `markSaved` runs only from `applyOpened`, `save`, `saveAs`, `newProject` |
| A7 | runtime damage state is not part of the saved document | PASS | – | `saved keys=format,version,metadata,viewport,name,circuit,sketch forbidden_found=none` — burnt parts, damage settings, selection and undo history are not written |
| B8 | version 1 files still load | PASS | – | `loaded version=1` (`legacyProjectFileSchema`, `main:499`) |
| B8 | a newer version is rejected instead of being downgraded | PASS | Low | `message="This is not a VircuitCAD project: version — invalid literal value"` — rejected, but the wording does not say “newer version” |
| B9 | unknown fields survive a load/save round trip | **FAIL** | Medium | `message="… Unrecognized key: \"futureField\""` — the strict zod schemas (`main:489`) refuse files with unknown keys |
| B10 | every bundled sample round-trips with 0 differences | PASS | – | `samples=4 differences=0` (parts, pins, wires, waypoints, props, notes, sketch, viewport, metadata compared) |
| C11 | save without a path asks for a location and enforces the extension | PASS | – | `dialog_shown=true defaultPath=Harness.vcc saved=…/c11.vcc` (`resolveSavePath`, `main:1492`) |
| C11 | the default file name follows the project name | PASS | – | `defaultPath=My-Circuit-2.vcc` — invalid characters are replaced by `safeBaseName` (`main:1466`) |
| C11 | a renderer-supplied path outside the approved set is not written directly | PASS | – | `dialog_shown=true saved=…/c11c.vcc` — `approvedPaths` (`main:1445`) gates every renderer path |
| C12 | samples are listed and opened read-only by the main process | PASS | – | `samples=4 opened=…/traffic-light.vcc` |
| C12 | the renderer clears the path after opening a sample | PASS | – | `renderer openSample() sets path:null = true` (code-read) — a sample can never be overwritten |
| C13 | a recent-files list exists | NOT PRESENT | Low | `renderer mentions a recent-files list: false` |
| C14 | autosave or crash recovery exists | NOT PRESENT | Medium | `renderer mentions autosave/recovery: false` |
| C15 | unicode and spaces in paths are handled | PASS | – | `saved=…/My Circuits/Circuit Ω.vcc readable=true` |
| C15 | a path that is too long fails with a clear message | PASS | – | `message="ENAMETOOLONG: name too long, open '…'"` |
| C16 | opening the same file from a second instance is guarded | **FAIL** | **High** | `second-instance handler=true file_delivered_to_renderer=true discard_guard_available=false` — the OS-open path replaces the document with no prompt (`acceptOpenedFile`, `main:1765`) |
| D17 | the browser window is isolated | PASS | – | `contextIsolation=true nodeIntegration=false sandbox=true` (`main:1731`) |
| D17 | non-string and relative save paths are rejected by the schema | PASS | – | `rejected_number=true rejected_object=true` (`saveProjectRequestSchema`, `main:562`) |
| D17 | the renderer cannot choose an arbitrary extension | PASS | – | `saved=…/evil.sh.vcc` — `withExtension()` (`main:559`) forces `.vcc` |
| D18 | `__proto__` and `constructor` keys are rejected | PASS | – | `message="… Unrecognized keys: \"__proto__\", \"constructor\"" prototype_polluted=false` |
| D18 | NaN and Infinity coordinates are rejected | PASS | – | `nan_rejected=true infinity_rejected=true` (zod `z.number()` rejects both) |
| D18 | duplicate part ids and dangling wires are reported | **FAIL** | Medium | `message=null` — both are accepted silently; `buildNetlist` ignores a wire whose endpoints do not exist (`work/readable/…:65258`) |
| E19 | a PNG export writes a decodable file | PASS | – | `png_signature=true bytes=70` |
| E19 | a non-PNG payload is rejected with an error | PASS | – | `message="The image data is not a PNG."` |
| E19 | a non-PDF payload is rejected with an error | PASS | – | zod rejects the payload before it reaches the writer |
| E19 | sketch and HEX exports are written | PASS | – | `sketch=…/e19.ino hex=…/e19.hex` |
| E19 | an invalid HEX payload is rejected | PASS | – | `message="There is no compiled HEX to export."` |
| E19 | SVG, netlist and BOM exports exist | NOT PRESENT | Low | `svg=false netlist=false bom=false` |

### Findings that drive Phase 2

Critical
1. **A1 — saving is not atomic.** A crash (or a full disk) during `fs.promises.writeFile` leaves a
   truncated project file; the previous version is gone. Evidence: `target_intact=false`.
2. **A5 — no unsaved-changes guard.** New/Open/Open-sample/second-instance replace the document
   immediately; the window X and Quit close without asking. Evidence: no `close` listener, no
   `before-quit` handler, no discard channel, no renderer guard.

High
3. **A2 — no backup.** The previous version is overwritten without a `.bak`.
4. **C16 — an OS-initiated open replaces the document** with no prompt (same root cause as A5).

### Proposals for Medium / Low (not implemented)

| id | what | why | size |
| --- | --- | --- | --- |
| A4 | check the file size with `stat` before reading | a huge file is read into memory before the 4 MB cap is applied | ~10 lines in `readText` |
| B9 | keep unknown top-level fields and re-emit them on save | files written by a newer build cannot be opened at all today | ~40 lines (a `passthrough` map in the project schema) |
| B8 | say “this file was written by a newer version” | the current message is a generic zod complaint | ~10 lines in `parseProjectText` |
| D18 | report duplicate part ids and wires with missing endpoints on load | both are silently accepted; dangling wires vanish from the netlist | ~30 lines in `parseProjectText` + a warning toast |
| C14 | write an autosave copy next to the app data and offer it after a crash | no recovery exists after a crash | ~120 lines + a restore prompt |
| C13 | keep a recent-files list in the app data | opening the same project again is tedious | ~80 lines |
| C15 | derive the display name with `path.basename` instead of splitting on `/` | on Windows the title keeps `C:\…` | ~5 lines in the renderer |
| A6 | mark the document dirty when the viewport changes | the viewport is saved but pan/zoom does not set the dirty flag | ~5 lines |
| E19 | SVG / netlist / BOM exports, and a theme choice for the PNG | users cannot get a vector image or a parts list | ~250 lines |
