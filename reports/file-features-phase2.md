# Phase 2 and 3 — file-operation safety fixes

Scope: the two Critical/High findings from `reports/file-features-phase1.md` that can cause
silent data loss — a project save that can leave a half-written file, and a document that is
discarded without asking.

Everything is produced by `scripts/patch-files.js` from the working sources; the sources in
`work/` are never modified and the installed app (`resources/app.asar`) is never repacked.
Patched copies live in `out/patched/` (git-ignored).

```
node scripts/patch-files.js              # apply the patches into out/patched/
node scripts/patch-files.js --rollback   # restore out/patched/ from the pristine extraction
node scripts/patch-files.js --check      # print out/patched/manifest.json
```

The patcher asserts every anchor string exactly once, refuses to patch a file that already
carries the `PROJECT_FILES_PATCH_V1` marker (so it is idempotent), and syntax-checks every
patched file before writing it.

## F1 — atomic saves with a one-generation backup

`out/patched/app/out/main/index.js:1334-1389` replaces the plain `fs.writeFile` save with:

1. write to `.<filename>.tmp-<pid>-<time>-<rand>` in the **same folder** as the target,
2. `fsync` the temporary file,
3. copy the existing target to `<filename>.bak` (one generation only),
4. `rename` the temporary file over the target (atomic on the same filesystem),
5. `fsync` the directory so the rename survives a power cut.

Failure handling:

- any failure removes the temporary file and rejects with a `ProjectFileError` whose message
  names the file and the reason (`out/patched/app/out/main/index.js:1336-1353`),
- `rename` is retried three times (40 ms / 120 ms / 300 ms) on `EPERM`, `EBUSY` and `EACCES`,
  which is what Windows returns while an indexer or virus scanner holds the file
  (`out/patched/app/out/main/index.js:1355-1372`),
- `ENOSPC`, `EXDEV`, `EISDIR`, `ENOENT`, `ENAMETOOLONG` and `EBUSY` each map to their own
  message instead of a raw errno.

The saved format is untouched: `serializeProject()` still produces the same UTF-8 JSON with
2-space indentation and a trailing newline.

## F2 — unsaved-changes guard

New IPC channels (main `out/patched/app/out/main/index.js:36-39`, preload
`out/patched/app/out/preload/index.js:22-25`):

| channel | direction | payload | result |
| --- | --- | --- | --- |
| `file:dirty-state` | renderer → main | `{ dirty, name }` | `{ accepted }` |
| `file:confirm-discard` | renderer → main | `{ dirty, name }` | `"save" \| "discard" \| "cancel"` |
| `file:close-request` | main → renderer | `"window" \| "quit"` | — |
| `file:close-decision` | renderer → main | `{ decision }` | `{ accepted }` |

Main process:

- `window.on("close")` calls `preventDefault()` and asks the renderer
  (`out/patched/app/out/main/index.js:1919-1923`),
- `app.on("before-quit")` does the same for a quit (`out/patched/app/out/main/index.js:1953-1960`),
- the native “Save / Don't Save / Cancel” box is shown by the main process
  (`out/patched/app/out/main/index.js:1612-1633`),
- a pending request expires after 30 s and then leaves the window open
  (`out/patched/app/out/main/index.js:1635-1643`),
- the renderer answers with `file:close-decision`; only then is the window closed or the app
  quit (`out/patched/app/out/main/index.js:1669-1680`).

Renderer (`out/patched/readable/out/renderer/assets/index-BU2QbNS1.js`):

- `confirmDiscard()` asks the main process and treats “cancel” and a failed save as “stop”
  (:100131-100146),
- `open` (:100156), `openSample` (:100185), `loadStarter` (:100204), `newProject` (:100220) and
  `receiveOpened` (:100240) — the path used by a file opened from the OS or a second instance —
  all check the guard before they replace the document,
- `save()` and `saveAs()` now return `true`/`false` so the guard can tell a finished save from
  a cancelled one (:100253-100326),
- the close request handler (:109449-109461) saves first when the user picks “Save” and
  answers “cancel” when that save fails,
- the dirty flag is reported to the main process whenever it changes (:109474).

## Verification

### Headless main-process harness — `scripts/test-files.js`

```
node scripts/test-files.js --main work/app/out/main/index.js \
  --renderer work/readable/out/renderer/assets/index-BU2QbNS1.js \
  --report reports/file-features-phase3-pristine.json

node scripts/test-files.js --main out/patched/app/out/main/index.js \
  --renderer out/patched/readable/out/renderer/assets/index-BU2QbNS1.js \
  --report reports/file-features-phase3.json
```

| build | PASS | FAIL | NOT PRESENT |
| --- | --- | --- | --- |
| unpatched | 29 | 14 | 3 |
| patched | 40 | 3 | 3 |

The 11 checks that changed from FAIL to PASS:

| check | unpatched | patched |
| --- | --- | --- |
| A1 save is atomic (target survives a crash during the write) | `target_intact=false bytes_after=20` | `target_intact=true bytes_after=1121` |
| A1 a rename failure is reported with the file name | `message=null` | `VircuitCAD cannot replace a1-exdev.vcc because it lives on another disk.` |
| A1 a locked file is retried before the save fails | — | `rename_attempts=3 saved=…` |
| A1 no temporary files are left behind | — | `after_success=none after_failure=none` |
| A2 a backup of the previous version is kept | `backup_exists=false` | `backup_exists=true backup_matches_previous=true` |
| A2 the backup keeps exactly one previous generation | `backup_is_previous_generation=false` | `backup_is_previous_generation=true` |
| A5 the window close event asks the renderer before closing | `has a "close" listener: false` | `true` |
| A5 the app guards before-quit | `registered: false` | `true` |
| A5 a discard confirmation channel exists | `registered: false` | `true` |
| A5 closing the window is blocked until the renderer answers | `file:close-decision is not registered` | `close_prevented=true renderer_asked=true open_after_cancel=true closed_after_accept=true` |
| A5 quitting the app is blocked until the renderer answers | `no before-quit handler` | `quit_prevented=true renderer_asked=true` |
| A5 the renderer asks before New/Open/Sample discards the document | `unguarded actions: newProject,open,openSample,loadStarter,receiveOpened` | `unguarded actions: none` |
| C16 opening the same file from a second instance is guarded | `discard_guard_available=false` | `discard_guard_available=true` |

The three checks that still fail are the Medium/Low items that were explicitly left out of
scope: A4 (an oversized file is still read before it is rejected), B9 (unknown top-level fields
are still rejected) and D18 (duplicate part ids and dangling wires are still accepted
silently).

### Real app over CDP — `scripts/test-files-app.js`

The patched bundles are copied into `out/patched/runtime/` and launched with the project's
Electron build and a throw-away user-data directory; the installed app is not touched.

```
node scripts/test-files-app.js --variant pristine --port 9334 --report reports/file-features-phase3-app-pristine.json
node scripts/test-files-app.js --variant patched  --port 9333 --report reports/file-features-phase3-app.json
```

| check | unpatched | patched |
| --- | --- | --- |
| R1 the build starts and renders the File menu | PASS | PASS |
| R2 an edit marks the document dirty | PASS | PASS |
| R3 New is blocked while the confirmation is pending | FAIL — `title_after="untitled" dirty_after=false` (document lost) | PASS — `title_after="Guarded Project" dirty_after=true` |
| R4 the renderer stays responsive while the confirmation is open | PASS | PASS |
| R5 no uncaught renderer exceptions | PASS | PASS |

The unpatched build throws the edited document away the moment **File → New circuit** is
clicked; the patched build keeps it while the native confirmation is open.

## Rollback

`node scripts/patch-files.js --rollback` re-copies the unpatched sources into
`out/patched/`, checks `pristine/app.asar` against `pristine/SHA256.txt` and records both in
`out/patched/manifest.json`. No file outside `out/patched/` is touched by either mode, so the
working tree and the installed app stay exactly as they were.

## Not changed on purpose

- the export writers (`.ino`, `.hex`, `.png`, `.pdf`) still write in place; they produce new
  files rather than replacing a project, so they are not part of the data-loss path,
- `readText` still reads a file before checking the 4 MiB limit (A4),
- no recent-files list, autosave, SVG/netlist/BOM export or duplicate-id reporting was added —
  those were listed as out of scope in Phase 1.
