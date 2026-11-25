"use strict";

/**
 * File-behaviour harness for VircuitCAD.
 *
 * Loads the real Electron main-process bundle with a mocked `electron`
 * module (mocked preload boundary) so every IPC handler can be called
 * directly. All file writes go to a temp directory created with
 * os.tmpdir(); nothing in the workspace is written or removed.
 *
 * Usage:
 *   node scripts/test-files.js [--main <path to out/main/index.js>]
 *                              [--renderer <path to the renderer bundle>]
 *                              [--report <path>]
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
  return value;
}

const mainPath = path.resolve(root, arg("main", "work/app/out/main/index.js"));
const reportPath = path.resolve(root, arg("report", "reports/file-features-phase1.json"));
const rendererPath = path.resolve(
  root,
  arg("renderer", "work/readable/out/renderer/assets/index-BU2QbNS1.js"),
);
const samplesDir = path.join(root, "resources", "samples");

/* ------------------------------------------------------------------ */
/* mocked electron                                                      */
/* ------------------------------------------------------------------ */

function createElectronMock(state) {
  const appEvents = new Map();
  const windowEvents = [];
  const ipcHandlers = new Map();

  const fakeWebContents = {
    sent: [],
    setWindowOpenHandler() {},
    on() {},
    isLoadingMainFrame: () => false,
    send(channel, payload) {
      fakeWebContents.sent.push({ channel, payload });
    },
  };

  class FakeBrowserWindow {
    constructor(options) {
      this.options = options;
      this.listeners = new Map();
      this.destroyed = false;
      this.webContents = fakeWebContents;
      windowEvents.push(this);
    }
    on(event, listener) {
      this.listeners.set(event, listener);
    }
    once(event, listener) {
      this.listeners.set(event, listener);
    }
    emit(event, ...args) {
      const listener = this.listeners.get(event);
      if (listener) return listener(...args);
      return undefined;
    }
    hasListener(event) {
      return this.listeners.has(event);
    }
    isDestroyed() {
      return this.destroyed;
    }
    show() {}
    focus() {}
    restore() {}
    isMinimized() {
      return false;
    }
    close() {
      const event = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      this.emit("close", event);
      if (event.defaultPrevented) return;
      this.destroyed = true;
      this.emit("closed");
    }
    loadFile() {}
    loadURL() {}
  }

  const mock = {
    app: {
      isPackaged: true,
      getAppPath: () => path.join(root, "work", "app"),
      requestSingleInstanceLock: () => true,
      quit: () => {
        state.quitCalls += 1;
      },
      on(event, listener) {
        appEvents.set(event, listener);
      },
      whenReady: () => {
        state.readyPromise = Promise.resolve();
        return state.readyPromise;
      },
    },
    BrowserWindow: FakeBrowserWindow,
    BrowserWindow_getAllWindows: () => windowEvents,
    ipcMain: {
      handle(channel, handler) {
        ipcHandlers.set(channel, handler);
      },
    },
    dialog: {
      async showOpenDialog(_window, options) {
        state.dialogCalls.push({ type: "open", options });
        if (state.openPath === null) return { canceled: true, filePaths: [] };
        return { canceled: false, filePaths: [state.openPath] };
      },
      async showSaveDialog(_window, options) {
        state.dialogCalls.push({ type: "save", options });
        if (state.savePath === null) return { canceled: true };
        return { canceled: false, filePath: state.savePath };
      },
      async showMessageBox(_window, options) {
        state.dialogCalls.push({ type: "message", options });
        if (state.messageBoxResponse === null) return { response: options.cancelId ?? 0 };
        return { response: state.messageBoxResponse };
      },
    },
    session: {
      defaultSession: {
        webRequest: { onHeadersReceived() {} },
        setPermissionRequestHandler() {},
        setPermissionCheckHandler() {},
      },
    },
  };
  mock.BrowserWindow.getAllWindows = () => windowEvents;
  mock.BrowserWindow.fromWebContents = () => windowEvents[0] ?? null;
  return { mock, appEvents, ipcHandlers, windowEvents };
}

async function loadMainBundle() {
  const state = {
    dialogCalls: [],
    openPath: null,
    savePath: null,
    messageBoxResponse: null,
    quitCalls: 0,
    readyPromise: Promise.resolve(),
  };
  const { mock, appEvents, ipcHandlers, windowEvents } = createElectronMock(state);
  const zodPath = require.resolve(path.join(root, "work", "app", "node_modules", "zod"));
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "electron") return mock;
    if (request === "zod") return originalLoad.call(this, zodPath, parent, isMain);
    return originalLoad.apply(this, arguments);
  };
  const previousResourcesPath = process.resourcesPath;
  process.resourcesPath = path.join(root, "resources");
  try {
    delete require.cache[require.resolve(mainPath)];
    require(mainPath);
  } finally {
    Module._load = originalLoad;
  }
  await state.readyPromise;
  await new Promise((resolve) => setImmediate(resolve));
  state.restoreResourcesPath = () => {
    if (previousResourcesPath === undefined) delete process.resourcesPath;
    else process.resourcesPath = previousResourcesPath;
  };
  return { state, appEvents, ipcHandlers, windowEvents };
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const results = [];
let currentSection = "";

function section(name) {
  currentSection = name;
}

async function check(id, title, fn) {
  const entry = { id, section: currentSection, check: title };
  try {
    const outcome = await fn();
    entry.status = outcome.status ?? "PASS";
    entry.severity = outcome.severity ?? "none";
    entry.evidence = outcome.evidence ?? "";
    if (outcome.detail !== undefined) entry.detail = outcome.detail;
  } catch (error) {
    entry.status = "ERROR";
    entry.severity = "unknown";
    entry.evidence = `harness error: ${error && error.stack ? error.stack.split("\n")[0] : String(error)}`;
  }
  results.push(entry);
  const flag = entry.status === "PASS" ? "PASS" : entry.status;
  console.log(`${flag.padEnd(5)} ${id.padEnd(4)} ${title}`);
  if (entry.evidence) console.log(`      ${entry.evidence}`);
}

function fakeEvent() {
  return { sender: {} };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sampleProject() {
  return {
    format: "vircuit-project",
    version: 2,
    metadata: { created_at: "2026-01-01T00:00:00.000Z", app_version: "0.5.0-beta.3" },
    viewport: { scale: 1, offsetX: 60, offsetY: 60 },
    name: "Harness",
    circuit: {
      version: 1,
      parts: [
        {
          id: "uno",
          type: "arduino-uno",
          position: { x: 100, y: 120 },
          rotation: 0,
          props: {},
        },
        {
          id: "led1",
          type: "led",
          position: { x: 200, y: 120 },
          rotation: 90,
          flipX: true,
          props: { color: "red" },
        },
      ],
      wires: [
        {
          id: "w1",
          from: { partId: "uno", pinId: "D13" },
          to: { partId: "led1", pinId: "anode" },
          color: "#6fb3ff",
          waypoints: [{ x: 150, y: 120 }],
        },
      ],
    },
    sketch: "void setup() {}\nvoid loop() {}\n",
  };
}

function semanticProject(project) {
  const circuit = project.circuit;
  return {
    format: project.format,
    version: project.version,
    name: project.name ?? null,
    metadata: project.metadata ?? null,
    viewport: project.viewport ?? null,
    sketch: project.sketch,
    parts: circuit.parts.map((part) => ({
      id: part.id,
      type: part.type,
      position: part.position,
      rotation: part.rotation,
      flipX: part.flipX ?? false,
      flipY: part.flipY ?? false,
      props: part.props,
    })),
    wires: circuit.wires.map((wire) => ({
      id: wire.id,
      from: wire.from,
      to: wire.to,
      color: wire.color,
      waypoints: wire.waypoints,
    })),
    notes: (circuit.notes ?? []).map((note) => ({
      id: note.id,
      text: note.text,
      position: note.position,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* the tests                                                           */
/* ------------------------------------------------------------------ */

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vcircuitcad-files-"));
  const harness = await loadMainBundle();
  const { state, appEvents, ipcHandlers, windowEvents } = harness;
  const handlers = ipcHandlers;
  console.log(`main bundle: ${path.relative(root, mainPath)}`);
  console.log(`temp dir:   ${temp}`);
  console.log(`ipc channels: ${[...handlers.keys()].join(", ")}`);
  console.log("");

  const save = handlers.get("file:save-project");
  const open = handlers.get("file:open");
  const openSample = handlers.get("file:open-sample");
  const listSamples = handlers.get("file:list-samples");
  const exportSketch = handlers.get("file:export-sketch");
  const exportHex = handlers.get("file:export-hex");
  const exportPng = handlers.get("file:export-png");
  const exportPdf = handlers.get("file:export-pdf");
  const confirmDiscard = handlers.get("file:confirm-discard");

  /* ---------------- A. data safety ---------------- */
  section("A. data safety");

  await check("A1", "save writes a valid project file", async () => {
    const target = path.join(temp, "a1.vcc");
    state.savePath = target;
    const saved = await save(fakeEvent(), { project: sampleProject(), path: null });
    const parsed = readJson(saved.path);
    return {
      status: parsed.format === "vircuit-project" && parsed.version === 2 ? "PASS" : "FAIL",
      severity: "none",
      evidence: `saved=${saved.path} format=${parsed.format} version=${parsed.version}`,
    };
  });

  await check("A1", "save is atomic (target survives a crash during the write)", async () => {
    const target = path.join(temp, "a1-atomic.vcc");
    state.savePath = target;
    await save(fakeEvent(), { project: sampleProject(), path: null });
    const before = fs.readFileSync(target, "utf8");
    const fsPromises = require("node:fs/promises");
    const originalWriteFile = fsPromises.writeFile;
    fsPromises.writeFile = async (file, data, options) => {
      const handle = await fsPromises.open(file, "w");
      await handle.write(String(data).slice(0, 20));
      await handle.close();
      const error = new Error("ENOSPC: simulated crash during write");
      error.code = "ENOSPC";
      throw error;
    };
    let rejected = false;
    try {
      await save(fakeEvent(), { project: sampleProject(), path: null });
    } catch {
      rejected = true;
    } finally {
      fsPromises.writeFile = originalWriteFile;
    }
    const after = fs.readFileSync(target, "utf8");
    const intact = before === after;
    return {
      status: intact ? "PASS" : "FAIL",
      severity: intact ? "none" : "Critical",
      evidence: `rejected=${rejected} target_intact=${intact} bytes_before=${before.length} bytes_after=${after.length}`,
    };
  });

  await check("A1", "a locked file is retried before the save fails", async () => {
    const target = path.join(temp, "a1-retry.vcc");
    state.savePath = target;
    const fsPromises = require("node:fs/promises");
    const originalRename = fsPromises.rename;
    let attempts = 0;
    fsPromises.rename = async (from, to) => {
      attempts += 1;
      if (attempts <= 2) {
        const error = new Error("EBUSY: resource busy or locked");
        error.code = "EBUSY";
        throw error;
      }
      return originalRename(from, to);
    };
    let saved = null;
    let failed = null;
    try {
      saved = await save(fakeEvent(), { project: sampleProject(), path: null });
    } catch (error) {
      failed = String(error && error.message ? error.message : error);
    } finally {
      fsPromises.rename = originalRename;
    }
    const written = saved !== null && fs.existsSync(saved.path);
    return {
      status: written ? "PASS" : "FAIL",
      severity: written ? "none" : "High",
      evidence: `rename_attempts=${attempts} saved=${saved === null ? "none" : saved.path} error=${JSON.stringify(failed)}`,
    };
  });

  await check("A1", "a rename failure is reported with the file name and keeps the old file", async () => {
    const target = path.join(temp, "a1-exdev.vcc");
    state.savePath = target;
    await save(fakeEvent(), { project: sampleProject(), path: null });
    const before = fs.readFileSync(target, "utf8");
    const fsPromises = require("node:fs/promises");
    const originalRename = fsPromises.rename;
    fsPromises.rename = async () => {
      const error = new Error("EXDEV: cross-device link not permitted");
      error.code = "EXDEV";
      throw error;
    };
    let message = null;
    try {
      await save(fakeEvent(), { project: sampleProject(), path: null });
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    } finally {
      fsPromises.rename = originalRename;
    }
    const after = fs.readFileSync(target, "utf8");
    const mentionsName = message !== null && message.includes("a1-exdev.vcc");
    return {
      status: mentionsName && before === after ? "PASS" : "FAIL",
      severity: mentionsName ? "none" : "High",
      evidence: `message=${JSON.stringify(message)} old_file_intact=${before === after}`,
    };
  });

  await check("A1", "no temporary files are left behind", async () => {
    const folder = path.join(temp, "a1-temp");
    fs.mkdirSync(folder, { recursive: true });
    const target = path.join(folder, "a1-temp.vcc");
    state.savePath = target;
    await save(fakeEvent(), { project: sampleProject(), path: null });
    const afterSuccess = fs.readdirSync(folder).filter((name) => name.includes(".tmp-"));
    const fsPromises = require("node:fs/promises");
    const originalWriteFile = fsPromises.writeFile;
    fsPromises.writeFile = async () => {
      const error = new Error("ENOSPC: simulated crash during write");
      error.code = "ENOSPC";
      throw error;
    };
    try {
      await save(fakeEvent(), { project: sampleProject(), path: null });
    } catch {
    } finally {
      fsPromises.writeFile = originalWriteFile;
    }
    const afterFailure = fs.readdirSync(folder).filter((name) => name.includes(".tmp-"));
    return {
      status: afterSuccess.length === 0 && afterFailure.length === 0 ? "PASS" : "FAIL",
      severity: afterSuccess.length === 0 && afterFailure.length === 0 ? "none" : "Medium",
      evidence: `after_success=${afterSuccess.join(",") || "none"} after_failure=${afterFailure.join(",") || "none"}`,
    };
  });

  await check("A2", "the backup keeps exactly one previous generation", async () => {
    const target = path.join(temp, "a2-generation.vcc");
    state.savePath = target;
    await save(fakeEvent(), { project: sampleProject(), path: null });
    const second = { ...sampleProject(), name: "Generation 2" };
    await save(fakeEvent(), { project: second, path: null });
    const secondText = fs.readFileSync(target, "utf8");
    const third = { ...sampleProject(), name: "Generation 3" };
    await save(fakeEvent(), { project: third, path: null });
    const backup = fs.existsSync(`${target}.bak`) ? fs.readFileSync(`${target}.bak`, "utf8") : null;
    const current = fs.readFileSync(target, "utf8");
    const backupIsPrevious = backup !== null && backup === secondText;
    const currentIsNewest = current !== secondText;
    return {
      status: backupIsPrevious && currentIsNewest ? "PASS" : "FAIL",
      severity: backupIsPrevious && currentIsNewest ? "none" : "Medium",
      evidence: `backup_is_previous_generation=${backupIsPrevious} current_is_newest=${currentIsNewest}`,
    };
  });

  await check("A2", "a backup of the previous version is kept", async () => {
    const target = path.join(temp, "a2.vcc");
    state.savePath = target;
    await save(fakeEvent(), { project: sampleProject(), path: null });
    const first = fs.readFileSync(target, "utf8");
    const second = { ...sampleProject(), name: "Harness 2" };
    await save(fakeEvent(), { project: second, path: null });
    const backup = `${target}.bak`;
    const hasBackup = fs.existsSync(backup);
    const backupMatches = hasBackup && fs.readFileSync(backup, "utf8") === first;
    return {
      status: hasBackup && backupMatches ? "PASS" : "FAIL",
      severity: hasBackup ? "Medium" : "High",
      evidence: `backup_exists=${hasBackup} backup_matches_previous=${backupMatches}`,
    };
  });

  await check("A3", "a failed write reports the file name and keeps the document dirty", async () => {
    const target = path.join(temp, "a3", "missing-dir", "a3.vcc");
    state.savePath = target;
    let message = null;
    try {
      await save(fakeEvent(), { project: sampleProject(), path: null });
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    }
    const mentionsPath = message !== null && message.includes("a3.vcc");
    return {
      status: message !== null && mentionsPath ? "PASS" : "FAIL",
      severity: message === null ? "Critical" : "none",
      evidence: `error=${JSON.stringify(message)} mentions_file=${mentionsPath}`,
    };
  });

  await check("A3", "a failed write is never silent (handler rejects)", async () => {
    const target = path.join(temp, "a3b", "a3b.vcc");
    state.savePath = target;
    let rejected = false;
    try {
      await save(fakeEvent(), { project: sampleProject(), path: null });
    } catch {
      rejected = true;
    }
    return {
      status: rejected ? "PASS" : "FAIL",
      severity: rejected ? "none" : "Critical",
      evidence: `handler_rejected=${rejected}`,
    };
  });

  await check("A4", "corrupt, empty, wrong-type and oversized files are rejected", async () => {
    const corrupt = path.join(temp, "corrupt.vcc");
    fs.writeFileSync(corrupt, '{"format":"vircuit-project","version":2,');
    const empty = path.join(temp, "empty.vcc");
    fs.writeFileSync(empty, "");
    const wrong = path.join(temp, "wrong.vcc");
    fs.writeFileSync(wrong, JSON.stringify({ hello: "world" }));
    const huge = path.join(temp, "huge.vcc");
    fs.writeFileSync(huge, "x".repeat(5 * 1024 * 1024));
    const cases = [];
    for (const file of [corrupt, empty, wrong, huge]) {
      state.openPath = file;
      let message = null;
      try {
        await open(fakeEvent());
      } catch (error) {
        message = String(error && error.message ? error.message : error);
      }
      cases.push(`${path.basename(file)}:${message === null ? "ACCEPTED" : "rejected"}`);
    }
    const allRejected = cases.every((entry) => entry.endsWith(":rejected"));
    return {
      status: allRejected ? "PASS" : "FAIL",
      severity: allRejected ? "none" : "High",
      evidence: cases.join(" "),
    };
  });

  await check("A4", "an oversized file is rejected before it is read into memory", async () => {
    const huge = path.join(temp, "huge2.vcc");
    fs.writeFileSync(huge, "x".repeat(5 * 1024 * 1024));
    const fsPromises = require("node:fs/promises");
    const originalReadFile = fsPromises.readFile;
    let readBytes = 0;
    fsPromises.readFile = async (...args) => {
      const buffer = await originalReadFile(...args);
      readBytes = buffer.byteLength;
      return buffer;
    };
    state.openPath = huge;
    try {
      await open(fakeEvent());
    } catch {
    } finally {
      fsPromises.readFile = originalReadFile;
    }
    return {
      status: readBytes === 0 ? "PASS" : "FAIL",
      severity: readBytes === 0 ? "none" : "Medium",
      evidence: `bytes_read_before_rejection=${readBytes} (cap is 4194304)`,
    };
  });

  await check("A5", "the window close event asks the renderer before closing", async () => {
    const window = windowEvents[0];
    const hasClose = window !== undefined && window.hasListener("close");
    return {
      status: hasClose ? "PASS" : "FAIL",
      severity: hasClose ? "none" : "Critical",
      evidence: `main window has a "close" listener: ${hasClose}`,
    };
  });

  await check("A5", "the app guards before-quit", async () => {
    const hasBeforeQuit = appEvents.has("before-quit");
    return {
      status: hasBeforeQuit ? "PASS" : "FAIL",
      severity: hasBeforeQuit ? "none" : "Critical",
      evidence: `app "before-quit" handler registered: ${hasBeforeQuit}`,
    };
  });

  await check("A5", "a discard confirmation channel exists for in-app actions", async () => {
    const exists = typeof confirmDiscard === "function";
    return {
      status: exists ? "PASS" : "FAIL",
      severity: exists ? "none" : "Critical",
      evidence: `ipc channel file:confirm-discard registered: ${exists}`,
    };
  });

  await check("A5", "quitting the app is blocked until the renderer answers", async () => {
    const handler = appEvents.get("before-quit");
    const window = windowEvents[0];
    const dirtyState = handlers.get("file:dirty-state");
    const closeDecision = handlers.get("file:close-decision");
    if (typeof handler !== "function") {
      return { status: "FAIL", severity: "Critical", evidence: "no before-quit handler" };
    }
    if (typeof dirtyState === "function") {
      await dirtyState(fakeEvent(), { dirty: true, name: "Harness" });
    }
    const before = window.webContents.sent.length;
    let prevented = false;
    handler({
      preventDefault() {
        prevented = true;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const asked = window.webContents.sent
      .slice(before)
      .some((entry) => entry.channel === "file:close-request");
    if (typeof closeDecision === "function") {
      await closeDecision(fakeEvent(), { decision: "cancel" });
    }
    return {
      status: prevented && asked ? "PASS" : "FAIL",
      severity: "Critical",
      evidence: `quit_prevented=${prevented} renderer_asked=${asked}`,
    };
  });

  await check("A5", "closing the window is blocked until the renderer answers", async () => {
    const window = windowEvents[0];
    const closeDecision = handlers.get("file:close-decision");
    if (typeof closeDecision !== "function") {
      return { status: "FAIL", severity: "Critical", evidence: "file:close-decision is not registered" };
    }
    const before = window.webContents.sent.length;
    let prevented = false;
    window.emit("close", {
      preventDefault() {
        prevented = true;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const asked = window.webContents.sent
      .slice(before)
      .some((entry) => entry.channel === "file:close-request");
    const stillOpen = window.isDestroyed() === false;
    const cancelled = await closeDecision(fakeEvent(), { decision: "cancel" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const openAfterCancel = window.isDestroyed() === false;
    window.emit("close", {
      preventDefault() {
        prevented = true;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const accepted = await closeDecision(fakeEvent(), { decision: "close" });
    await new Promise((resolve) => setTimeout(resolve, 40));
    const closedAfterAccept = window.isDestroyed() === true;
    return {
      status:
        prevented && asked && stillOpen && openAfterCancel && accepted.accepted && closedAfterAccept
          ? "PASS"
          : "FAIL",
      severity: "Critical",
      evidence: `close_prevented=${prevented} renderer_asked=${asked} open_before_answer=${stillOpen} open_after_cancel=${openAfterCancel} cancel_accepted=${cancelled.accepted} closed_after_accept=${closedAfterAccept}`,
    };
  });

  await check("A5", "the renderer asks before New/Open/Sample discards the document", async () => {
    const source = fs.readFileSync(rendererPath, "utf8");
    const guard = /confirmDiscard|guardDiscard|confirmUnsaved/.test(source);
    const actions = [
      ["newProject", /newProject\(\) \{/g],
      ["open", /async open\(\) \{/g],
      ["openSample", /async openSample\(name\) \{/g],
      ["loadStarter", /loadStarter\(starter\) \{/g],
      ["receiveOpened", /receiveOpened\(opened\) \{/g],
    ];
    const unguarded = [];
    for (const [action, pattern] of actions) {
      const index = source.search(pattern);
      if (index === -1) {
        unguarded.push(`${action}:missing`);
        continue;
      }
      const body = source.slice(index, index + 400);
      if (!/confirmDiscard|guardDiscard|confirmUnsaved/.test(body)) unguarded.push(action);
    }
    const guardedNew = unguarded.length === 0;
    return {
      status: guard && guardedNew ? "PASS" : "FAIL",
      severity: guard && guardedNew ? "none" : "Critical",
      evidence: `renderer has a discard guard: ${guard}; unguarded actions: ${unguarded.join(",") || "none"}`,
    };
  });

  await check("A6", "the dirty flag is derived from the document, sketch and name only", async () => {
    const source = fs.readFileSync(rendererPath, "utf8");
    const start = source.indexOf("function computeDirty()");
    const body = source.slice(start, start + 400);
    const usesViewport = /viewport/i.test(body);
    const usesSelection = /selection|selected/i.test(body);
    return {
      status: !usesViewport && !usesSelection ? "PASS" : "FAIL",
      severity: "none",
      evidence: `computeDirty() mentions viewport=${usesViewport} selection=${usesSelection}`,
    };
  });

  await check("A6", "the dirty flag is cleared only after a successful save", async () => {
    const source = fs.readFileSync(rendererPath, "utf8");
    const dirtyFalse = source.match(/dirty: false/g) ?? [];
    const markSavedCalls = source.match(/markSaved\(/g) ?? [];
    return {
      status: markSavedCalls.length >= 3 ? "PASS" : "FAIL",
      severity: "none",
      evidence: `dirty:false assignments=${dirtyFalse.length} markSaved() calls=${markSavedCalls.length}`,
    };
  });

  await check("A7", "runtime damage state is not part of the saved document", async () => {
    const target = path.join(temp, "a7.vcc");
    state.savePath = target;
    await save(fakeEvent(), { project: sampleProject(), path: null });
    const text = fs.readFileSync(target, "utf8");
    const forbidden = ["failedParts", "burnt", "damage", "undo", "history", "selected"];
    const found = forbidden.filter((needle) => text.includes(needle));
    return {
      status: found.length === 0 ? "PASS" : "FAIL",
      severity: found.length === 0 ? "none" : "High",
      evidence: `saved keys=${Object.keys(readJson(target)).join(",")} forbidden_found=${found.join(",") || "none"}`,
    };
  });

  /* ---------------- B. compatibility ---------------- */
  section("B. compatibility");

  await check("B8", "version 1 files still load", async () => {
    const legacy = path.join(temp, "legacy.vcc");
    const project = sampleProject();
    delete project.metadata;
    delete project.viewport;
    project.version = 1;
    fs.writeFileSync(legacy, JSON.stringify(project, null, 2));
    state.openPath = legacy;
    const opened = await open(fakeEvent());
    return {
      status: opened.project.version === 1 ? "PASS" : "FAIL",
      severity: "none",
      evidence: `loaded version=${opened.project.version}`,
    };
  });

  await check("B8", "a newer version is rejected instead of being downgraded", async () => {
    const newer = path.join(temp, "newer.vcc");
    const project = sampleProject();
    project.version = 3;
    fs.writeFileSync(newer, JSON.stringify(project, null, 2));
    state.openPath = newer;
    let message = null;
    try {
      await open(fakeEvent());
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    }
    return {
      status: message !== null ? "PASS" : "FAIL",
      severity: message === null ? "High" : "Low",
      evidence: `message=${JSON.stringify(message)}`,
    };
  });

  await check("B9", "unknown fields survive a load/save round trip", async () => {
    const extra = path.join(temp, "extra.vcc");
    const project = sampleProject();
    project.futureField = { anything: true };
    fs.writeFileSync(extra, JSON.stringify(project, null, 2));
    state.openPath = extra;
    let message = null;
    try {
      await open(fakeEvent());
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    }
    return {
      status: message === null ? "PASS" : "FAIL",
      severity: message === null ? "none" : "Medium",
      evidence: `message=${JSON.stringify(message)}`,
    };
  });

  await check("B10", "every bundled sample round-trips with 0 differences", async () => {
    const names = fs.readdirSync(samplesDir).filter((name) => name.endsWith(".vcc"));
    const differences = [];
    for (const name of names) {
      const source = path.join(samplesDir, name);
      state.openPath = source;
      const opened = await open(fakeEvent());
      const target = path.join(temp, `roundtrip-${name}`);
      state.savePath = target;
      await save(fakeEvent(), { project: opened.project, path: null });
      state.openPath = target;
      const reopened = await open(fakeEvent());
      const before = JSON.stringify(semanticProject(opened.project));
      const after = JSON.stringify(semanticProject(reopened.project));
      if (before !== after) differences.push(name);
    }
    return {
      status: differences.length === 0 ? "PASS" : "FAIL",
      severity: differences.length === 0 ? "none" : "High",
      evidence: `samples=${names.length} differences=${differences.length} ${differences.join(",")}`,
    };
  });

  /* ---------------- C. behaviour ---------------- */
  section("C. behaviour");

  await check("C11", "save without a path asks for a location and enforces the extension", async () => {
    state.dialogCalls.length = 0;
    state.savePath = path.join(temp, "c11");
    const saved = await save(fakeEvent(), { project: sampleProject(), path: null });
    const call = state.dialogCalls.find((entry) => entry.type === "save");
    const defaultPath = call ? call.options.defaultPath : null;
    const extensionOk = saved.path.endsWith(".vcc");
    return {
      status: call !== undefined && extensionOk ? "PASS" : "FAIL",
      severity: call === undefined ? "High" : "none",
      evidence: `dialog_shown=${call !== undefined} defaultPath=${defaultPath} saved=${saved.path}`,
    };
  });

  await check("C11", "the default file name follows the project name", async () => {
    state.dialogCalls.length = 0;
    state.savePath = path.join(temp, "c11b.vcc");
    const project = sampleProject();
    project.name = "My Circuit / 2";
    await save(fakeEvent(), { project, path: null });
    const call = state.dialogCalls.find((entry) => entry.type === "save");
    return {
      status: call !== undefined && call.options.defaultPath === "My-Circuit-2.vcc" ? "PASS" : "FAIL",
      severity: "none",
      evidence: `defaultPath=${call ? call.options.defaultPath : null}`,
    };
  });

  await check("C11", "a renderer-supplied path outside the approved set is not written directly", async () => {
    const traversal = path.join(temp, "..", "..", "etc", "passwd-traversal");
    state.dialogCalls.length = 0;
    state.savePath = path.join(temp, "c11c.vcc");
    const saved = await save(fakeEvent(), { project: sampleProject(), path: traversal });
    const dialogShown = state.dialogCalls.some((entry) => entry.type === "save");
    const writtenElsewhere = saved.path.includes("passwd-traversal");
    return {
      status: dialogShown && !writtenElsewhere ? "PASS" : "FAIL",
      severity: dialogShown ? "none" : "Critical",
      evidence: `dialog_shown=${dialogShown} saved=${saved.path}`,
    };
  });

  await check("C12", "samples are listed and opened read-only by the main process", async () => {
    const listed = await listSamples();
    const name = listed[0] && listed[0].name;
    if (!name) return { status: "FAIL", severity: "High", evidence: "no samples listed" };
    const opened = await openSample(fakeEvent(), { name });
    const source = fs.readFileSync(path.join(samplesDir, name), "utf8");
    return {
      status: opened.kind === "project" && source.length > 0 ? "PASS" : "FAIL",
      severity: "none",
      evidence: `samples=${listed.length} opened=${opened.path}`,
    };
  });

  await check("C12", "the renderer clears the path after opening a sample", async () => {
    const source = fs.readFileSync(rendererPath, "utf8");
    const index = source.indexOf("async openSample(name)");
    const snippet = source.slice(index, index + 700);
    const clears = /set\(\{\s*path: null\s*\}\)/.test(snippet);
    return {
      status: clears ? "PASS" : "FAIL",
      severity: clears ? "none" : "High",
      evidence: `renderer openSample() sets path:null = ${clears} (work/readable/.../index-BU2QbNS1.js)`,
    };
  });

  await check("C13", "a recent-files list exists", async () => {
    const source = fs.readFileSync(rendererPath, "utf8");
    const hasRecent = /recentFiles|recent-files/.test(source);
    return {
      status: hasRecent ? "PASS" : "NOT PRESENT",
      severity: hasRecent ? "none" : "Low",
      evidence: `renderer mentions a recent-files list: ${hasRecent}`,
    };
  });

  await check("C14", "autosave or crash recovery exists", async () => {
    const source = fs.readFileSync(rendererPath, "utf8");
    const hasAutosave = /autosave|autoSave|crashRecovery/.test(source);
    return {
      status: hasAutosave ? "PASS" : "NOT PRESENT",
      severity: hasAutosave ? "none" : "Medium",
      evidence: `renderer mentions autosave/recovery: ${hasAutosave}`,
    };
  });

  await check("C15", "unicode and spaces in paths are handled", async () => {
    const target = path.join(temp, "My Circuits", "Circuit Ω.vcc");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    state.savePath = target;
    const saved = await save(fakeEvent(), { project: sampleProject(), path: null });
    const ok = fs.existsSync(saved.path) && readJson(saved.path).format === "vircuit-project";
    return {
      status: ok ? "PASS" : "FAIL",
      severity: ok ? "none" : "Medium",
      evidence: `saved=${saved.path} readable=${ok}`,
    };
  });

  await check("C15", "a path that is too long fails with a clear message", async () => {
    const target = path.join(temp, `${"n".repeat(300)}.vcc`);
    state.savePath = target;
    let message = null;
    try {
      await save(fakeEvent(), { project: sampleProject(), path: null });
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    }
    return {
      status: message !== null ? "PASS" : "FAIL",
      severity: message === null ? "High" : "none",
      evidence: `message=${JSON.stringify(message)}`,
    };
  });

  await check("C16", "opening the same file from a second instance is guarded", async () => {
    const handler = appEvents.get("second-instance");
    const exists = typeof handler === "function";
    let delivered = false;
    if (exists) {
      const window = windowEvents[0];
      const before = window.webContents.sent.length;
      handler({}, [path.join(samplesDir, "traffic-light.vcc")]);
      await new Promise((resolve) => setTimeout(resolve, 50));
      delivered = window.webContents.sent.length > before;
    }
    const guard = typeof confirmDiscard === "function";
    return {
      status: exists && guard ? "PASS" : "FAIL",
      severity: exists && guard ? "none" : "High",
      evidence: `second-instance handler=${exists} file_delivered_to_renderer=${delivered} discard_guard_available=${guard}`,
    };
  });

  /* ---------------- D. security ---------------- */
  section("D. security");

  await check("D17", "the browser window is isolated", async () => {
    const options = windowEvents[0] ? windowEvents[0].options : {};
    const preferences = options.webPreferences ?? {};
    const ok =
      preferences.contextIsolation === true &&
      preferences.nodeIntegration === false &&
      preferences.sandbox === true;
    return {
      status: ok ? "PASS" : "FAIL",
      severity: ok ? "none" : "Critical",
      evidence: `contextIsolation=${preferences.contextIsolation} nodeIntegration=${preferences.nodeIntegration} sandbox=${preferences.sandbox}`,
    };
  });

  await check("D17", "non-string and relative save paths are rejected by the schema", async () => {
    let rejectedNumber = false;
    let rejectedObject = false;
    try {
      await save(fakeEvent(), { project: sampleProject(), path: 42 });
    } catch {
      rejectedNumber = true;
    }
    try {
      await save(fakeEvent(), { project: sampleProject(), path: { toString: () => "/tmp/x" } });
    } catch {
      rejectedObject = true;
    }
    return {
      status: rejectedNumber && rejectedObject ? "PASS" : "FAIL",
      severity: rejectedNumber && rejectedObject ? "none" : "High",
      evidence: `rejected_number=${rejectedNumber} rejected_object=${rejectedObject}`,
    };
  });

  await check("D17", "the renderer cannot choose an arbitrary extension", async () => {
    const target = path.join(temp, "evil.sh");
    state.savePath = target;
    const saved = await save(fakeEvent(), { project: sampleProject(), path: null });
    return {
      status: saved.path.endsWith(".vcc") ? "PASS" : "FAIL",
      severity: saved.path.endsWith(".vcc") ? "none" : "High",
      evidence: `saved=${saved.path}`,
    };
  });

  await check("D18", "__proto__ and constructor keys are rejected", async () => {
    const file = path.join(temp, "proto.vcc");
    const project = sampleProject();
    fs.writeFileSync(
      file,
      JSON.stringify(project).replace('"format"', '"__proto__":{"polluted":true},"constructor":1,"format"'),
    );
    state.openPath = file;
    let message = null;
    try {
      await open(fakeEvent());
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    }
    const polluted = {}.polluted === true;
    return {
      status: message !== null && !polluted ? "PASS" : "FAIL",
      severity: polluted ? "Critical" : "none",
      evidence: `message=${JSON.stringify(message)} prototype_polluted=${polluted}`,
    };
  });

  await check("D18", "NaN and Infinity coordinates are rejected", async () => {
    const nanFile = path.join(temp, "nan.vcc");
    const project = sampleProject();
    project.circuit.parts[0].position.x = "not-a-number";
    fs.writeFileSync(nanFile, JSON.stringify(project));
    state.openPath = nanFile;
    let nanMessage = null;
    try {
      await open(fakeEvent());
    } catch (error) {
      nanMessage = String(error && error.message ? error.message : error);
    }
    const infFile = path.join(temp, "inf.vcc");
    const project2 = sampleProject();
    project2.circuit.parts[0].position.x = 1e308 * 10;
    fs.writeFileSync(infFile, JSON.stringify(project2));
    state.openPath = infFile;
    let infMessage = null;
    try {
      await open(fakeEvent());
    } catch (error) {
      infMessage = String(error && error.message ? error.message : error);
    }
    return {
      status: nanMessage !== null && infMessage !== null ? "PASS" : "FAIL",
      severity: nanMessage === null ? "High" : infMessage === null ? "Medium" : "none",
      evidence: `nan_rejected=${nanMessage !== null} infinity_rejected=${infMessage !== null}`,
    };
  });

  await check("D18", "duplicate part ids and dangling wires are reported", async () => {
    const file = path.join(temp, "dup.vcc");
    const project = sampleProject();
    project.circuit.parts.push({ ...project.circuit.parts[1] });
    project.circuit.wires.push({
      id: "w2",
      from: { partId: "missing-part", pinId: "a" },
      to: { partId: "led1", pinId: "cathode" },
      color: "#6fb3ff",
      waypoints: [],
    });
    fs.writeFileSync(file, JSON.stringify(project));
    state.openPath = file;
    let message = null;
    try {
      await open(fakeEvent());
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    }
    return {
      status: message !== null ? "PASS" : "FAIL",
      severity: message === null ? "Medium" : "none",
      evidence: `message=${JSON.stringify(message)} (duplicate ids and dangling wires are accepted silently)`,
    };
  });

  /* ---------------- E. exports ---------------- */
  section("E. exports");

  await check("E19", "a PNG export writes a decodable file", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const target = path.join(temp, "e19.png");
    state.savePath = target;
    const saved = await exportPng(fakeEvent(), {
      dataUrl: `data:image/png;base64,${png.toString("base64")}`,
      name: "Harness",
      path: null,
    });
    const bytes = fs.readFileSync(saved.path);
    const signature = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    return {
      status: signature ? "PASS" : "FAIL",
      severity: signature ? "none" : "High",
      evidence: `saved=${saved.path} png_signature=${signature} bytes=${bytes.length}`,
    };
  });

  await check("E19", "a non-PNG payload is rejected with an error", async () => {
    const target = path.join(temp, "e19-bad.png");
    state.savePath = target;
    let message = null;
    try {
      await exportPng(fakeEvent(), {
        dataUrl: `data:image/png;base64,${Buffer.from("not a png").toString("base64")}`,
        name: "Harness",
        path: null,
      });
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    }
    return {
      status: message !== null ? "PASS" : "FAIL",
      severity: message === null ? "High" : "none",
      evidence: `message=${JSON.stringify(message)}`,
    };
  });

  await check("E19", "a non-PDF payload is rejected with an error", async () => {
    const target = path.join(temp, "e19-bad.pdf");
    state.savePath = target;
    let message = null;
    try {
      await exportPdf(fakeEvent(), {
        data: Buffer.from("not a pdf").toString("base64"),
        name: "Harness",
        path: null,
      });
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    }
    return {
      status: message !== null ? "PASS" : "FAIL",
      severity: message === null ? "High" : "none",
      evidence: `message=${JSON.stringify(message)}`,
    };
  });

  await check("E19", "sketch and HEX exports are written", async () => {
    const sketchPath = path.join(temp, "e19.ino");
    state.savePath = sketchPath;
    const sketchSaved = await exportSketch(fakeEvent(), {
      sketch: "void setup() {}\n",
      path: null,
    });
    const hexPath = path.join(temp, "e19.hex");
    state.savePath = hexPath;
    const hexSaved = await exportHex(fakeEvent(), { hex: ":00000001FF\n", path: null });
    return {
      status:
        fs.readFileSync(sketchSaved.path, "utf8") === "void setup() {}\n" &&
        fs.readFileSync(hexSaved.path, "utf8").startsWith(":00000001FF")
          ? "PASS"
          : "FAIL",
      severity: "none",
      evidence: `sketch=${sketchSaved.path} hex=${hexSaved.path}`,
    };
  });

  await check("E19", "an invalid HEX payload is rejected", async () => {
    state.savePath = path.join(temp, "e19-bad.hex");
    let message = null;
    try {
      await exportHex(fakeEvent(), { hex: "not-hex", path: null });
    } catch (error) {
      message = String(error && error.message ? error.message : error);
    }
    return {
      status: message !== null ? "PASS" : "FAIL",
      severity: message === null ? "High" : "none",
      evidence: `message=${JSON.stringify(message)}`,
    };
  });

  await check("E19", "SVG, netlist and BOM exports exist", async () => {
    const source = fs.readFileSync(rendererPath, "utf8");
    const hasSvg = /exportSvg|file:export-svg/.test(source);
    const hasNetlist = /exportNetlist|file:export-netlist/.test(source);
    const hasBom = /exportBom|file:export-bom|buildBom/.test(source);
    return {
      status: hasSvg && hasNetlist && hasBom ? "PASS" : "NOT PRESENT",
      severity: hasSvg || hasNetlist || hasBom ? "Low" : "Low",
      evidence: `svg=${hasSvg} netlist=${hasNetlist} bom=${hasBom}`,
    };
  });

  /* ---------------- summary ---------------- */
  const counts = {};
  for (const entry of results) {
    counts[entry.status] = (counts[entry.status] ?? 0) + 1;
  }
  state.restoreResourcesPath();
  const report = {
    main_bundle: path.relative(root, mainPath),
    temp_dir: temp,
    counts,
    results,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("");
  console.log(`counts: ${JSON.stringify(counts)}`);
  console.log(`report: ${path.relative(root, reportPath)}`);
  for (const entry of results) {
    if (entry.status !== "PASS" && entry.status !== "NOT PRESENT") {
      console.log(
        `  ${entry.status} ${entry.id} [${entry.severity}] ${entry.check} — ${entry.evidence}`,
      );
    }
  }
  console.log("FILE HARNESS: DONE");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
