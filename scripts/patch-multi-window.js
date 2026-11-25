"use strict";

/**
 * Opens files that arrive from the operating system in their own window.
 *
 * Opening a project from the file manager used to replace the project in the
 * running window, which lost whatever was open. Now the file gets a window of
 * its own and the current project stays where it is.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value: --${name}`);
  return value;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

const sourcePath = resolveInput(arg("source", "out/patched/multi-window/out/main/index.js"));
const outputPath = resolveInput(arg("output", "out/patched/multi-window/out/main/index.js"));

const MARKER = "const MULTI_WINDOW_PATCH_V1 = true;";

const ANCHOR_MARKER = `var partPropsSchemas = {`;

const ANCHOR_QUEUE = `/** A file path handed to the app before the renderer was ready to receive it. */
var pendingLaunchPath = null;
function queueLaunchPath(path) {
  pendingLaunchPath = path;
}`;

const REPLACEMENT_QUEUE = `/** File paths handed to the app before a renderer was ready to receive them. */
var pendingLaunchPaths = [];
/** Launch paths for windows that are still starting up. */
var windowLaunchPaths = new WeakMap();
function queueLaunchPath(path) {
  pendingLaunchPaths.push(path);
}
function queueWindowLaunchPath(window, path) {
  windowLaunchPaths.set(window.webContents, path);
}`;

const ANCHOR_TAKE = `  electron.ipcMain.handle(IpcChannels.takeLaunchFile, async () => {
    if (pendingLaunchPath === null) return null;
    const path = pendingLaunchPath;
    pendingLaunchPath = null;
    const opened = await openFile(path);
    approvedPaths.add(path);
    return opened;
  });`;

const REPLACEMENT_TAKE = `  electron.ipcMain.handle(IpcChannels.takeLaunchFile, async (event) => {
    const windowPath = windowLaunchPaths.get(event.sender) ?? null;
    if (windowPath !== null) {
      windowLaunchPaths.delete(event.sender);
      const opened = await openFile(windowPath);
      approvedPaths.add(windowPath);
      return opened;
    }
    if (pendingLaunchPaths.length === 0) return null;
    const path = pendingLaunchPaths.shift();
    const opened = await openFile(path);
    approvedPaths.add(path);
    return opened;
  });`;

const ANCHOR_CREATE = `function createWindow() {
  const window = new electron.BrowserWindow({`;

const REPLACEMENT_CREATE = `function createWindow(launchPath = null) {
  const window = new electron.BrowserWindow({`;

const ANCHOR_READY = `  window.once("ready-to-show", () => {
    window.show();
  });`;

const REPLACEMENT_READY = `  if (launchPath !== null) queueWindowLaunchPath(window, launchPath);
  window.once("ready-to-show", () => {
    window.show();
  });`;

const ANCHOR_CLOSED = `  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });`;

const REPLACEMENT_CLOSED = `  window.on("closed", () => {
    if (mainWindow !== window) return;
    const remaining = electron.BrowserWindow.getAllWindows();
    mainWindow = remaining.length > 0 ? remaining[remaining.length - 1] : null;
  });`;

const ANCHOR_ACCEPT = `/** Routes a file opened by the OS to the renderer, or queues it until startup. */
function acceptOpenedFile(path) {
  const window = mainWindow;
  if (window === null || window.webContents.isLoadingMainFrame()) {
    queueLaunchPath(path);
    if (window !== null) focusWindow(window);
    return;
  }
  focusWindow(window);
  deliverOpenFile(window, path);
}`;

const REPLACEMENT_ACCEPT = `/**
 * Routes a file opened by the OS to a window. A file that arrives while the
 * app is running opens in a window of its own so the project that is already
 * open stays untouched.
 */
function acceptOpenedFile(path) {
  const window = mainWindow;
  if (window === null) {
    queueLaunchPath(path);
    return;
  }
  if (window.webContents.isLoadingMainFrame()) {
    queueLaunchPath(path);
    focusWindow(window);
    return;
  }
  const opened = createWindow(path);
  mainWindow = opened;
  focusWindow(opened);
}`;

const EDITS = [
  ["launch queue", ANCHOR_QUEUE, REPLACEMENT_QUEUE],
  ["take launch file", ANCHOR_TAKE, REPLACEMENT_TAKE],
  ["create window", ANCHOR_CREATE, REPLACEMENT_CREATE],
  ["window ready", ANCHOR_READY, REPLACEMENT_READY],
  ["window closed", ANCHOR_CLOSED, REPLACEMENT_CLOSED],
  ["accept opened file", ANCHOR_ACCEPT, REPLACEMENT_ACCEPT],
];

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("multi window marker count mismatch");
  const mode = markerCount === 1 ? "upgrade" : "fresh";

  let patched = source;

  if (mode === "fresh") {
    if (count(patched, ANCHOR_MARKER) !== 1) throw new Error("anchor mismatch: marker");
    patched = patched.replace(ANCHOR_MARKER, `${MARKER}\n${ANCHOR_MARKER}`);
    for (const [name, anchor, replacement] of EDITS) {
      if (count(patched, anchor) !== 1) throw new Error(`anchor mismatch: ${name}`);
      patched = patched.replace(anchor, replacement);
    }
  } else {
    for (const [name, , replacement] of EDITS) {
      if (count(patched, replacement) !== 1) throw new Error(`replacement mismatch: ${name}`);
    }
  }

  if (count(patched, MARKER) !== 1) throw new Error("patched marker count mismatch");
  if (count(patched, "pendingLaunchPath = ") !== 0) {
    throw new Error("the single launch path slot is still in place");
  }
  if (count(patched, "queueWindowLaunchPath(window, launchPath)") !== 1) {
    throw new Error("window launch path count mismatch");
  }
  if (count(patched, "const opened = createWindow(path);") !== 1) {
    throw new Error("opened files do not create a window");
  }
  if (count(patched, "createWindow(launchPath = null)") !== 1) {
    throw new Error("create window signature count mismatch");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, patched);

  const sourceBuffer = fs.readFileSync(sourcePath);
  const patchedBuffer = fs.readFileSync(outputPath);
  console.log(`source=${path.relative(root, sourcePath).split(path.sep).join("/")}`);
  console.log(`output=${path.relative(root, outputPath).split(path.sep).join("/")}`);
  console.log(`mode=${mode}`);
  console.log(`source_bytes=${sourceBuffer.length}`);
  console.log(`output_bytes=${patchedBuffer.length}`);
  console.log(`source_sha256=${sha256(sourceBuffer)}`);
  console.log(`output_sha256=${sha256(patchedBuffer)}`);
  console.log(`marker_count=1`);
  console.log("PATCH: PASS");
}

main();
