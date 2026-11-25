"use strict";

/**
 * Checks the parts library of a running app build:
 *
 *  - the library opens on "All parts" and no longer offers a "Basic" section,
 *  - the jumper wire is no longer offered in the library,
 *  - the category sections still narrow the list down,
 *  - a project that still contains a jumper wire can be written to disk.
 *
 * Usage:
 *   node scripts/library-sections-check.js [--app out/app-library-sections.asar] [--port <cdp port>]
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const electronBinary = path.join(root, "node_modules", "electron", "dist", "electron");

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findPage(port) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      const page = pages.find((entry) => entry.type === "page");
      if (page) return page;
    } catch {
    }
    await sleep(200);
  }
  throw new Error("no renderer page appeared");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const exceptions = [];
    let requestId = 0;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") {
        exceptions.push(
          String(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text).slice(0, 400),
        );
      }
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    };
    socket.onopen = () =>
      resolve({
        exceptions,
        close: () => socket.close(),
        send(method, params = {}) {
          return new Promise((resolveCall) => {
            const id = ++requestId;
            pending.set(id, resolveCall);
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
      });
    socket.onerror = () => reject(new Error("cdp socket error"));
  });
}

const jumperProject = {
  format: "vircuit-project",
  version: 2,
  metadata: { created_at: "2026-01-01T00:00:00.000Z", app_version: "0.5.0-beta.3" },
  viewport: { scale: 1, offsetX: 0, offsetY: 0 },
  circuit: {
    version: 1,
    parts: [
      { id: "jumper-1", type: "jumper-wire", position: { x: 0, y: 0 }, rotation: 0, props: {} },
    ],
    wires: [],
  },
  sketch: "void setup() {}\nvoid loop() {}\n",
};

async function findInspector(port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const target = targets.find((entry) => entry.webSocketDebuggerUrl);
      if (target) return target;
    } catch {
    }
    await sleep(200);
  }
  throw new Error("no main process inspector appeared");
}

async function main() {
  const port = Number(arg("port", "9357"));
  const inspectorPort = port + 100;
  const appPath = resolveInput(arg("app", "out/app-library-sections.asar"));
  const reportPath = resolveInput(arg("report", "reports/library-sections-check.json"));

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-library-sections-check-"));
  const child = spawn(
    electronBinary,
    [
      appPath,
      `--remote-debugging-port=${port}`,
      `--inspect=${inspectorPort}`,
      `--user-data-dir=${userDataDir}`,
      "--no-sandbox",
    ],
    { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  let client = null;
  let inspector = null;
  try {
    const page = await findPage(port);
    client = await connect(page.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    const evaluate = async (expression) => {
      const response = await client.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (response.result?.exceptionDetails) {
        throw new Error(String(response.result.exceptionDetails.text).slice(0, 300));
      }
      return response.result?.result?.value;
    };

    const savePath = path.join(userDataDir, "jumper-project.vcc");
    const inspectorTarget = await findInspector(inspectorPort);
    inspector = await connect(inspectorTarget.webSocketDebuggerUrl);
    await inspector.send("Runtime.enable");
    const inspectorEvaluate = async (expression) => {
      const response = await inspector.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (response.result?.exceptionDetails) {
        throw new Error(String(response.result.exceptionDetails.text).slice(0, 300));
      }
      return response.result?.result?.value;
    };
    const dialogStubbed = await inspectorEvaluate(
      `(() => {
        const electron = process.mainModule.require("electron");
        electron.dialog.showSaveDialog = async () => ({ canceled: false, filePath: ${JSON.stringify(savePath)} });
        return typeof electron.dialog.showSaveDialog;
      })()`,
    );

    await sleep(3000);
    await evaluate(
      `(() => { const button = [...document.querySelectorAll("button")].find((entry) => entry.innerText.includes("already know")); if (button) button.click(); return true; })()`,
    );
    await sleep(1200);

    const selectState = JSON.parse(
      await evaluate(`(() => {
        const select = document.querySelector('[data-testid="parts-section"]');
        if (select === null) return JSON.stringify({ found: false });
        return JSON.stringify({
          found: true,
          value: select.value,
          options: [...select.options].map((option) => ({ value: option.value, label: option.textContent.trim() })),
        });
      })()`),
    );

    const defaultView = JSON.parse(
      await evaluate(`(() => {
        const cards = [...document.querySelectorAll(".cb-part-card")].map((card) => card.getAttribute("data-part-type"));
        const groups = [...document.querySelectorAll(".cb-part-group-title")].map((title) => title.textContent.trim());
        return JSON.stringify({ cards, groups });
      })()`),
    );

    const boardsView = JSON.parse(
      await evaluate(`(() => {
        const select = document.querySelector('[data-testid="parts-section"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
        setter.call(select, "boards");
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return JSON.stringify({ selected: select.value });
      })()`),
    );
    await sleep(800);
    const boardsCards = JSON.parse(
      await evaluate(
        `JSON.stringify([...document.querySelectorAll(".cb-part-card")].map((card) => card.getAttribute("data-part-type")))`,
      ),
    );

    const saveResult = JSON.parse(
      await evaluate(`(async () => {
        try {
          const saved = await window.api.saveProject({ project: ${JSON.stringify(jumperProject)}, path: ${JSON.stringify(savePath)} });
          return JSON.stringify({ ok: true, saved });
        } catch (error) {
          return JSON.stringify({ ok: false, message: String(error && error.message ? error.message : error).slice(0, 300) });
        }
      })()`),
    );
    const savedFile = fs.existsSync(savePath);
    const savedText = savedFile ? fs.readFileSync(savePath, "utf8") : "";

    const checks = {
      section_select_found: selectState.found === true,
      all_section_is_default: selectState.value === "all",
      basic_section_removed: selectState.options.every((option) => option.value !== "basic"),
      section_options_kept: ["all", "boards", "outputs", "inputs", "passives"].every(
        (value) => selectState.options.some((option) => option.value === value),
      ),
      library_shows_twelve_cards: defaultView.cards.length === 12,
      jumper_wire_not_offered: !defaultView.cards.includes("jumper-wire"),
      library_groups_shown: defaultView.groups.length === 4,
      boards_section_narrows: boardsView.selected === "boards" && boardsCards.length < 12 && boardsCards.includes("arduino-uno"),
      save_dialog_stubbed: dialogStubbed === "function",
      jumper_project_saves: saveResult.ok === true && savedFile === true,
      jumper_project_keeps_part: savedText.includes("jumper-wire"),
      no_runtime_exceptions: client.exceptions.length === 0,
    };

    const report = {
      app: path.relative(root, appPath).split(path.sep).join("/"),
      select: selectState,
      default_view: defaultView,
      boards_view: { ...boardsView, cards: boardsCards },
      save: { ...saveResult, saved_file: savedFile, saved_bytes: savedText.length },
      checks,
      runtimeExceptions: client.exceptions,
    };
    report.pass = Object.values(report.checks).every((value) => value === true);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    console.log(`section_value=${selectState.value}`);
    console.log(`section_options=${selectState.options.map((option) => option.value).join(",")}`);
    console.log(`default_cards=${defaultView.cards.length}`);
    console.log(`default_groups=${defaultView.groups.join(",")}`);
    console.log(`boards_cards=${boardsCards.join(",")}`);
    console.log(`jumper_project_saved=${Number(savedFile)}`);
    console.log(`runtime_exceptions=${client.exceptions.length}`);
    for (const [name, value] of Object.entries(checks)) {
      console.log(`${name}=${Number(value)}`);
    }
    console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
    console.log(report.pass ? "LIBRARY SECTIONS CHECK: PASS" : "LIBRARY SECTIONS CHECK: FAIL");
    if (!report.pass) process.exitCode = 1;
  } finally {
    if (client !== null) client.close();
    if (inspector !== null) inspector.close();
    child.kill("SIGTERM");
    await sleep(800);
    if (!child.killed) child.kill("SIGKILL");
    await sleep(300);
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode ?? 0), 200).unref();
});
