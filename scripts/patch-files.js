"use strict";

/**
 * Phase 2 file-safety patches for VircuitCAD.
 *
 * Reads the working sources and writes patched copies into out/patched/.
 * Nothing outside out/patched/ is written, and the sources are never
 * modified, so the patch is reversible by re-running with --rollback.
 *
 * Usage:
 *   node scripts/patch-files.js            apply the patches
 *   node scripts/patch-files.js --rollback restore out/patched from pristine
 *   node scripts/patch-files.js --check    print the current manifest
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "out", "patched");
const marker = "PROJECT_FILES_PATCH_V1";

const sources = {
  main: path.join(root, "work", "app", "out", "main", "index.js"),
  preload: path.join(root, "work", "app", "out", "preload", "index.js"),
  rendererApp: path.join(root, "work", "app", "out", "renderer", "assets", "index-BU2QbNS1.js"),
  rendererReadable: path.join(root, "work", "readable", "out", "renderer", "assets", "index-BU2QbNS1.js"),
};

const pristineAsar = path.join(root, "pristine", "app.asar");
const pristineSha = path.join(root, "pristine", "SHA256.txt");

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function writeOut(relative, contents) {
  const target = path.join(outDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  return target;
}

function apply(source, label, pattern, replacement, expected) {
  const wanted = expected ?? 1;
  const matches = source.match(pattern);
  const count = matches === null ? 0 : matches.length;
  if (count !== wanted) {
    throw new Error(`[${label}] expected ${wanted} match(es) but found ${count}`);
  }
  return source.replace(pattern, replacement);
}

function applyRegion(source, label, startMarker, endMarker, edits) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`[${label}] start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error(`[${label}] end marker not found: ${endMarker}`);
  let region = source.slice(start, end);
  for (const edit of edits) {
    region = apply(region, `${label}:${edit.id}`, edit.pattern, edit.replacement, edit.expected);
  }
  return source.slice(0, start) + region + source.slice(end);
}

const channelLines = [
  '  confirmDiscard: "file:confirm-discard",',
  '  dirtyState: "file:dirty-state",',
  '  closeRequest: "file:close-request",',
  '  closeDecision: "file:close-decision",',
].join("\n");

const mainWriteProjectFile = `var PROJECT_FILES_PATCH_MARKER = "${marker}";
var PROJECT_SAVE_RETRY_DELAYS_MS = [40, 120, 300];
function projectSaveErrorMessage(error, path) {
  var code = error && error.code ? error.code : "";
  var name = node_path.basename(path);
  if (code === "ENOSPC")
    return "There is not enough space on the disk to save " + name + ".";
  if (code === "EACCES" || code === "EPERM")
    return "VircuitCAD is not allowed to write " + name + ".";
  if (code === "EBUSY")
    return name + " is locked by another program. Close it and try again.";
  if (code === "EXDEV")
    return "VircuitCAD cannot replace " + name + " because it lives on another disk.";
  if (code === "ENAMETOOLONG")
    return "The file name " + name + " is too long for this system.";
  if (code === "EISDIR") return name + " is a folder, not a project file.";
  if (code === "ENOENT")
    return "The folder for " + name + " no longer exists.";
  var detail = error && error.message ? error.message : String(error);
  return "Could not save " + name + ": " + detail;
}
async function renameWithRetry(from, to) {
  var lastError = null;
  for (var attempt = 0; attempt <= PROJECT_SAVE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await (0, node_fs_promises.rename)(from, to);
      return;
    } catch (error) {
      lastError = error;
      var code = error && error.code ? error.code : "";
      var retryable = code === "EPERM" || code === "EBUSY" || code === "EACCES";
      if (!retryable) break;
      if (attempt === PROJECT_SAVE_RETRY_DELAYS_MS.length) break;
      await new Promise((resolve) =>
        setTimeout(resolve, PROJECT_SAVE_RETRY_DELAYS_MS[attempt]),
      );
    }
  }
  throw lastError;
}
async function syncDirectory(directory) {
  var handle = null;
  try {
    handle = await (0, node_fs_promises.open)(directory, "r");
    await handle.sync();
  } catch {
  } finally {
    if (handle !== null) {
      try {
        await handle.close();
      } catch {
      }
    }
  }
}
async function writeProjectFile(path, project) {
  var text = serializeProject(project);
  var directory = node_path.dirname(path);
  var temporary = node_path.join(
    directory,
    "." +
      node_path.basename(path) +
      ".tmp-" +
      process.pid +
      "-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 8),
  );
  try {
    await (0, node_fs_promises.writeFile)(temporary, text, "utf8");
    var handle = await (0, node_fs_promises.open)(temporary, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    var backup = path + ".bak";
    var hasPrevious = await (0, node_fs_promises.stat)(path).then(
      function () {
        return true;
      },
      function () {
        return false;
      },
    );
    if (hasPrevious) await (0, node_fs_promises.copyFile)(path, backup);
    await renameWithRetry(temporary, path);
    await syncDirectory(directory);
  } catch (error) {
    await (0, node_fs_promises.unlink)(temporary).catch(function () {});
    throw new ProjectFileError(projectSaveErrorMessage(error, path));
  }
}`;

const mainState = `var rendererDirty = false;
var rendererProjectName = "";
var closeApproved = false;
var pendingCloseRequest = null;`;

const mainHelpers = `var closeDecisionSchema = zod.z.strictObject({
  decision: zod.z.enum(["close", "cancel"]),
});
var rendererStateSchema = zod.z.strictObject({
  dirty: zod.z.boolean(),
  name: zod.z.string().max(200).optional(),
});
function noteRendererState(dirty, name) {
  rendererDirty = dirty === true;
  if (typeof name === "string") rendererProjectName = name;
  if (rendererDirty) closeApproved = false;
}
async function showDiscardConfirmation(event) {
  var options = {
    type: "warning",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    title: "Unsaved changes",
    message: "Save the changes before continuing?",
    detail:
      rendererProjectName === ""
        ? "This project has unsaved changes."
        : rendererProjectName + " has unsaved changes.",
    noLink: true,
  };
  var window = ownerWindow(event);
  var result =
    window === null
      ? await electron.dialog.showMessageBox(options)
      : await electron.dialog.showMessageBox(window, options);
  if (result.response === 0) return "save";
  if (result.response === 1) return "discard";
  return "cancel";
}
function requestCloseDecision(window, kind) {
  if (pendingCloseRequest !== null) return;
  var request = { kind: kind, window: window, timer: null };
  pendingCloseRequest = request;
  request.timer = setTimeout(function () {
    if (pendingCloseRequest === request) pendingCloseRequest = null;
  }, 30000);
  window.webContents.send(IpcChannels.closeRequest, kind);
}`;

const mainHandlers = `  electron.ipcMain.handle(IpcChannels.dirtyState, (_event, payload) => {
    var request = rendererStateSchema.parse(payload);
    noteRendererState(request.dirty, request.name);
    return { accepted: true };
  });
  electron.ipcMain.handle(IpcChannels.confirmDiscard, async (event, payload) => {
    var request = rendererStateSchema.parse(payload);
    noteRendererState(request.dirty, request.name);
    if (!request.dirty) return "discard";
    return await showDiscardConfirmation(event);
  });
  electron.ipcMain.handle(IpcChannels.closeDecision, (_event, payload) => {
    var request = closeDecisionSchema.parse(payload);
    var pending = pendingCloseRequest;
    if (pending === null) return { accepted: false };
    pendingCloseRequest = null;
    clearTimeout(pending.timer);
    if (request.decision !== "close") return { accepted: false };
    closeApproved = true;
    setImmediate(function () {
      if (pending.kind === "quit") electron.app.quit();
      else if (!pending.window.isDestroyed()) pending.window.close();
    });
    return { accepted: true };
  });`;

const mainCloseListener = `  window.on("close", (event) => {
    if (closeApproved) return;
    event.preventDefault();
    requestCloseDecision(window, "window");
  });`;

const mainBeforeQuit = `  electron.app.on("before-quit", (event) => {
    if (closeApproved) return;
    event.preventDefault();
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      requestCloseDecision(mainWindow, "quit");
    }
  });`;

function patchMain(source) {
  const applied = [];
  let out = source;
  out = apply(out, "main:channels", /(\n  openSample: "file:open-sample",\n)(\};)/g, (match, head, tail) => `${head}${channelLines}\n${tail}`);
  applied.push("main:channels");
  out = apply(
    out,
    "main:writeProjectFile",
    /async function writeProjectFile\(path, project\) \{[\s\S]*?\n\}/g,
    () => mainWriteProjectFile,
  );
  applied.push("main:writeProjectFile");
  out = apply(out, "main:state", /var mainWindow = null;/g, (match) => `${match}\n${mainState}`);
  applied.push("main:state");
  out = apply(
    out,
    "main:helpers",
    /\nfunction registerIpcHandlers\(\) \{/g,
    (match) => `\n${mainHelpers}\n${match}`,
  );
  applied.push("main:helpers");
  out = apply(
    out,
    "main:handlers",
    /(  electron\.ipcMain\.handle\(IpcChannels\.ping,[\s\S]*?\n  \}\);\n)/g,
    (match) => `${match}${mainHandlers}\n`,
  );
  applied.push("main:handlers");
  out = apply(
    out,
    "main:close-listener",
    /(  window\.on\("closed", \(\) => \{)/g,
    (match) => `${mainCloseListener}\n${match}`,
  );
  applied.push("main:close-listener");
  out = apply(
    out,
    "main:before-quit",
    /(  electron\.app\.on\("second-instance", \(_event, argv\) => \{)/g,
    (match) => `${mainBeforeQuit}\n${match}`,
  );
  applied.push("main:before-quit");
  return { source: out, applied };
}

const preloadMethods = `  confirmDiscard(state) {
    return electron.ipcRenderer.invoke(IpcChannels.confirmDiscard, state);
  },
  setDirtyState(state) {
    return electron.ipcRenderer.invoke(IpcChannels.dirtyState, state);
  },
  onCloseRequest(listener) {
    const handler = (_event, kind) => listener(kind);
    electron.ipcRenderer.on(IpcChannels.closeRequest, handler);
    return () =>
      electron.ipcRenderer.removeListener(IpcChannels.closeRequest, handler);
  },
  respondClose(decision) {
    return electron.ipcRenderer.invoke(IpcChannels.closeDecision, { decision });
  },`;

function patchPreload(source) {
  const applied = [];
  let out = source;
  out = apply(out, "preload:channels", /(\n  openSample: "file:open-sample",\n)(\};)/g, (match, head, tail) => `${head}${channelLines}\n${tail}`);
  applied.push("preload:channels");
  out = apply(
    out,
    "preload:methods",
    /(  openSample\(request\) \{\n    return electron\.ipcRenderer\.invoke\(IpcChannels\.openSample, request\);\n  \},\n)(\}\);)/g,
    (match, head, tail) => `${head}${preloadMethods}\n${tail}`,
  );
  applied.push("preload:methods");
  return { source: out, applied };
}

function rendererHelper(indent) {
  return `${indent}async function confirmDiscard() {
${indent}  if (!get().dirty) return true;
${indent}  try {
${indent}    const decision = await window.api.confirmDiscard({
${indent}      dirty: true,
${indent}      name: get().name,
${indent}    });
${indent}    if (decision === "cancel") return false;
${indent}    if (decision === "save") return (await get().save()) === true;
${indent}    return true;
${indent}  } catch (error) {
${indent}    fail("Could not confirm unsaved changes", error);
${indent}    return false;
${indent}  }
${indent}}`;
}

const rendererCloseHandler = `    const stopClose = window.api.onCloseRequest(async () => {
      const state = useProjectStore.getState();
      const decision = await window.api.confirmDiscard({
        dirty: state.dirty,
        name: state.name,
      });
      if (decision === "save") {
        const saved = await useProjectStore.getState().save();
        if (saved !== true) {
          await window.api.respondClose("cancel");
          return;
        }
      }
      await window.api.respondClose(decision === "cancel" ? "cancel" : "close");
    });`;

function patchRenderer(source) {
  const applied = [];
  let out = source;

  out = apply(
    out,
    "renderer:helper",
    /(\n([ \t]*)function warn\(title, message\) \{[\s\S]*?\n[ \t]*\})/g,
    (match, block, indent) => `${block}\n${rendererHelper(indent)}`,
  );
  applied.push("renderer:helper");

  out = apply(
    out,
    "renderer:open",
    /(async open\(\) \{\n([ \t]*)if \(get\(\)\.busy\) return;)/g,
    (match, head, indent) => `${head}\n${indent}if (!(await confirmDiscard())) return;`,
  );
  applied.push("renderer:open");

  out = apply(
    out,
    "renderer:openSample",
    /(async openSample\(name\) \{\n([ \t]*)if \(get\(\)\.busy\) return;)/g,
    (match, head, indent) => `${head}\n${indent}if (!(await confirmDiscard())) return;`,
  );
  applied.push("renderer:openSample");

  out = apply(
    out,
    "renderer:loadStarter",
    /(loadStarter\(starter\) \{\n([ \t]*)if \(get\(\)\.busy\) return;)/g,
    (match, head, indent) =>
      `async ${head}\n${indent}if (!(await confirmDiscard())) return;`,
  );
  applied.push("renderer:loadStarter");

  out = apply(
    out,
    "renderer:newProject",
    /(newProject\(\) \{)(\n([ \t]*)resetAll\(\);)/g,
    (match, signature, rest, indent) =>
      `async ${signature}\n${indent}if (!(await confirmDiscard())) return;${rest}`,
  );
  applied.push("renderer:newProject");

  out = apply(
    out,
    "renderer:receiveOpened",
    /(receiveOpened\(opened\) \{)(\n([ \t]*)try \{)/g,
    (match, signature, rest, indent) =>
      `async ${signature}\n${indent}if (!(await confirmDiscard())) return;${rest}`,
  );
  applied.push("renderer:receiveOpened");

  out = applyRegion(out, "renderer:save", "    async save() {", "    async exportSketch() {", [
    {
      id: "busy",
      pattern: /if \(get\(\)\.busy\) return;/g,
      replacement: () => "if (get().busy) return false;",
      expected: 2,
    },
    {
      id: "cancelled",
      pattern: /if \(saved === null\) return;/g,
      replacement: () => "if (saved === null) return false;",
      expected: 2,
    },
    {
      id: "success",
      pattern: /((?:^|\n)([ \t]*)notify\(\s*"success",\s*"Project saved",\s*`Saved as \$\{fileBaseName\(saved\.path\)\}`,?\s*\);)/g,
      replacement: (match, block, indent) => `${block}\n${indent}return true;`,
      expected: 2,
    },
    {
      id: "failure",
      pattern: /((?:^|\n)([ \t]*)fail\("Could not save project", error\);)/g,
      replacement: (match, block, indent) => `${block}\n${indent}return false;`,
      expected: 2,
    },
  ]);
  applied.push("renderer:save");

  out = apply(
    out,
    "renderer:dirty-state",
    /((?:^|\n)([ \t]*)updateWindowTitle\(projectName, projectDirty\);)/g,
    (match, block, indent) =>
      `${block}\n${indent}window.api.setDirtyState({ dirty: projectDirty, name: projectName });`,
  );
  applied.push("renderer:dirty-state");

  out = apply(
    out,
    "renderer:close-handler",
    /(    openLaunch\(\);\n)/g,
    (match) => `${match}${rendererCloseHandler}\n`,
  );
  applied.push("renderer:close-handler");

  out = apply(
    out,
    "renderer:close-cleanup",
    /(      stopOpened\(\);\n      stopError\(\);\n)/g,
    (match) => `${match}      stopClose();\n`,
  );
  applied.push("renderer:close-cleanup");

  return { source: out, applied };
}

function checkSyntax(label, source) {
  const isModule = /(^|\n)\s*(import|export)\s/.test(source) || source.includes("import.meta");
  if (!isModule) {
    try {
      new vm.Script(source, { filename: label });
    } catch (error) {
      throw new Error(`[syntax] ${label}: ${error.message}`);
    }
    return;
  }
  const os = require("node:os");
  const child = require("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vcircuitcad-syntax-"));
  const file = path.join(dir, "check.mjs");
  fs.writeFileSync(file, source);
  try {
    child.execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    const detail = String(error.stderr || error.message)
      .split("\n")
      .slice(0, 4)
      .join(" | ");
    throw new Error(`[syntax] ${label}: ${detail}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function pristineIntegrity() {
  if (!fs.existsSync(pristineAsar)) return { checked: false };
  const digest = sha256(fs.readFileSync(pristineAsar));
  let expected = null;
  if (fs.existsSync(pristineSha)) {
    const match = read(pristineSha).match(/[0-9a-f]{64}/i);
    if (match) expected = match[0].toLowerCase();
  }
  return { checked: true, sha256: digest, expected, matches: expected === null ? null : expected === digest };
}

function run() {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    const manifestPath = path.join(outDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      console.log("no manifest: out/patched/manifest.json does not exist");
      return;
    }
    console.log(read(manifestPath));
    return;
  }

  if (args.includes("--rollback")) {
    const integrity = pristineIntegrity();
    const entries = [
      ["app/out/main/index.js", sources.main],
      ["app/out/preload/index.js", sources.preload],
      ["app/out/renderer/assets/index-BU2QbNS1.js", sources.rendererApp],
      ["readable/out/renderer/assets/index-BU2QbNS1.js", sources.rendererReadable],
    ];
    for (const [relative, source] of entries) {
      writeOut(relative, read(source));
    }
    const manifest = {
      rolled_back: true,
      pristine: integrity,
      restored: entries.map(([relative, source]) => ({
        file: relative,
        from: path.relative(root, source),
        sha256: sha256(fs.readFileSync(source)),
      })),
    };
    fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`rollback: restored ${entries.length} files from the pristine extraction`);
    console.log(`pristine asar sha256 ${integrity.sha256 ?? "unknown"} matches=${integrity.matches}`);
    return;
  }

  const manifest = {
    marker,
    pristine: pristineIntegrity(),
    files: [],
  };

  const jobs = [
    {
      id: "main",
      source: sources.main,
      target: "app/out/main/index.js",
      patch: patchMain,
    },
    {
      id: "preload",
      source: sources.preload,
      target: "app/out/preload/index.js",
      patch: patchPreload,
    },
    {
      id: "rendererApp",
      source: sources.rendererApp,
      target: "app/out/renderer/assets/index-BU2QbNS1.js",
      patch: patchRenderer,
    },
    {
      id: "rendererReadable",
      source: sources.rendererReadable,
      target: "readable/out/renderer/assets/index-BU2QbNS1.js",
      patch: patchRenderer,
    },
  ];

  for (const job of jobs) {
    const original = read(job.source);
    let patched = original;
    let applied = [];
    let state = "patched";
    if (original.includes(marker)) {
      state = "already-patched";
    } else {
      const result = job.patch(original);
      patched = result.source;
      applied = result.applied;
    }
    writeOut(job.target, patched);
    checkSyntax(job.target, patched);
    manifest.files.push({
      id: job.id,
      source: path.relative(root, job.source),
      target: path.relative(root, path.join(outDir, job.target)),
      state,
      applied,
      sha256_before: sha256(original),
      sha256_after: sha256(patched),
    });
    console.log(`${job.id}: ${state} (${applied.length} patches) -> ${job.target}`);
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest: ${path.relative(root, path.join(outDir, "manifest.json"))}`);
}

run();
